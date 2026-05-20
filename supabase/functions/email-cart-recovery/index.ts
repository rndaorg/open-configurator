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
  const siteUrl = Deno.env.get('SITE_URL') || 'https://openconfigurator.dev';

  const now = Date.now();
  const h24 = new Date(now - 24 * 3600_000).toISOString();
  const h72 = new Date(now - 72 * 3600_000).toISOString();
  const d7 = new Date(now - 7 * 24 * 3600_000).toISOString();

  // Expire old
  await supabase.from('abandoned_carts')
    .update({ recovery_status: 'expired' })
    .lt('created_at', d7).neq('recovery_status', 'recovered');

  // First reminder
  const { data: firstBatch } = await supabase.from('abandoned_carts')
    .select('id, email, total_amount, item_count')
    .eq('recovery_status', 'pending').lt('created_at', h24).limit(50);

  for (const cart of (firstBatch || [])) {
    await fetch(`${projectUrl}/functions/v1/email-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        templateSlug: 'cart_recovery_1', to: cart.email,
        templateData: {
          customer_name: cart.email.split('@')[0],
          item_count: cart.item_count, total_amount: Number(cart.total_amount).toFixed(2),
          cart_url: `${siteUrl}/cart`,
        },
      }),
    });
    await supabase.from('abandoned_carts')
      .update({ recovery_status: 'email_1_sent', last_email_sent_at: new Date().toISOString() })
      .eq('id', cart.id);
  }

  // Second reminder
  const { data: secondBatch } = await supabase.from('abandoned_carts')
    .select('id, email')
    .eq('recovery_status', 'email_1_sent').lt('last_email_sent_at', h72).limit(50);

  for (const cart of (secondBatch || [])) {
    await fetch(`${projectUrl}/functions/v1/email-send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({
        templateSlug: 'cart_recovery_2', to: cart.email,
        templateData: { customer_name: cart.email.split('@')[0], cart_url: `${siteUrl}/cart` },
      }),
    });
    await supabase.from('abandoned_carts')
      .update({ recovery_status: 'email_2_sent', last_email_sent_at: new Date().toISOString() })
      .eq('id', cart.id);
  }

  return new Response(JSON.stringify({
    first: firstBatch?.length || 0, second: secondBatch?.length || 0,
  }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
});
