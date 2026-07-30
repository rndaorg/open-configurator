import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Plug, KeyRound, Webhook, Activity, Copy, Trash2, Plus, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

const ALL_SCOPES = [
  'products:read',
  'configurations:validate',
  'pricing:read',
  'orders:read',
  'orders:write',
];
const ALL_EVENTS = ['order.created', 'order.updated', 'configuration.validated'];

const API_BASE = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/agent-api`;

interface Agent {
  id: string;
  name: string;
  description: string | null;
  scopes: string[];
  rate_limit_per_minute: number;
  is_active: boolean;
  last_used_at: string | null;
}

function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return 'oc_agent_' + Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export default function AdminAgentAPI() {
  const { user } = useAuth();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [tokens, setTokens] = useState<any[]>([]);
  const [webhooks, setWebhooks] = useState<any[]>([]);
  const [requests, setRequests] = useState<any[]>([]);
  const [deliveries, setDeliveries] = useState<any[]>([]);
  const [selected, setSelected] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [issued, setIssued] = useState<string | null>(null);

  const [form, setForm] = useState({ name: '', description: '', rate: 60, scopes: ['products:read', 'configurations:validate', 'pricing:read'] });
  const [hookForm, setHookForm] = useState({ url: '', events: ['order.created'] });

  const loadAgents = async () => {
    const { data } = await supabase.from('api_agents').select('*').order('created_at', { ascending: false });
    setAgents((data ?? []) as Agent[]);
    if (data?.length && !selected) setSelected(data[0].id);
  };

  const loadDetails = async (agentId: string) => {
    const [t, w, r, d] = await Promise.all([
      supabase.from('api_agent_tokens').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }),
      supabase.from('api_agent_webhooks').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }),
      supabase.from('api_agent_requests').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(50),
      supabase.from('api_agent_webhook_deliveries').select('*').eq('agent_id', agentId).order('created_at', { ascending: false }).limit(50),
    ]);
    setTokens(t.data ?? []);
    setWebhooks(w.data ?? []);
    setRequests(r.data ?? []);
    setDeliveries(d.data ?? []);
  };

  useEffect(() => { loadAgents(); }, []);
  useEffect(() => { if (selected) loadDetails(selected); }, [selected]);

  const createAgent = async () => {
    if (!form.name.trim()) return toast.error('Give the agent a name');
    setLoading(true);
    const { data, error } = await supabase.from('api_agents').insert({
      name: form.name.trim(),
      description: form.description || null,
      scopes: form.scopes,
      rate_limit_per_minute: form.rate,
      owner_user_id: user?.id ?? null,
    }).select().single();
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success('Agent registered');
    setForm({ name: '', description: '', rate: 60, scopes: ['products:read', 'configurations:validate', 'pricing:read'] });
    await loadAgents();
    setSelected(data.id);
  };

  const toggleAgent = async (agent: Agent) => {
    const { error } = await supabase.from('api_agents').update({ is_active: !agent.is_active }).eq('id', agent.id);
    if (error) return toast.error(error.message);
    loadAgents();
  };

  const issueToken = async () => {
    if (!selected) return;
    const raw = randomToken();
    const hash = await sha256(raw);
    const { error } = await supabase.from('api_agent_tokens').insert({
      agent_id: selected,
      name: `token-${new Date().toISOString().slice(0, 10)}`,
      token_prefix: raw.slice(0, 17),
      token_hash: hash,
    });
    if (error) return toast.error(error.message);
    setIssued(raw);
    loadDetails(selected);
  };

  const revokeToken = async (id: string) => {
    const { error } = await supabase.from('api_agent_tokens').update({ revoked_at: new Date().toISOString() }).eq('id', id);
    if (error) return toast.error(error.message);
    toast.success('Token revoked');
    loadDetails(selected);
  };

  const addWebhook = async () => {
    if (!selected || !hookForm.url) return toast.error('Enter a callback URL');
    const secretBytes = crypto.getRandomValues(new Uint8Array(24));
    const secret = Array.from(secretBytes).map((b) => b.toString(16).padStart(2, '0')).join('');
    const { error } = await supabase.from('api_agent_webhooks').insert({
      agent_id: selected, url: hookForm.url, events: hookForm.events, signing_secret: secret,
    });
    if (error) return toast.error(error.message);
    setHookForm({ url: '', events: ['order.created'] });
    toast.success('Webhook added');
    loadDetails(selected);
  };

  const deleteWebhook = async (id: string) => {
    await supabase.from('api_agent_webhooks').delete().eq('id', id);
    loadDetails(selected);
  };

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied'); };
  const current = agents.find((a) => a.id === selected);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Plug className="h-7 w-7" /> Agent API Platform</h1>
        <p className="text-muted-foreground mt-1">
          Issue identity tokens so partner systems, client ERPs and custom chatbots can query products, validate configurations, price and order programmatically.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Base URL</CardTitle>
          <CardDescription>Authenticate with <code>Authorization: Bearer &lt;token&gt;</code> or <code>X-Agent-Token</code>.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-2">
          <code className="text-xs bg-muted px-3 py-2 rounded flex-1 overflow-auto">{API_BASE}</code>
          <Button variant="outline" size="sm" onClick={() => copy(API_BASE)}><Copy className="h-4 w-4" /></Button>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1">
          <CardHeader><CardTitle className="text-base">Register agent</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Acme ERP connector" /></div>
            <div><Label>Description</Label><Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
            <div><Label>Rate limit (req/min)</Label><Input type="number" min={1} value={form.rate} onChange={(e) => setForm({ ...form, rate: parseInt(e.target.value) || 60 })} /></div>
            <div>
              <Label>Scopes</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {ALL_SCOPES.map((s) => (
                  <Badge
                    key={s}
                    variant={form.scopes.includes(s) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setForm({ ...form, scopes: form.scopes.includes(s) ? form.scopes.filter((x) => x !== s) : [...form.scopes, s] })}
                  >{s}</Badge>
                ))}
              </div>
            </div>
            <Button onClick={createAgent} disabled={loading} className="w-full">
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}Register
            </Button>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="text-base">Registered agents ({agents.length})</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {agents.length === 0 && <p className="text-sm text-muted-foreground">No agents yet.</p>}
            {agents.map((a) => (
              <div
                key={a.id}
                onClick={() => setSelected(a.id)}
                className={`border rounded-md p-3 cursor-pointer ${selected === a.id ? 'border-primary bg-primary/5' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium">{a.name}</div>
                    <div className="text-xs text-muted-foreground">{a.description || 'No description'}</div>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge variant="outline">{a.rate_limit_per_minute}/min</Badge>
                    <Switch checked={a.is_active} onCheckedChange={() => toggleAgent(a)} onClick={(e) => e.stopPropagation()} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {(a.scopes ?? []).map((s) => <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>)}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {current && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{current.name}</CardTitle>
            <CardDescription>Tokens, webhook callbacks and request activity.</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="tokens">
              <TabsList>
                <TabsTrigger value="tokens"><KeyRound className="h-4 w-4 mr-1" />Tokens</TabsTrigger>
                <TabsTrigger value="webhooks"><Webhook className="h-4 w-4 mr-1" />Webhooks</TabsTrigger>
                <TabsTrigger value="activity"><Activity className="h-4 w-4 mr-1" />Activity</TabsTrigger>
                <TabsTrigger value="docs">Docs</TabsTrigger>
              </TabsList>

              <TabsContent value="tokens" className="space-y-3 pt-4">
                <Button onClick={issueToken}><Plus className="h-4 w-4 mr-2" />Issue new token</Button>
                {issued && (
                  <div className="border border-primary rounded-md p-3 bg-primary/5 space-y-2">
                    <p className="text-sm font-medium">Copy this token now — it is hashed and never shown again.</p>
                    <div className="flex gap-2">
                      <code className="text-xs bg-background px-3 py-2 rounded flex-1 overflow-auto">{issued}</code>
                      <Button size="sm" variant="outline" onClick={() => copy(issued)}><Copy className="h-4 w-4" /></Button>
                    </div>
                  </div>
                )}
                {tokens.map((t) => (
                  <div key={t.id} className="flex items-center justify-between border rounded-md p-3">
                    <div>
                      <div className="font-mono text-sm">{t.token_prefix}…</div>
                      <div className="text-xs text-muted-foreground">
                        {t.revoked_at ? 'Revoked' : t.last_used_at ? `Last used ${new Date(t.last_used_at).toLocaleString()}` : 'Never used'}
                      </div>
                    </div>
                    {!t.revoked_at && <Button size="sm" variant="ghost" onClick={() => revokeToken(t.id)}><Trash2 className="h-4 w-4" /></Button>}
                  </div>
                ))}
              </TabsContent>

              <TabsContent value="webhooks" className="space-y-3 pt-4">
                <div className="flex flex-col md:flex-row gap-2">
                  <Input placeholder="https://partner.example.com/hooks/orders" value={hookForm.url} onChange={(e) => setHookForm({ ...hookForm, url: e.target.value })} />
                  <Button onClick={addWebhook}><Plus className="h-4 w-4 mr-2" />Add</Button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {ALL_EVENTS.map((ev) => (
                    <Badge key={ev} variant={hookForm.events.includes(ev) ? 'default' : 'outline'} className="cursor-pointer"
                      onClick={() => setHookForm({ ...hookForm, events: hookForm.events.includes(ev) ? hookForm.events.filter((x) => x !== ev) : [...hookForm.events, ev] })}>{ev}</Badge>
                  ))}
                </div>
                {webhooks.map((w) => (
                  <div key={w.id} className="flex items-center justify-between border rounded-md p-3">
                    <div className="min-w-0">
                      <div className="text-sm truncate">{w.url}</div>
                      <div className="text-xs text-muted-foreground">{(w.events ?? []).join(', ')} · signed with HMAC-SHA256 (X-Agent-Signature)</div>
                    </div>
                    <Button size="sm" variant="ghost" onClick={() => deleteWebhook(w.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
                ))}
                {deliveries.length > 0 && (
                  <div className="pt-2">
                    <div className="text-sm font-medium mb-2">Recent deliveries</div>
                    <ScrollArea className="h-56 pr-3">
                      {deliveries.map((d) => (
                        <div key={d.id} className="text-xs border rounded p-2 mb-2 flex justify-between">
                          <span>{d.event} · {new Date(d.created_at).toLocaleString()}</span>
                          <Badge variant={d.status === 'delivered' ? 'default' : 'destructive'}>{d.status} {d.response_status ?? ''}</Badge>
                        </div>
                      ))}
                    </ScrollArea>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="activity" className="pt-4">
                <ScrollArea className="h-80 pr-3">
                  {requests.length === 0 && <p className="text-sm text-muted-foreground">No API calls yet.</p>}
                  {requests.map((r) => (
                    <div key={r.id} className="text-xs border rounded p-2 mb-2 flex items-center justify-between">
                      <span className="font-mono">{r.method} {r.endpoint}</span>
                      <span className="flex items-center gap-2 text-muted-foreground">
                        {r.duration_ms}ms
                        <Badge variant={r.status_code < 400 ? 'default' : 'destructive'}>{r.status_code}</Badge>
                        {new Date(r.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </ScrollArea>
              </TabsContent>

              <TabsContent value="docs" className="pt-4">
                <pre className="text-xs bg-muted p-4 rounded overflow-auto">{`# Discovery (no auth)
curl ${API_BASE}

# List products
curl ${API_BASE}/products \\
  -H "Authorization: Bearer oc_agent_..."

# Validate a configuration
curl -X POST ${API_BASE}/configurations/validate \\
  -H "Authorization: Bearer oc_agent_..." \\
  -H "Content-Type: application/json" \\
  -d '{"productId":"<uuid>","selectedOptions":{"<optionId>":"<valueId>"},"quantity":2}'

# Price quote
curl -X POST ${API_BASE}/pricing/quote -H "Authorization: Bearer oc_agent_..." \\
  -H "Content-Type: application/json" -d '{"productId":"<uuid>","selectedOptions":{},"quantity":1}'

# Submit an order (async webhook callback)
curl -X POST ${API_BASE}/orders \\
  -H "Authorization: Bearer oc_agent_..." -H "Content-Type: application/json" \\
  -d '{"productId":"<uuid>","selectedOptions":{},"quantity":1,"callbackUrl":"https://partner.example.com/hook"}'

# Rate limits: X-RateLimit-Limit / X-RateLimit-Remaining headers, 429 + Retry-After when exceeded.
# Webhook signature: HMAC-SHA256 of the raw body in X-Agent-Signature.`}</pre>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
