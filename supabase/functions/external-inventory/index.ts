import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InventoryItem {
  sku: string;
  quantity: number;
  location?: string;
  lastUpdated?: string;
}

interface SyncRequest {
  provider: "shopify" | "woocommerce" | "custom";
  apiUrl?: string;
  apiKey?: string;
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
      case "sync": {
        const body: SyncRequest = await req.json();
        const { provider, apiUrl, apiKey } = body;

        let externalInventory: InventoryItem[] = [];

        switch (provider) {
          case "shopify": {
            const shopifyApiKey = apiKey || Deno.env.get("SHOPIFY_API_KEY");
            const shopifyStore = Deno.env.get("SHOPIFY_STORE_URL");
            
            if (!shopifyApiKey || !shopifyStore) {
              throw new Error("Shopify credentials not configured");
            }

            const response = await fetch(`${shopifyStore}/admin/api/2024-01/inventory_levels.json`, {
              headers: { "X-Shopify-Access-Token": shopifyApiKey },
            });

            if (response.ok) {
              const data = await response.json();
              externalInventory = data.inventory_levels.map((item: any) => ({
                sku: item.inventory_item_id.toString(),
                quantity: item.available,
                location: item.location_id.toString(),
                lastUpdated: new Date().toISOString(),
              }));
            }
            break;
          }

          case "woocommerce": {
            const wooUrl = apiUrl || Deno.env.get("WOOCOMMERCE_URL");
            const wooKey = apiKey || Deno.env.get("WOOCOMMERCE_CONSUMER_KEY");
            const wooSecret = Deno.env.get("WOOCOMMERCE_CONSUMER_SECRET");
            
            if (!wooUrl || !wooKey) {
              throw new Error("WooCommerce credentials not configured");
            }

            const auth = btoa(`${wooKey}:${wooSecret}`);
            const response = await fetch(`${wooUrl}/wp-json/wc/v3/products?per_page=100`, {
              headers: { "Authorization": `Basic ${auth}` },
            });

            if (response.ok) {
              const products = await response.json();
              externalInventory = products.map((product: any) => ({
                sku: product.sku,
                quantity: product.stock_quantity || 0,
                lastUpdated: new Date().toISOString(),
              }));
            }
            break;
          }

          case "custom": {
            if (!apiUrl) {
              throw new Error("Custom API URL required");
            }

            const response = await fetch(apiUrl, {
              headers: apiKey ? { "Authorization": `Bearer ${apiKey}` } : {},
            });

            if (response.ok) {
              externalInventory = await response.json();
            }
            break;
          }
        }

        // Update local inventory levels
        let updated = 0;
        for (const item of externalInventory) {
          const { error } = await supabase
            .from("inventory_levels")
            .upsert({
              option_value_id: item.sku,
              available_quantity: item.quantity,
              updated_at: item.lastUpdated || new Date().toISOString(),
            }, { onConflict: "option_value_id" });

          if (!error) updated++;
        }

        return new Response(JSON.stringify({
          success: true,
          synced: externalInventory.length,
          updated,
          timestamp: new Date().toISOString(),
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "check": {
        const { skus } = await req.json();

        const { data, error } = await supabase
          .from("inventory_levels")
          .select("option_value_id, available_quantity, reserved_quantity, low_stock_threshold")
          .in("option_value_id", skus);

        if (error) throw error;

        const inventory = data.map(item => ({
          sku: item.option_value_id,
          available: item.available_quantity - item.reserved_quantity,
          isLowStock: (item.available_quantity - item.reserved_quantity) <= item.low_stock_threshold,
        }));

        return new Response(JSON.stringify({ inventory }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "reserve": {
        const { sku, quantity, orderId } = await req.json();

        const { data: current, error: fetchError } = await supabase
          .from("inventory_levels")
          .select("available_quantity, reserved_quantity")
          .eq("option_value_id", sku)
          .single();

        if (fetchError) throw fetchError;

        const availableToReserve = current.available_quantity - current.reserved_quantity;
        if (availableToReserve < quantity) {
          return new Response(JSON.stringify({
            success: false,
            error: "Insufficient inventory",
            available: availableToReserve,
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        const { error: updateError } = await supabase
          .from("inventory_levels")
          .update({ reserved_quantity: current.reserved_quantity + quantity })
          .eq("option_value_id", sku);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true, reserved: quantity }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "release": {
        const { sku, quantity } = await req.json();

        const { data: current, error: fetchError } = await supabase
          .from("inventory_levels")
          .select("reserved_quantity")
          .eq("option_value_id", sku)
          .single();

        if (fetchError) throw fetchError;

        const newReserved = Math.max(0, current.reserved_quantity - quantity);

        const { error: updateError } = await supabase
          .from("inventory_levels")
          .update({ reserved_quantity: newReserved })
          .eq("option_value_id", sku);

        if (updateError) throw updateError;

        return new Response(JSON.stringify({ success: true, released: quantity }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "webhook": {
        // Handle incoming webhooks from external inventory systems
        const event = await req.json();
        console.log("Received inventory webhook:", JSON.stringify(event).substring(0, 200));

        if (event.type === "inventory_update" && event.sku) {
          await supabase
            .from("inventory_levels")
            .upsert({
              option_value_id: event.sku,
              available_quantity: event.quantity,
              updated_at: new Date().toISOString(),
            }, { onConflict: "option_value_id" });
        }

        return new Response(JSON.stringify({ received: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("External inventory error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
