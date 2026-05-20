import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { toast } from 'sonner';
import { Plus, Send, Trash2, Edit, RefreshCw } from 'lucide-react';

type Template = {
  id: string; slug: string; name: string; subject: string;
  html_body: string; text_body: string | null; variables: any;
  category: string; is_active: boolean; updated_at: string;
};

type Campaign = {
  id: string; name: string; template_id: string; type: string; status: string;
  audience_filter: any; template_data: any; scheduled_at: string | null;
  sent_at: string | null; stats: any; created_at: string;
};

export default function AdminEmail() {
  const { tab } = useParams();
  const navigate = useNavigate();
  const current = tab || 'templates';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Email</h1>
        <p className="text-muted-foreground">Manage templates, campaigns, drip sequences, and subscribers.</p>
      </div>
      <Tabs value={current} onValueChange={(v) => navigate(`/admin/email/${v === 'templates' ? '' : v}`)}>
        <TabsList className="grid grid-cols-6 w-full max-w-3xl">
          <TabsTrigger value="templates">Templates</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
          <TabsTrigger value="drip">Drip</TabsTrigger>
          <TabsTrigger value="abandoned">Carts</TabsTrigger>
          <TabsTrigger value="subscribers">Subscribers</TabsTrigger>
          <TabsTrigger value="logs">Logs</TabsTrigger>
        </TabsList>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="campaigns"><CampaignsTab /></TabsContent>
        <TabsContent value="drip"><DripTab /></TabsContent>
        <TabsContent value="abandoned"><AbandonedCartsTab /></TabsContent>
        <TabsContent value="subscribers"><SubscribersTab /></TabsContent>
        <TabsContent value="logs"><LogsTab /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============================================================
// TEMPLATES TAB
// ============================================================
function TemplatesTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Template | null>(null);
  const [open, setOpen] = useState(false);

  const { data: templates = [], isLoading } = useQuery({
    queryKey: ['email-templates'],
    queryFn: async () => {
      const { data, error } = await supabase.from('email_templates').select('*').order('category').order('name');
      if (error) throw error;
      return data as Template[];
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('email_templates').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['email-templates'] }); toast.success('Template deleted'); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Templates</CardTitle>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="h-4 w-4 me-2" /> New template
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <p>Loading…</p> : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead><TableHead>Slug</TableHead>
                <TableHead>Category</TableHead><TableHead>Status</TableHead>
                <TableHead className="text-end">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell><code className="text-xs">{t.slug}</code></TableCell>
                  <TableCell><Badge variant="outline">{t.category}</Badge></TableCell>
                  <TableCell>{t.is_active ? <Badge>Active</Badge> : <Badge variant="secondary">Inactive</Badge>}</TableCell>
                  <TableCell className="text-end space-x-2">
                    <Button size="sm" variant="ghost" onClick={() => { setEditing(t); setOpen(true); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => {
                      if (confirm(`Delete template "${t.name}"?`)) deleteMutation.mutate(t.id);
                    }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
      <TemplateDialog open={open} onOpenChange={setOpen} template={editing} />
    </Card>
  );
}

function TemplateDialog({ open, onOpenChange, template }: {
  open: boolean; onOpenChange: (o: boolean) => void; template: Template | null;
}) {
  const qc = useQueryClient();
  const [form, setForm] = useState(() => template || {
    slug: '', name: '', subject: '', html_body: '', text_body: '',
    category: 'transactional', is_active: true, variables: [],
  } as any);
  const [testEmail, setTestEmail] = useState('');

  // Reset form when template changes
  useState(() => { setForm(template || { slug: '', name: '', subject: '', html_body: '', text_body: '', category: 'transactional', is_active: true, variables: [] }); });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = { ...form, variables: Array.isArray(form.variables) ? form.variables : [] };
      if (template?.id) {
        const { error } = await supabase.from('email_templates').update(payload).eq('id', template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('email_templates').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['email-templates'] });
      toast.success('Template saved'); onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const sendTest = async () => {
    if (!testEmail) return toast.error('Enter test email');
    const { data, error } = await supabase.functions.invoke('email-send', {
      body: { templateSlug: form.slug, to: testEmail, templateData: {}, bypassSubscriptionCheck: true },
    });
    if (error) return toast.error(error.message);
    toast.success(`Test sent (${(data as any)?.status || 'ok'})`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{template ? 'Edit template' : 'New template'}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Name</Label>
            <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Slug (unique key)</Label>
            <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} disabled={!!template} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Subject (supports {`{{variables}}`})</Label>
            <Input value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          </div>
          <div className="space-y-2">
            <Label>Category</Label>
            <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="transactional">Transactional</SelectItem>
                <SelectItem value="promotional">Promotional</SelectItem>
                <SelectItem value="newsletter">Newsletter</SelectItem>
                <SelectItem value="drip">Drip</SelectItem>
                <SelectItem value="cart_recovery">Cart recovery</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-end gap-2">
            <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
            <Label>Active</Label>
          </div>
          <div className="space-y-2 col-span-2">
            <Label>HTML body</Label>
            <Textarea rows={10} className="font-mono text-xs" value={form.html_body}
              onChange={(e) => setForm({ ...form, html_body: e.target.value })} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Plain text body (optional)</Label>
            <Textarea rows={4} className="font-mono text-xs" value={form.text_body || ''}
              onChange={(e) => setForm({ ...form, text_body: e.target.value })} />
          </div>
          <div className="space-y-2 col-span-2">
            <Label>Live preview</Label>
            <div className="border rounded-md p-4 bg-background max-h-64 overflow-auto"
              dangerouslySetInnerHTML={{ __html: form.html_body }} />
          </div>
          {template && (
            <div className="col-span-2 flex items-end gap-2 border-t pt-4">
              <div className="flex-1 space-y-2">
                <Label>Send test email</Label>
                <Input type="email" placeholder="you@example.com"
                  value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
              </div>
              <Button variant="outline" onClick={sendTest}><Send className="h-4 w-4 me-2" /> Send test</Button>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// CAMPAIGNS TAB
// ============================================================
function CampaignsTab() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: campaigns = [] } = useQuery({
    queryKey: ['email-campaigns'],
    queryFn: async () => {
      const { data, error } = await supabase.from('email_campaigns').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      return data as Campaign[];
    },
  });

  const dispatch = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await supabase.functions.invoke('email-campaign-dispatch', { body: { campaignId: id } });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => {
      qc.invalidateQueries({ queryKey: ['email-campaigns'] });
      toast.success(`Campaign sent — ${d.sent || 0} delivered, ${d.skipped || 0} skipped, ${d.failed || 0} failed`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusVariant = (s: string) => s === 'sent' ? 'default' : s === 'sending' ? 'secondary' : s === 'failed' ? 'destructive' : 'outline';

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Campaigns</CardTitle>
        <Button onClick={() => setOpen(true)}><Plus className="h-4 w-4 me-2" /> New campaign</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead><TableHead>Type</TableHead>
              <TableHead>Status</TableHead><TableHead>Stats</TableHead>
              <TableHead className="text-end">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {campaigns.map((c) => (
              <TableRow key={c.id}>
                <TableCell className="font-medium">{c.name}</TableCell>
                <TableCell><Badge variant="outline">{c.type}</Badge></TableCell>
                <TableCell><Badge variant={statusVariant(c.status)}>{c.status}</Badge></TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {c.stats?.sent || 0} sent / {c.stats?.failed || 0} failed / {c.stats?.skipped || 0} skipped
                </TableCell>
                <TableCell className="text-end">
                  {(c.status === 'draft' || c.status === 'scheduled') && (
                    <Button size="sm" onClick={() => dispatch.mutate(c.id)} disabled={dispatch.isPending}>
                      <Send className="h-4 w-4 me-2" /> Send now
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {campaigns.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No campaigns yet.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
      <CampaignDialog open={open} onOpenChange={setOpen} />
    </Card>
  );
}

function CampaignDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const qc = useQueryClient();
  const [form, setForm] = useState({
    name: '', template_id: '', type: 'one_off',
    audience_type: 'all', template_data: '{}',
  });

  const { data: templates = [] } = useQuery({
    queryKey: ['email-templates-active'],
    queryFn: async () => {
      const { data } = await supabase.from('email_templates').select('id, name, slug, category').eq('is_active', true);
      return data || [];
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      let templateData = {};
      try { templateData = JSON.parse(form.template_data || '{}'); } catch { throw new Error('Invalid template data JSON'); }
      const { error } = await supabase.from('email_campaigns').insert({
        name: form.name, template_id: form.template_id, type: form.type,
        audience_filter: { type: form.audience_type }, template_data: templateData, status: 'draft',
      });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['email-campaigns'] }); toast.success('Campaign created'); onOpenChange(false); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle>New campaign</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div><Label>Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
          <div><Label>Template</Label>
            <Select value={form.template_id} onValueChange={(v) => setForm({ ...form, template_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choose template" /></SelectTrigger>
              <SelectContent>
                {templates.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.name} ({t.category})</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Type</Label>
            <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="one_off">One-off blast</SelectItem>
                <SelectItem value="newsletter">Newsletter</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Audience</Label>
            <Select value={form.audience_type} onValueChange={(v) => setForm({ ...form, audience_type: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All opted-in subscribers</SelectItem>
                <SelectItem value="has_order">Customers who ordered</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>Template data (JSON for variable substitution)</Label>
            <Textarea rows={4} className="font-mono text-xs" value={form.template_data}
              onChange={(e) => setForm({ ...form, template_data: e.target.value })} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button onClick={() => create.mutate()} disabled={create.isPending || !form.name || !form.template_id}>Create</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// DRIP TAB
// ============================================================
function DripTab() {
  const qc = useQueryClient();
  const { data: drips = [] } = useQuery({
    queryKey: ['drip-campaigns'],
    queryFn: async () => {
      const { data } = await supabase.from('drip_campaigns').select('*').order('created_at', { ascending: false });
      return data || [];
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ id, val }: { id: string; val: boolean }) => {
      const { error } = await supabase.from('drip_campaigns').update({ is_active: val }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drip-campaigns'] }),
  });

  const create = useMutation({
    mutationFn: async () => {
      const name = prompt('Drip campaign name?'); if (!name) return;
      const trigger = prompt('Trigger event? (signup, first_order, cart_abandoned, inactive_30d, manual)', 'signup');
      if (!trigger) return;
      const { error } = await supabase.from('drip_campaigns').insert({ name, trigger_event: trigger });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['drip-campaigns'] }); toast.success('Drip created'); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Drip campaigns</CardTitle>
        <Button onClick={() => create.mutate()}><Plus className="h-4 w-4 me-2" /> New drip</Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Name</TableHead><TableHead>Trigger</TableHead>
            <TableHead>Steps</TableHead><TableHead>Active</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {drips.map((d: any) => (
              <DripRow key={d.id} drip={d} onToggle={(v) => toggle.mutate({ id: d.id, val: v })} />
            ))}
            {drips.length === 0 && (
              <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                No drip campaigns. Create one to automate emails based on user events.
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function DripRow({ drip, onToggle }: { drip: any; onToggle: (v: boolean) => void }) {
  const qc = useQueryClient();
  const { data: steps = [] } = useQuery({
    queryKey: ['drip-steps', drip.id],
    queryFn: async () => {
      const { data } = await supabase.from('drip_campaign_steps').select('*, email_templates(name, slug)').eq('drip_campaign_id', drip.id).order('step_order');
      return data || [];
    },
  });

  const addStep = useMutation({
    mutationFn: async () => {
      const { data: templates } = await supabase.from('email_templates').select('id, name').eq('is_active', true);
      const list = (templates || []).map((t: any, i: number) => `${i + 1}. ${t.name}`).join('\n');
      const idx = parseInt(prompt(`Pick template number:\n${list}`) || '0', 10) - 1;
      if (isNaN(idx) || !templates?.[idx]) return;
      const delay = parseInt(prompt('Delay hours after previous step?', '24') || '24', 10);
      const nextOrder = steps.length;
      const { error } = await supabase.from('drip_campaign_steps').insert({
        drip_campaign_id: drip.id, step_order: nextOrder,
        delay_hours: delay, template_id: templates[idx].id,
      });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['drip-steps', drip.id] }),
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <TableRow>
      <TableCell className="font-medium">
        {drip.name}
        {steps.length > 0 && (
          <div className="text-xs text-muted-foreground mt-1">
            {steps.map((s: any, i: number) => (
              <span key={s.id}>{i > 0 && ' → '}{s.email_templates?.name} (+{s.delay_hours}h)</span>
            ))}
          </div>
        )}
      </TableCell>
      <TableCell><Badge variant="outline">{drip.trigger_event}</Badge></TableCell>
      <TableCell>
        {steps.length} <Button size="sm" variant="ghost" onClick={() => addStep.mutate()}>+ add</Button>
      </TableCell>
      <TableCell><Switch checked={drip.is_active} onCheckedChange={onToggle} /></TableCell>
    </TableRow>
  );
}

// ============================================================
// ABANDONED CARTS TAB
// ============================================================
function AbandonedCartsTab() {
  const qc = useQueryClient();
  const { data: carts = [] } = useQuery({
    queryKey: ['abandoned-carts'],
    queryFn: async () => {
      const { data } = await supabase.from('abandoned_carts').select('*').order('created_at', { ascending: false }).limit(100);
      return data || [];
    },
  });

  const run = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke('email-cart-recovery', { body: {} });
      if (error) throw error;
      return data;
    },
    onSuccess: (d: any) => { qc.invalidateQueries({ queryKey: ['abandoned-carts'] }); toast.success(`Sent ${d.first + d.second} recovery emails`); },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Abandoned carts</CardTitle>
        <Button onClick={() => run.mutate()} disabled={run.isPending}>
          <RefreshCw className="h-4 w-4 me-2" /> Run recovery now
        </Button>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Email</TableHead><TableHead>Total</TableHead>
            <TableHead>Items</TableHead><TableHead>Status</TableHead>
            <TableHead>Created</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {carts.map((c: any) => (
              <TableRow key={c.id}>
                <TableCell>{c.email}</TableCell>
                <TableCell>${Number(c.total_amount).toFixed(2)}</TableCell>
                <TableCell>{c.item_count}</TableCell>
                <TableCell><Badge variant="outline">{c.recovery_status}</Badge></TableCell>
                <TableCell className="text-xs">{new Date(c.created_at).toLocaleString()}</TableCell>
              </TableRow>
            ))}
            {carts.length === 0 && (
              <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">No abandoned carts.</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============================================================
// SUBSCRIBERS TAB
// ============================================================
function SubscribersTab() {
  const [search, setSearch] = useState('');
  const { data: subs = [] } = useQuery({
    queryKey: ['email-subscribers', search],
    queryFn: async () => {
      let q = supabase.from('email_subscriptions').select('*').order('created_at', { ascending: false }).limit(200);
      if (search) q = q.ilike('email', `%${search}%`);
      const { data } = await q;
      return data || [];
    },
  });

  const exportCsv = () => {
    const rows = [['email', 'newsletter', 'promotional', 'unsubscribed_at'], ...subs.map((s: any) => [s.email, s.newsletter, s.promotional, s.unsubscribed_at || ''])];
    const csv = rows.map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'subscribers.csv'; a.click();
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Subscribers</CardTitle>
        <div className="flex gap-2">
          <Input placeholder="Search email…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-64" />
          <Button variant="outline" onClick={exportCsv}>Export CSV</Button>
        </div>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Email</TableHead><TableHead>Newsletter</TableHead>
            <TableHead>Promotional</TableHead><TableHead>Unsubscribed</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {subs.map((s: any) => (
              <TableRow key={s.id}>
                <TableCell>{s.email}</TableCell>
                <TableCell>{s.newsletter ? '✓' : '—'}</TableCell>
                <TableCell>{s.promotional ? '✓' : '—'}</TableCell>
                <TableCell>{s.unsubscribed_at ? new Date(s.unsubscribed_at).toLocaleDateString() : '—'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

// ============================================================
// LOGS TAB
// ============================================================
function LogsTab() {
  const { data: logs = [] } = useQuery({
    queryKey: ['email-logs'],
    queryFn: async () => {
      const { data } = await supabase.from('email_send_log').select('*').order('sent_at', { ascending: false }).limit(200);
      return data || [];
    },
    refetchInterval: 10000,
  });

  return (
    <Card>
      <CardHeader><CardTitle>Send log (most recent 200)</CardTitle></CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow>
            <TableHead>Time</TableHead><TableHead>Recipient</TableHead>
            <TableHead>Template</TableHead><TableHead>Category</TableHead>
            <TableHead>Status</TableHead><TableHead>Error</TableHead>
          </TableRow></TableHeader>
          <TableBody>
            {logs.map((l: any) => (
              <TableRow key={l.id}>
                <TableCell className="text-xs whitespace-nowrap">{new Date(l.sent_at).toLocaleString()}</TableCell>
                <TableCell>{l.recipient_email}</TableCell>
                <TableCell><code className="text-xs">{l.template_slug}</code></TableCell>
                <TableCell><Badge variant="outline">{l.category}</Badge></TableCell>
                <TableCell>
                  <Badge variant={l.status === 'sent' ? 'default' : l.status === 'failed' ? 'destructive' : 'secondary'}>
                    {l.status}
                  </Badge>
                </TableCell>
                <TableCell className="text-xs text-muted-foreground max-w-xs truncate">{l.error || ''}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
