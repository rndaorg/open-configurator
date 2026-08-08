import { createContext, useContext, useEffect, useMemo, useState, useCallback, ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  custom_domain: string | null;
  status: string;
  onboarding_step: number;
  onboarding_completed: boolean;
  created_by: string | null;
}

export interface TenantBranding {
  tenant_id: string;
  logo_url: string | null;
  favicon_url: string | null;
  tagline: string | null;
  support_email: string | null;
  primary_color: string;
  accent_color: string;
  background_color: string;
  foreground_color: string;
  heading_font: string;
  body_font: string;
  radius: string;
}

export type TenantRole = 'owner' | 'admin' | 'member';

interface TenantContextValue {
  tenant: Tenant | null;
  branding: TenantBranding | null;
  role: TenantRole | null;
  loading: boolean;
  /** Prefix a path with the active tenant, e.g. tenantPath('/products') */
  tenantPath: (path: string) => string;
  refresh: () => Promise<void>;
}

const TenantContext = createContext<TenantContextValue>({
  tenant: null,
  branding: null,
  role: null,
  loading: true,
  tenantPath: (p) => p,
  refresh: async () => {},
});

export const useTenant = () => useContext(TenantContext);

const GOOGLE_FONT_ID = 'tenant-google-font';
const FAVICON_ID = 'tenant-favicon';

function applyBranding(branding: TenantBranding | null) {
  const root = document.documentElement;
  const vars: Array<[string, string | undefined]> = [
    ['--primary', branding?.primary_color],
    ['--ring', branding?.primary_color],
    ['--accent', branding?.accent_color],
    ['--background', branding?.background_color],
    ['--foreground', branding?.foreground_color],
    ['--radius', branding?.radius],
    ['--font-heading', branding ? `'${branding.heading_font}', system-ui, sans-serif` : undefined],
    ['--font-body', branding ? `'${branding.body_font}', system-ui, sans-serif` : undefined],
  ];

  vars.forEach(([name, value]) => {
    if (value) root.style.setProperty(name, value);
    else root.style.removeProperty(name);
  });

  // Google Fonts
  const existing = document.getElementById(GOOGLE_FONT_ID);
  if (branding) {
    const families = Array.from(new Set([branding.heading_font, branding.body_font]))
      .map((f) => `family=${encodeURIComponent(f)}:wght@400;500;600;700`)
      .join('&');
    const href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
    if (existing) {
      (existing as HTMLLinkElement).href = href;
    } else {
      const link = document.createElement('link');
      link.id = GOOGLE_FONT_ID;
      link.rel = 'stylesheet';
      link.href = href;
      document.head.appendChild(link);
    }
  } else if (existing) {
    existing.remove();
  }

  // Favicon
  if (branding?.favicon_url) {
    let icon = document.getElementById(FAVICON_ID) as HTMLLinkElement | null;
    if (!icon) {
      icon = document.createElement('link');
      icon.id = FAVICON_ID;
      icon.rel = 'icon';
      document.head.appendChild(icon);
    }
    icon.href = branding.favicon_url;
  } else {
    document.getElementById(FAVICON_ID)?.remove();
  }
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const location = useLocation();
  const { user } = useAuth();
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [branding, setBranding] = useState<TenantBranding | null>(null);
  const [role, setRole] = useState<TenantRole | null>(null);
  const [loading, setLoading] = useState(true);

  const slug = useMemo(() => {
    const match = location.pathname.match(/^\/t\/([^/]+)/);
    return match ? decodeURIComponent(match[1]) : null;
  }, [location.pathname]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const host = window.location.hostname;
      let query = supabase.from('tenants').select('*').eq('status', 'active').limit(1);

      if (slug) {
        query = query.eq('slug', slug);
      } else if (host && !/^(localhost|127\.0\.0\.1)$/.test(host) && !host.endsWith('.lovable.app')) {
        query = query.eq('custom_domain', host);
      } else {
        setTenant(null);
        setBranding(null);
        setRole(null);
        applyBranding(null);
        setLoading(false);
        return;
      }

      const { data } = await query.maybeSingle();
      const t = (data as Tenant | null) ?? null;
      setTenant(t);

      if (t) {
        const { data: b } = await supabase
          .from('tenant_branding')
          .select('*')
          .eq('tenant_id', t.id)
          .maybeSingle();
        const bb = (b as TenantBranding | null) ?? null;
        setBranding(bb);
        applyBranding(bb);
      } else {
        setBranding(null);
        applyBranding(null);
      }
    } catch (e) {
      console.error('Failed to resolve tenant', e);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    let active = true;
    async function loadRole() {
      if (!user || !tenant) {
        setRole(null);
        return;
      }
      const { data } = await supabase
        .from('tenant_members')
        .select('role')
        .eq('tenant_id', tenant.id)
        .eq('user_id', user.id)
        .maybeSingle();
      if (active) setRole((data?.role as TenantRole) ?? null);
    }
    loadRole();
    return () => {
      active = false;
    };
  }, [user, tenant]);

  const tenantPath = useCallback(
    (path: string) => (tenant ? `/t/${tenant.slug}${path === '/' ? '' : path}` : path),
    [tenant]
  );

  return (
    <TenantContext.Provider value={{ tenant, branding, role, loading, tenantPath, refresh: load }}>
      {children}
    </TenantContext.Provider>
  );
}
