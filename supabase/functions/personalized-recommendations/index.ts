import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const RequestSchema = z.object({
  userId: z.string().uuid(),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate auth
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

    // Validate input
    const parsed = RequestSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId } = parsed.data;

    // Ensure user can only get their own recommendations
    if (user.id !== userId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's interaction history
    const { data: preferences, error: prefError } = await supabase
      .from("user_preferences")
      .select("*, products(*)")
      .eq("user_id", userId)
      .order("interaction_score", { ascending: false })
      .limit(10);

    if (prefError) throw prefError;

    const { data: configurations, error: configError } = await supabase
      .from("product_configurations")
      .select("*, products(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (configError) throw configError;

    const { data: orders, error: orderError } = await supabase
      .from("orders")
      .select("product_id, configuration_data")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (orderError) throw orderError;

    const productScores = new Map<string, number>();

    preferences?.forEach((pref) => {
      const score = Number(pref.interaction_score) * 3;
      productScores.set(pref.product_id, (productScores.get(pref.product_id) || 0) + score);
    });

    configurations?.forEach((config) => {
      if (config.product_id) {
        productScores.set(config.product_id, (productScores.get(config.product_id) || 0) + 2);
      }
    });

    orders?.forEach((order) => {
      if (order.product_id) {
        productScores.set(order.product_id, (productScores.get(order.product_id) || 0) + 5);
      }
    });

    const sortedProducts = Array.from(productScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([productId]) => productId);

    const { data: recommendedProducts, error: recError } = await supabase
      .from("products")
      .select("*")
      .in("id", sortedProducts.length > 0 ? sortedProducts : ["00000000-0000-0000-0000-000000000000"]);

    if (recError) throw recError;

    let finalRecommendations = recommendedProducts || [];
    
    if (finalRecommendations.length < 3) {
      const { data: popularProducts, error: popError } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .limit(5);

      if (popError) throw popError;
      
      finalRecommendations = [...finalRecommendations, ...(popularProducts || [])]
        .filter((product, index, self) => index === self.findIndex((p) => p.id === product.id))
        .slice(0, 5);
    }

    return new Response(
      JSON.stringify({
        recommendations: finalRecommendations,
        personalized: sortedProducts.length > 0,
        reason: sortedProducts.length > 0 
          ? "Based on your browsing and purchase history"
          : "Popular products",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return new Response(
      JSON.stringify({ error: "An error occurred generating recommendations" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
