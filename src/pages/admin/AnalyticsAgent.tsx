import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Brain, Play, CheckCircle2, XCircle, TrendingDown, Lightbulb, AlertTriangle, Mail } from 'lucide-react';
import { toast } from 'sonner';

interface Insight {
  id: string;
  run_id: string | null;
  product_id: string | null;
  insight_type: string;
  severity: string;
  title: string;
  description: string;
  recommendation: string | null;
  status: string;
  created_at: string;
}

interface Run {
  id: string;
  trigger_type: string;
  status: string;
  window_days: number;
  summary: string | null;
  metrics: any;
  duration_ms: number | null;
  created_at: string;
}

const severityColor: Record<string, string> = {
  high: 'bg-destructive/10 text-destructive border-destructive/30',
  medium: 'bg-amber-500/10 text-amber-500 border-amber-500/30',
  low: 'bg-muted text-muted-foreground border-border',
};

const typeIcon: Record<string, any> = {
  drop_off: TrendingDown,
  underperforming_option: AlertTriangle,
  catalog_change: Lightbulb,
  opportunity: Brain,
};

export default function AnalyticsAgent() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(false);
  const [windowDays, setWindowDays] = useState(30);
  const [emailRecipient, setEmailRecipient] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'accepted' | 'dismissed'>('new');

  const load = async () => {
    const [ri, rr] = await Promise.all([
      supabase.from('analytics_insights').select('*').order('created_at', { ascending: false }).limit(100),
      supabase.from('analytics_agent_runs').select('*').order('created_at', { ascending: false }).limit(20),
    ]);
    if (ri.data) setInsights(ri.data as any);
    if (rr.data) setRuns(rr.data as any);
  };

  useEffect(() => { load(); }, []);

  const run = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('analytics-agent', {
        body: { windowDays, triggerType: 'manual', emailRecipient: emailRecipient || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast.success(`Agent produced ${data.insights} insights`);
      await load();
    } catch (e: any) {
      toast.error(e.message || 'Agent run failed');
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, status: string) => {
    const { error } = await supabase
      .from('analytics_insights')
      .update({ status, reviewed_at: new Date().toISOString() })
      .eq('id', id);
    if (error) return toast.error(error.message);
    setInsights((prev) => prev.map((i) => (i.id === id ? { ...i, status } : i)));
  };

  const filtered = insights.filter((i) => statusFilter === 'all' || i.status === statusFilter);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Brain className="h-7 w-7" /> Self-Improving Analytics Agent</h1>
        <p className="text-muted-foreground mt-1">
          Autonomous agent that monitors configuration patterns, detects drop-off points, flags underperforming options, and proposes catalog changes.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Trigger a run</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Window (days)</Label>
              <Input type="number" min={1} max={365} value={windowDays} onChange={(e) => setWindowDays(parseInt(e.target.value) || 30)} />
            </div>
            <div className="md:col-span-2">
              <Label>Email scheduled report to (optional)</Label>
              <Input type="email" placeholder="admin@example.com" value={emailRecipient} onChange={(e) => setEmailRecipient(e.target.value)} />
            </div>
          </div>
          <Button onClick={run} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Play className="h-4 w-4 mr-2" />}
            Run analytics agent
          </Button>
        </CardContent>
      </Card>

      <Tabs defaultValue="insights">
        <TabsList>
          <TabsTrigger value="insights">Insights ({insights.length})</TabsTrigger>
          <TabsTrigger value="runs">Run history ({runs.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="insights" className="space-y-4">
          <div className="flex gap-2">
            {(['new', 'accepted', 'dismissed', 'all'] as const).map((s) => (
              <Button key={s} variant={statusFilter === s ? 'default' : 'outline'} size="sm" onClick={() => setStatusFilter(s)}>
                {s}
              </Button>
            ))}
          </div>
          {filtered.length === 0 && (
            <Card><CardContent className="py-8 text-center text-muted-foreground">No insights. Run the agent to generate recommendations.</CardContent></Card>
          )}
          <div className="grid gap-3">
            {filtered.map((i) => {
              const Icon = typeIcon[i.insight_type] || Brain;
              return (
                <Card key={i.id} className={`border ${severityColor[i.severity] || ''}`}>
                  <CardContent className="p-4 space-y-2">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3 flex-1">
                        <Icon className="h-5 w-5 mt-1 flex-shrink-0" />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold">{i.title}</h3>
                            <Badge variant="outline">{i.insight_type.replace(/_/g, ' ')}</Badge>
                            <Badge variant="outline">{i.severity}</Badge>
                            <Badge variant={i.status === 'new' ? 'default' : 'secondary'}>{i.status}</Badge>
                          </div>
                          <p className="text-sm mt-2 text-muted-foreground">{i.description}</p>
                          {i.recommendation && (
                            <div className="mt-2 p-2 rounded bg-background/50 text-sm">
                              <strong>Recommendation:</strong> {i.recommendation}
                            </div>
                          )}
                        </div>
                      </div>
                      {i.status === 'new' && (
                        <div className="flex flex-col gap-2">
                          <Button size="sm" variant="outline" onClick={() => updateStatus(i.id, 'accepted')}>
                            <CheckCircle2 className="h-4 w-4 mr-1" /> Accept
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => updateStatus(i.id, 'dismissed')}>
                            <XCircle className="h-4 w-4 mr-1" /> Dismiss
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="runs">
          <Card>
            <CardContent className="p-0">
              <ScrollArea className="h-[500px]">
                <div className="divide-y">
                  {runs.map((r) => (
                    <div key={r.id} className="p-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline">{r.trigger_type}</Badge>
                          <Badge variant={r.status === 'completed' ? 'default' : 'destructive'}>{r.status}</Badge>
                          <span className="text-sm text-muted-foreground">{new Date(r.created_at).toLocaleString()}</span>
                        </div>
                        <span className="text-xs text-muted-foreground">{r.duration_ms}ms · {r.window_days}d window</span>
                      </div>
                      <p className="text-sm">{r.summary}</p>
                      {r.metrics && (
                        <div className="text-xs text-muted-foreground flex gap-3 flex-wrap">
                          {Object.entries(r.metrics).map(([k, v]) => (
                            <span key={k}><strong>{k}:</strong> {String(v)}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                  {runs.length === 0 && <div className="p-8 text-center text-muted-foreground">No runs yet.</div>}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Schedule recurring runs</CardTitle></CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>To run the agent automatically (e.g. weekly), create a pg_cron job that POSTs to the <code>analytics-agent</code> edge function with the <code>x-scheduled-secret</code> header set to your service role key. Insights and scheduled reports will be generated and stored automatically.</p>
        </CardContent>
      </Card>
    </div>
  );
}
