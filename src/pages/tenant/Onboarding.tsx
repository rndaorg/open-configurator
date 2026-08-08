import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { SEO } from '@/components/SEO';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { slugify, useCreateTenant, useUpdateBranding, useUpdateTenant, uploadTenantAsset } from '@/hooks/useTenants';
import { Check, Loader2, Upload } from 'lucide-react';

const FONTS = ['Inter', 'Manrope', 'Poppins', 'Playfair Display', 'Space Grotesk', 'DM Sans', 'Sora', 'Lora'];

const PALETTES = [
  { label: 'Indigo', primary: '243 75% 59%', accent: '199 89% 48%' },
  { label: 'Emerald', primary: '160 84% 39%', accent: '43 96% 56%' },
  { label: 'Crimson', primary: '347 77% 50%', accent: '25 95% 53%' },
  { label: 'Slate', primary: '215 28% 30%', accent: '199 89% 48%' },
];

const STEPS = ['Business', 'Branding', 'Domain', 'Done'];

export default function TenantOnboarding() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const createTenant = useCreateTenant();
  const updateTenant = useUpdateTenant();
  const updateBranding = useUpdateBranding();

  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [tagline, setTagline] = useState('');
  const [supportEmail, setSupportEmail] = useState('');
  const [palette, setPalette] = useState(PALETTES[0]);
  const [headingFont, setHeadingFont] = useState('Inter');
  const [bodyFont, setBodyFont] = useState('Inter');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [faviconUrl, setFaviconUrl] = useState<string | null>(null);
  const [customDomain, setCustomDomain] = useState('');

  if (!authLoading && !user) {
    navigate('/auth');
  }

  const handleCreate = async () => {
    const finalSlug = slugify(slug || name);
    if (!name.trim() || !finalSlug) {
      toast.error('Enter a business name');
      return;
    }
    setBusy(true);
    try {
      const { data: existing } = await supabase.from('tenants').select('id').eq('slug', finalSlug).maybeSingle();
      if (existing) {
        toast.error('That workspace address is already taken');
        return;
      }
      const tenant = await createTenant.mutateAsync({ name: name.trim(), slug: finalSlug });
      setTenantId(tenant.id);
      setSlug(tenant.slug);
      setStep(1);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not create the business');
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (file: File, kind: 'logo' | 'favicon') => {
    if (!tenantId) return;
    setBusy(true);
    try {
      const url = await uploadTenantAsset(tenantId, file, kind);
      if (kind === 'logo') setLogoUrl(url);
      else setFaviconUrl(url);
      toast.success(`${kind === 'logo' ? 'Logo' : 'Favicon'} uploaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setBusy(false);
    }
  };

  const handleBranding = async () => {
    if (!tenantId) return;
    setBusy(true);
    try {
      await updateBranding.mutateAsync({
        tenant_id: tenantId,
        primary_color: palette.primary,
        accent_color: palette.accent,
        heading_font: headingFont,
        body_font: bodyFont,
        tagline: tagline || null,
        support_email: supportEmail || null,
        logo_url: logoUrl,
        favicon_url: faviconUrl,
      });
      await updateTenant.mutateAsync({ id: tenantId, onboarding_step: 2 });
      setStep(2);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save branding');
    } finally {
      setBusy(false);
    }
  };

  const handleFinish = async () => {
    if (!tenantId) return;
    setBusy(true);
    try {
      await updateTenant.mutateAsync({
        id: tenantId,
        custom_domain: customDomain.trim() ? customDomain.trim().toLowerCase() : null,
        onboarding_step: 3,
        onboarding_completed: true,
      });
      setStep(3);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not save the domain');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Create your white-label workspace | Open Configurator"
        description="Launch a branded product configurator for your business in minutes: pick a workspace address, upload your logo, choose colors and fonts."
        path="/onboarding"
      />
      <Navigation />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">Set up your workspace</h1>
          <p className="text-muted-foreground">Four quick steps to a fully branded, isolated configurator.</p>
        </header>

        <div className="space-y-2">
          <Progress value={((step + 1) / STEPS.length) * 100} />
          <div className="flex justify-between text-xs text-muted-foreground">
            {STEPS.map((s, i) => (
              <span key={s} className={i <= step ? 'text-primary font-medium' : ''}>
                {s}
              </span>
            ))}
          </div>
        </div>

        {step === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Business details</CardTitle>
              <CardDescription>Your workspace lives at /t/your-address.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Business name</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    setSlug(slugify(e.target.value));
                  }}
                  placeholder="Acme Bicycles"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="slug">Workspace address</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">/t/</span>
                  <Input id="slug" value={slug} onChange={(e) => setSlug(slugify(e.target.value))} placeholder="acme" />
                </div>
              </div>
              <Button onClick={handleCreate} disabled={busy}>
                {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>Branding</CardTitle>
              <CardDescription>Logo, colors and typography for your storefront.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Logo</Label>
                  <label className="flex items-center gap-2 border border-dashed rounded-md p-3 cursor-pointer hover:bg-muted/50">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm truncate">{logoUrl ? 'Replace logo' : 'Upload logo'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'logo')}
                    />
                  </label>
                  {logoUrl && <img src={logoUrl} alt="Uploaded business logo" className="h-10 object-contain" />}
                </div>
                <div className="space-y-2">
                  <Label>Favicon</Label>
                  <label className="flex items-center gap-2 border border-dashed rounded-md p-3 cursor-pointer hover:bg-muted/50">
                    <Upload className="h-4 w-4" />
                    <span className="text-sm truncate">{faviconUrl ? 'Replace favicon' : 'Upload favicon'}</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => e.target.files?.[0] && handleUpload(e.target.files[0], 'favicon')}
                    />
                  </label>
                  {faviconUrl && <img src={faviconUrl} alt="Uploaded favicon" className="h-8 w-8 object-contain" />}
                </div>
              </div>

              <div className="space-y-2">
                <Label>Color theme</Label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {PALETTES.map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      onClick={() => setPalette(p)}
                      className={`rounded-md border p-3 text-start transition-colors ${
                        palette.label === p.label ? 'border-primary ring-2 ring-primary/40' : 'hover:bg-muted/50'
                      }`}
                    >
                      <div className="flex gap-1 mb-2">
                        <span className="h-5 w-5 rounded" style={{ background: `hsl(${p.primary})` }} />
                        <span className="h-5 w-5 rounded" style={{ background: `hsl(${p.accent})` }} />
                      </div>
                      <span className="text-xs">{p.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Heading font</Label>
                  <Select value={headingFont} onValueChange={setHeadingFont}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Body font</Label>
                  <Select value={bodyFont} onValueChange={setBodyFont}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {FONTS.map((f) => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="tagline">Tagline</Label>
                  <Input id="tagline" value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Built for riders" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="support">Support email</Label>
                  <Input id="support" type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} placeholder="help@acme.com" />
                </div>
              </div>

              <Button onClick={handleBranding} disabled={busy}>
                {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>Custom domain (optional)</CardTitle>
              <CardDescription>Point your own domain at this workspace. You can add it later.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="domain">Domain</Label>
                <Input id="domain" value={customDomain} onChange={(e) => setCustomDomain(e.target.value)} placeholder="shop.acme.com" />
                <p className="text-xs text-muted-foreground">
                  Add a CNAME/A record at your registrar pointing to this app, then we resolve visitors on that hostname to your workspace.
                </p>
              </div>
              <Button onClick={handleFinish} disabled={busy}>
                {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}Finish setup
              </Button>
            </CardContent>
          </Card>
        )}

        {step === 3 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-primary" /> Workspace ready
              </CardTitle>
              <CardDescription>{name} is live at /t/{slug}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              <Button onClick={() => navigate(`/t/${slug}`)}>View storefront</Button>
              <Button variant="outline" onClick={() => navigate(`/t/${slug}/admin`)}>Open tenant admin</Button>
            </CardContent>
          </Card>
        )}
      </main>
      <Footer />
    </div>
  );
}
