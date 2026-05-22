import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RequestSchema = z.object({
  productId: z.string().uuid(),
  message: z.string().min(1).max(2000),
  currentSelections: z.record(z.string(), z.string()).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      })
    )
    .max(20)
    .optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const { productId, message, currentSelections = {}, history = [] } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    // Load product with options/values and rules
    const [{ data: product, error: pErr }, { data: rules }] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, description, base_price, categories(name), config_options(id, name, option_type, is_required, option_values(id, name, price_modifier, hex_color, is_available))")
        .eq("id", productId)
        .single(),
      supabase
        .from("configuration_rules")
        .select("rule_name, rule_type, conditions, actions")
        .eq("product_id", productId)
        .eq("is_active", true),
    ]);

    if (pErr || !product) throw new Error("Product not found");

    // Build compact catalog for the model
    const optionsCatalog = (product.config_options || []).map((o: any) => ({
      option_id: o.id,
      name: o.name,
      type: o.option_type,
      required: o.is_required,
      values: (o.option_values || [])
        .filter((v: any) => v.is_available)
        .map((v: any) => ({
          value_id: v.id,
          name: v.name,
          price_modifier: Number(v.price_modifier ?? 0),
          color: v.hex_color,
        })),
    }));

    const systemPrompt = `You are an expert product configuration assistant for "${product.name}" (category: ${product.categories?.name ?? "n/a"}, base price $${product.base_price}).
Your job: read the customer's natural-language request and pick the best matching option values from the catalog.
Rules:
- ONLY pick value_ids that exist in the catalog below.
- Honor budget constraints (sum base_price + selected price_modifiers ≤ stated budget when possible).
- Respect configuration rules (dependencies/restrictions).
- If you can't satisfy something, explain why and pick the closest alternative.
- Keep the conversational reply short, warm, and human. The detailed reasoning goes in "explanation".

PRODUCT DESCRIPTION: ${product.description ?? ""}

CATALOG:
${JSON.stringify(optionsCatalog, null, 2)}

CONFIGURATION RULES:
${JSON.stringify(rules ?? [], null, 2)}

CURRENT SELECTIONS (option_id -> value_id): ${JSON.stringify(currentSelections)}`;

    const tools = [
      {
        type: "function",
        function: {
          name: "apply_configuration",
          description: "Apply a recommended configuration based on the user's natural-language request.",
          parameters: {
            type: "object",
            properties: {
              selections: {
                type: "array",
                description: "List of option/value pairs to apply.",
                items: {
                  type: "object",
                  properties: {
                    option_id: { type: "string", description: "ID of the config option." },
                    value_id: { type: "string", description: "ID of the chosen option value." },
                    reason: { type: "string", description: "Why this value matches the request." },
                  },
                  required: ["option_id", "value_id", "reason"],
                  additionalProperties: false,
                },
              },
              reply: {
                type: "string",
                description: "Short friendly conversational reply (1-3 sentences).",
              },
              explanation: {
                type: "string",
                description: "Concise markdown explanation of the overall configuration choice.",
              },
              estimated_total: {
                type: "number",
                description: "Estimated total price = base_price + sum of price_modifiers of selected values.",
              },
            },
            required: ["selections", "reply", "explanation"],
            additionalProperties: false,
          },
        },
      },
    ];

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...history,
          { role: "user", content: message },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "apply_configuration" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds in Settings → Workspace → Usage." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const txt = await aiResp.text();
      console.error("AI gateway error", aiResp.status, txt);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall) {
      return new Response(
        JSON.stringify({
          reply: aiData?.choices?.[0]?.message?.content ?? "I couldn't generate a configuration. Please rephrase.",
          selections: [],
          explanation: "",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let args: any = {};
    try {
      args = JSON.parse(toolCall.function.arguments);
    } catch {
      args = {};
    }

    // Validate selections against catalog
    const validIds = new Set<string>();
    const optionToValues = new Map<string, Set<string>>();
    for (const o of optionsCatalog) {
      const vs = new Set<string>(o.values.map((v: any) => v.value_id));
      optionToValues.set(o.option_id, vs);
      vs.forEach((id) => validIds.add(id));
    }
    const cleanedSelections = (args.selections || []).filter(
      (s: any) =>
        s &&
        typeof s.option_id === "string" &&
        typeof s.value_id === "string" &&
        optionToValues.get(s.option_id)?.has(s.value_id)
    );

    return new Response(
      JSON.stringify({
        reply: args.reply ?? "Here's a configuration that matches your request.",
        explanation: args.explanation ?? "",
        estimated_total: args.estimated_total ?? null,
        selections: cleanedSelections,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("configurator-ai-agent error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
