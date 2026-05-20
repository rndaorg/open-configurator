import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';
import { sendEmail, renderTemplate, appendUnsubscribeFooter } from '../_shared/email-sender.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const SendSchema = z.object({
  templateSlug: z.string().min(1).max(100),
  to: z.string().email(),
  templateData: z.record(z.unknown()).default({}),
  campaignId: z.string().uuid().optional(),
  dripEnrollmentId: z.string().uuid().optional(),
  bypassSubscriptionCheck: z.boolean().optional(),
});

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const parsed = SendSchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const { templateSlug, to, templateData, campaignId, dripEnrollmentId, bypassSubscriptionCheck } = parsed.data;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    );

    const { data: template, error: tErr } = await supabase
      .from('email_templates')
      .select('*')
      .eq('slug', templateSlug)
      .eq('is_active', true)
      .maybeSingle();

    if (tErr || !template) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Check subscription preferences
    const { data: sub } = await supabase
      .from('email_subscriptions')
      .select('newsletter, promotional, transactional, unsubscribed_at, unsubscribe_token')
      .eq('email', to)
      .maybeSingle();

    let unsubscribeToken = sub?.unsubscribe_token;
    if (!bypassSubscriptionCheck && sub) {
      if (sub.unsubscribed_at) {
        await supabase.from('email_send_log').insert({
          template_slug: templateSlug, category: template.category, recipient_email: to,
          campaign_id: campaignId, drip_enrollment_id: dripEnrollmentId,
          status: 'skipped', provider: 'sendgrid', error: 'unsubscribed',
        });
        return new Response(JSON.stringify({ status: 'skipped', reason: 'unsubscribed' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const catMap: Record<string, keyof typeof sub> = {
        newsletter: 'newsletter', promotional: 'promotional',
        cart_recovery: 'promotional', drip: 'promotional', transactional: 'transactional',
      };
      const prefKey = catMap[template.category];
      if (prefKey && sub[prefKey] === false) {
        await supabase.from('email_send_log').insert({
          template_slug: templateSlug, category: template.category, recipient_email: to,
          campaign_id: campaignId, drip_enrollment_id: dripEnrollmentId,
          status: 'skipped', provider: 'sendgrid', error: 'opted_out',
        });
        return new Response(JSON.stringify({ status: 'skipped', reason: 'opted_out' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // Auto-create subscription record + token if missing
    if (!unsubscribeToken) {
      const { data: newSub } = await supabase
        .from('email_subscriptions')
        .upsert({ email: to }, { onConflict: 'email' })
        .select('unsubscribe_token')
        .single();
      unsubscribeToken = newSub?.unsubscribe_token;
    }

    const enrichedData = { ...templateData, site_url: Deno.env.get('SITE_URL') || 'https://openconfigurator.dev' };
    const subject = renderTemplate(template.subject, enrichedData);
    let html = renderTemplate(template.html_body, enrichedData);
    const text = template.text_body ? renderTemplate(template.text_body, enrichedData) : undefined;

    // Append unsubscribe footer for non-transactional
    if (template.category !== 'transactional' && unsubscribeToken) {
      const projectUrl = Deno.env.get('SUPABASE_URL')!;
      const unsubUrl = `${projectUrl}/functions/v1/email-unsubscribe?token=${unsubscribeToken}`;
      html = appendUnsubscribeFooter(html, unsubUrl);
    }

    const result = await sendEmail({ to, subject, html, text, category: template.category });

    await supabase.from('email_send_log').insert({
      template_slug: templateSlug, category: template.category, recipient_email: to,
      campaign_id: campaignId, drip_enrollment_id: dripEnrollmentId,
      status: result.status === 'sent' || result.status === 'demo' ? result.status : 'failed',
      provider: 'sendgrid', provider_message_id: result.provider_message_id, error: result.error,
    });

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: result.status === 'failed' ? 500 : 200,
    });
  } catch (e) {
    console.error('email-send error', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
