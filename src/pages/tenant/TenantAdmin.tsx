import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useTenant } from '@/contexts/TenantContext';
import {
  useTenantBranding,
  useTenantMembers,
  useUpdateBranding,
  useUpdateTenant,
  uploadTenantAsset,
} from '@/hooks/useTenants';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2, Upload, ExternalLink, Trash2 } from 'lucide-react';

const FONTS = ['Inter', 'Manrope', 'Poppins', 'Playfair Display', 'Space Grotesk', 'DM Sans', 'Sora', 'Lora'];

export default function TenantAdmin() {
  const { slug } = useParams();
  const qc = useQueryClient();
  const { tenant, role, loading, refresh } = useTenant();
  const canManage = role === 'owner' || role === 'admin';

  const { data: branding } = useTenantBranding(tenant?.id);
  const { data: members } = useTenantMembers(tenant?.id);
  const updateBranding = useUpdateBranding();
  const updateTenant = useUpdateTenant();

  const [form, setForm] = useState({
    primary_color: '',
    accent_color: '',
    background_color: '',
    foreground_color: '',
    heading_font: 'Inter',
    body_font: 'Inter',
    radius: '0.5rem',
    tagline: '',
    support_email: '',
    logo_url: '',
    favicon_url: '',
  });
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [memberEmail, setMemberEmail] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (branding) {
      setForm({
        primary_color: branding.primary_color,
        accent_color: branding.accent_color,
        background_color: branding.background_color,
        foreground_color: branding.foreground_color,
        heading_font: branding.heading_font,
        body_font: branding.body_font,
        radius: branding.radius,
        tagline: branding.tagline ?? '',
        support_email: branding.support_email ?? '',
        logo_url: branding.logo_url ?? '',
        favicon_url: branding.favicon_url ?? '',
      });
    }
  }, [branding]);

  useEffect(() => {
    if (tenant) {
      setName(tenant.name);
      setDomain(tenant.custom_domain ?? '');
    }
  }, [tenant]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-3xl mx-auto px-6 py-20 text-center space-y-4">
          <h1 className="text-2xl font-bold">Workspace not found</h1>
          <p className="text-muted-foreground">No active workspace matches “{slug}”.</p>
          <Button asChild><Link to="/onboarding">Create a workspace</Link></Button>
        </main>
        <Footer />
      </div>
    );
  }

  if (!canManage) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <main className="max-w-3xl mx-auto px-6 py-20 text-center space-y-4">
          <h1 className="text-2xl font-bold">No access</h1>
          <p className="text-muted-foreground">You need an owner or admin role in {tenant.name} to open this panel.</p>
        </main>
        <Footer />
      </div>
    );
  }

  const saveBranding = async () => {
    setBusy(true);
    try {
      await updateBranding.mutateAsync({
        tenant_id: tenant.id,
        ...form,
        tagline: form.tagline || null,
        support_email: form.support_email || null,
        logo_url: form.logo_url || null,
        favicon_url: form.favicon_url || null,
      });
      await refresh();
      toast.success('Branding saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save branding');
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (file: File, kind: 'logo' | 'favicon') => {
    setBusy(true);
    try {
      const url = await uploadTenantAsset(tenant.id, file, kind);
      setForm((f) => ({ ...f, [kind === 'logo' ? 'logo_url' : 'favicon_url']: url }));
      toast.success('Uploaded — remember to save');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const saveSettings = async () => {
    setBusy(true);
    try {
      await updateTenant.mutateAsync({
        id: tenant.id,
        name,
        custom_domain: domain.trim() ? domain.trim().toLowerCase() : null,
      });
      await refresh();
      toast.success('Settings saved');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save settings');
    } finally {
      setBusy(false);
    }
  };

  const addMember = async () => {
    const email = memberEmail.trim().toLowerCase();
    if (!email) return;
    setBusy(true);
    try {
      const { data: profile } = await supabase.from('profiles').select('id').eq('email', email).maybeSingle();
      if (!profile) {
        toast.error('No account found with that email — ask them to sign up first');
        return;
      }
      const { error } = await supabase
        .from('tenant_members')
        .insert({ tenant_id: tenant.id, user_id: profile.id, role: 'member' });
      if (error) throw error;
      setMemberEmail('');
      qc.invalidateQueries({ queryKey: ['tenant-members', tenant.id] });
      toast.success('Member added');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not add member');
    } finally {
      setBusy(false);
    }
  };

  const changeRole = async (id: string, newRole: string) => {
    const { error } = await supabase.from('tenant_members').update({ role: newRole }).eq('id', id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ['tenant-members', tenant.id] });
  };

  const removeMember = async (id: string) => {
    const { error } = await supabase.from('tenant_members').delete().eq('id', id);
    if (error) toast.error(error.message);
    else qc.invalidateQueries({ queryKey: ['tenant-members', tenant.id] });
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title={`${tenant.name} workspace admin | Open Configurator`}
        description={`Manage branding, members, domain and settings for the ${tenant.name} white-label configurator workspace.`}
        path={`/t/${tenant.slug}/admin`}
      />
      <Navigation />
      <main className="max-w-5xl mx-auto px-6 py-10 space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{tenant.name}</h1>
            <p className="text-muted-foreground text-sm">
              /t/{tenant.slug} <Badge variant="secondary" className="ms-2">{role}</Badge>
            </p>
          </div>
          <Button variant="outline" asChild>
            <Link to={`/t/${tenant.slug}`}>Storefront <ExternalLink className="ms-2 h-4 w-4" /></Link>
          </Button>
        </header>

        <Tabs defaultValue="branding">
          <TabsList>
            <TabsTrigger value="branding">Branding</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
            <TabsTrigger value="domain">Domain</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="branding" className="space-y-6 pt-6">
            <Card>
              <CardHeader>
                <CardTitle>Identity</CardTitle>
                <CardDescription>Logo and favicon shown across your storefront.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <label className="flex items-center gap-2 border border-dashed rounded-md p-3 cursor-pointer hover:bg-muted/50">
                    <Upload className="h-4 w-4" /><span className="text-sm">Upload logo</span>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'logo')} />
                  </label>
                  {form.logo_url && <img src={form.logo_url} alt={`${tenant.name} logo`} className="h-10 object-contain" />}
                </div>
                <div className="space-y-2">
                  <Label>Favicon</Label>
                  <label className="flex items-center gap-2 border border-dashed rounded-md p-3 cursor-pointer hover:bg-muted/50">
                    <Upload className="h-4 w-4" /><span className="text-sm">Upload favicon</span>
                    <input type="file" accept="image/*" className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'favicon')} />
                  </label>
                  {form.favicon_url && <img src={form.favicon_url} alt={`${tenant.name} favicon`} className="h-8 w-8 object-contain" />}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Theme</CardTitle>
                <CardDescription>HSL values, e.g. “243 75% 59%”.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                {([
                  ['primary_color', 'Primary'],
                  ['accent_color', 'Accent'],
                  ['background_color', 'Background'],
                  ['foreground_color', 'Text'],
                ] as const).map(([key, label]) => (
                  <div key={key} className="space-y-2">
                    <Label htmlFor={key}>{label}</Label>
                    <div className="flex items-center gap-2">
                      <span className="h-9 w-9 rounded border shrink-0" style={{ background: `hsl(${form[key]})` }} />
                      <Input id={key} value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} />
                    </div>
                  </div>
                ))}
                <div className="space-y-2">
                  <Label>Heading font</Label>
                  <Select value={form.heading_font} onValueChange={(v) => setForm({ ...form, heading_font: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Body font</Label>
                  <Select value={form.body_font} onValueChange={(v) => setForm({ ...form, body_font: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input id="tagline" value={form.tagline} onChange={(e) => setForm({ ...form, tagline: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support_email">Support email</Label>
                  <Input id="support_email" type="email" value={form.support_email}
                    onChange={(e) => setForm({ ...form, support_email: e.target.value })} />
                </div>
              </CardContent>
            </Card>
            <Button onClick={saveBranding} disabled={busy}>
              {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}Save branding
            </Button>
          </TabsContent>

          <TabsContent value="members" className="space-y-6 pt-6">
            <Card>
              <CardHeader>
                <CardTitle>Team</CardTitle>
                <CardDescription>Members can manage this workspace's catalog and orders.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input placeholder="teammate@company.com" value={memberEmail} onChange={(e) => setMemberEmail(e.target.value)} />
                  <Button onClick={addMember} disabled={busy}>Add</Button>
                </div>
                <Table>
                  <TableHeader>
                    <TableRow><TableHead>User</TableHead><TableHead>Role</TableHead><TableHead /></TableRow>
                  </TableHeader>
                  <TableBody>
                    {(members || []).map((m: Record<string, string>) => (
                      <TableRow key={m.id}>
                        <TableCell className="font-mono text-xs">{m.user_id}</TableCell>
                        <TableCell>
                          <Select value={m.role} onValueChange={(v) => changeRole(m.id, v)}>
                            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="owner">owner</SelectItem>
                              <SelectItem value="admin">admin</SelectItem>
                              <SelectItem value="member">member</SelectItem>
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-end">
                          <Button variant="ghost" size="icon" onClick={() => removeMember(m.id)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="domain" className="pt-6">
            <Card>
              <CardHeader>
                <CardTitle>Custom domain</CardTitle>
                <CardDescription>Visitors on this hostname get your branded workspace automatically.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="cdomain">Domain</Label>
                  <Input id="cdomain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="shop.acme.com" />
                  <p className="text-xs text-muted-foreground">
                    Point a CNAME/A record at this app at your registrar, then connect it in Project settings → Domains.
                  </p>
                </div>
                <Button onClick={saveSettings} disabled={busy}>Save domain</Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="pt-6">
            <Card>
              <CardHeader>
                <CardTitle>Workspace settings</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="wname">Business name</Label>
                  <Input id="wname" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Workspace address</Label>
                  <Input value={`/t/${tenant.slug}`} readOnly />
                </div>
                <Button onClick={saveSettings} disabled={busy}>Save settings</Button>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
      <Footer />
    </div>
  );
}
