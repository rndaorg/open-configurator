// Multi-Agent Orchestration Layer
// Master agent delegates to specialized sub-agents via Lovable AI tool calling.
// Sub-agents: customer (configuration), pricing, inventory, rules.
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RequestSchema = z.object({
  productId: z.string().uuid(),
  message: z.string().min(1).max(2000),
  currentSelections: z.record(z.string(), z.string()).optional(),
  quantity: z.number().int().min(1).max(1000).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      }),
    )
    .max(20)
    .optional(),
});

const MODEL = "google/gemini-3-flash-preview";
const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";

type AgentTrace = {
  agent: string;
  input: unknown;
  output: unknown;
  ms: number;
};

// ---------- Sub-agent implementations ----------

async function customerAgent(
  apiKey: string,
  ctx: { product: any; message: string; selections: Record<string, string> },
): Promise<{ selections: Record<string, string>; rationale: string }> {
  const catalog = (ctx.product.config_options || []).map((o: any) => ({
    option_id: o.id,
    name: o.name,
    required: o.is_required,
    values: (o.option_values || [])
      .filter((v: any) => v.is_available)
      .map((v: any) => ({
        value_id: v.id,
        name: v.name,
        price_modifier: Number(v.price_modifier ?? 0),
      })),
  }));

  const resp = await fetch(GATEWAY_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        {
          role: "system",
          content:
            `You are the Customer Agent. Map the customer's natural-language request to concrete option/value selections from the catalog. ONLY return value_ids present in catalog.\nCATALOG: ${JSON.stringify(catalog)}\nCURRENT: ${JSON.stringify(ctx.selections)}`,
        },
        { role: "user", content: ctx.message },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "set_selections",
            description: "Pick option/value pairs that satisfy the request.",
            parameters: {
              type: "object",
              properties: {
                selections: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      option_id: { type: "string" },
                      value_id: { type: "string" },
                    },
                    required: ["option_id", "value_id"],
                    additionalProperties: false,
                  },
                },
                rationale: { type: "string" },
              },
              required: ["selections", "rationale"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "set_selections" } },
    }),
  });
  const data = await resp.json();
  const args = JSON.parse(
    data?.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments ?? "{}",
  );
  const valid = new Map<string, Set<string>>();
  for (const o of catalog) {
    valid.set(o.option_id, new Set(o.values.map((v: any) => v.value_id)));
  }
  const selections: Record<string, string> = { ...ctx.selections };
  for (const s of args.selections ?? []) {
    if (valid.get(s.option_id)?.has(s.value_id)) {
      selections[s.option_id] = s.value_id;
    }
  }
  return { selections, rationale: args.rationale ?? "" };
}

function rulesAgent(
  rules: any[],
  selections: Record<string, string>,
): { violations: string[]; autoSelections: Record<string, string> } {
  const violations: string[] = [];
  const autoSelections: Record<string, string> = {};
  const evalCond = (cond: any) => {
    if (!cond || typeof cond !== "object") return true;
    if (cond.selectedOptions) {
      for (const [k, v] of Object.entries(cond.selectedOptions)) {
        if (selections[k] !== v) return false;
      }
    }
    return true;
  };
  for (const r of rules) {
    if (!evalCond(r.conditions)) continue;
    if (r.rule_type === "dependency") {
      const { required_option } = r.actions ?? {};
      if (required_option && !selections[required_option]) {
        violations.push(`${r.rule_name}: missing required option`);
      }
    } else if (r.rule_type === "restriction") {
      for (const opt of r.actions?.restricted_options ?? []) {
        if (selections[opt]) {
          violations.push(`${r.rule_name}: ${opt} not allowed`);
        }
      }
    } else if (r.rule_type === "auto_select") {
      const { auto_select_option, auto_select_value } = r.actions ?? {};
      if (auto_select_option && auto_select_value && !selections[auto_select_option]) {
        autoSelections[auto_select_option] = auto_select_value;
      }
    }
  }
  return { violations, autoSelections };
}

async function inventoryAgent(
  supabase: any,
  selections: Record<string, string>,
): Promise<{ inStock: boolean; issues: string[] }> {
  const issues: string[] = [];
  const valueIds = Object.values(selections);
  if (valueIds.length === 0) return { inStock: true, issues };
  const { data } = await supabase
    .from("inventory_levels")
    .select("option_value_id, available_quantity, reserved_quantity, low_stock_threshold")
    .in("option_value_id", valueIds);
  for (const vid of valueIds) {
    const inv = data?.find((r: any) => r.option_value_id === vid);
    if (!inv) continue;
    const avail = inv.available_quantity - inv.reserved_quantity;
    if (avail <= 0) issues.push(`Out of stock: ${vid}`);
    else if (avail <= inv.low_stock_threshold)
      issues.push(`Low stock (${avail}) for ${vid}`);
  }
  return { inStock: !issues.some((i) => i.startsWith("Out of stock")), issues };
}

async function pricingAgent(
  supabase: any,
  product: any,
  selections: Record<string, string>,
  quantity: number,
): Promise<{ basePrice: number; modifiers: number; discounts: number; total: number; applied: string[] }> {
  let modifiers = 0;
  const valueIds = Object.values(selections);
  if (valueIds.length) {
    const { data: vals } = await supabase
      .from("option_values")
      .select("id, price_modifier")
      .in("id", valueIds);
    for (const v of vals ?? []) modifiers += Number(v.price_modifier ?? 0);
  }
  const { data: pricingRules } = await supabase
    .from("pricing_rules")
    .select("*")
    .eq("product_id", product.id)
    .eq("is_active", true);

  const subtotal = (Number(product.base_price) + modifiers) * quantity;
  let price = subtotal;
  const applied: string[] = [];
  const now = new Date();
  for (const r of pricingRules ?? []) {
    if (quantity < (r.min_quantity || 1)) continue;
    if (r.valid_from && new Date(r.valid_from) > now) continue;
    if (r.valid_until && new Date(r.valid_until) < now) continue;
    if (r.conditions?.selectedOptions) {
      let match = true;
      for (const [k, v] of Object.entries(r.conditions.selectedOptions)) {
        if (selections[k] !== v) { match = false; break; }
      }
      if (!match) continue;
    }
    if (r.discount_type === "percentage") {
      const d = price * (Number(r.discount_value) / 100);
      price -= d;
      applied.push(`${r.rule_name ?? "Discount"}: -${d.toFixed(2)}`);
    } else if (r.discount_type === "fixed") {
      price -= Number(r.discount_value);
      applied.push(`${r.rule_name ?? "Discount"}: -${Number(r.discount_value).toFixed(2)}`);
    }
  }
  return {
    basePrice: Number(product.base_price),
    modifiers,
    discounts: subtotal - price,
    total: Math.max(0, price),
    applied,
  };
}

// ---------- Master orchestrator ----------

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) throw new Error("LOVABLE_API_KEY missing");

    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const { productId, message, currentSelections = {}, quantity = 1, history = [] } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } },
    );

    const [{ data: product, error: pErr }, { data: rules }] = await Promise.all([
      supabase
        .from("products")
        .select(
          "id, name, description, base_price, categories(name), config_options(id, name, option_type, is_required, option_values(id, name, price_modifier, is_available))",
        )
        .eq("id", productId)
        .single(),
      supabase
        .from("configuration_rules")
        .select("rule_name, rule_type, conditions, actions")
        .eq("product_id", productId)
        .eq("is_active", true),
    ]);
    if (pErr || !product) throw new Error("Product not found");

    const traces: AgentTrace[] = [];
    let workingSelections = { ...currentSelections };

    // Master agent decides which sub-agents to invoke via tool calling
    const tools = [
      {
        type: "function",
        function: {
          name: "call_customer_agent",
          description: "Map natural-language request to option/value selections.",
          parameters: {
            type: "object",
            properties: { instruction: { type: "string" } },
            required: ["instruction"],
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "call_rules_agent",
          description: "Validate current selections against configuration rules.",
          parameters: { type: "object", properties: {}, additionalProperties: false },
        },
      },
      {
        type: "function",
        function: {
          name: "call_inventory_agent",
          description: "Check stock availability for current selections.",
          parameters: { type: "object", properties: {}, additionalProperties: false },
        },
      },
      {
        type: "function",
        function: {
          name: "call_pricing_agent",
          description: "Compute price with discounts for current selections.",
          parameters: {
            type: "object",
            properties: { quantity: { type: "number" } },
            additionalProperties: false,
          },
        },
      },
      {
        type: "function",
        function: {
          name: "finalize",
          description: "Return the final answer to the user.",
          parameters: {
            type: "object",
            properties: {
              reply: { type: "string" },
              summary: { type: "string" },
            },
            required: ["reply"],
            additionalProperties: false,
          },
        },
      },
    ];

    const systemPrompt = `You are the Master Orchestrator coordinating 4 specialized sub-agents for product "${product.name}" ($${product.base_price} base).
Strategy:
1. If the user describes a desired configuration, call call_customer_agent first.
2. Then call_rules_agent to validate.
3. Then call_inventory_agent to check stock.
4. Then call_pricing_agent with quantity ${quantity}.
5. Finally call finalize with a concise reply summarizing selections, stock, and price.
Always call sub-agents in that order when configuring; skip irrelevant ones for pure Q&A.`;

    const messages: any[] = [
      { role: "system", content: systemPrompt },
      ...history,
      { role: "user", content: message },
    ];

    let finalReply = "";
    let finalSummary = "";
    let lastPricing: any = null;
    let lastInventory: any = null;
    let lastRules: any = null;

    for (let step = 0; step < 8; step++) {
      const resp = await fetch(GATEWAY_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ model: MODEL, messages, tools, tool_choice: "auto" }),
      });
      if (!resp.ok) {
        if (resp.status === 429)
          return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
            status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        if (resp.status === 402)
          return new Response(JSON.stringify({ error: "AI credits exhausted" }), {
            status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        throw new Error(`AI gateway error: ${await resp.text()}`);
      }
      const data = await resp.json();
      const msg = data?.choices?.[0]?.message;
      messages.push(msg);
      const calls = msg?.tool_calls ?? [];
      if (!calls.length) {
        finalReply = msg?.content ?? "Done.";
        break;
      }

      for (const call of calls) {
        const name = call.function.name;
        const args = JSON.parse(call.function.arguments || "{}");
        const start = Date.now();
        let result: any;
        try {
          if (name === "call_customer_agent") {
            const out = await customerAgent(apiKey, {
              product,
              message: args.instruction || message,
              selections: workingSelections,
            });
            workingSelections = out.selections;
            result = { selections: workingSelections, rationale: out.rationale };
          } else if (name === "call_rules_agent") {
            const out = rulesAgent(rules ?? [], workingSelections);
            Object.assign(workingSelections, out.autoSelections);
            lastRules = out;
            result = out;
          } else if (name === "call_inventory_agent") {
            lastInventory = await inventoryAgent(supabase, workingSelections);
            result = lastInventory;
          } else if (name === "call_pricing_agent") {
            lastPricing = await pricingAgent(
              supabase, product, workingSelections, args.quantity ?? quantity,
            );
            result = lastPricing;
          } else if (name === "finalize") {
            finalReply = args.reply ?? "Done.";
            finalSummary = args.summary ?? "";
            result = { ok: true };
          } else {
            result = { error: `Unknown agent: ${name}` };
          }
        } catch (e: any) {
          result = { error: e?.message ?? "agent failure" };
        }
        const ms = Date.now() - start;
        traces.push({ agent: name, input: args, output: result, ms });
        messages.push({
          role: "tool",
          tool_call_id: call.id,
          content: JSON.stringify(result),
        });
        if (name === "finalize") {
          return new Response(
            JSON.stringify({
              reply: finalReply,
              summary: finalSummary,
              selections: workingSelections,
              pricing: lastPricing,
              inventory: lastInventory,
              rules: lastRules,
              traces,
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
      }
    }

    return new Response(
      JSON.stringify({
        reply: finalReply || "Reached step limit without finalizing.",
        selections: workingSelections,
        pricing: lastPricing,
        inventory: lastInventory,
        rules: lastRules,
        traces,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("agents-orchestrator error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
