import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CRMContact {
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  company?: string;
  customFields?: Record<string, unknown>;
}

interface CRMDeal {
  contactEmail: string;
  title: string;
  value: number;
  stage?: string;
  productId?: string;
  configurationId?: string;
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

    switch (action) {
      case "sync-contact": {
        const body: CRMContact & { provider: string } = await req.json();
        const { provider, email, firstName, lastName, phone, company, customFields } = body;

        switch (provider) {
          case "hubspot": {
            const hubspotKey = Deno.env.get("HUBSPOT_API_KEY");
            if (!hubspotKey) throw new Error("HubSpot API key not configured");

            const response = await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${hubspotKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                properties: {
                  email,
                  firstname: firstName,
                  lastname: lastName,
                  phone,
                  company,
                  ...customFields,
                },
              }),
            });

            if (!response.ok) {
              // Try to update existing contact
              const searchResponse = await fetch(
                `https://api.hubapi.com/crm/v3/objects/contacts/search`,
                {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${hubspotKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    filterGroups: [{
                      filters: [{ propertyName: "email", operator: "EQ", value: email }],
                    }],
                  }),
                }
              );

              const searchData = await searchResponse.json();
              if (searchData.results?.length > 0) {
                const contactId = searchData.results[0].id;
                await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${contactId}`, {
                  method: "PATCH",
                  headers: {
                    "Authorization": `Bearer ${hubspotKey}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    properties: { firstname: firstName, lastname: lastName, phone, company },
                  }),
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
              headers: {
                "Authorization": `Bearer ${sfToken}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                Email: email,
                FirstName: firstName,
                LastName: lastName || "Unknown",
                Phone: phone,
                ...customFields,
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
        const body: CRMDeal & { provider: string } = await req.json();
        const { provider, contactEmail, title, value, stage, productId, configurationId } = body;

        switch (provider) {
          case "hubspot": {
            const hubspotKey = Deno.env.get("HUBSPOT_API_KEY");
            if (!hubspotKey) throw new Error("HubSpot API key not configured");

            // Find contact first
            const searchResponse = await fetch(
              `https://api.hubapi.com/crm/v3/objects/contacts/search`,
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${hubspotKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  filterGroups: [{
                    filters: [{ propertyName: "email", operator: "EQ", value: contactEmail }],
                  }],
                }),
              }
            );

            const searchData = await searchResponse.json();
            const contactId = searchData.results?.[0]?.id;

            const dealResponse = await fetch("https://api.hubapi.com/crm/v3/objects/deals", {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${hubspotKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                properties: {
                  dealname: title,
                  amount: value.toString(),
                  dealstage: stage || "appointmentscheduled",
                  product_id: productId,
                  configuration_id: configurationId,
                },
              }),
            });

            const deal = await dealResponse.json();

            // Associate deal with contact
            if (contactId && deal.id) {
              await fetch(
                `https://api.hubapi.com/crm/v3/objects/deals/${deal.id}/associations/contacts/${contactId}/deal_to_contact`,
                {
                  method: "PUT",
                  headers: { "Authorization": `Bearer ${hubspotKey}` },
                }
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
              body: JSON.stringify({
                title,
                value,
                currency: "USD",
                stage_id: stage ? parseInt(stage) : 1,
              }),
            });
            break;
          }
        }

        return new Response(JSON.stringify({ success: true, deal: title }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "log-activity": {
        const { provider, contactEmail, activityType, description, productId } = await req.json();

        switch (provider) {
          case "hubspot": {
            const hubspotKey = Deno.env.get("HUBSPOT_API_KEY");
            if (!hubspotKey) throw new Error("HubSpot API key not configured");

            // Find contact
            const searchResponse = await fetch(
              `https://api.hubapi.com/crm/v3/objects/contacts/search`,
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${hubspotKey}`,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify({
                  filterGroups: [{
                    filters: [{ propertyName: "email", operator: "EQ", value: contactEmail }],
                  }],
                }),
              }
            );

            const searchData = await searchResponse.json();
            const contactId = searchData.results?.[0]?.id;

            if (contactId) {
              await fetch("https://api.hubapi.com/crm/v3/objects/notes", {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${hubspotKey}`,
                  "Content-Type": "application/json",
                },
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
        console.log("CRM webhook received:", JSON.stringify(event).substring(0, 200));

        // Handle incoming CRM webhooks (e.g., deal stage changes)
        if (event.type === "deal.updated" && event.orderId) {
          // Update order status based on CRM deal stage
          const statusMap: Record<string, string> = {
            won: "confirmed",
            lost: "cancelled",
          };

          if (statusMap[event.stage]) {
            await supabase
              .from("orders")
              .update({ status: statusMap[event.stage] })
              .eq("id", event.orderId);
          }
        }

        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("CRM integration error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
