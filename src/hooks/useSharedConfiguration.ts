import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

function generateToken() {
  const arr = new Uint8Array(9);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 12);
}

export interface SharedConfig {
  id: string;
  share_token: string;
  owner_id: string | null;
  product_id: string;
  configuration_id: string | null;
  configuration_data: any;
  configuration_name: string | null;
  total_price: number | null;
  is_collaborative: boolean;
  allow_edits: boolean;
  view_count: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export function useSharedConfiguration() {
  const { user } = useAuth();

  const create = useCallback(
    async (params: {
      productId: string;
      configurationData: any;
      configurationName?: string;
      totalPrice?: number;
      isCollaborative?: boolean;
      allowEdits?: boolean;
    }) => {
      if (!user) {
        toast.error('Sign in to create a share link');
        return null;
      }
      const share_token = generateToken();
      const { data, error } = await supabase
        .from('shared_configurations')
        .insert({
          share_token,
          owner_id: user.id,
          product_id: params.productId,
          configuration_data: params.configurationData,
          configuration_name: params.configurationName ?? null,
          total_price: params.totalPrice ?? null,
          is_collaborative: params.isCollaborative ?? false,
          allow_edits: params.allowEdits ?? false,
        })
        .select('*')
        .single();
      if (error) {
        console.error(error);
        toast.error('Could not create share link');
        return null;
      }
      return data as SharedConfig;
    },
    [user]
  );

  return { create };
}

export function useResolveShare(shareToken: string | undefined) {
  const [share, setShare] = useState<SharedConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!shareToken) return;
    let mounted = true;
    setLoading(true);
    (async () => {
      const { data, error } = await supabase
        .from('shared_configurations')
        .select('*')
        .eq('share_token', shareToken)
        .maybeSingle();
      if (!mounted) return;
      if (error || !data) {
        setError('Share link not found or expired');
      } else {
        setShare(data as SharedConfig);
        // increment view_count (best effort, ignore failures)
        supabase
          .from('shared_configurations')
          .update({ view_count: (data.view_count ?? 0) + 1 })
          .eq('id', data.id)
          .then(() => {});
      }
      setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [shareToken]);

  return { share, loading, error };
}
