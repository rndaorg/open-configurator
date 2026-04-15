import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CheckoutSchema = z.object({
  tierId: z.string().uuid(),
  billingInterval: z.enum(["monthly", "yearly"]),
  provider: z.enum(["stripe", "paddle"]),
});

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Auth required" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const token = authHeader.replace("Bearer ", "");
    const { data: { user } } = await supabase.auth.getUser(token);
    if (!user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate input
    const parsed = CheckoutSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { tierId, billingInterval, provider } = parsed.data;

    // Get tier
    const { data: tier, error: tierError } = await supabase
      .from("subscription_tiers")
      .select("*")
      .eq("id", tierId)
      .single();

    if (tierError || !tier) {
      return new Response(JSON.stringify({ error: "Tier not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const price = billingInterval === "yearly" ? tier.yearly_price_usd : tier.monthly_price_usd;

    // Check for real API keys
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const paddleKey = Deno.env.get("PADDLE_API_KEY");

    const isDemoMode = (provider === "stripe" && !stripeKey) || (provider === "paddle" && !paddleKey);

    if (isDemoMode) {
      // Demo mode: directly update subscription
      const { error: upsertError } = await supabase
        .from("user_subscriptions")
        .upsert({
          user_id: user.id,
          tier_id: tierId,
          status: "active",
          payment_provider: provider,
          billing_interval: billingInterval,
          provider_subscription_id: `demo_sub_${Date.now()}`,
          current_period_start: new Date().toISOString(),
          current_period_end: new Date(Date.now() + (billingInterval === "yearly" ? 365 : 30) * 86400000).toISOString(),
        }, { onConflict: "user_id" });

      if (upsertError) throw upsertError;

      return new Response(JSON.stringify({
        demo: true,
        message: `Demo: Subscribed to ${tier.name} (${provider}). Add ${provider === "stripe" ? "STRIPE_SECRET_KEY" : "PADDLE_API_KEY"} for real payments.`,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Real Stripe checkout
    if (provider === "stripe") {
      const response = await fetch("https://api.stripe.com/v1/checkout/sessions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${stripeKey}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          mode: "subscription",
          "line_items[0][price_data][currency]": "usd",
          "line_items[0][price_data][unit_amount]": Math.round(price * 100).toString(),
          "line_items[0][price_data][recurring][interval]": billingInterval === "yearly" ? "year" : "month",
          "line_items[0][price_data][product_data][name]": `${tier.name} Plan`,
          "line_items[0][quantity]": "1",
          customer_email: user.email!,
          success_url: `${req.headers.get("origin")}/profile?tab=subscription&status=success`,
          cancel_url: `${req.headers.get("origin")}/pricing?status=canceled`,
          "metadata[user_id]": user.id,
          "metadata[tier_id]": tierId,
          "metadata[billing_interval]": billingInterval,
        }),
      });

      const session = await response.json();
      if (session.error) throw new Error(session.error.message);

      return new Response(JSON.stringify({ checkoutUrl: session.url }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Real Paddle checkout
    if (provider === "paddle") {
      // Paddle API v2
      const paddleUrl = Deno.env.get("PADDLE_ENVIRONMENT") === "production"
        ? "https://api.paddle.com"
        : "https://sandbox-api.paddle.com";

      const response = await fetch(`${paddleUrl}/transactions`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${paddleKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{
            price: {
              description: `${tier.name} Plan - ${billingInterval}`,
              unit_price: { amount: Math.round(price * 100).toString(), currency_code: "USD" },
              billing_cycle: {
                interval: billingInterval === "yearly" ? "year" : "month",
                frequency: 1,
              },
              product: { name: `${tier.name} Plan`, tax_category: "standard" },
            },
            quantity: 1,
          }],
          customer: { email: user.email },
          custom_data: { user_id: user.id, tier_id: tierId, billing_interval: billingInterval },
          checkout: {
            url: `${req.headers.get("origin")}/profile?tab=subscription&status=success`,
          },
        }),
      });

      const transaction = await response.json();
      if (transaction.error) throw new Error(JSON.stringify(transaction.error));

      return new Response(JSON.stringify({
        checkoutUrl: transaction.data?.checkout?.url || null,
        transactionId: transaction.data?.id,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown provider" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Checkout error:", error);
    return new Response(JSON.stringify({ error: "Checkout failed" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
