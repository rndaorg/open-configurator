import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, ArrowUpCircle, ArrowDownCircle, XCircle, PlayCircle, AlertCircle, Sparkles } from 'lucide-react';
import { format } from 'date-fns';

interface HistoryEvent {
  id: string;
  event_type: string;
  from_tier_id: string | null;
  to_tier_id: string | null;
  from_status: string | null;
  to_status: string | null;
  reason: string | null;
  created_at: string;
}

interface Tier { id: string; name: string; }

const eventConfig: Record<string, { icon: typeof Sparkles; label: string; color: string }> = {
  created: { icon: Sparkles, label: 'Subscription Created', color: 'text-blue-500' },
  tier_changed: { icon: ArrowUpCircle, label: 'Plan Changed', color: 'text-primary' },
  upgraded: { icon: ArrowUpCircle, label: 'Upgraded', color: 'text-green-500' },
  downgraded: { icon: ArrowDownCircle, label: 'Downgraded', color: 'text-yellow-500' },
  canceled: { icon: XCircle, label: 'Canceled', color: 'text-red-500' },
  cancellation_scheduled: { icon: AlertCircle, label: 'Cancellation Scheduled', color: 'text-yellow-500' },
  resumed: { icon: PlayCircle, label: 'Resumed', color: 'text-green-500' },
  status_changed: { icon: AlertCircle, label: 'Status Changed', color: 'text-muted-foreground' },
  payment_failed: { icon: AlertCircle, label: 'Payment Failed', color: 'text-red-500' },
  renewed: { icon: Sparkles, label: 'Renewed', color: 'text-green-500' },
};

export function SubscriptionHistoryTab() {
  const { user } = useAuth();
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [tiers, setTiers] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) load();
  }, [user]);

  const load = async () => {
    try {
      setLoading(true);
      const [historyRes, tiersRes] = await Promise.all([
        supabase
          .from('subscription_history')
          .select('*')
          .eq('user_id', user!.id)
          .order('created_at', { ascending: false }),
        supabase.from('subscription_tiers').select('id, name'),
      ]);
      if (historyRes.error) throw historyRes.error;
      setEvents(historyRes.data || []);
      const tierMap: Record<string, string> = {};
      (tiersRes.data || []).forEach((t: Tier) => { tierMap[t.id] = t.name; });
      setTiers(tierMap);
    } catch (error) {
      console.error('Error loading history:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <History className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Subscription History</CardTitle>
            <CardDescription>A timeline of all changes to your subscription</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="py-12 text-center">
            <History className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No subscription history yet</p>
          </div>
        ) : (
          <div className="space-y-4">
            {events.map((event, idx) => {
              const config = eventConfig[event.event_type] || eventConfig.status_changed;
              const Icon = config.icon;
              const fromTier = event.from_tier_id ? tiers[event.from_tier_id] : null;
              const toTier = event.to_tier_id ? tiers[event.to_tier_id] : null;
              return (
                <div key={event.id} className="flex gap-4 relative">
                  {idx !== events.length - 1 && (
                    <div className="absolute left-[19px] top-10 bottom-0 w-px bg-border" />
                  )}
                  <div className={`p-2 rounded-full bg-muted h-10 w-10 flex items-center justify-center shrink-0 ${config.color}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 pb-4">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <p className="font-medium">{config.label}</p>
                      <span className="text-xs text-muted-foreground">
                        {format(new Date(event.created_at), 'MMM d, yyyy h:mm a')}
                      </span>
                    </div>
                    {(fromTier || toTier) && (
                      <p className="text-sm text-muted-foreground mt-1">
                        {fromTier && toTier ? (
                          <>From <Badge variant="outline">{fromTier}</Badge> to <Badge variant="outline">{toTier}</Badge></>
                        ) : toTier ? (
                          <>Plan: <Badge variant="outline">{toTier}</Badge></>
                        ) : null}
                      </p>
                    )}
                    {event.from_status && event.to_status && event.from_status !== event.to_status && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Status: {event.from_status} → {event.to_status}
                      </p>
                    )}
                    {event.reason && (
                      <p className="text-xs text-muted-foreground mt-1 italic">{event.reason}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
