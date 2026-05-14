import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const Schema = z.object({
  option_value_id: z.string().uuid().optional(),
  product_id: z.string().uuid().optional(),
  horizon_days: z.number().int().min(1).max(365).default(30),
  history_days: z.number().int().min(7).max(365).default(90),
});

async function requireAdmin(req: Request, supabase: any) {
  const auth = req.headers.get("Authorization");
  if (!auth) return false;
  const token = auth.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return false;
  const { data: ok } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
  return !!ok;
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (!await requireAdmin(req, supabase)) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const parsed = Schema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { product_id, horizon_days, history_days } = parsed.data;
    const since = new Date(Date.now() - history_days * 86400000).toISOString();

    // Pull historical orders for the product (or all)
    let q = supabase.from("orders").select("product_id, quantity, created_at").gte("created_at", since).in("status", ["paid","shipped","delivered","completed"]);
    if (product_id) q = q.eq("product_id", product_id);
    const { data: orders, error } = await q;
    if (error) throw error;

    // Aggregate by day
    const dayBuckets: Record<string, number> = {};
    for (const o of orders || []) {
      const d = new Date(o.created_at).toISOString().slice(0, 10);
      dayBuckets[d] = (dayBuckets[d] || 0) + (o.quantity || 1);
    }
    const days: { date: string; qty: number }[] = [];
    for (let i = history_days - 1; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      days.push({ date: d, qty: dayBuckets[d] || 0 });
    }
    const total = days.reduce((s, d) => s + d.qty, 0);
    const avg30 = days.slice(-30).reduce((s, d) => s + d.qty, 0) / Math.min(30, days.length);
    const avg7 = days.slice(-7).reduce((s, d) => s + d.qty, 0) / Math.min(7, days.length);

    // Simple linear trend (least squares slope on daily qty)
    const n = days.length;
    const xMean = (n - 1) / 2;
    const yMean = total / n;
    let num = 0, den = 0;
    days.forEach((d, i) => { num += (i - xMean) * (d.qty - yMean); den += (i - xMean) ** 2; });
    const slope = den === 0 ? 0 : num / den;

    const projected: { date: string; projected_qty: number }[] = [];
    for (let i = 1; i <= horizon_days; i++) {
      const d = new Date(Date.now() + i * 86400000).toISOString().slice(0, 10);
      const proj = Math.max(0, yMean + slope * (n - 1 + i));
      projected.push({ date: d, projected_qty: Math.round(proj * 100) / 100 });
    }

    // Stock-on-hand
    let stockQ = supabase.from("warehouse_inventory").select("option_value_id, available_quantity, reserved_quantity, reorder_point");
    const { data: stock } = await stockQ;
    const totalStock = (stock || []).reduce((s, r) => s + (r.available_quantity - r.reserved_quantity), 0);
    const dailyDemand = Math.max(0.001, avg7 || avg30);
    const daysOfStock = totalStock / dailyDemand;

    return new Response(JSON.stringify({
      history: days,
      projection: projected,
      metrics: {
        avg7_daily: Math.round(avg7 * 100) / 100,
        avg30_daily: Math.round(avg30 * 100) / 100,
        trend_slope: Math.round(slope * 1000) / 1000,
        total_stock_on_hand: totalStock,
        days_of_stock_remaining: Math.round(daysOfStock * 10) / 10,
        recommended_reorder_in_days: Math.max(0, Math.round(daysOfStock - 7)),
      },
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("forecast error", e);
    return new Response(JSON.stringify({ error: "Failed to compute forecast" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
