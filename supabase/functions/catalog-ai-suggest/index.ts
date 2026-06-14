import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  productId: z.string().uuid(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "Missing LOVABLE_API_KEY" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { productId } = parsed.data;

    const { data: product, error: pErr } = await supabase
      .from("products")
      .select("id, name, description, base_price, categories(name), config_options(id, name, option_type, option_values(id, name, price_modifier))")
      .eq("id", productId)
      .single();
    if (pErr || !product) {
      return new Response(JSON.stringify({ error: "Product not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemPrompt = `You are an expert e-commerce catalog analyst. Given a product description, you propose:
1. Configuration options (color/size/material/accessory/feature) the product should expose
2. Compatibility rules (dependencies, restrictions, auto-selects between options)
3. Pricing logic (modifiers, bundle discounts, quantity tiers)

Respond ONLY in valid JSON matching this schema:
{
  "summary": "1-2 sentence natural-language summary of what you propose and why",
  "config_options": [{ "name": "string", "option_type": "color|size|material|accessory|feature", "is_required": boolean, "rationale": "string", "values": [{ "name": "string", "price_modifier": number }] }],
  "rules": [{ "rule_name": "string", "rule_type": "dependency|restriction|auto_select|pricing", "description_plain": "string", "rationale": "string" }],
  "pricing": [{ "rule_name": "string", "discount_type": "percentage|fixed", "discount_value": number, "min_quantity": number, "description_plain": "string" }]
}`;

    const userPrompt = `Product: ${product.name}
Category: ${(product as any).categories?.name ?? "uncategorized"}
Base price: $${product.base_price}
Description: ${product.description ?? "(none)"}

Existing config options: ${JSON.stringify((product as any).config_options ?? [])}

Propose missing/improved configuration options, compatibility rules, and pricing logic. Avoid duplicating existing options.`;

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
      },
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
      const errText = await aiRes.text();
      console.error("AI gateway error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please retry shortly." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (aiRes.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits in workspace settings." }), {
          status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI request failed" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const content = aiJson.choices?.[0]?.message?.content ?? "{}";
    let suggestions: any;
    try {
      suggestions = JSON.parse(content);
    } catch {
      suggestions = { summary: content, config_options: [], rules: [], pricing: [] };
    }

    // Persist proposal
    const { data: proposal, error: insErr } = await supabase
      .from("catalog_ai_proposals")
      .insert({
        product_id: productId,
        created_by: user.id,
        status: "pending",
        summary: suggestions.summary ?? null,
        suggestions,
      })
      .select()
      .single();

    if (insErr) {
      console.error("Insert proposal error:", insErr);
      return new Response(JSON.stringify({ error: "Failed to save proposal" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ proposal }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("catalog-ai-suggest error:", e);
    return new Response(JSON.stringify({ error: e.message ?? "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
