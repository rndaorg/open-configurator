import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RequestSchema = z.object({
  sharedConfigId: z.string().uuid(),
  productId: z.string().uuid(),
  action: z.enum(["chat", "analyze", "propose"]).default("chat"),
  displayName: z.string().max(80).default("Guest"),
  message: z.string().max(2000).optional(),
  currentSelections: z.record(z.string(), z.string()).default({}),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { sharedConfigId, productId, action, displayName, message, currentSelections } = parsed.data;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const [{ data: product }, { data: rules }, { data: prefs }, { data: history }] = await Promise.all([
      supabase
        .from("products")
        .select("id, name, description, base_price, config_options(id, name, is_required, option_values(id, name, price_modifier, is_available))")
        .eq("id", productId)
        .single(),
      supabase.from("configuration_rules").select("rule_name, rule_type, conditions, actions").eq("product_id", productId).eq("is_active", true),
      supabase.from("mediator_preferences").select("*").eq("shared_config_id", sharedConfigId),
      supabase
        .from("mediator_messages")
        .select("role, display_name, content")
        .eq("shared_config_id", sharedConfigId)
        .order("created_at", { ascending: true })
        .limit(30),
    ]);

    if (!product) throw new Error("Product not found");

    const optionsCatalog = (product.config_options || []).map((o: any) => ({
      option_id: o.id,
      name: o.name,
      required: o.is_required,
      values: (o.option_values || []).filter((v: any) => v.is_available).map((v: any) => ({
        value_id: v.id,
        name: v.name,
        price_modifier: Number(v.price_modifier ?? 0),
      })),
    }));

    // Log user message
    if (action === "chat" && message) {
      await supabase.from("mediator_messages").insert({
        shared_config_id: sharedConfigId,
        display_name: displayName,
        role: "user",
        content: message,
      });
    }

    const systemPrompt = `You are the AI Mediator joining a live multi-participant configuration session for "${product.name}".
Your job is to help a group of collaborators reach consensus. You must:
- Explain trade-offs of options in plain, neutral language.
- Detect DISAGREEMENTS between collaborators' stated preferences and highlight them clearly.
- Propose a CONSENSUS configuration when preferences conflict, justifying the compromise.
- Never take sides; always acknowledge everyone's priorities.
- Be concise and use short paragraphs or bullet lists.

PRODUCT: ${product.description ?? ""}
BASE PRICE: $${product.base_price}

CATALOG (option_id / value_id are opaque IDs — always use them exactly):
${JSON.stringify(optionsCatalog, null, 2)}

CONFIGURATION RULES:
${JSON.stringify(rules ?? [], null, 2)}

COLLABORATOR PREFERENCES:
${JSON.stringify((prefs ?? []).map((p: any) => ({
  who: p.display_name,
  preferences: p.preferences_text,
  priorities: p.priorities,
  budget_max: p.budget_max,
})), null, 2)}

CURRENT SHARED SELECTIONS (option_id -> value_id): ${JSON.stringify(currentSelections)}

ACTION MODE: ${action}
- "chat": respond conversationally to the latest message.
- "analyze": summarize each participant's priorities, list all conflicts, and rate consensus health 0-100.
- "propose": produce a compromise configuration honoring all collaborators as fairly as possible.`;

    const tools = [
      {
        type: "function",
        function: {
          name: "mediator_response",
          description: "Structured mediator output.",
          parameters: {
            type: "object",
            properties: {
              reply: { type: "string", description: "Markdown message shown to all participants." },
              disagreements: {
                type: "array",
                description: "Detected conflicts between collaborators.",
                items: {
                  type: "object",
                  properties: {
                    topic: { type: "string" },
                    participants: { type: "array", items: { type: "string" } },
                    summary: { type: "string" },
                  },
                  required: ["topic", "summary"],
                  additionalProperties: false,
                },
              },
              tradeoffs: {
                type: "array",
                description: "Trade-off notes worth surfacing to the group.",
                items: {
                  type: "object",
                  properties: {
                    option: { type: "string" },
                    note: { type: "string" },
                  },
                  required: ["option", "note"],
                  additionalProperties: false,
                },
              },
              consensus_score: { type: "number", description: "0-100 estimate of how aligned collaborators are." },
              proposed_selections: {
                type: "array",
                description: "Optional consensus configuration.",
                items: {
                  type: "object",
                  properties: {
                    option_id: { type: "string" },
                    value_id: { type: "string" },
                    reason: { type: "string" },
                  },
                  required: ["option_id", "value_id", "reason"],
                  additionalProperties: false,
                },
              },
            },
            required: ["reply"],
            additionalProperties: false,
          },
        },
      },
    ];

    const messages: any[] = [{ role: "system", content: systemPrompt }];
    for (const h of history ?? []) {
      messages.push({
        role: h.role === "assistant" ? "assistant" : "user",
        content: h.role === "user" ? `${h.display_name}: ${h.content}` : h.content,
      });
    }
    if (action === "analyze") {
      messages.push({ role: "user", content: "Please analyze the current preferences and highlight disagreements." });
    } else if (action === "propose") {
      messages.push({ role: "user", content: "Please propose a consensus configuration that fairly balances everyone's priorities." });
    }

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages,
        tools,
        tool_choice: { type: "function", function: { name: "mediator_response" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, try again shortly." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const txt = await aiResp.text();
      console.error("mediator AI error", aiResp.status, txt);
      throw new Error("AI gateway error");
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    let args: any = {};
    try {
      args = JSON.parse(toolCall?.function?.arguments ?? "{}");
    } catch { args = {}; }

    // Validate proposed selections
    const optionToValues = new Map<string, Set<string>>();
    for (const o of optionsCatalog) optionToValues.set(o.option_id, new Set(o.values.map((v: any) => v.value_id)));
    const cleanProposed = (args.proposed_selections || []).filter(
      (s: any) => s && optionToValues.get(s.option_id)?.has(s.value_id)
    );
    const proposedMap: Record<string, string> = {};
    for (const s of cleanProposed) proposedMap[s.option_id] = s.value_id;

    const payload = {
      reply: args.reply ?? "I couldn't produce a mediator response.",
      disagreements: args.disagreements ?? [],
      tradeoffs: args.tradeoffs ?? [],
      consensus_score: typeof args.consensus_score === "number" ? args.consensus_score : null,
      proposed_selections: cleanProposed,
      proposed_config: Object.keys(proposedMap).length ? proposedMap : null,
    };

    await supabase.from("mediator_messages").insert({
      shared_config_id: sharedConfigId,
      display_name: "AI Mediator",
      role: "assistant",
      content: payload.reply,
      proposed_config: payload.proposed_config,
      metadata: {
        disagreements: payload.disagreements,
        tradeoffs: payload.tradeoffs,
        consensus_score: payload.consensus_score,
        action,
      },
    });

    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("collab-mediator-agent error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unexpected error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
