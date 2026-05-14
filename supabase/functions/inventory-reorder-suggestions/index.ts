import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const Schema = z.object({
  warehouse_id: z.string().uuid().optional(),
  status: z.enum(["pending", "ordered", "dismissed", "all"]).default("pending"),
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
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const parsed = Schema.safeParse(body);
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { warehouse_id, status } = parsed.data;

    let q = supabase.from("reorder_alerts").select("*").order("triggered_at", { ascending: false });
    if (status !== "all") q = q.eq("status", status);
    if (warehouse_id) q = q.eq("warehouse_id", warehouse_id);
    const { data: alerts, error } = await q;
    if (error) throw error;

    // Enrich with option_value name & supplier name
    const ovIds = [...new Set((alerts || []).map(a => a.option_value_id))];
    const supplierIds = [...new Set((alerts || []).map(a => a.supplier_id).filter(Boolean))];
    const whIds = [...new Set((alerts || []).map(a => a.warehouse_id))];

    const [{ data: ovs }, { data: sups }, { data: whs }] = await Promise.all([
      supabase.from("option_values").select("id, name").in("id", ovIds.length ? ovIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("suppliers").select("id, name, lead_time_days").in("id", supplierIds.length ? supplierIds : ["00000000-0000-0000-0000-000000000000"]),
      supabase.from("warehouses").select("id, name, code").in("id", whIds.length ? whIds : ["00000000-0000-0000-0000-000000000000"]),
    ]);
    const ovMap = new Map((ovs || []).map(o => [o.id, o.name]));
    const supMap = new Map((sups || []).map(s => [s.id, s]));
    const whMap = new Map((whs || []).map(w => [w.id, w]));

    const enriched = (alerts || []).map(a => ({
      ...a,
      option_name: ovMap.get(a.option_value_id) || "Unknown SKU",
      supplier: a.supplier_id ? supMap.get(a.supplier_id) : null,
      warehouse: whMap.get(a.warehouse_id) || null,
    }));

    return new Response(JSON.stringify({ alerts: enriched, total: enriched.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("reorder-suggestions error", e);
    return new Response(JSON.stringify({ error: "Failed to load reorder suggestions" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
