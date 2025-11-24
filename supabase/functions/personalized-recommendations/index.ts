import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { userId } = await req.json();

    // Get user's interaction history
    const { data: preferences, error: prefError } = await supabase
      .from("user_preferences")
      .select("*, products(*)")
      .eq("user_id", userId)
      .order("interaction_score", { ascending: false })
      .limit(10);

    if (prefError) throw prefError;

    // Get user's configuration history
    const { data: configurations, error: configError } = await supabase
      .from("product_configurations")
      .select("*, products(*)")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (configError) throw configError;

    // Get user's order history
    const { data: orders, error: orderError } = await supabase
      .from("orders")
      .select("product_id, configuration_data")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10);

    if (orderError) throw orderError;

    // Calculate product affinity scores
    const productScores = new Map<string, number>();

    // Score from preferences (highest weight)
    preferences?.forEach((pref) => {
      const score = Number(pref.interaction_score) * 3;
      productScores.set(
        pref.product_id,
        (productScores.get(pref.product_id) || 0) + score
      );
    });

    // Score from configurations (medium weight)
    configurations?.forEach((config) => {
      if (config.product_id) {
        productScores.set(
          config.product_id,
          (productScores.get(config.product_id) || 0) + 2
        );
      }
    });

    // Score from orders (highest conversion weight)
    orders?.forEach((order) => {
      if (order.product_id) {
        productScores.set(
          order.product_id,
          (productScores.get(order.product_id) || 0) + 5
        );
      }
    });

    // Get top products based on scores
    const sortedProducts = Array.from(productScores.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([productId]) => productId);

    // Fetch recommended products
    const { data: recommendedProducts, error: recError } = await supabase
      .from("products")
      .select("*")
      .in("id", sortedProducts);

    if (recError) throw recError;

    // If no personalized recommendations, get popular products
    let finalRecommendations = recommendedProducts || [];
    
    if (finalRecommendations.length < 3) {
      const { data: popularProducts, error: popError } = await supabase
        .from("products")
        .select("*")
        .eq("is_active", true)
        .limit(5);

      if (popError) throw popError;
      
      finalRecommendations = [...finalRecommendations, ...(popularProducts || [])]
        .filter((product, index, self) => 
          index === self.findIndex((p) => p.id === product.id)
        )
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
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error generating recommendations:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
