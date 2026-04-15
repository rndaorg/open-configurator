import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const PaymentRequestSchema = z.object({
  amount: z.number().positive().max(999999),
  currency: z.string().length(3).default("usd"),
  orderId: z.string().uuid(),
  customerEmail: z.string().email().max(255),
  metadata: z.record(z.string().max(500)).optional(),
});

const ConfirmPaymentSchema = z.object({
  paymentIntentId: z.string().max(255),
  orderId: z.string().uuid(),
});

const RefundSchema = z.object({
  paymentIntentId: z.string().max(255),
  amount: z.number().positive().max(999999).optional(),
  reason: z.string().max(255).optional(),
});

async function getAuthenticatedUser(req: Request, supabase: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return null;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  return user;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY") || "sk_test_demo_key_for_demonstration";
    const isDemoMode = !Deno.env.get("STRIPE_SECRET_KEY");

    if (isDemoMode) {
      console.log("Running in DEMO MODE - returning simulated responses");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.pathname.split("/").pop();

    // Webhook doesn't require auth
    if (action !== "webhook") {
      const user = await getAuthenticatedUser(req, supabase);
      if (!user) {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    switch (action) {
      case "create-payment-intent": {
        const rawBody = await req.json();
        const parsed = PaymentRequestSchema.safeParse(rawBody);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { amount, currency, orderId, customerEmail, metadata } = parsed.data;

        if (isDemoMode) {
          const demoPaymentId = `pi_demo_${Date.now()}`;
          return new Response(JSON.stringify({
            clientSecret: `${demoPaymentId}_secret_demo`,
            paymentIntentId: demoPaymentId,
            demo: true,
            message: "Demo mode: This is a simulated payment intent"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

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
        const rawBody = await req.json();
        const parsed = ConfirmPaymentSchema.safeParse(rawBody);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { paymentIntentId, orderId } = parsed.data;

        if (isDemoMode) {
          return new Response(JSON.stringify({ 
            success: true, status: "paid", demo: true,
            message: "Demo mode: Payment confirmed successfully"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

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
          success: false, status: paymentIntent.status 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "refund": {
        const rawBody = await req.json();
        const parsed = RefundSchema.safeParse(rawBody);
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { paymentIntentId, amount, reason } = parsed.data;

        // Refunds require admin
        const user = await getAuthenticatedUser(req, supabase);
        const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user?.id, _role: 'admin' });
        if (!isAdmin) {
          return new Response(JSON.stringify({ error: "Admin access required" }), {
            status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (isDemoMode) {
          return new Response(JSON.stringify({ 
            success: true, refundId: `re_demo_${Date.now()}`, status: "succeeded",
            demo: true, message: "Demo mode: Refund processed successfully"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const params: Record<string, string> = { payment_intent: paymentIntentId };
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
        if (refund.error) throw new Error(refund.error.message);

        return new Response(JSON.stringify({ 
          success: true, refundId: refund.id, status: refund.status 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "webhook": {
        const body = await req.text();
        console.log("Received Stripe webhook");

        const event = JSON.parse(body);

        switch (event.type) {
          case "payment_intent.succeeded": {
            const paymentIntent = event.data.object;
            if (paymentIntent.metadata?.order_id) {
              await supabase
                .from("orders")
                .update({ payment_status: "paid", status: "confirmed" })
                .eq("id", paymentIntent.metadata.order_id);
            }
            break;
          }
          case "payment_intent.payment_failed": {
            const failedPayment = event.data.object;
            if (failedPayment.metadata?.order_id) {
              await supabase
                .from("orders")
                .update({ payment_status: "failed" })
                .eq("id", failedPayment.metadata.order_id);
            }
            break;
          }
        }

        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Stripe payment error:", error);
    return new Response(JSON.stringify({ error: "An error occurred processing your request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
