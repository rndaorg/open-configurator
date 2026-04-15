import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SyncContactSchema = z.object({
  provider: z.enum(["hubspot", "salesforce", "pipedrive"]),
  email: z.string().email().max(255),
  firstName: z.string().max(255).optional(),
  lastName: z.string().max(255).optional(),
  phone: z.string().max(50).optional(),
  company: z.string().max(255).optional(),
  customFields: z.record(z.unknown()).optional(),
});

const CreateDealSchema = z.object({
  provider: z.enum(["hubspot", "salesforce", "pipedrive"]),
  contactEmail: z.string().email().max(255),
  title: z.string().max(500),
  value: z.number().positive().max(999999999),
  stage: z.string().max(100).optional(),
  productId: z.string().uuid().optional(),
  configurationId: z.string().uuid().optional(),
});

const LogActivitySchema = z.object({
  provider: z.enum(["hubspot", "salesforce", "pipedrive"]),
  contactEmail: z.string().email().max(255),
  activityType: z.string().max(100),
  description: z.string().max(5000),
  productId: z.string().uuid().optional(),
});

async function requireAdmin(req: Request, supabase: any) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return false;
  const token = authHeader.replace("Bearer ", "");
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user) return false;
  const { data: isAdmin } = await supabase.rpc('has_role', { _user_id: user.id, _role: 'admin' });
  return !!isAdmin;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const url = new URL(req.url);
    const action = url.pathname.split("/").pop();

    // All CRM actions except webhook require admin
    if (action !== "webhook") {
      if (!await requireAdmin(req, supabase)) {
        return new Response(JSON.stringify({ error: "Admin access required" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    switch (action) {
      case "sync-contact": {
        const parsed = SyncContactSchema.safeParse(await req.json());
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { provider, email, firstName, lastName, phone, company, customFields } = parsed.data;

        switch (provider) {
          case "hubspot": {
            const hubspotKey = Deno.env.get("HUBSPOT_API_KEY");
            if (!hubspotKey) throw new Error("HubSpot API key not configured");

            const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
              method: "POST",
              headers: { "Authorization": `Bearer ${hubspotKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                properties: { email, firstname: firstName, lastname: lastName, phone, company, ...customFields },
              }),
            });

            if (!response.ok) {
              const searchResponse = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
                method: "POST",
                headers: { "Authorization": `Bearer ${hubspotKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: email }] }],
                }),
              });

              const searchData = await searchResponse.json();
              if (searchData.results?.length > 0) {
                const contactId = searchData.results[0].id;
                await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
                  method: "PATCH",
                  headers: { "Authorization": `Bearer ${hubspotKey}`, "Content-Type": "application/json" },
                  body: JSON.stringify({ properties: { firstname: firstName, lastname: lastName, phone, company } }),
                });
              }
            }
            break;
          }
          case "salesforce": {
            const sfToken = Deno.env.get("SALESFORCE_ACCESS_TOKEN");
            const sfInstance = Deno.env.get("SALESFORCE_INSTANCE_URL");
            if (!sfToken || !sfInstance) throw new Error("Salesforce credentials not configured");

            await fetch(`${sfInstance}/services/data/v58.0/sobjects/Contact`, {
              method: "POST",
              headers: { "Authorization": `Bearer ${sfToken}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                Email: email, FirstName: firstName, LastName: lastName || "Unknown", Phone: phone, ...customFields,
              }),
            });
            break;
          }
          case "pipedrive": {
            const pipedriveKey = Deno.env.get("PIPEDRIVE_API_KEY");
            if (!pipedriveKey) throw new Error("Pipedrive API key not configured");

            await fetch(`https://api.pipedrive.com/v1/persons?api_token=${pipedriveKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: `${firstName || ""} ${lastName || ""}`.trim() || email,
                email: [{ value: email, primary: true }],
                phone: phone ? [{ value: phone, primary: true }] : undefined,
              }),
            });
            break;
          }
        }

        return new Response(JSON.stringify({ success: true, synced: email }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "create-deal": {
        const parsed = CreateDealSchema.safeParse(await req.json());
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { provider, contactEmail, title, value, stage, productId, configurationId } = parsed.data;

        switch (provider) {
          case "hubspot": {
            const hubspotKey = Deno.env.get("HUBSPOT_API_KEY");
            if (!hubspotKey) throw new Error("HubSpot API key not configured");

            const searchResponse = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
              method: "POST",
              headers: { "Authorization": `Bearer ${hubspotKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: contactEmail }] }],
              }),
            });

            const searchData = await searchResponse.json();
            const contactId = searchData.results?.[0]?.id;

            const dealResponse = await fetch("https://api.hubapi.com/crm/v3/objects/deals", {
              method: "POST",
              headers: { "Authorization": `Bearer ${hubspotKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                properties: {
                  dealname: title, amount: value.toString(),
                  dealstage: stage || "appointmentscheduled",
                  product_id: productId, configuration_id: configurationId,
                },
              }),
            });

            const deal = await dealResponse.json();

            if (contactId && deal.id) {
              await fetch(
                `https://api.hubapi.com/crm/v3/objects/deals/${deal.id}/associations/contacts/${contactId}/deal_to_contact`,
                { method: "PUT", headers: { "Authorization": `Bearer ${hubspotKey}` } }
              );
            }
            break;
          }
          case "pipedrive": {
            const pipedriveKey = Deno.env.get("PIPEDRIVE_API_KEY");
            if (!pipedriveKey) throw new Error("Pipedrive API key not configured");

            await fetch(`https://api.pipedrive.com/v1/deals?api_token=${pipedriveKey}`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ title, value, currency: "USD", stage_id: stage ? parseInt(stage) : 1 }),
            });
            break;
          }
        }

        return new Response(JSON.stringify({ success: true, deal: title }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "log-activity": {
        const parsed = LogActivitySchema.safeParse(await req.json());
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { provider, contactEmail, activityType, description, productId } = parsed.data;

        switch (provider) {
          case "hubspot": {
            const hubspotKey = Deno.env.get("HUBSPOT_API_KEY");
            if (!hubspotKey) throw new Error("HubSpot API key not configured");

            const searchResponse = await fetch("https://api.hubapi.com/crm/v3/objects/contacts/search", {
              method: "POST",
              headers: { "Authorization": `Bearer ${hubspotKey}`, "Content-Type": "application/json" },
              body: JSON.stringify({
                filterGroups: [{ filters: [{ propertyName: "email", operator: "EQ", value: contactEmail }] }],
              }),
            });

            const searchData = await searchResponse.json();
            const contactId = searchData.results?.[0]?.id;

            if (contactId) {
              await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
                method: "POST",
                headers: { "Authorization": `Bearer ${hubspotKey}`, "Content-Type": "application/json" },
                body: JSON.stringify({
                  properties: {
                    hs_note_body: `${activityType}: ${description}${productId ? ` (Product: ${productId})` : ""}`,
                    hs_timestamp: new Date().toISOString(),
                  },
                  associations: [{
                    to: { id: contactId },
                    types: [{ associationCategory: "HUBSPOT_DEFINED", associationTypeId: 202 }],
                  }],
                }),
              });
            }
            break;
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "webhook": {
        const event = await req.json();
        console.log("CRM webhook received");

        if (event.type === "deal.updated" && event.orderId) {
          const statusMap: Record<string, string> = { won: "confirmed", lost: "cancelled" };
          if (statusMap[event.stage]) {
            await supabase.from("orders").update({ status: statusMap[event.stage] }).eq("id", event.orderId);
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
    console.error("CRM integration error:", error);
    return new Response(JSON.stringify({ error: "An error occurred processing your request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
