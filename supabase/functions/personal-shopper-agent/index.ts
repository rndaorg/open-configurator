import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RequestSchema = z.object({
  action: z.enum(["chat", "greet", "history"]).default("chat"),
  message: z.string().max(2000).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = RequestSchema.safeParse(await req.json().catch(() => ({})));
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { action, message } = parsed.data;

    // Return raw history for hydration
    if (action === "history") {
      const [{ data: messages }, { data: memory }] = await Promise.all([
        supabase.from("ai_agent_messages").select("id, role, content, suggestions, created_at")
          .eq("user_id", user.id).order("created_at", { ascending: true }).limit(100),
        supabase.from("ai_agent_memory").select("*").eq("user_id", user.id).maybeSingle(),
      ]);
      return new Response(JSON.stringify({ messages: messages ?? [], memory: memory ?? null }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "chat" && !message?.trim()) {
      return new Response(JSON.stringify({ error: "Message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load context in parallel
    const [
      { data: memory },
      { data: recentMessages },
      { data: orders },
      { data: savedConfigs },
      { data: prefs },
      { data: products },
    ] = await Promise.all([
      supabase.from("ai_agent_memory").select("*").eq("user_id", user.id).maybeSingle(),
      supabase.from("ai_agent_messages").select("role, content").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(20),
      supabase.from("orders").select("id, total_price, status, created_at, configuration_data, products(name)")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("product_configurations").select("configuration_name, total_price, configuration_data, created_at, products(name)")
        .eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      supabase.from("user_preferences").select("product_id, interaction_score, preferences, products(name)")
        .eq("user_id", user.id).order("interaction_score", { ascending: false }).limit(10),
      supabase.from("products").select("id, name, description, base_price, categories(name)")
        .eq("is_active", true).limit(40),
    ]);

    const history = (recentMessages ?? []).reverse();
    const lastInteraction = memory?.last_interaction_at ? new Date(memory.last_interaction_at) : null;
    const daysAway = lastInteraction
      ? Math.floor((Date.now() - lastInteraction.getTime()) / (1000 * 60 * 60 * 24))
      : null;

    const systemPrompt = `You are a persistent AI personal shopping assistant for Open Configurator. You have ongoing memory of this customer across sessions.

Your job:
- Speak warmly and personally. Reference past interactions when relevant ("Last time you were looking at...").
- Proactively suggest products or configuration ideas that fit their stored preferences, budget, and style.
- Continuously refine your memory: after each turn, update the summary, preferences, budget, and style_tags based on what they say.
- Keep replies concise (2-5 sentences). Use product suggestions sparingly (0-3) and only when genuinely relevant.

CUSTOMER MEMORY (long-term):
${JSON.stringify(memory ?? { note: "No prior memory — this is a new customer." }, null, 2)}

DAYS SINCE LAST INTERACTION: ${daysAway ?? "first time"}

PAST ORDERS (most recent first):
${JSON.stringify(orders?.map(o => ({ product: (o.products as any)?.name, total: o.total_price, status: o.status, date: o.created_at })) ?? [], null, 2)}

SAVED CONFIGURATIONS:
${JSON.stringify(savedConfigs?.map(c => ({ name: c.configuration_name, product: (c.products as any)?.name, total: c.total_price })) ?? [], null, 2)}

TOP PREFERENCES:
${JSON.stringify(prefs?.map(p => ({ product: (p.products as any)?.name, score: p.interaction_score })) ?? [], null, 2)}

AVAILABLE PRODUCTS YOU CAN SUGGEST (use exact product_id):
${JSON.stringify(products?.map(p => ({ product_id: p.id, name: p.name, base_price: p.base_price, category: (p.categories as any)?.name, description: (p.description ?? "").slice(0, 120) })) ?? [], null, 2)}

${action === "greet" ? "TASK: The customer just returned. Greet them warmly, reference what you remember (or welcome them if new), and proactively suggest 1-3 relevant products or next steps. Do NOT wait for them to ask." : "TASK: Respond to the customer's message naturally."}`;

    const tools = [{
      type: "function",
      function: {
        name: "respond",
        description: "Reply to the customer and update long-term memory.",
        parameters: {
          type: "object",
          properties: {
            reply: { type: "string", description: "Warm, concise conversational reply (markdown ok)." },
            product_suggestions: {
              type: "array",
              description: "0-3 products to proactively surface.",
              items: {
                type: "object",
                properties: {
                  product_id: { type: "string" },
                  reason: { type: "string", description: "Short reason this fits the customer." },
                },
                required: ["product_id", "reason"],
                additionalProperties: false,
              },
            },
            updated_memory: {
              type: "object",
              description: "Refined long-term memory after this turn.",
              properties: {
                summary: { type: "string", description: "1-3 sentence persona summary." },
                preferences: { type: "object", description: "Free-form key/value preferences (e.g. {color:'matte black', use_case:'commuting'})." },
                budget_min: { type: ["number", "null"] },
                budget_max: { type: ["number", "null"] },
                style_tags: { type: "array", items: { type: "string" } },
                interested_categories: { type: "array", items: { type: "string" } },
              },
              required: ["summary", "preferences", "style_tags", "interested_categories"],
              additionalProperties: false,
            },
          },
          required: ["reply", "product_suggestions", "updated_memory"],
          additionalProperties: false,
        },
      },
    }];

    const userTurn = action === "greet"
      ? "[The customer just opened the app. Greet them and proactively suggest something.]"
      : message!.trim();

    const aiResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...history.map(m => ({ role: m.role, content: m.content })),
          { role: "user", content: userTurn },
        ],
        tools,
        tool_choice: { type: "function", function: { name: "respond" } },
      }),
    });

    if (!aiResp.ok) {
      if (aiResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again shortly." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      if (aiResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      console.error("AI gateway error", aiResp.status, await aiResp.text());
      return new Response(JSON.stringify({ error: "AI gateway error" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const aiData = await aiResp.json();
    const toolCall = aiData?.choices?.[0]?.message?.tool_calls?.[0];
    let args: any = {};
    try { args = JSON.parse(toolCall?.function?.arguments ?? "{}"); } catch { args = {}; }

    const reply: string = args.reply ?? "I'm here whenever you'd like to chat.";
    const rawSuggestions = Array.isArray(args.product_suggestions) ? args.product_suggestions : [];
    const validProductIds = new Set((products ?? []).map(p => p.id));
    const productMap = new Map((products ?? []).map(p => [p.id, p]));
    const suggestions = rawSuggestions
      .filter((s: any) => s && typeof s.product_id === "string" && validProductIds.has(s.product_id))
      .slice(0, 3)
      .map((s: any) => {
        const p = productMap.get(s.product_id) as any;
        return {
          product_id: s.product_id,
          reason: String(s.reason ?? "").slice(0, 300),
          name: p?.name,
          base_price: p?.base_price,
          category: p?.categories?.name,
        };
      });

    // Persist messages
    const inserts: any[] = [];
    if (action === "chat" && message?.trim()) {
      inserts.push({ user_id: user.id, role: "user", content: message.trim() });
    }
    inserts.push({
      user_id: user.id, role: "assistant", content: reply,
      suggestions: suggestions.length ? suggestions : null,
    });
    await supabase.from("ai_agent_messages").insert(inserts);

    // Upsert memory
    const upd = args.updated_memory ?? {};
    await supabase.from("ai_agent_memory").upsert({
      user_id: user.id,
      summary: String(upd.summary ?? memory?.summary ?? "").slice(0, 2000),
      preferences: upd.preferences ?? memory?.preferences ?? {},
      budget_min: upd.budget_min ?? memory?.budget_min ?? null,
      budget_max: upd.budget_max ?? memory?.budget_max ?? null,
      style_tags: Array.isArray(upd.style_tags) ? upd.style_tags.slice(0, 20) : (memory?.style_tags ?? []),
      interested_categories: Array.isArray(upd.interested_categories) ? upd.interested_categories.slice(0, 20) : (memory?.interested_categories ?? []),
      last_interaction_at: new Date().toISOString(),
    }, { onConflict: "user_id" });

    return new Response(JSON.stringify({ reply, suggestions, days_away: daysAway }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("personal-shopper-agent error:", e);
    return new Response(JSON.stringify({ error: e?.message ?? "Unexpected error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
