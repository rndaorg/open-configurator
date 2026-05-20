// Shared SendGrid sender with demo-mode fallback and template rendering
export interface SendArgs {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
  category?: string;
  unsubscribeUrl?: string;
}

export interface SendResult {
  status: 'sent' | 'demo' | 'failed';
  provider_message_id?: string;
  error?: string;
}

export function renderTemplate(template: string, data: Record<string, unknown>): string {
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, key) => {
    const value = data[key];
    if (value === undefined || value === null) return '';
    return String(value);
  });
}

export function appendUnsubscribeFooter(html: string, unsubscribeUrl: string): string {
  const footer = `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #eee;font-size:12px;color:#888;text-align:center;font-family:Arial,sans-serif">
You are receiving this because you subscribed. <a href="${unsubscribeUrl}" style="color:#888;text-decoration:underline">Unsubscribe</a>
</div>`;
  return html + footer;
}

export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const apiKey = Deno.env.get('SENDGRID_API_KEY');
  const defaultFrom = Deno.env.get('SENDGRID_FROM_EMAIL') || 'no-reply@openconfigurator.dev';
  const from = args.from || defaultFrom;

  if (!apiKey) {
    console.log(`[DEMO MODE] Would send "${args.subject}" to ${args.to}`);
    return { status: 'demo', provider_message_id: `demo-${crypto.randomUUID()}` };
  }

  try {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: args.to }] }],
        from: { email: from },
        subject: args.subject,
        categories: args.category ? [args.category] : undefined,
        content: [
          ...(args.text ? [{ type: 'text/plain', value: args.text }] : []),
          { type: 'text/html', value: args.html },
        ],
      }),
    });
    if (!response.ok) {
      const errText = await response.text();
      return { status: 'failed', error: `SendGrid ${response.status}: ${errText.slice(0, 200)}` };
    }
    const messageId = response.headers.get('x-message-id') || undefined;
    return { status: 'sent', provider_message_id: messageId };
  } catch (e) {
    return { status: 'failed', error: e instanceof Error ? e.message : 'unknown error' };
  }
}
