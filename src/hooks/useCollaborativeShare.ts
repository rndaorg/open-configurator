import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface Collaborator {
  id: string;
  user_id: string | null;
  display_name: string;
  last_seen_at: string;
}

interface UseCollaborativeShareOptions {
  sharedConfigId: string;
  enabled: boolean;
  displayName: string;
  onRemoteUpdate?: (configurationData: any) => void;
}

export function useCollaborativeShare({
  sharedConfigId,
  enabled,
  displayName,
  onRemoteUpdate,
}: UseCollaborativeShareOptions) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const myRowIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (!enabled || !sharedConfigId) return;

    let mounted = true;

    const join = async () => {
      const { data: row } = await supabase
        .from('shared_configuration_collaborators')
        .insert({
          shared_config_id: sharedConfigId,
          user_id: (await supabase.auth.getUser()).data.user?.id ?? null,
          display_name: displayName,
        })
        .select()
        .single();
      if (mounted && row) myRowIdRef.current = row.id;

      const { data } = await supabase
        .from('shared_configuration_collaborators')
        .select('*')
        .eq('shared_config_id', sharedConfigId);
      if (mounted) setCollaborators((data as any) ?? []);
    };

    join();

    const channel = supabase
      .channel(`shared-config-${sharedConfigId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shared_configuration_collaborators',
          filter: `shared_config_id=eq.${sharedConfigId}`,
        },
        (payload) => {
          setCollaborators((prev) => {
            if (payload.eventType === 'INSERT') return [...prev, payload.new as any];
            if (payload.eventType === 'DELETE')
              return prev.filter((c) => c.id !== (payload.old as any).id);
            if (payload.eventType === 'UPDATE')
              return prev.map((c) =>
                c.id === (payload.new as any).id ? (payload.new as any) : c
              );
            return prev;
          });
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'shared_configurations',
          filter: `id=eq.${sharedConfigId}`,
        },
        (payload) => {
          const data = (payload.new as any).configuration_data;
          if (data && onRemoteUpdate) onRemoteUpdate(data);
        }
      )
      .subscribe();

    channelRef.current = channel;

    const heartbeat = setInterval(async () => {
      if (myRowIdRef.current) {
        await supabase
          .from('shared_configuration_collaborators')
          .update({ last_seen_at: new Date().toISOString() })
          .eq('id', myRowIdRef.current);
      }
    }, 30000);

    return () => {
      mounted = false;
      clearInterval(heartbeat);
      if (myRowIdRef.current) {
        supabase
          .from('shared_configuration_collaborators')
          .delete()
          .eq('id', myRowIdRef.current)
          .then(() => {});
      }
      if (channelRef.current) supabase.removeChannel(channelRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sharedConfigId, enabled]);

  const broadcastUpdate = async (configurationData: any) => {
    await supabase
      .from('shared_configurations')
      .update({ configuration_data: configurationData })
      .eq('id', sharedConfigId);
  };

  return { collaborators, broadcastUpdate };
}
