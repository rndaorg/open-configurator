
REVOKE EXECUTE ON FUNCTION public.is_tenant_member(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.has_tenant_role(uuid, public.tenant_role) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_manage_tenant(uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.can_write_tenant(uuid) FROM anon;

CREATE POLICY "Tenant assets are readable"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'tenant-assets');

CREATE POLICY "Tenant members upload assets"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'tenant-assets'
    AND public.can_write_tenant(NULLIF((storage.foldername(name))[1], '')::uuid)
  );

CREATE POLICY "Tenant members update assets"
  ON storage.objects FOR UPDATE TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND public.can_write_tenant(NULLIF((storage.foldername(name))[1], '')::uuid)
  );

CREATE POLICY "Tenant members delete assets"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'tenant-assets'
    AND public.can_write_tenant(NULLIF((storage.foldername(name))[1], '')::uuid)
  );
