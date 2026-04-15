import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ReportConfigSchema = z.object({
  reportType: z.enum(["sales", "orders", "customers", "products", "full"]).default("full"),
  dateFrom: z.string().max(100).optional(),
  dateTo: z.string().max(100).optional(),
  format: z.enum(["json", "csv"]).default("json"),
  recipientEmail: z.string().email().max(255).optional(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Require admin authentication
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Authentication required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate input
    const parsed = ReportConfigSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { reportType, format } = parsed.data;
    const fromDate = parsed.data.dateFrom || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const toDate = parsed.data.dateTo || new Date().toISOString();

    console.log(`Generating ${reportType} report from ${fromDate} to ${toDate}`);

    const reportData: Record<string, unknown> = {
      generatedAt: new Date().toISOString(),
      dateRange: { from: fromDate, to: toDate },
      reportType,
    };

    // Fetch sales data
    if (reportType === "sales" || reportType === "full") {
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, total_price, status, created_at, product_id")
        .gte("created_at", fromDate)
        .lte("created_at", toDate);

      if (ordersError) throw ordersError;

      const totalRevenue = orders?.reduce((sum, o) => sum + (o.total_price || 0), 0) || 0;
      const totalOrders = orders?.length || 0;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      const ordersByStatus = orders?.reduce((acc: Record<string, number>, order) => {
        acc[order.status] = (acc[order.status] || 0) + 1;
        return acc;
      }, {}) || {};

      reportData.sales = { totalRevenue, totalOrders, avgOrderValue, ordersByStatus, orders: orders || [] };
    }

    if (reportType === "customers" || reportType === "full") {
      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, email, created_at")
        .gte("created_at", fromDate)
        .lte("created_at", toDate);

      if (profilesError) throw profilesError;

      const { data: searchAnalytics, error: searchError } = await supabase
        .from("search_analytics")
        .select("search_query, results_count")
        .gte("created_at", fromDate)
        .lte("created_at", toDate)
        .limit(100);

      if (searchError) throw searchError;

      const searchCounts = searchAnalytics?.reduce((acc: Record<string, number>, s) => {
        acc[s.search_query] = (acc[s.search_query] || 0) + 1;
        return acc;
      }, {}) || {};

      const topSearches = Object.entries(searchCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10)
        .map(([query, count]) => ({ query, count }));

      reportData.customers = { newCustomers: profiles?.length || 0, topSearches };
    }

    if (reportType === "products" || reportType === "full") {
      const { data: products, error: productsError } = await supabase
        .from("products")
        .select("id, name, base_price, is_active, category_id");

      if (productsError) throw productsError;

      const { data: categories, error: categoriesError } = await supabase
        .from("categories")
        .select("id, name");

      if (categoriesError) throw categoriesError;

      reportData.products = {
        totalProducts: products?.length || 0,
        activeProducts: products?.filter(p => p.is_active).length || 0,
        categories: categories || [],
        productList: products || [],
      };
    }

    if (reportType === "full") {
      const { data: configAnalytics, error: configError } = await supabase
        .from("configuration_analytics")
        .select("completion_rate, abandonment_point")
        .gte("created_at", fromDate)
        .lte("created_at", toDate);

      if (configError) throw configError;

      const avgCompletionRate = configAnalytics?.length
        ? configAnalytics.reduce((sum, c) => sum + (c.completion_rate || 0), 0) / configAnalytics.length
        : 0;

      const abandonmentPoints = configAnalytics?.reduce((acc: Record<string, number>, c) => {
        if (c.abandonment_point) {
          acc[c.abandonment_point] = (acc[c.abandonment_point] || 0) + 1;
        }
        return acc;
      }, {}) || {};

      reportData.conversionFunnel = { avgCompletionRate, abandonmentPoints, totalSessions: configAnalytics?.length || 0 };
    }

    if (format === "csv") {
      const csvData = convertToCSV(reportData);
      return new Response(csvData, {
        headers: {
          ...corsHeaders,
          "Content-Type": "text/csv",
          "Content-Disposition": `attachment; filename="report-${reportType}-${new Date().toISOString().split('T')[0]}.csv"`,
        },
      });
    }

    return new Response(JSON.stringify(reportData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error generating report:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred generating the report" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

function convertToCSV(data: Record<string, unknown>): string {
  const lines: string[] = [];
  
  lines.push(`Report Generated: ${data.generatedAt}`);
  lines.push(`Date Range: ${(data.dateRange as { from: string; to: string }).from} to ${(data.dateRange as { from: string; to: string }).to}`);
  lines.push(`Report Type: ${data.reportType}`);
  lines.push("");

  if (data.sales) {
    const sales = data.sales as { totalRevenue: number; totalOrders: number; avgOrderValue: number; ordersByStatus: Record<string, number> };
    lines.push("=== SALES SUMMARY ===");
    lines.push(`Total Revenue,${sales.totalRevenue}`);
    lines.push(`Total Orders,${sales.totalOrders}`);
    lines.push(`Average Order Value,${sales.avgOrderValue.toFixed(2)}`);
    lines.push("");
    lines.push("Orders by Status");
    Object.entries(sales.ordersByStatus).forEach(([status, count]) => {
      lines.push(`${status},${count}`);
    });
    lines.push("");
  }

  if (data.customers) {
    const customers = data.customers as { newCustomers: number; topSearches: { query: string; count: number }[] };
    lines.push("=== CUSTOMER INSIGHTS ===");
    lines.push(`New Customers,${customers.newCustomers}`);
    lines.push("");
    lines.push("Top Searches");
    lines.push("Query,Count");
    customers.topSearches.forEach(({ query, count }) => {
      lines.push(`"${query}",${count}`);
    });
    lines.push("");
  }

  if (data.products) {
    const products = data.products as { totalProducts: number; activeProducts: number };
    lines.push("=== PRODUCT SUMMARY ===");
    lines.push(`Total Products,${products.totalProducts}`);
    lines.push(`Active Products,${products.activeProducts}`);
    lines.push("");
  }

  if (data.conversionFunnel) {
    const funnel = data.conversionFunnel as { avgCompletionRate: number; totalSessions: number; abandonmentPoints: Record<string, number> };
    lines.push("=== CONVERSION FUNNEL ===");
    lines.push(`Average Completion Rate,${(funnel.avgCompletionRate * 100).toFixed(1)}%`);
    lines.push(`Total Sessions,${funnel.totalSessions}`);
    lines.push("");
    lines.push("Abandonment Points");
    Object.entries(funnel.abandonmentPoints).forEach(([point, count]) => {
      lines.push(`${point},${count}`);
    });
  }

  return lines.join("\n");
}
