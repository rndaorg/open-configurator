import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const InputSchema = z.object({
  productId: z.string().uuid(),
  transcript: z.string().max(4000).optional(),
  imageDataUrl: z.string().max(6_000_000).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const parsed = InputSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { productId, transcript, imageDataUrl } = parsed.data;

    if (!transcript && !imageDataUrl) {
      return new Response(JSON.stringify({ error: "Provide voice transcript or image" }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const { data: product } = await supabase.from("products").select("id, name, description").eq("id", productId).maybeSingle();
    const { data: options } = await supabase
      .from("config_options")
      .select("id, name, option_type, option_values(id, name, price_modifier, is_available)")
      .eq("product_id", productId);

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "AI not configured" }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const systemPrompt = `You are a Multi-Modal Configuration Agent.
Given a product's catalog of configurable options and either voice-transcribed intent, an inspiration image, or both, you must:
1) Interpret the customer's aesthetic and functional preferences.
2) Map them to concrete option value IDs from the catalog.
3) Explain your reasoning per option.

Return ONLY valid JSON:
{
  "interpretation": string (2-3 sentences about what you understood),
  "selections": [{ "option_id": string, "option_name": string, "value_id": string, "value_name": string, "reason": string }],
  "confidence": number (0-100),
  "follow_up_questions": [string]
}
Only pick value_id values that exist in the catalog and are is_available=true.`;

    const userContent: any[] = [];
    let userText = `## Product\n${JSON.stringify(product)}\n\n## Available Options (catalog)\n${JSON.stringify(options)}\n\n`;
    if (transcript) userText += `## Voice transcript\n"${transcript}"\n\n`;
    if (imageDataUrl) userText += `## Inspiration image\nAnalyze the attached image for style, color, materials, form factor.\n`;
    userContent.push({ type: "text", text: userText });
    if (imageDataUrl) {
      userContent.push({ type: "image_url", image_url: { url: imageDataUrl } });
    }

    const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
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
    let result: any = {};
    try { result = JSON.parse(aiJson.choices?.[0]?.message?.content || "{}"); } catch { result = { raw: aiJson.choices?.[0]?.message?.content }; }

    return new Response(JSON.stringify({ success: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("multimodal-config-agent error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message ?? "Failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
