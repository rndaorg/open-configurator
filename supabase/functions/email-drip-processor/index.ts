import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const projectUrl = Deno.env.get('SUPABASE_URL')!;
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

  const { data: due } = await supabase
    .from('drip_enrollments')
    .select('id, drip_campaign_id, user_id, email, current_step')
    .eq('status', 'active')
    .lte('next_send_at', new Date().toISOString())
    .limit(100);

  let processed = 0;
  for (const enrollment of (due || [])) {
    const { data: step } = await supabase
      .from('drip_campaign_steps')
      .select('id, step_order, delay_hours, template_id')
      .eq('drip_campaign_id', enrollment.drip_campaign_id)
      .eq('step_order', enrollment.current_step)
      .maybeSingle();

    if (!step) {
      await supabase.from('drip_enrollments')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', enrollment.id);
      continue;
    }

    const { data: tpl } = await supabase.from('email_templates').select('slug').eq('id', step.template_id).single();
    if (tpl) {
      await fetch(`${projectUrl}/functions/v1/email-send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
        body: JSON.stringify({
          templateSlug: tpl.slug, to: enrollment.email,
          templateData: { customer_name: enrollment.email.split('@')[0] },
          dripEnrollmentId: enrollment.id,
        }),
      });
    }

    // Schedule next step
    const { data: nextStep } = await supabase
      .from('drip_campaign_steps')
      .select('delay_hours')
      .eq('drip_campaign_id', enrollment.drip_campaign_id)
      .eq('step_order', enrollment.current_step + 1)
      .maybeSingle();

    if (nextStep) {
      await supabase.from('drip_enrollments').update({
        current_step: enrollment.current_step + 1,
        next_send_at: new Date(Date.now() + nextStep.delay_hours * 3600_000).toISOString(),
      }).eq('id', enrollment.id);
    } else {
      await supabase.from('drip_enrollments').update({
        status: 'completed', completed_at: new Date().toISOString(),
      }).eq('id', enrollment.id);
    }
    processed++;
  }

  return new Response(JSON.stringify({ processed }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
});
