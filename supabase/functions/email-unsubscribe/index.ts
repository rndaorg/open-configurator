import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const HTML_PAGE = (body: string) => `<!DOCTYPE html><html><head><meta charset="utf-8"><title>Unsubscribe</title>
<style>body{font-family:system-ui,Arial,sans-serif;max-width:480px;margin:80px auto;padding:24px;text-align:center;color:#222}
.card{background:#fff;border:1px solid #eee;border-radius:12px;padding:32px;box-shadow:0 2px 12px rgba(0,0,0,.04)}
h1{font-size:22px;margin:0 0 12px}p{color:#555;line-height:1.5}</style></head>
<body><div class="card">${body}<p style="margin-top:24px;font-size:12px;color:#999">Open Configurator</p></div></body></html>`;

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const url = new URL(req.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return new Response(HTML_PAGE('<h1>Invalid link</h1><p>This unsubscribe link is missing required information.</p>'),
      { status: 400, headers: { 'Content-Type': 'text/html' } });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  const { data: sub } = await supabase.from('email_subscriptions')
    .select('email, unsubscribed_at').eq('unsubscribe_token', token).maybeSingle();

  if (!sub) {
    return new Response(HTML_PAGE('<h1>Link not recognized</h1><p>This unsubscribe link is invalid or expired.</p>'),
      { status: 404, headers: { 'Content-Type': 'text/html' } });
  }

  if (sub.unsubscribed_at) {
    return new Response(HTML_PAGE(`<h1>Already unsubscribed</h1><p>${sub.email} is no longer receiving promotional emails.</p>`),
      { headers: { 'Content-Type': 'text/html' } });
  }

  await supabase.from('email_subscriptions')
    .update({ unsubscribed_at: new Date().toISOString(), newsletter: false, promotional: false })
    .eq('unsubscribe_token', token);

  return new Response(HTML_PAGE(`<h1>You're unsubscribed</h1><p>${sub.email} will no longer receive marketing emails. You'll still get important transactional messages like order confirmations.</p>`),
    { headers: { 'Content-Type': 'text/html' } });
});
