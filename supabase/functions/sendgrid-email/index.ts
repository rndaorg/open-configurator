import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SendEmailSchema = z.object({
  to: z.union([z.string().email(), z.array(z.string().email()).max(50)]),
  subject: z.string().min(1).max(500),
  html: z.string().max(100000).optional(),
  text: z.string().max(100000).optional(),
  templateId: z.string().max(255).optional(),
  dynamicTemplateData: z.record(z.unknown()).optional(),
  from: z.string().email().optional(),
  replyTo: z.string().email().optional(),
});

const OrderConfirmationSchema = z.object({
  orderId: z.string().uuid(),
  customerEmail: z.string().email(),
  customerName: z.string().max(255),
  productName: z.string().max(255),
  configurationSummary: z.string().max(5000),
  totalPrice: z.number().positive(),
  orderDate: z.string().max(100),
});

const StatusUpdateSchema = z.object({
  customerEmail: z.string().email(),
  customerName: z.string().max(255),
  orderId: z.string().uuid(),
  newStatus: z.string().max(50),
  trackingNumber: z.string().max(100).optional(),
});

async function requireAdmin(req: Request, supabase: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) throw new Error("AUTH_REQUIRED");
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) throw new Error("AUTH_REQUIRED");
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  if (!isAdmin) throw new Error("ADMIN_REQUIRED");
  return user;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY") || "SG.demo_key_for_demonstration";
    const isDemoMode = !Deno.env.get("SENDGRID_API_KEY");
    const defaultFrom = Deno.env.get("SENDGRID_FROM_EMAIL") || "demo@example.com";

    if (isDemoMode) {
      console.log("Running in DEMO MODE - returning simulated responses");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.pathname.split("/").pop();

    // All email sending requires admin auth
    try {
      await requireAdmin(req, supabase);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg === "AUTH_REQUIRED") {
        return new Response(JSON.stringify({ error: "Authentication required" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (msg === "ADMIN_REQUIRED") {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw e;
    }

    switch (action) {
      case "send": {
        const parsed = SendEmailSchema.safeParse(await req.json());
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { to, subject, html, text, templateId, dynamicTemplateData, from, replyTo } = parsed.data;
        const toAddresses = Array.isArray(to) ? to : [to];

        if (isDemoMode) {
          return new Response(JSON.stringify({ 
            success: true, message: "Demo mode: Email would be sent", demo: true,
            recipients: toAddresses, subject
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }
        
        const emailPayload: Record<string, unknown> = {
          personalizations: toAddresses.map(email => ({
            to: [{ email }],
            dynamic_template_data: dynamicTemplateData,
          })),
          from: { email: from || defaultFrom },
          subject,
        };
        if (replyTo) emailPayload.reply_to = { email: replyTo };
        if (templateId) {
          emailPayload.template_id = templateId;
        } else {
          emailPayload.content = [];
          if (text) (emailPayload.content as any[]).push({ type: "text/plain", value: text });
          if (html) (emailPayload.content as any[]).push({ type: "text/html", value: html });
        }

        const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: { "Authorization": `Bearer ${sendgridApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify(emailPayload),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`SendGrid error: ${errorText}`);
        }

        return new Response(JSON.stringify({ success: true, message: "Email sent successfully" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "order-confirmation": {
        const parsed = OrderConfirmationSchema.safeParse(await req.json());
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { orderId, customerEmail, customerName, productName, configurationSummary, totalPrice, orderDate } = parsed.data;

        if (isDemoMode) {
          return new Response(JSON.stringify({ 
            success: true, demo: true, message: "Demo mode: Order confirmation email would be sent",
            recipient: customerEmail, orderId
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const html = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
              .container { max-width: 600px; margin: 0 auto; padding: 20px; }
              .header { background: #1a1a2e; color: white; padding: 20px; text-align: center; }
              .content { padding: 20px; background: #f9f9f9; }
              .order-details { background: white; padding: 15px; border-radius: 8px; margin: 15px 0; }
              .total { font-size: 24px; color: #1a1a2e; font-weight: bold; }
              .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
            </style>
          </head>
          <body>
            <div class="container">
              <div class="header"><h1>Order Confirmation</h1></div>
              <div class="content">
                <p>Dear ${customerName},</p>
                <p>Thank you for your order!</p>
                <div class="order-details">
                  <h3>Order #${orderId.substring(0, 8).toUpperCase()}</h3>
                  <p><strong>Product:</strong> ${productName}</p>
                  <p><strong>Configuration:</strong></p>
                  <p>${configurationSummary}</p>
                  <p><strong>Order Date:</strong> ${orderDate}</p>
                  <p class="total">Total: $${totalPrice.toFixed(2)}</p>
                </div>
                <p>We'll notify you when your order ships.</p>
              </div>
              <div class="footer"><p>If you have any questions, please contact our support team.</p></div>
            </div>
          </body>
          </html>
        `;

        const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: { "Authorization": `Bearer ${sendgridApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: customerEmail }] }],
            from: { email: defaultFrom },
            subject: `Order Confirmation #${orderId.substring(0, 8).toUpperCase()}`,
            content: [{ type: "text/html", value: html }],
          }),
        });

        if (!response.ok) throw new Error(`SendGrid error: ${await response.text()}`);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "status-update": {
        const parsed = StatusUpdateSchema.safeParse(await req.json());
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { customerEmail, customerName, orderId, newStatus, trackingNumber } = parsed.data;

        if (isDemoMode) {
          return new Response(JSON.stringify({ 
            success: true, demo: true, message: "Demo mode: Status update email would be sent",
            recipient: customerEmail, orderId, newStatus
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        const statusMessages: Record<string, string> = {
          processing: "Your order is being processed",
          shipped: `Your order has been shipped${trackingNumber ? ` (Tracking: ${trackingNumber})` : ""}`,
          delivered: "Your order has been delivered",
          cancelled: "Your order has been cancelled",
        };

        const html = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Order Status Update</h2>
            <p>Dear ${customerName},</p>
            <p>${statusMessages[newStatus] || `Your order status is now: ${newStatus}`}</p>
            <p><strong>Order ID:</strong> #${orderId.substring(0, 8).toUpperCase()}</p>
            ${trackingNumber ? `<p><strong>Tracking Number:</strong> ${trackingNumber}</p>` : ""}
            <p>Thank you for your business!</p>
          </div>
        `;

        const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: { "Authorization": `Bearer ${sendgridApiKey}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: customerEmail }] }],
            from: { email: defaultFrom },
            subject: `Order Update #${orderId.substring(0, 8).toUpperCase()} - ${newStatus}`,
            content: [{ type: "text/html", value: html }],
          }),
        });

        if (!response.ok) throw new Error(`SendGrid error: ${await response.text()}`);

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("SendGrid email error:", error);
    return new Response(JSON.stringify({ error: "An error occurred processing your request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
