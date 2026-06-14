import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  proposalId: z.string().uuid(),
  decision: z.enum(["approve", "reject"]),
  selections: z.object({
    config_options: z.array(z.number().int()).default([]),
    rules: z.array(z.number().int()).default([]),
    pricing: z.array(z.number().int()).default([]),
  }).optional(),
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: corsHeaders });

    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: corsHeaders });

    const parsed = BodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten() }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { proposalId, decision, selections } = parsed.data;

    const { data: proposal, error: pErr } = await supabase
      .from("catalog_ai_proposals")
      .select("*")
      .eq("id", proposalId)
      .single();
    if (pErr || !proposal) {
      return new Response(JSON.stringify({ error: "Proposal not found" }), { status: 404, headers: corsHeaders });
    }
    if (proposal.status !== "pending") {
      return new Response(JSON.stringify({ error: "Proposal already resolved" }), { status: 400, headers: corsHeaders });
    }

    const applied: any = { config_options: 0, rules: 0, pricing: 0 };

    if (decision === "approve") {
      const sugg = proposal.suggestions ?? {};
      const productId = proposal.product_id;
      const sel = selections ?? {
        config_options: (sugg.config_options ?? []).map((_: any, i: number) => i),
        rules: (sugg.rules ?? []).map((_: any, i: number) => i),
        pricing: (sugg.pricing ?? []).map((_: any, i: number) => i),
      };

      // Apply config options + values
      for (const idx of sel.config_options) {
        const opt = sugg.config_options?.[idx];
        if (!opt) continue;
        const { data: created, error } = await supabase.from("config_options").insert({
          product_id: productId,
          name: opt.name,
          option_type: opt.option_type,
          is_required: !!opt.is_required,
          display_order: 0,
        }).select().single();
        if (error) { console.error("config_options insert error", error); continue; }
        applied.config_options++;
        for (const v of opt.values ?? []) {
          await supabase.from("option_values").insert({
            config_option_id: created.id,
            name: v.name,
            price_modifier: Number(v.price_modifier) || 0,
            is_available: true,
            display_order: 0,
          });
        }
      }

      // Apply rules
      for (const idx of sel.rules) {
        const r = sugg.rules?.[idx];
        if (!r) continue;
        const { error } = await supabase.from("configuration_rules").insert({
          product_id: productId,
          rule_name: r.rule_name,
          rule_type: r.rule_type,
          conditions: {},
          actions: { note: r.description_plain ?? "" },
          priority: 0,
          is_active: false, // require human review of conditions/actions
        });
        if (!error) applied.rules++;
      }

      // Apply pricing
      for (const idx of sel.pricing) {
        const p = sugg.pricing?.[idx];
        if (!p) continue;
        const { error } = await supabase.from("pricing_rules").insert({
          product_id: productId,
          rule_name: p.rule_name,
          conditions: {},
          discount_type: p.discount_type,
          discount_value: Number(p.discount_value) || 0,
          min_quantity: Number(p.min_quantity) || 1,
          is_active: false,
        });
        if (!error) applied.pricing++;
      }
    }

    await supabase.from("catalog_ai_proposals").update({
      status: decision === "approve" ? "approved" : "rejected",
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      applied_summary: applied,
    }).eq("id", proposalId);

    return new Response(JSON.stringify({ success: true, applied }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("catalog-ai-apply error:", e);
    return new Response(JSON.stringify({ error: e.message ?? "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
