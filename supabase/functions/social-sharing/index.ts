import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { z } from "https://deno.land/x/zod@v3.22.4/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GenerateLinkSchema = z.object({
  productId: z.string().uuid(),
  productName: z.string().max(255),
  configurationId: z.string().uuid(),
  configurationName: z.string().max(255).optional(),
  imageUrl: z.string().url().max(2000).optional(),
  totalPrice: z.number().positive().max(999999),
  selectedOptions: z.record(z.string().uuid(), z.string().uuid()),
});

const TrackShareSchema = z.object({
  shareId: z.string().max(100),
  platform: z.string().max(50),
  referrer: z.string().max(2000).optional(),
});

const TrackViewSchema = z.object({
  shareId: z.string().max(100),
  referrer: z.string().max(2000).optional(),
  userAgent: z.string().max(500).optional(),
});

const ResolveSchema = z.object({
  shareId: z.string().max(100),
  data: z.string().max(10000),
});

const GenerateEmbedSchema = z.object({
  configurationId: z.string().uuid(),
  width: z.number().int().min(200).max(2000).optional(),
  height: z.number().int().min(200).max(2000).optional(),
  theme: z.enum(["light", "dark"]).optional(),
});

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
        const parsed = GenerateLinkSchema.safeParse(await req.json());
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { productId, productName, configurationId, configurationName, imageUrl, totalPrice, selectedOptions } = parsed.data;

        const shareId = crypto.randomUUID().substring(0, 8);
        const baseUrl = Deno.env.get("APP_URL") || "https://app.example.com";

        const encodedData = btoa(JSON.stringify({
          pid: productId, cid: configurationId, opts: selectedOptions,
        }));

        const shareUrl = `${baseUrl}/shared/${shareId}?data=${encodedData}`;

        const title = encodeURIComponent(configurationName || `Custom ${productName}`);
        const description = encodeURIComponent(`Check out my custom ${productName} configuration - $${totalPrice.toFixed(2)}`);
        const image = encodeURIComponent(imageUrl || "");

        const socialLinks = {
          shareUrl, shareId,
          facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}&quote=${description}`,
          twitter: `https://twitter.com/intent/tweet?url=${encodeURIComponent(shareUrl)}&text=${description}`,
          linkedin: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareUrl)}`,
          pinterest: `https://pinterest.com/pin/create/button/?url=${encodeURIComponent(shareUrl)}&media=${image}&description=${description}`,
          whatsapp: `https://wa.me/?text=${description}%20${encodeURIComponent(shareUrl)}`,
          email: `mailto:?subject=${title}&body=${description}%0A%0A${encodeURIComponent(shareUrl)}`,
          copyLink: shareUrl,
        };

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

        return new Response(JSON.stringify({ success: true, shareUrl, shareId, socialLinks, ogTags }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "track-share": {
        const parsed = TrackShareSchema.safeParse(await req.json());
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid input" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.log(`Share tracked: ${parsed.data.shareId} on ${parsed.data.platform}`);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "track-view": {
        const parsed = TrackViewSchema.safeParse(await req.json());
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid input" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        console.log(`Share view: ${parsed.data.shareId}`);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "resolve": {
        const parsed = ResolveSchema.safeParse(await req.json());
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid input" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        try {
          const decoded = JSON.parse(atob(parsed.data.data));
          
          const { data: product, error: productError } = await supabase
            .from("products")
            .select(`*, config_options (*, option_values (*))`)
            .eq("id", decoded.pid)
            .single();

          if (productError) throw productError;

          const configurationDetails: Record<string, { optionName: string; valueName: string; priceModifier: number }> = {};
          
          if (product?.config_options) {
            for (const option of product.config_options) {
              const selectedValueId = decoded.opts[option.id];
              if (selectedValueId) {
                const value = option.option_values?.find((v: any) => v.id === selectedValueId);
                if (value) {
                  configurationDetails[option.id] = {
                    optionName: option.name, valueName: value.name, priceModifier: value.price_modifier,
                  };
                }
              }
            }
          }

          return new Response(JSON.stringify({
            success: true,
            product: {
              id: product.id, name: product.name, description: product.description,
              basePrice: product.base_price, imageUrl: product.image_url,
            },
            configurationId: decoded.cid,
            selectedOptions: decoded.opts,
            configurationDetails,
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        } catch {
          return new Response(JSON.stringify({ success: false, error: "Invalid or expired share link" }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      }

      case "generate-embed": {
        const parsed = GenerateEmbedSchema.safeParse(await req.json());
        if (!parsed.success) {
          return new Response(JSON.stringify({ error: "Invalid input", details: parsed.error.flatten().fieldErrors }), {
            status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
        const { configurationId, width, height, theme } = parsed.data;

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

        return new Response(JSON.stringify({ success: true, embedUrl, embedCode }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Unknown action" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (error) {
    console.error("Social sharing error:", error);
    return new Response(JSON.stringify({ error: "An error occurred processing your request" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
