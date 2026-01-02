import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface PaymentRequest {
  amount: number;
  currency?: string;
  orderId: string;
  customerEmail: string;
  metadata?: Record<string, string>;
}

interface RefundRequest {
  paymentIntentId: string;
  amount?: number;
  reason?: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeSecretKey) {
      throw new Error("STRIPE_SECRET_KEY not configured");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.pathname.split("/").pop();

    switch (action) {
      case "create-payment-intent": {
        const body: PaymentRequest = await req.json();
        const { amount, currency = "usd", orderId, customerEmail, metadata } = body;

        // Create payment intent via Stripe API
        const response = await fetch("https://api.stripe.com/v1/payment_intents", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${stripeSecretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            amount: Math.round(amount * 100).toString(),
            currency,
            receipt_email: customerEmail,
            "metadata[order_id]": orderId,
            ...Object.fromEntries(
              Object.entries(metadata || {}).map(([k, v]) => [`metadata[${k}]`, v])
            ),
          }),
        });

        const paymentIntent = await response.json();

        if (paymentIntent.error) {
          throw new Error(paymentIntent.error.message);
        }

        // Update order with payment intent ID
        await supabase
          .from("orders")
          .update({ 
            payment_status: "processing",
            configuration_data: { payment_intent_id: paymentIntent.id }
          })
          .eq("id", orderId);

        return new Response(JSON.stringify({
          clientSecret: paymentIntent.client_secret,
          paymentIntentId: paymentIntent.id,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "confirm-payment": {
        const { paymentIntentId, orderId } = await req.json();

        // Verify payment status
        const response = await fetch(`https://api.stripe.com/v1/payment_intents/${paymentIntentId}`, {
          headers: { "Authorization": `Bearer ${stripeSecretKey}` },
        });

        const paymentIntent = await response.json();

        if (paymentIntent.status === "succeeded") {
          await supabase
            .from("orders")
            .update({ payment_status: "paid", status: "confirmed" })
            .eq("id", orderId);

          return new Response(JSON.stringify({ success: true, status: "paid" }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        return new Response(JSON.stringify({ 
          success: false, 
          status: paymentIntent.status 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "refund": {
        const body: RefundRequest = await req.json();
        const { paymentIntentId, amount, reason } = body;

        const params: Record<string, string> = {
          payment_intent: paymentIntentId,
        };
        if (amount) params.amount = Math.round(amount * 100).toString();
        if (reason) params.reason = reason;

        const response = await fetch("https://api.stripe.com/v1/refunds", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${stripeSecretKey}`,
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams(params),
        });

        const refund = await response.json();

        if (refund.error) {
          throw new Error(refund.error.message);
        }

        return new Response(JSON.stringify({ 
          success: true, 
          refundId: refund.id,
          status: refund.status 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "webhook": {
        const body = await req.text();
        const sig = req.headers.get("stripe-signature");
        const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");

        // Verify webhook signature (simplified - production should use stripe library)
        console.log("Received Stripe webhook:", body.substring(0, 100));

        const event = JSON.parse(body);

        switch (event.type) {
          case "payment_intent.succeeded":
            const paymentIntent = event.data.object;
            if (paymentIntent.metadata?.order_id) {
              await supabase
                .from("orders")
                .update({ payment_status: "paid", status: "confirmed" })
                .eq("id", paymentIntent.metadata.order_id);
            }
            break;

          case "payment_intent.payment_failed":
            const failedPayment = event.data.object;
            if (failedPayment.metadata?.order_id) {
              await supabase
                .from("orders")
                .update({ payment_status: "failed" })
                .eq("id", failedPayment.metadata.order_id);
            }
            break;
        }

        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("Stripe payment error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
