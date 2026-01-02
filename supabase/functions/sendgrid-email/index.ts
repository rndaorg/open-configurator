import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailRequest {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  dynamicTemplateData?: Record<string, unknown>;
  from?: string;
  replyTo?: string;
}

interface OrderConfirmationData {
  orderId: string;
  customerEmail: string;
  customerName: string;
  productName: string;
  configurationSummary: string;
  totalPrice: number;
  orderDate: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const sendgridApiKey = Deno.env.get("SENDGRID_API_KEY");
    if (!sendgridApiKey) {
      throw new Error("SENDGRID_API_KEY not configured");
    }

    const defaultFrom = Deno.env.get("SENDGRID_FROM_EMAIL") || "noreply@example.com";
    const url = new URL(req.url);
    const action = url.pathname.split("/").pop();

    switch (action) {
      case "send": {
        const body: EmailRequest = await req.json();
        const { to, subject, html, text, templateId, dynamicTemplateData, from, replyTo } = body;

        const toAddresses = Array.isArray(to) ? to : [to];
        
        const emailPayload: Record<string, unknown> = {
          personalizations: toAddresses.map(email => ({
            to: [{ email }],
            dynamic_template_data: dynamicTemplateData,
          })),
          from: { email: from || defaultFrom },
          subject,
        };

        if (replyTo) {
          emailPayload.reply_to = { email: replyTo };
        }

        if (templateId) {
          emailPayload.template_id = templateId;
        } else {
          emailPayload.content = [];
          if (text) emailPayload.content.push({ type: "text/plain", value: text });
          if (html) emailPayload.content.push({ type: "text/html", value: html });
        }

        const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${sendgridApiKey}`,
            "Content-Type": "application/json",
          },
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
        const body: OrderConfirmationData = await req.json();
        const { orderId, customerEmail, customerName, productName, configurationSummary, totalPrice, orderDate } = body;

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
              <div class="header">
                <h1>Order Confirmation</h1>
              </div>
              <div class="content">
                <p>Dear ${customerName},</p>
                <p>Thank you for your order! We're excited to confirm your purchase.</p>
                
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
              <div class="footer">
                <p>If you have any questions, please contact our support team.</p>
              </div>
            </div>
          </body>
          </html>
        `;

        const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${sendgridApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: customerEmail }] }],
            from: { email: defaultFrom },
            subject: `Order Confirmation #${orderId.substring(0, 8).toUpperCase()}`,
            content: [{ type: "text/html", value: html }],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`SendGrid error: ${errorText}`);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "status-update": {
        const { customerEmail, customerName, orderId, newStatus, trackingNumber } = await req.json();

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
          headers: {
            "Authorization": `Bearer ${sendgridApiKey}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            personalizations: [{ to: [{ email: customerEmail }] }],
            from: { email: defaultFrom },
            subject: `Order Update #${orderId.substring(0, 8).toUpperCase()} - ${newStatus}`,
            content: [{ type: "text/html", value: html }],
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`SendGrid error: ${errorText}`);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("SendGrid email error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
