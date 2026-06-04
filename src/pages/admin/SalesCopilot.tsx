import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Loader2, Sparkles, Mail, FileText, TrendingUp, AlertTriangle, Send, Copy } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';

interface OrderRow {
  id: string;
  created_at: string;
  total_price: number;
  status: string;
  product_id: string | null;
  user_id: string;
}

interface ConfigRow {
  id: string;
  created_at: string;
  configuration_name: string | null;
  total_price: number;
  product_id: string | null;
  user_id: string | null;
}

export default function SalesCopilot() {
  const [source, setSource] = useState<'order' | 'configuration'>('order');
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [configs, setConfigs] = useState<ConfigRow[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerName, setCustomerName] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    supabase.from('orders').select('id, created_at, total_price, status, product_id, user_id')
      .order('created_at', { ascending: false }).limit(25)
      .then(({ data }) => setOrders((data as OrderRow[]) || []));
    supabase.from('product_configurations').select('id, created_at, configuration_name, total_price, product_id, user_id')
      .order('created_at', { ascending: false }).limit(25)
      .then(({ data }) => setConfigs((data as ConfigRow[]) || []));
  }, []);

  const runCopilot = async () => {
    if (!selectedId) {
      toast.error('Select a record first');
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const payload: any = { notes };
      if (source === 'order') payload.orderId = selectedId;
      else payload.configurationId = selectedId;
      if (customerEmail) payload.customerEmail = customerEmail;
      if (customerName) payload.customerName = customerName;

      const { data, error } = await supabase.functions.invoke('sales-copilot', { body: payload });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      if (data?.context?.customerEmail && !customerEmail) setCustomerEmail(data.context.customerEmail);
      if (data?.context?.customerName && !customerName) setCustomerName(data.context.customerName);
      toast.success('Copilot insights ready');
    } catch (e: any) {
      toast.error(e.message || 'Failed to run copilot');
    } finally {
      setLoading(false);
    }
  };

  const copy = (text: string) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied');
  };

  const pushToCRM = async (provider: 'hubspot' | 'salesforce' | 'pipedrive') => {
    if (!customerEmail) { toast.error('Customer email required'); return; }
    if (!result?.copilot) { toast.error('Run the copilot first'); return; }
    setPushing(true);
    try {
      const [first, ...rest] = (customerName || '').split(' ');
      await supabase.functions.invoke('crm-integration/sync-contact', {
        body: { provider, email: customerEmail, firstName: first, lastName: rest.join(' ') || undefined },
      });
      const dealValue = Number(result?.context?.totalPrice || 0) +
        (result?.copilot?.upsells || []).reduce((s: number, u: any) => s + Number(u.estimated_uplift_usd || 0), 0);
      await supabase.functions.invoke('crm-integration/create-deal', {
        body: {
          provider,
          contactEmail: customerEmail,
          title: `${result.context?.product || 'Configuration'} — ${customerName || customerEmail}`,
          value: Math.max(1, Math.round(dealValue)),
        },
      });
      await supabase.functions.invoke('crm-integration/log-activity', {
        body: {
          provider,
          contactEmail: customerEmail,
          activityType: 'Sales Copilot Analysis',
          description: result.copilot.summary || 'AI sales copilot analysis',
        },
      });
      toast.success(`Pushed to ${provider}`);
    } catch (e: any) {
      toast.error(`CRM push failed: ${e.message}`);
    } finally {
      setPushing(false);
    }
  };

  const copilot = result?.copilot;
  const healthColor: Record<string, string> = {
    hot: 'bg-red-500/10 text-red-500 border-red-500/30',
    warm: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
    cold: 'bg-blue-500/10 text-blue-500 border-blue-500/30',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" /> Sales Copilot
        </h1>
        <p className="text-muted-foreground">AI-powered upsell, quote, and follow-up generation for the sales team.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Select a record to analyze</CardTitle>
          <CardDescription>Pick an order or saved configuration, add context, and run the copilot.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Tabs value={source} onValueChange={(v) => { setSource(v as any); setSelectedId(''); }}>
            <TabsList>
              <TabsTrigger value="order">Recent Orders</TabsTrigger>
              <TabsTrigger value="configuration">Saved Configurations</TabsTrigger>
            </TabsList>
            <TabsContent value="order" className="pt-4">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue placeholder="Choose an order…" /></SelectTrigger>
                <SelectContent>
                  {orders.map(o => (
                    <SelectItem key={o.id} value={o.id}>
                      #{o.id.slice(0, 8)} — ${Number(o.total_price).toFixed(2)} — {o.status} — {new Date(o.created_at).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TabsContent>
            <TabsContent value="configuration" className="pt-4">
              <Select value={selectedId} onValueChange={setSelectedId}>
                <SelectTrigger><SelectValue placeholder="Choose a configuration…" /></SelectTrigger>
                <SelectContent>
                  {configs.map(c => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.configuration_name || `#${c.id.slice(0, 8)}`} — ${Number(c.total_price).toFixed(2)} — {new Date(c.created_at).toLocaleDateString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </TabsContent>
          </Tabs>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label>Customer name (optional override)</Label>
              <Input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Jane Smith" />
            </div>
            <div>
              <Label>Customer email (optional override)</Label>
              <Input value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="jane@acme.com" />
            </div>
          </div>
          <div>
            <Label>Internal notes for the copilot</Label>
            <Textarea value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="e.g. Customer mentioned a tight Q1 budget but is interested in premium options."
              rows={3} />
          </div>

          <Button onClick={runCopilot} disabled={loading || !selectedId} size="lg">
            {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing…</> : <><Sparkles className="mr-2 h-4 w-4" /> Run Sales Copilot</>}
          </Button>
        </CardContent>
      </Card>

      {copilot && (
        <>
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" /> Opportunity Summary
                  </CardTitle>
                  <CardDescription>{result?.context?.product} — ${Number(result?.context?.totalPrice || 0).toFixed(2)}</CardDescription>
                </div>
                <div className="flex items-center gap-2">
                  {copilot.deal_health && (
                    <Badge className={healthColor[copilot.deal_health] || ''} variant="outline">
                      {copilot.deal_health.toUpperCase()}
                    </Badge>
                  )}
                  {typeof copilot.estimated_close_probability === 'number' && (
                    <Badge variant="secondary">{copilot.estimated_close_probability}% close prob.</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm">{copilot.summary}</p>
              {copilot.risks?.length > 0 && (
                <div className="mt-4 p-3 rounded-md border border-amber-500/30 bg-amber-500/5">
                  <div className="flex items-center gap-2 font-medium text-sm mb-2">
                    <AlertTriangle className="h-4 w-4 text-amber-500" /> Risks
                  </div>
                  <ul className="list-disc list-inside text-sm space-y-1">
                    {copilot.risks.map((r: string, i: number) => <li key={i}>{r}</li>)}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle>Upsells</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(copilot.upsells || []).map((u: any, i: number) => (
                  <div key={i} className="p-3 rounded-md border">
                    <div className="flex justify-between gap-2">
                      <div className="font-medium text-sm">{u.option_name}</div>
                      <Badge variant="secondary">+${Number(u.estimated_uplift_usd || 0).toFixed(0)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{u.reason}</p>
                  </div>
                ))}
                {(!copilot.upsells || copilot.upsells.length === 0) && (
                  <p className="text-sm text-muted-foreground">No upsells identified.</p>
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Cross-sells</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {(copilot.cross_sells || []).map((c: any, i: number) => (
                  <div key={i} className="p-3 rounded-md border">
                    <div className="flex justify-between gap-2">
                      <div className="font-medium text-sm">{c.product_name}</div>
                      <Badge variant="secondary">${Number(c.estimated_value_usd || 0).toFixed(0)}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{c.reason}</p>
                  </div>
                ))}
                {(!copilot.cross_sells || copilot.cross_sells.length === 0) && (
                  <p className="text-sm text-muted-foreground">No cross-sells identified.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5" /> Quote Proposal</CardTitle>
                <Button size="sm" variant="outline" onClick={() => copy(copilot.quote_proposal_markdown || '')}>
                  <Copy className="h-4 w-4 mr-1" /> Copy
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="prose prose-sm dark:prose-invert max-w-none border rounded-md p-4 bg-muted/30">
                <ReactMarkdown>{copilot.quote_proposal_markdown || ''}</ReactMarkdown>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Follow-up Email Draft</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label>Subject</Label>
                <div className="flex gap-2">
                  <Input readOnly value={copilot.followup_email?.subject || ''} />
                  <Button variant="outline" size="icon" onClick={() => copy(copilot.followup_email?.subject || '')}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div>
                <Label>Body</Label>
                <Textarea readOnly rows={12} value={copilot.followup_email?.body || ''} />
                <Button variant="outline" size="sm" className="mt-2" onClick={() => copy(copilot.followup_email?.body || '')}>
                  <Copy className="h-4 w-4 mr-1" /> Copy body
                </Button>
              </div>
            </CardContent>
          </Card>

          {copilot.next_actions?.length > 0 && (
            <Card>
              <CardHeader><CardTitle>Next Actions</CardTitle></CardHeader>
              <CardContent>
                <ul className="list-disc list-inside text-sm space-y-1">
                  {copilot.next_actions.map((a: string, i: number) => <li key={i}>{a}</li>)}
                </ul>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5" /> Push to CRM</CardTitle>
              <CardDescription>Sync contact, create deal, and log this analysis as an activity.</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={pushing} onClick={() => pushToCRM('hubspot')}>HubSpot</Button>
              <Button variant="outline" disabled={pushing} onClick={() => pushToCRM('salesforce')}>Salesforce</Button>
              <Button variant="outline" disabled={pushing} onClick={() => pushToCRM('pipedrive')}>Pipedrive</Button>
              {pushing && <Loader2 className="h-4 w-4 animate-spin self-center" />}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
