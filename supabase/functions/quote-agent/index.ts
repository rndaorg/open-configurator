import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const InputSchema = z.object({
  command: z.string().min(1).max(2000),
  configurationId: z.string().uuid().optional(),
  orderId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Admin check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: { user } } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { command, configurationId, orderId, productId } = parsed.data;

    // Load context
    let configData: any = null;
    let totalPrice = 0;
    let resolvedProductId = productId;

    if (orderId) {
      const { data } = await supabase.from("orders").select("configuration_data, total_price, product_id").eq("id", orderId).maybeSingle();
      if (data) { configData = data.configuration_data; totalPrice = Number(data.total_price || 0); resolvedProductId ??= data.product_id ?? undefined; }
    } else if (configurationId) {
      const { data } = await supabase.from("product_configurations").select("configuration_data, total_price, product_id").eq("id", configurationId).maybeSingle();
      if (data) { configData = data.configuration_data; totalPrice = Number(data.total_price || 0); resolvedProductId ??= data.product_id ?? undefined; }
    }

    let product: any = null;
    if (resolvedProductId) {
      const { data } = await supabase.from("products").select("id, name, description, base_price, image_url").eq("id", resolvedProductId).maybeSingle();
      product = data;
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `You are a Quote & Proposal Generator agent. Parse the sales rep's natural-language command and produce a JSON quote payload.

Extract: customer name, contact, discount % or absolute, financing terms (months + APR), validity days, delivery notes, special line items, and an executive summary.

Always return valid JSON matching this schema:
{
  "customer": { "name": string, "company": string|null, "email": string|null, "address": string|null },
  "quote_number": string,
  "issue_date": string (ISO date),
  "valid_until": string (ISO date),
  "line_items": [{ "label": string, "detail": string, "quantity": number, "unit_price": number, "total": number }],
  "subtotal": number,
  "discount": { "label": string, "amount": number },
  "tax": { "label": string, "rate": number, "amount": number },
  "grand_total": number,
  "financing": { "enabled": boolean, "months": number, "apr": number, "monthly_payment": number } | null,
  "executive_summary": string,
  "terms": string,
  "delivery": string
}

Rules:
- Base line items on the provided product & configuration.
- If command mentions a discount, apply it. Otherwise discount amount = 0.
- Default tax rate 0. If mentioned, apply it.
- Financing monthly payment = P * (r/12) / (1 - (1 + r/12)^-n) where r = apr/100, n = months. Compute correctly.
- Quote number: Q-{YYYYMMDD}-{random 4 digits}.
- Valid 30 days from today unless specified.`;

    const userPrompt = `## Command
${command}

## Product
${JSON.stringify(product)}

## Current Configuration (base total: $${totalPrice.toFixed(2)})
${JSON.stringify(configData, null, 2)}

Today: ${new Date().toISOString().slice(0, 10)}

Return ONLY the JSON quote payload.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        response_format: { type: "json_object" },
      }),
    });

    if (!aiRes.ok) {
      if (aiRes.status === 429) return new Response(JSON.stringify({ error: "Rate limit" }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      if (aiRes.status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted" }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      const t = await aiRes.text();
      throw new Error(`AI ${aiRes.status}: ${t}`);
    }

    const aiJson = await aiRes.json();
    let quote: any = {};
    try {
      quote = JSON.parse(aiJson.choices?.[0]?.message?.content || "{}");
    } catch {
      quote = { raw: aiJson.choices?.[0]?.message?.content };
    }

    return new Response(JSON.stringify({
      success: true,
      quote,
      product,
      base_total: totalPrice,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("quote-agent error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
