import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import type { Tenant, TenantBranding, TenantRole } from '@/contexts/TenantContext';

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);

export interface TenantMembership extends Tenant {
  role: TenantRole;
}

export function useMyTenants() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['my-tenants', user?.id],
    enabled: !!user,
    queryFn: async (): Promise<TenantMembership[]> => {
      const { data, error } = await supabase
        .from('tenant_members')
        .select('role, tenants(*)')
        .eq('user_id', user!.id);
      if (error) throw error;
      return (data || [])
        .filter((row: Record<string, unknown>) => row.tenants)
        .map((row: Record<string, unknown>) => ({
          ...(row.tenants as Tenant),
          role: row.role as TenantRole,
        }));
    },
  });
}

export function useTenantBySlug(slug?: string) {
  return useQuery({
    queryKey: ['tenant', slug],
    enabled: !!slug,
    queryFn: async () => {
      const { data, error } = await supabase.from('tenants').select('*').eq('slug', slug!).maybeSingle();
      if (error) throw error;
      return data as Tenant | null;
    },
  });
}

export function useTenantBranding(tenantId?: string) {
  return useQuery({
    queryKey: ['tenant-branding', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_branding')
        .select('*')
        .eq('tenant_id', tenantId!)
        .maybeSingle();
      if (error) throw error;
      return data as TenantBranding | null;
    },
  });
}

export function useTenantMembers(tenantId?: string) {
  return useQuery({
    queryKey: ['tenant-members', tenantId],
    enabled: !!tenantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tenant_members')
        .select('id, user_id, role, created_at')
        .eq('tenant_id', tenantId!)
        .order('created_at');
      if (error) throw error;
      return data;
    },
  });
}

export function useCreateTenant() {
  const { user } = useAuth();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { name: string; slug: string }) => {
      const { data, error } = await supabase
        .from('tenants')
        .insert({ name: input.name, slug: input.slug, created_by: user?.id ?? null })
        .select()
        .single();
      if (error) throw error;
      return data as Tenant;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['my-tenants'] }),
  });
}

export function useUpdateTenant() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Tenant> & { id: string }) => {
      const { data, error } = await supabase.from('tenants').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data as Tenant;
    },
    onSuccess: (t) => {
      qc.invalidateQueries({ queryKey: ['my-tenants'] });
      qc.invalidateQueries({ queryKey: ['tenant', t.slug] });
    },
  });
}

export function useUpdateBranding() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenant_id, ...patch }: Partial<TenantBranding> & { tenant_id: string }) => {
      const { data, error } = await supabase
        .from('tenant_branding')
        .upsert({ tenant_id, ...patch }, { onConflict: 'tenant_id' })
        .select()
        .single();
      if (error) throw error;
      return data as TenantBranding;
    },
    onSuccess: (b) => qc.invalidateQueries({ queryKey: ['tenant-branding', b.tenant_id] }),
  });
}

const TEN_YEARS = 60 * 60 * 24 * 365 * 10;

export async function uploadTenantAsset(tenantId: string, file: File, kind: 'logo' | 'favicon') {
  const ext = file.name.split('.').pop() || 'png';
  const path = `${tenantId}/${kind}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from('tenant-assets').upload(path, file, { upsert: true });
  if (error) throw error;
  const { data, error: signErr } = await supabase.storage
    .from('tenant-assets')
    .createSignedUrl(path, TEN_YEARS);
  if (signErr) throw signErr;
  return data.signedUrl;
}
