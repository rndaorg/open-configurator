import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ShareableConfig {
  productId: string;
  productName: string;
  configurationId: string;
  configurationName?: string;
  imageUrl?: string;
  totalPrice: number;
  selectedOptions: Record<string, string>;
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
      case "generate-link": {
        const body: ShareableConfig = await req.json();
        const { productId, productName, configurationId, configurationName, imageUrl, totalPrice, selectedOptions } = body;

        // Generate a unique share ID
        const shareId = crypto.randomUUID().substring(0, 8);
        const baseUrl = Deno.env.get("APP_URL") || "https://app.example.com";

        // Store shareable configuration data
        const shareData = {
          id: shareId,
          productId,
          productName,
          configurationId,
          configurationName,
          imageUrl,
          totalPrice,
          selectedOptions,
          createdAt: new Date().toISOString(),
          views: 0,
        };

        // For demo, we'll encode in URL - in production, store in DB
        const encodedData = btoa(JSON.stringify({
          pid: productId,
          cid: configurationId,
          opts: selectedOptions,
        }));

        const shareUrl = `${baseUrl}/shared/${shareId}?data=${encodedData}`;

        // Generate social media share URLs
        const title = encodeURIComponent(configurationName || `Custom ${productName}`);
        const description = encodeURIComponent(`Check out my custom ${productName} configuration - $${totalPrice.toFixed(2)}`);
        const image = encodeURIComponent(imageUrl || "");

        const socialLinks = {
          shareUrl,
          shareId,
          facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${description}`,
          twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${description}`,
          linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
          pinterest: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&media=${image}&description=${description}`,
          whatsapp: `https://wa.me/?text=${description}%20${encodeURIComponent(shareUrl)}`,
          email: `mailto:?subject=${title}&body=${description}%0A%0A${encodeURIComponent(shareUrl)}`,
          copyLink: shareUrl,
        };

        // Generate Open Graph meta tags for the share page
        const ogTags = {
          "og:title": configurationName || `Custom ${productName}`,
          "og:description": `Check out this custom configuration - $${totalPrice.toFixed(2)}`,
          "og:image": imageUrl || "",
          "og:url": shareUrl,
          "og:type": "product",
          "twitter:card": "summary_large_image",
          "twitter:title": configurationName || `Custom ${productName}`,
          "twitter:description": `Check out this custom configuration - $${totalPrice.toFixed(2)}`,
          "twitter:image": imageUrl || "",
        };

        return new Response(JSON.stringify({ 
          success: true, 
          shareUrl,
          shareId,
          socialLinks,
          ogTags,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "track-share": {
        const { shareId, platform, referrer } = await req.json();

        // Track share analytics
        console.log(`Share tracked: ${shareId} on ${platform} from ${referrer}`);

        // In production, store in analytics table
        // await supabase.from('share_analytics').insert({ ... });

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "track-view": {
        const { shareId, referrer, userAgent } = await req.json();

        console.log(`Share view: ${shareId} from ${referrer}`);

        // Track view analytics
        // In production, increment view counter

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "resolve": {
        const { shareId, data } = await req.json();

        try {
          // Decode the share data
          const decoded = JSON.parse(atob(data));
          
          // Fetch full product and configuration details
          const { data: product, error: productError } = await supabase
            .from("products")
            .select(`
              *,
              config_options (
                *,
                option_values (*)
              )
            `)
            .eq("id", decoded.pid)
            .single();

          if (productError) throw productError;

          // Build configuration details
          const configurationDetails: Record<string, { optionName: string; valueName: string; priceModifier: number }> = {};
          
          if (product?.config_options) {
            for (const option of product.config_options) {
              const selectedValueId = decoded.opts[option.id];
              if (selectedValueId) {
                const value = option.option_values?.find((v: any) => v.id === selectedValueId);
                if (value) {
                  configurationDetails[option.id] = {
                    optionName: option.name,
                    valueName: value.name,
                    priceModifier: value.price_modifier,
                  };
                }
              }
            }
          }

          return new Response(JSON.stringify({
            success: true,
            product: {
              id: product.id,
              name: product.name,
              description: product.description,
              basePrice: product.base_price,
              imageUrl: product.image_url,
            },
            configurationId: decoded.cid,
            selectedOptions: decoded.opts,
            configurationDetails,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch (e) {
          return new Response(JSON.stringify({ 
            success: false, 
            error: "Invalid or expired share link" 
          }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      case "generate-embed": {
        const { configurationId, width, height, theme } = await req.json();

        const baseUrl = Deno.env.get("APP_URL") || "https://app.example.com";
        const embedUrl = `${baseUrl}/embed/${configurationId}?theme=${theme || "light"}`;

        const embedCode = `<iframe 
  src="${embedUrl}" 
  width="${width || 400}" 
  height="${height || 500}" 
  frameborder="0" 
  allowfullscreen
  style="border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
</iframe>`;

        return new Response(JSON.stringify({ 
          success: true, 
          embedUrl,
          embedCode,
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error("Social sharing error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
