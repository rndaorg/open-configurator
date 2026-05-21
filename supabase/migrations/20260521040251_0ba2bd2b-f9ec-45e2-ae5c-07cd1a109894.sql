
-- 1) email_templates: remove broad authenticated read
DROP POLICY IF EXISTS "Authenticated read active templates" ON public.email_templates;

-- 2) payment_provider_config: remove public read
DROP POLICY IF EXISTS "Everyone can view payment config" ON public.payment_provider_config;

-- 3) warehouse_inventory: remove broad authenticated read (admins ALL policy still applies)
DROP POLICY IF EXISTS "Authenticated read warehouse_inventory" ON public.warehouse_inventory;

-- 4) shared_configuration_collaborators: require authenticated INSERT
DROP POLICY IF EXISTS "Anyone can join a collaborative share" ON public.shared_configuration_collaborators;
CREATE POLICY "Authenticated users can join a collaborative share"
ON public.shared_configuration_collaborators
FOR INSERT
TO authenticated
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.shared_configurations sc
    WHERE sc.id = shared_configuration_collaborators.shared_config_id
      AND sc.is_collaborative = true
  )
);

-- 5) shared_configurations: tighten collaborative update policy
DROP POLICY IF EXISTS "Collaborators can update collaborative shares" ON public.shared_configurations;
CREATE POLICY "Verified collaborators can update collaborative shares"
ON public.shared_configurations
FOR UPDATE
TO authenticated
USING (
  is_collaborative = true
  AND allow_edits = true
  AND (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.shared_configuration_collaborators c
      WHERE c.shared_config_id = shared_configurations.id
        AND c.user_id = auth.uid()
    )
  )
)
WITH CHECK (
  is_collaborative = true
  AND allow_edits = true
  AND (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM public.shared_configuration_collaborators c
      WHERE c.shared_config_id = shared_configurations.id
        AND c.user_id = auth.uid()
    )
  )
);

-- 6) Realtime channel authorization: scope topic subscriptions by user
ALTER TABLE IF EXISTS realtime.messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read own user-scoped topics" ON realtime.messages;
CREATE POLICY "Authenticated users can read own user-scoped topics"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Allow own user-scoped channels: notifications:<uid>, orders:<uid>
  (realtime.topic() = 'notifications:' || auth.uid()::text)
  OR (realtime.topic() = 'orders:' || auth.uid()::text)
  -- Allow shared-config channels only for owner or registered collaborators
  OR (
    realtime.topic() LIKE 'shared-config-%'
    AND EXISTS (
      SELECT 1 FROM public.shared_configurations sc
      WHERE sc.id::text = substring(realtime.topic() FROM 'shared-config-(.+)')
        AND (
          sc.owner_id = auth.uid()
          OR EXISTS (
            SELECT 1 FROM public.shared_configuration_collaborators c
            WHERE c.shared_config_id = sc.id AND c.user_id = auth.uid()
          )
        )
    )
  )
  -- Admin-only channels (inventory, etc.)
  OR (
    realtime.topic() IN ('inventory_levels', 'admin')
    AND public.has_role(auth.uid(), 'admin'::app_role)
  )
);

DROP POLICY IF EXISTS "Authenticated users can broadcast to own topics" ON realtime.messages;
CREATE POLICY "Authenticated users can broadcast to own topics"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  realtime.topic() LIKE 'shared-config-%'
  AND EXISTS (
    SELECT 1 FROM public.shared_configurations sc
    WHERE sc.id::text = substring(realtime.topic() FROM 'shared-config-(.+)')
      AND (
        sc.owner_id = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.shared_configuration_collaborators c
          WHERE c.shared_config_id = sc.id AND c.user_id = auth.uid()
        )
      )
  )
);
