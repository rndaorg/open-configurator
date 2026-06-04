import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const InputSchema = z.object({
  configurationId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
  customerEmail: z.string().email().max(255).optional(),
  customerName: z.string().max(255).optional(),
  notes: z.string().max(2000).optional(),
});

async function requireAdmin(req: Request, supabase: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return null;
  const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  return isAdmin ? user : null;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const admin = await requireAdmin(req, supabase);
    if (!admin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { configurationId, orderId, productId, customerEmail, customerName, notes } = parsed.data;

    // Load configuration context
    let configData: any = null;
    let totalPrice = 0;
    let resolvedProductId = productId;
    let resolvedEmail = customerEmail;
    let resolvedName = customerName;

    if (orderId) {
      const { data: order } = await supabase
        .from("orders")
        .select("id, configuration_data, total_price, product_id, user_id, status")
        .eq("id", orderId).maybeSingle();
      if (order) {
        configData = order.configuration_data;
        totalPrice = Number(order.total_price || 0);
        resolvedProductId = resolvedProductId || order.product_id || undefined;
        if (order.user_id) {
          const { data: prof } = await supabase.from("profiles").select("email, full_name").eq("id", order.user_id).maybeSingle();
          resolvedEmail = resolvedEmail || prof?.email;
          resolvedName = resolvedName || prof?.full_name;
        }
      }
    } else if (configurationId) {
      const { data: cfg } = await supabase
        .from("product_configurations")
        .select("id, configuration_data, total_price, product_id, user_id")
        .eq("id", configurationId).maybeSingle();
      if (cfg) {
        configData = cfg.configuration_data;
        totalPrice = Number(cfg.total_price || 0);
        resolvedProductId = resolvedProductId || cfg.product_id || undefined;
        if (cfg.user_id) {
          const { data: prof } = await supabase.from("profiles").select("email, full_name").eq("id", cfg.user_id).maybeSingle();
          resolvedEmail = resolvedEmail || prof?.email;
          resolvedName = resolvedName || prof?.full_name;
        }
      }
    }

    // Product + catalog context
    let product: any = null;
    let catalog: any[] = [];
    if (resolvedProductId) {
      const { data: prod } = await supabase.from("products").select("id, name, description, base_price, category_id").eq("id", resolvedProductId).maybeSingle();
      product = prod;
      const { data: opts } = await supabase
        .from("config_options")
        .select("id, name, option_type, option_values(id, name, price_modifier, is_available)")
        .eq("product_id", resolvedProductId);
      catalog = opts || [];
    }

    // Analytics signals: top abandonment + popular options
    const { data: analytics } = await supabase
      .from("configuration_analytics")
      .select("configuration_data, completion_rate, abandonment_point")
      .eq("product_id", resolvedProductId || "")
      .order("created_at", { ascending: false })
      .limit(50);

    // Other products for cross-sell
    const { data: otherProducts } = await supabase
      .from("products")
      .select("id, name, base_price, category_id")
      .eq("is_active", true)
      .neq("id", resolvedProductId || "00000000-0000-0000-0000-000000000000")
      .limit(8);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are a B2B Sales Copilot for internal sales staff at Open Configurator.
You analyze a customer's product configuration and produce three deliverables:
1) Upsell & cross-sell recommendations (specific, justified, with rough revenue uplift estimates).
2) A polished quote proposal (markdown, ready to paste into a quote document).
3) A friendly, concise follow-up email draft (subject + body, addressed to the customer).

Be concrete. Reference actual option names and prices. Avoid generic fluff.
Return ONLY valid JSON matching the requested schema.`;

    const userPrompt = `## Customer
Name: ${resolvedName || "Unknown"}
Email: ${resolvedEmail || "Unknown"}
Internal staff notes: ${notes || "(none)"}

## Product
${product ? JSON.stringify(product) : "(no product context)"}

## Current Configuration (total: $${totalPrice.toFixed(2)})
${JSON.stringify(configData, null, 2)}

## Available Options (catalog)
${JSON.stringify(catalog).slice(0, 6000)}

## Cross-sell Candidate Products
${JSON.stringify(otherProducts || [])}

## Configuration Analytics Signals (recent 50)
- Avg completion rate: ${analytics && analytics.length ? (analytics.reduce((s: number, a: any) => s + Number(a.completion_rate || 0), 0) / analytics.length).toFixed(2) : "n/a"}
- Common abandonment points: ${JSON.stringify([...new Set((analytics || []).map((a: any) => a.abandonment_point).filter(Boolean))].slice(0, 5))}

Return JSON with this exact shape:
{
  "summary": "2-3 sentence executive summary of this opportunity",
  "deal_health": "hot" | "warm" | "cold",
  "estimated_close_probability": 0-100,
  "upsells": [{ "option_name": string, "reason": string, "estimated_uplift_usd": number }],
  "cross_sells": [{ "product_name": string, "reason": string, "estimated_value_usd": number }],
  "risks": [string],
  "quote_proposal_markdown": string,
  "followup_email": { "subject": string, "body": string },
  "next_actions": [string]
}`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      throw new Error(`AI gateway error ${aiRes.status}: ${errText}`);
    }

    const aiJson = await aiRes.json();
    let copilot: any = {};
    try {
      copilot = JSON.parse(aiJson.choices?.[0]?.message?.content || "{}");
    } catch {
      copilot = { raw: aiJson.choices?.[0]?.message?.content };
    }

    return new Response(JSON.stringify({
      success: true,
      context: {
        product: product?.name,
        customerEmail: resolvedEmail,
        customerName: resolvedName,
        totalPrice,
      },
      copilot,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("sales-copilot error:", err);
    return new Response(JSON.stringify({ error: "Failed to generate sales insights" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
