import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { z } from 'https://deno.land/x/zod@v3.22.4/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const Schema = z.object({ campaignId: z.string().uuid() });

async function requireAdmin(req: Request, supabase: any) {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) throw new Error('AUTH');
  const token = authHeader.replace('Bearer ', '');
  const { data } = await supabase.auth.getClaims(token);
  const uid = data?.claims?.sub;
  if (!uid) throw new Error('AUTH');
  const { data: ok } = await supabase.rpc('has_role', { _user_id: uid, _role: 'admin' });
  if (!ok) throw new Error('ADMIN');
  return uid;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  try {
    try { await requireAdmin(req, supabase); } catch (e) {
      const msg = e instanceof Error ? e.message : '';
      return new Response(JSON.stringify({ error: msg === 'ADMIN' ? 'Admin only' : 'Auth required' }), {
        status: msg === 'ADMIN' ? 403 : 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const parsed = Schema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { campaignId } = parsed.data;
    const { data: campaign, error: cErr } = await supabase
      .from('email_campaigns').select('*').eq('id', campaignId).single();
    if (cErr || !campaign) {
      return new Response(JSON.stringify({ error: 'Campaign not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: template } = await supabase
      .from('email_templates').select('slug, category').eq('id', campaign.template_id).single();
    if (!template) {
      return new Response(JSON.stringify({ error: 'Template not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Resolve audience
    const filter = campaign.audience_filter || { type: 'all' };
    let subsQuery = supabase.from('email_subscriptions')
      .select('email, user_id, newsletter, promotional, unsubscribed_at')
      .is('unsubscribed_at', null);

    const catField = template.category === 'newsletter' ? 'newsletter' : 'promotional';
    subsQuery = subsQuery.eq(catField, true);

    const { data: subs } = await subsQuery;
    let recipients = subs || [];

    if (filter.type === 'has_order') {
      const { data: orderUsers } = await supabase.from('orders').select('user_id');
      const ids = new Set((orderUsers || []).map((o: any) => o.user_id));
      recipients = recipients.filter((r: any) => r.user_id && ids.has(r.user_id));
    } else if (filter.type === 'user_ids' && Array.isArray(filter.user_ids)) {
      const ids = new Set(filter.user_ids);
      recipients = recipients.filter((r: any) => r.user_id && ids.has(r.user_id));
    }

    if (recipients.length === 0) {
      await supabase.from('email_campaigns').update({
        status: 'sent', sent_at: new Date().toISOString(),
        stats: { queued: 0, sent: 0, failed: 0, skipped: 0 },
      }).eq('id', campaignId);
      return new Response(JSON.stringify({ status: 'sent', recipientCount: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert recipient rows
    const recipientRows = recipients.map((r: any) => ({
      campaign_id: campaignId, user_id: r.user_id, email: r.email, status: 'pending',
    }));
    await supabase.from('email_campaign_recipients').insert(recipientRows);

    await supabase.from('email_campaigns').update({
      status: 'sending', stats: { queued: recipients.length, sent: 0, failed: 0, skipped: 0 },
    }).eq('id', campaignId);

    // Dispatch (fire-and-forget batching)
    const projectUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    let sent = 0, failed = 0, skipped = 0;

    for (const r of recipients) {
      try {
        const resp = await fetch(`${projectUrl}/functions/v1/email-send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
          body: JSON.stringify({
            templateSlug: template.slug, to: r.email, templateData: campaign.template_data || {},
            campaignId,
          }),
        });
        const result = await resp.json();
        if (result.status === 'sent' || result.status === 'demo') {
          sent++;
          await supabase.from('email_campaign_recipients')
            .update({ status: 'sent', sent_at: new Date().toISOString(), provider_message_id: result.provider_message_id })
            .eq('campaign_id', campaignId).eq('email', r.email);
        } else if (result.status === 'skipped') {
          skipped++;
          await supabase.from('email_campaign_recipients')
            .update({ status: 'skipped', error: result.reason }).eq('campaign_id', campaignId).eq('email', r.email);
        } else {
          failed++;
          await supabase.from('email_campaign_recipients')
            .update({ status: 'failed', error: result.error || 'unknown' }).eq('campaign_id', campaignId).eq('email', r.email);
        }
      } catch (e) {
        failed++;
        await supabase.from('email_campaign_recipients')
          .update({ status: 'failed', error: e instanceof Error ? e.message : 'unknown' })
          .eq('campaign_id', campaignId).eq('email', r.email);
      }
    }

    await supabase.from('email_campaigns').update({
      status: 'sent', sent_at: new Date().toISOString(),
      stats: { queued: recipients.length, sent, failed, skipped },
    }).eq('id', campaignId);

    return new Response(JSON.stringify({ status: 'sent', sent, failed, skipped }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    console.error('campaign dispatch error', e);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
