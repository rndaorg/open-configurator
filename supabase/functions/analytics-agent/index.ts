import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const BodySchema = z.object({
  windowDays: z.number().int().min(1).max(365).default(30),
  triggerType: z.enum(["manual", "scheduled"]).default("manual"),
  emailRecipient: z.string().email().optional(),
});

interface OptionAgg {
  key: string;
  optionId: string;
  valueId: string;
  productId: string;
  selections: number;
  completions: number;
  abandonments: number;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const started = Date.now();

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: allow admin OR scheduled call with service role secret header
    const authHeader = req.headers.get("Authorization") || "";
    const isScheduled = req.headers.get("x-scheduled-secret") === Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    let userId: string | null = null;
    if (!isScheduled) {
      if (!authHeader.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      const { data: userData } = await supabase.auth.getUser(authHeader.replace("Bearer ", ""));
      if (!userData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
      userId = userData.user.id;
      const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: userId, _role: "admin" });
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Admin only" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const parsed = BodySchema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { windowDays, triggerType, emailRecipient } = parsed.data;

    const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();

    // Fetch analytics
    const [{ data: sessions }, { data: products }, { data: optionValues }] = await Promise.all([
      supabase.from("configuration_analytics").select("*").gte("created_at", since).limit(5000),
      supabase.from("products").select("id, name").eq("is_active", true),
      supabase.from("option_values").select("id, name, config_option_id, config_options(id, name, product_id)"),
    ]);

    const totalSessions = sessions?.length || 0;
    const completed = sessions?.filter((s: any) => (s.completion_rate ?? 0) >= 100).length || 0;
    const abandoned = totalSessions - completed;
    const completionRate = totalSessions ? (completed / totalSessions) * 100 : 0;

    // Aggregate abandonment points
    const abandonMap: Record<string, number> = {};
    const productAbandon: Record<string, number> = {};
    const productSessions: Record<string, number> = {};
    const optionAgg: Record<string, OptionAgg> = {};

    for (const s of sessions || []) {
      const pid = s.product_id as string;
      productSessions[pid] = (productSessions[pid] || 0) + 1;
      if ((s.completion_rate ?? 0) < 100 && s.abandonment_point) {
        abandonMap[s.abandonment_point] = (abandonMap[s.abandonment_point] || 0) + 1;
        productAbandon[pid] = (productAbandon[pid] || 0) + 1;
      }
      const cfg = s.configuration_data || {};
      for (const [optId, valId] of Object.entries(cfg)) {
        const key = `${pid}::${optId}::${valId}`;
        if (!optionAgg[key]) optionAgg[key] = { key, optionId: optId, valueId: String(valId), productId: pid, selections: 0, completions: 0, abandonments: 0 };
        optionAgg[key].selections += 1;
        if ((s.completion_rate ?? 0) >= 100) optionAgg[key].completions += 1;
        else optionAgg[key].abandonments += 1;
      }
    }

    // Build compact digest for LLM
    const topAbandonPoints = Object.entries(abandonMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const productMap = new Map((products || []).map((p: any) => [p.id, p.name]));
    const ovMap = new Map((optionValues || []).map((ov: any) => [ov.id, { name: ov.name, optionName: ov.config_options?.name, productId: ov.config_options?.product_id }]));

    // Underperforming = high selections but low completion vs product average
    const productCompletion: Record<string, { total: number; done: number }> = {};
    for (const s of sessions || []) {
      const pid = s.product_id as string;
      productCompletion[pid] = productCompletion[pid] || { total: 0, done: 0 };
      productCompletion[pid].total += 1;
      if ((s.completion_rate ?? 0) >= 100) productCompletion[pid].done += 1;
    }

    const underperforming = Object.values(optionAgg)
      .filter((o) => o.selections >= 5)
      .map((o) => {
        const pc = productCompletion[o.productId];
        const productRate = pc && pc.total ? pc.done / pc.total : 0;
        const optionRate = o.completions / o.selections;
        return { ...o, optionRate, productRate, delta: optionRate - productRate };
      })
      .filter((o) => o.delta < -0.15)
      .sort((a, b) => a.delta - b.delta)
      .slice(0, 10);

    const digest = {
      windowDays,
      totals: { sessions: totalSessions, completed, abandoned, completionRate: +completionRate.toFixed(1) },
      topAbandonPoints: topAbandonPoints.map(([point, count]) => ({ point, count })),
      productBreakdown: Object.entries(productCompletion).map(([pid, v]) => ({
        productId: pid,
        product: productMap.get(pid) || "unknown",
        sessions: v.total,
        completionRate: v.total ? +((v.done / v.total) * 100).toFixed(1) : 0,
        abandonments: productAbandon[pid] || 0,
      })).sort((a, b) => b.sessions - a.sessions).slice(0, 10),
      underperformingOptions: underperforming.map((o) => {
        const meta = ovMap.get(o.valueId);
        return {
          productId: o.productId,
          product: productMap.get(o.productId) || "unknown",
          option: meta?.optionName || o.optionId,
          value: meta?.name || o.valueId,
          selections: o.selections,
          optionCompletionRate: +(o.optionRate * 100).toFixed(1),
          productCompletionRate: +(o.productRate * 100).toFixed(1),
        };
      }),
    };

    // Call Lovable AI to synthesize insights
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    let aiInsights: any[] = [];
    let aiSummary = "";

    if (LOVABLE_API_KEY && totalSessions > 0) {
      const prompt = `You are an autonomous e-commerce analytics agent. Analyze this ${windowDays}-day configurator data digest and produce actionable catalog recommendations for admins.

DATA:
${JSON.stringify(digest, null, 2)}

Return a JSON object with:
- "summary": 2-3 sentence executive summary of overall health and top concern
- "insights": array of 3-8 findings, each: { "type": "drop_off"|"underperforming_option"|"catalog_change"|"opportunity", "severity": "low"|"medium"|"high", "title": string, "description": string (evidence-based), "recommendation": string (specific action), "productId": string|null }

Focus on: drop-off points, options with low conversion, products with unusual abandonment, and concrete catalog changes (rename, reprice, hide, add rule, promote).`;

      const aiRes = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "user", content: prompt }],
          response_format: { type: "json_object" },
        }),
      });

      if (aiRes.ok) {
        const aiJson = await aiRes.json();
        try {
          const parsed = JSON.parse(aiJson.choices?.[0]?.message?.content || "{}");
          aiSummary = parsed.summary || "";
          aiInsights = Array.isArray(parsed.insights) ? parsed.insights : [];
        } catch (e) {
          console.error("AI parse error", e);
        }
      } else {
        console.error("AI gateway error", aiRes.status, await aiRes.text());
      }
    }

    // Store run
    const { data: run, error: runError } = await supabase
      .from("analytics_agent_runs")
      .insert({
        triggered_by: userId,
        trigger_type: triggerType,
        status: "completed",
        window_days: windowDays,
        summary: aiSummary || `Analyzed ${totalSessions} sessions. ${completionRate.toFixed(1)}% completion rate.`,
        metrics: digest.totals,
        duration_ms: Date.now() - started,
      })
      .select()
      .single();
    if (runError) throw runError;

    // Persist insights
    const rows = aiInsights.map((i) => ({
      run_id: run.id,
      product_id: i.productId || null,
      insight_type: i.type || "opportunity",
      severity: i.severity || "medium",
      title: (i.title || "Untitled").slice(0, 200),
      description: i.description || "",
      recommendation: i.recommendation || "",
      evidence: { source: "analytics-agent", digest_slice: digest.totals },
      status: "new",
    }));
    if (rows.length) {
      const { error: insErr } = await supabase.from("analytics_insights").insert(rows);
      if (insErr) console.error("insight insert err", insErr);
    }

    // Optional: trigger scheduled report email
    if (emailRecipient) {
      supabase.functions.invoke("generate-scheduled-report", {
        body: { reportType: "full", format: "json", recipientEmail: emailRecipient },
        headers: { Authorization: authHeader },
      }).catch((e) => console.error("report dispatch failed", e));
    }

    return new Response(JSON.stringify({
      runId: run.id,
      summary: run.summary,
      digest,
      insights: rows.length,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e: any) {
    console.error("analytics-agent error", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
