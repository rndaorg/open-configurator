import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-agent-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

const admin = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } },
);

function json(body: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', ...extra },
  });
}

async function sha256(input: string) {
  const bytes = new TextEncoder().encode(input);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(secret: string, payload: string) {
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

const ValidateSchema = z.object({
  productId: z.string().uuid(),
  selectedOptions: z.record(z.string().uuid(), z.string().uuid()),
  quantity: z.number().int().min(1).max(10000).default(1),
});

const OrderSchema = ValidateSchema.extend({
  userId: z.string().uuid().optional(),
  shippingAddress: z.record(z.string(), z.unknown()).optional(),
  shippingMethod: z.string().max(120).optional(),
  callbackUrl: z.string().url().optional(),
});

function evaluateConditions(conditions: any, options: Record<string, string>): boolean {
  if (!conditions || typeof conditions !== 'object') return true;
  if (conditions.selectedOptions) {
    for (const [k, v] of Object.entries(conditions.selectedOptions)) {
      if (options[k] !== v) return false;
    }
  }
  return true;
}

function validateRules(rules: any[], options: Record<string, string>): string[] {
  const violations: string[] = [];
  for (const rule of rules) {
    if (!evaluateConditions(rule.conditions, options)) continue;
    if (rule.rule_type === 'dependency' && rule.actions?.required_option && !options[rule.actions.required_option]) {
      violations.push(`${rule.rule_name}: required option missing`);
    }
    if (rule.rule_type === 'restriction' && Array.isArray(rule.actions?.restricted_options)) {
      for (const optionId of rule.actions.restricted_options) {
        if (options[optionId]) violations.push(`${rule.rule_name}: invalid option combination`);
      }
    }
  }
  return violations;
}

async function priceConfiguration(productId: string, options: Record<string, string>, quantity: number) {
  const [{ data: product }, { data: pricingRules }, { data: values }] = await Promise.all([
    admin.from('products').select('id, name, base_price').eq('id', productId).maybeSingle(),
    admin.from('pricing_rules').select('*').eq('product_id', productId).eq('is_active', true),
    admin.from('option_values').select('id, value, price_modifier').in('id', Object.values(options)),
  ]);
  if (!product) return { error: 'Product not found' as const };

  let unit = Number(product.base_price);
  const modifiers = (values ?? []).reduce((sum, v: any) => sum + Number(v.price_modifier ?? 0), 0);
  unit += modifiers;

  const applied: string[] = [];
  const now = new Date();
  for (const rule of pricingRules ?? []) {
    if (!evaluateConditions(rule.conditions, options)) continue;
    if (quantity < (rule.min_quantity ?? 1)) continue;
    if (rule.valid_from && new Date(rule.valid_from) > now) continue;
    if (rule.valid_until && new Date(rule.valid_until) < now) continue;
    if (rule.discount_type === 'percentage') {
      unit -= unit * (Number(rule.discount_value) / 100);
      applied.push(`${rule.rule_name ?? 'Discount'} (${rule.discount_value}%)`);
    } else if (rule.discount_type === 'fixed') {
      unit -= Number(rule.discount_value);
      applied.push(`${rule.rule_name ?? 'Discount'} (-${rule.discount_value})`);
    }
  }
  const unitPrice = Math.max(0, Math.round(unit * 100) / 100);
  return {
    product: { id: product.id, name: product.name, basePrice: Number(product.base_price) },
    optionModifiers: Math.round(modifiers * 100) / 100,
    unitPrice,
    quantity,
    total: Math.round(unitPrice * quantity * 100) / 100,
    appliedDiscounts: applied,
  };
}

async function dispatchWebhooks(agentId: string, event: string, payload: unknown, extraUrl?: string) {
  const { data: hooks } = await admin
    .from('api_agent_webhooks')
    .select('*')
    .eq('agent_id', agentId)
    .eq('is_active', true);

  const targets = [
    ...(hooks ?? []).filter((h: any) => (h.events ?? []).includes(event)),
    ...(extraUrl ? [{ id: null, url: extraUrl, signing_secret: '' }] : []),
  ];

  await Promise.all(targets.map(async (hook: any) => {
    const body = JSON.stringify({ event, data: payload, timestamp: new Date().toISOString() });
    let responseStatus: number | null = null;
    let responseBody = '';
    let status = 'failed';
    try {
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (hook.signing_secret) headers['X-Agent-Signature'] = await hmac(hook.signing_secret, body);
      const res = await fetch(hook.url, { method: 'POST', headers, body });
      responseStatus = res.status;
      responseBody = (await res.text()).slice(0, 500);
      status = res.ok ? 'delivered' : 'failed';
    } catch (e) {
      responseBody = String(e).slice(0, 500);
    }
    if (hook.id) {
      await admin.from('api_agent_webhook_deliveries').insert({
        webhook_id: hook.id,
        agent_id: agentId,
        event,
        payload: payload as any,
        status,
        response_status: responseStatus,
        response_body: responseBody,
        attempts: 1,
      });
    }
  }));
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const started = Date.now();
  const url = new URL(req.url);
  const path = url.pathname.replace(/^.*\/agent-api/, '').replace(/\/+$/, '') || '/';
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? null;

  // Public discovery endpoint — no token required.
  if (path === '/' || path === '/openapi') {
    return json({
      name: 'Open Configurator Agent API',
      version: '1.0.0',
      auth: 'Bearer <agent token> or X-Agent-Token header',
      endpoints: [
        { method: 'GET', path: '/products', scope: 'products:read', description: 'List active products' },
        { method: 'GET', path: '/products/{id}', scope: 'products:read', description: 'Product with options, values and rules' },
        { method: 'POST', path: '/configurations/validate', scope: 'configurations:validate', description: 'Validate selections against rules and stock' },
        { method: 'POST', path: '/pricing/quote', scope: 'pricing:read', description: 'Server-side price calculation' },
        { method: 'POST', path: '/orders', scope: 'orders:write', description: 'Submit an order; fires webhook callbacks' },
        { method: 'GET', path: '/orders/{id}', scope: 'orders:read', description: 'Order status' },
        { method: 'GET', path: '/usage', scope: '*', description: 'Rate limit and usage for the calling agent' },
      ],
    });
  }

  // --- Authentication ---
  const raw = req.headers.get('x-agent-token') ?? (req.headers.get('authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!raw || !raw.startsWith('oc_agent_')) {
    return json({ error: 'Missing or malformed agent token' }, 401);
  }
  const tokenHash = await sha256(raw);
  const { data: token } = await admin
    .from('api_agent_tokens')
    .select('id, agent_id, expires_at, revoked_at')
    .eq('token_hash', tokenHash)
    .maybeSingle();

  if (!token || token.revoked_at || (token.expires_at && new Date(token.expires_at) < new Date())) {
    return json({ error: 'Invalid, expired or revoked agent token' }, 401);
  }

  const { data: agent } = await admin
    .from('api_agents').select('*').eq('id', token.agent_id).maybeSingle();
  if (!agent || !agent.is_active) return json({ error: 'Agent disabled' }, 403);

  const log = async (status: number, error?: string) => {
    await admin.from('api_agent_requests').insert({
      agent_id: agent.id,
      token_id: token.id,
      endpoint: path,
      method: req.method,
      status_code: status,
      duration_ms: Date.now() - started,
      ip_address: ip,
      error: error ?? null,
    });
  };

  // --- Rate limiting (sliding 60s window) ---
  const windowStart = new Date(Date.now() - 60_000).toISOString();
  const { count } = await admin
    .from('api_agent_requests')
    .select('id', { count: 'exact', head: true })
    .eq('agent_id', agent.id)
    .gte('created_at', windowStart);

  const limit = agent.rate_limit_per_minute ?? 60;
  const used = count ?? 0;
  const rateHeaders = {
    'X-RateLimit-Limit': String(limit),
    'X-RateLimit-Remaining': String(Math.max(0, limit - used - 1)),
  };
  if (used >= limit) {
    await log(429, 'rate limit exceeded');
    return json({ error: 'Rate limit exceeded', limit, windowSeconds: 60 }, 429, { ...rateHeaders, 'Retry-After': '60' });
  }

  const hasScope = (scope: string) => (agent.scopes ?? []).includes(scope) || (agent.scopes ?? []).includes('*');
  const deny = async (scope: string) => {
    await log(403, `missing scope ${scope}`);
    return json({ error: `Agent token lacks required scope: ${scope}` }, 403, rateHeaders);
  };

  try {
    admin.from('api_agents').update({ last_used_at: new Date().toISOString() }).eq('id', agent.id).then(() => {});
    admin.from('api_agent_tokens').update({ last_used_at: new Date().toISOString() }).eq('id', token.id).then(() => {});

    // GET /usage
    if (path === '/usage' && req.method === 'GET') {
      await log(200);
      return json({ agent: { id: agent.id, name: agent.name, scopes: agent.scopes }, rateLimit: { limit, usedLastMinute: used } }, 200, rateHeaders);
    }

    // GET /products
    if (path === '/products' && req.method === 'GET') {
      if (!hasScope('products:read')) return await deny('products:read');
      const limitParam = Math.min(parseInt(url.searchParams.get('limit') ?? '50'), 200);
      const { data, error } = await admin
        .from('products')
        .select('id, name, description, base_price, image_url, category_id')
        .eq('is_active', true)
        .limit(limitParam);
      if (error) throw error;
      await log(200);
      return json({ products: data }, 200, rateHeaders);
    }

    // GET /products/{id}
    const productMatch = path.match(/^\/products\/([0-9a-f-]{36})$/i);
    if (productMatch && req.method === 'GET') {
      if (!hasScope('products:read')) return await deny('products:read');
      const productId = productMatch[1];
      const [{ data: product }, { data: options }, { data: rules }] = await Promise.all([
        admin.from('products').select('*').eq('id', productId).eq('is_active', true).maybeSingle(),
        admin.from('config_options').select('*, option_values(*)').eq('product_id', productId),
        admin.from('configuration_rules').select('id, rule_name, rule_type, conditions, actions, priority').eq('product_id', productId).eq('is_active', true),
      ]);
      if (!product) { await log(404); return json({ error: 'Product not found' }, 404, rateHeaders); }
      await log(200);
      return json({ product, options: options ?? [], rules: rules ?? [] }, 200, rateHeaders);
    }

    // POST /configurations/validate
    if (path === '/configurations/validate' && req.method === 'POST') {
      if (!hasScope('configurations:validate')) return await deny('configurations:validate');
      const parsed = ValidateSchema.safeParse(await req.json());
      if (!parsed.success) { await log(400); return json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }, 400, rateHeaders); }
      const { productId, selectedOptions, quantity } = parsed.data;

      const { data: rules } = await admin.from('configuration_rules')
        .select('*').eq('product_id', productId).eq('is_active', true).order('priority', { ascending: false });
      const violations = validateRules(rules ?? [], selectedOptions);

      const stockIssues: string[] = [];
      const { data: levels } = await admin.from('inventory_levels')
        .select('option_value_id, available_quantity, reserved_quantity')
        .in('option_value_id', Object.values(selectedOptions));
      for (const lvl of levels ?? []) {
        if ((lvl.available_quantity ?? 0) - (lvl.reserved_quantity ?? 0) < quantity) {
          stockIssues.push(`Insufficient stock for option value ${lvl.option_value_id}`);
        }
      }

      const pricing = await priceConfiguration(productId, selectedOptions, quantity);
      await log(200);
      return json({ valid: violations.length === 0 && stockIssues.length === 0, violations, stockIssues, pricing }, 200, rateHeaders);
    }

    // POST /pricing/quote
    if (path === '/pricing/quote' && req.method === 'POST') {
      if (!hasScope('pricing:read')) return await deny('pricing:read');
      const parsed = ValidateSchema.safeParse(await req.json());
      if (!parsed.success) { await log(400); return json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }, 400, rateHeaders); }
      const pricing = await priceConfiguration(parsed.data.productId, parsed.data.selectedOptions, parsed.data.quantity);
      if ((pricing as any).error) { await log(404); return json(pricing, 404, rateHeaders); }
      await log(200);
      return json(pricing, 200, rateHeaders);
    }

    // POST /orders
    if (path === '/orders' && req.method === 'POST') {
      if (!hasScope('orders:write')) return await deny('orders:write');
      const parsed = OrderSchema.safeParse(await req.json());
      if (!parsed.success) { await log(400); return json({ error: 'Invalid input', details: parsed.error.flatten().fieldErrors }, 400, rateHeaders); }
      const { productId, selectedOptions, quantity, userId, shippingAddress, shippingMethod, callbackUrl } = parsed.data;

      const { data: rules } = await admin.from('configuration_rules')
        .select('*').eq('product_id', productId).eq('is_active', true);
      const violations = validateRules(rules ?? [], selectedOptions);
      if (violations.length) { await log(422, 'rule violations'); return json({ error: 'Configuration invalid', violations }, 422, rateHeaders); }

      const pricing: any = await priceConfiguration(productId, selectedOptions, quantity);
      if (pricing.error) { await log(404); return json(pricing, 404, rateHeaders); }

      const ownerId = userId ?? agent.owner_user_id;
      if (!ownerId) { await log(400, 'no user'); return json({ error: 'userId is required (agent has no owner to attribute the order to)' }, 400, rateHeaders); }

      const { data: order, error } = await admin.from('orders').insert({
        user_id: ownerId,
        product_id: productId,
        quantity,
        configuration_data: selectedOptions as any,
        total_price: pricing.total,
        status: 'pending',
        payment_status: 'pending',
        shipping_address: (shippingAddress ?? null) as any,
        shipping_method: shippingMethod ?? null,
      }).select().single();
      if (error) throw error;

      // Async webhook callbacks — do not block the response.
      const payload = { orderId: order.id, agentId: agent.id, status: order.status, total: pricing.total, quantity, productId, selectedOptions };
      // deno-lint-ignore no-explicit-any
      (globalThis as any).EdgeRuntime?.waitUntil?.(dispatchWebhooks(agent.id, 'order.created', payload, callbackUrl))
        ?? dispatchWebhooks(agent.id, 'order.created', payload, callbackUrl);

      await log(201);
      return json({ order: { id: order.id, status: order.status, total: order.total_price }, pricing }, 201, rateHeaders);
    }

    // GET /orders/{id}
    const orderMatch = path.match(/^\/orders\/([0-9a-f-]{36})$/i);
    if (orderMatch && req.method === 'GET') {
      if (!hasScope('orders:read') && !hasScope('orders:write')) return await deny('orders:read');
      const { data: order } = await admin.from('orders')
        .select('id, status, payment_status, total_price, quantity, product_id, created_at')
        .eq('id', orderMatch[1]).maybeSingle();
      if (!order) { await log(404); return json({ error: 'Order not found' }, 404, rateHeaders); }
      await log(200);
      return json({ order }, 200, rateHeaders);
    }

    await log(404, 'unknown endpoint');
    return json({ error: `Unknown endpoint ${req.method} ${path}` }, 404, rateHeaders);
  } catch (e) {
    console.error('agent-api error', e);
    await log(500, String(e).slice(0, 300));
    return json({ error: 'Internal error processing agent request' }, 500, rateHeaders);
  }
});
