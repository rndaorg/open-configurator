import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Sparkles, Send, Users, Scale, Loader2, CheckCircle2, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';

interface MediatorMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  display_name: string;
  content: string;
  proposed_config?: Record<string, string> | null;
  metadata?: any;
  created_at: string;
}

interface MediatorPreference {
  id: string;
  display_name: string;
  preferences_text: string;
  budget_max: number | null;
}

interface Props {
  sharedConfigId: string;
  productId: string;
  displayName: string;
  currentSelections: Record<string, string>;
  optionNameLookup: Record<string, string>;
  valueNameLookup: Record<string, string>;
  onApplyProposal: (map: Record<string, string>) => void;
  allowEdits: boolean;
}

export function CollaborativeMediatorPanel({
  sharedConfigId,
  productId,
  displayName,
  currentSelections,
  optionNameLookup,
  valueNameLookup,
  onApplyProposal,
  allowEdits,
}: Props) {
  const [messages, setMessages] = useState<MediatorMessage[]>([]);
  const [prefs, setPrefs] = useState<MediatorPreference[]>([]);
  const [input, setInput] = useState('');
  const [prefText, setPrefText] = useState('');
  const [budget, setBudget] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [savingPref, setSavingPref] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load initial data + subscribe
  useEffect(() => {
    if (!sharedConfigId) return;
    let mounted = true;

    const load = async () => {
      const [{ data: msgs }, { data: p }] = await Promise.all([
        supabase.from('mediator_messages').select('*').eq('shared_config_id', sharedConfigId).order('created_at', { ascending: true }),
        supabase.from('mediator_preferences').select('*').eq('shared_config_id', sharedConfigId),
      ]);
      if (!mounted) return;
      setMessages((msgs as any) ?? []);
      setPrefs((p as any) ?? []);
      const mine = (p ?? []).find((x: any) => x.display_name === displayName);
      if (mine) {
        setPrefText(mine.preferences_text ?? '');
        setBudget(mine.budget_max ? String(mine.budget_max) : '');
      }
    };
    load();

    const channel = supabase
      .channel(`mediator-${sharedConfigId}`)
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'mediator_messages',
        filter: `shared_config_id=eq.${sharedConfigId}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as any]);
      })
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'mediator_preferences',
        filter: `shared_config_id=eq.${sharedConfigId}`,
      }, (payload) => {
        setPrefs((prev) => {
          if (payload.eventType === 'DELETE') return prev.filter((x) => x.id !== (payload.old as any).id);
          const row = payload.new as any;
          const idx = prev.findIndex((x) => x.id === row.id);
          if (idx === -1) return [...prev, row];
          const clone = [...prev];
          clone[idx] = row;
          return clone;
        });
      })
      .subscribe();

    return () => {
      mounted = false;
      supabase.removeChannel(channel);
    };
  }, [sharedConfigId, displayName]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const savePref = async () => {
    setSavingPref(true);
    const budgetNum = budget ? parseFloat(budget) : null;
    const existing = prefs.find((p) => p.display_name === displayName);
    const payload: any = {
      shared_config_id: sharedConfigId,
      display_name: displayName,
      preferences_text: prefText,
      budget_max: budgetNum,
      updated_at: new Date().toISOString(),
    };
    if (existing) {
      await supabase.from('mediator_preferences').update(payload).eq('id', existing.id);
    } else {
      await supabase.from('mediator_preferences').insert(payload);
    }
    setSavingPref(false);
    toast.success('Your preferences shared with the group');
  };

  const invoke = async (action: 'chat' | 'analyze' | 'propose', message?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('collab-mediator-agent', {
        body: {
          sharedConfigId,
          productId,
          action,
          displayName,
          message,
          currentSelections,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
    } catch (e: any) {
      toast.error(e.message || 'Mediator failed');
    } finally {
      setLoading(false);
    }
  };

  const send = async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput('');
    await invoke('chat', text);
  };

  const applyProposal = (map: Record<string, string>) => {
    if (!allowEdits) {
      toast.error('You do not have edit permission on this share');
      return;
    }
    onApplyProposal(map);
    toast.success('Consensus configuration applied');
  };

  const renderProposal = (m: MediatorMessage) => {
    if (!m.proposed_config || !Object.keys(m.proposed_config).length) return null;
    return (
      <div className="mt-2 space-y-1 rounded-md border border-primary/30 bg-primary/5 p-2 text-xs">
        <p className="font-semibold flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Proposed consensus</p>
        {Object.entries(m.proposed_config).map(([oid, vid]) => (
          <div key={oid} className="flex justify-between gap-2">
            <span className="text-muted-foreground">{optionNameLookup[oid] ?? oid}</span>
            <span>{valueNameLookup[vid] ?? vid}</span>
          </div>
        ))}
        <Button size="sm" className="w-full mt-2 h-7 text-xs" onClick={() => applyProposal(m.proposed_config!)} disabled={!allowEdits}>
          Apply to shared config
        </Button>
      </div>
    );
  };

  const renderMeta = (m: MediatorMessage) => {
    const meta = m.metadata;
    if (!meta) return null;
    return (
      <div className="mt-2 space-y-1">
        {typeof meta.consensus_score === 'number' && (
          <Badge variant="outline" className="text-[10px]">
            Consensus {Math.round(meta.consensus_score)}%
          </Badge>
        )}
        {Array.isArray(meta.disagreements) && meta.disagreements.length > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-2 text-xs">
            <p className="font-semibold flex items-center gap-1"><AlertTriangle className="w-3 h-3" /> Disagreements</p>
            <ul className="mt-1 space-y-1">
              {meta.disagreements.map((d: any, i: number) => (
                <li key={i}>
                  <span className="font-medium">{d.topic}:</span> {d.summary}
                  {d.participants?.length ? <span className="text-muted-foreground"> — {d.participants.join(', ')}</span> : null}
                </li>
              ))}
            </ul>
          </div>
        )}
        {Array.isArray(meta.tradeoffs) && meta.tradeoffs.length > 0 && (
          <div className="rounded-md border border-border bg-muted/40 p-2 text-xs">
            <p className="font-semibold">Trade-offs</p>
            <ul className="mt-1 space-y-1">
              {meta.tradeoffs.map((t: any, i: number) => (
                <li key={i}><span className="font-medium">{t.option}:</span> {t.note}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card className="glass-card p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Sparkles className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold">AI Mediator</h3>
        <Badge variant="secondary" className="text-[10px] ml-auto">
          <Users className="w-3 h-3 mr-1" /> {prefs.length} preferences shared
        </Badge>
      </div>

      {/* My preferences */}
      <div className="space-y-2">
        <p className="text-xs font-medium text-muted-foreground">Your preferences ({displayName})</p>
        <Textarea
          value={prefText}
          onChange={(e) => setPrefText(e.target.value)}
          placeholder="e.g. I care about performance and lightweight materials"
          className="text-xs min-h-[60px]"
        />
        <div className="flex gap-2">
          <Input
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="Max budget"
            type="number"
            className="text-xs h-8"
          />
          <Button size="sm" onClick={savePref} disabled={savingPref} className="h-8 text-xs">
            {savingPref ? <Loader2 className="w-3 h-3 animate-spin" /> : 'Share'}
          </Button>
        </div>
      </div>

      <Separator />

      {/* Live prefs summary */}
      {prefs.length > 0 && (
        <div className="space-y-1 text-xs">
          {prefs.map((p) => (
            <div key={p.id} className="rounded border border-border p-2">
              <div className="flex items-center justify-between">
                <span className="font-medium">{p.display_name}</span>
                {p.budget_max ? <span className="text-muted-foreground">≤ ${p.budget_max}</span> : null}
              </div>
              {p.preferences_text && <p className="text-muted-foreground mt-1">{p.preferences_text}</p>}
            </div>
          ))}
        </div>
      )}

      <Separator />

      {/* Mediator actions */}
      <div className="flex gap-2">
        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => invoke('analyze')} disabled={loading}>
          <Scale className="w-3 h-3 mr-1" /> Analyze
        </Button>
        <Button size="sm" variant="outline" className="flex-1 h-8 text-xs" onClick={() => invoke('propose')} disabled={loading}>
          <Sparkles className="w-3 h-3 mr-1" /> Propose consensus
        </Button>
      </div>

      {/* Chat log */}
      <ScrollArea className="h-72" ref={scrollRef as any}>
        <div className="space-y-3 pr-2">
          {messages.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-8">
              Share preferences above, then ask the mediator to analyze or propose a consensus.
            </p>
          )}
          {messages.map((m) => (
            <div
              key={m.id}
              className={`rounded-lg p-2 text-xs ${
                m.role === 'assistant'
                  ? 'bg-primary/10 border border-primary/20'
                  : 'bg-muted/40 border border-border'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold">
                  {m.role === 'assistant' ? '🤖 AI Mediator' : m.display_name}
                </span>
                <span className="text-[10px] text-muted-foreground">
                  {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>
              {renderMeta(m)}
              {renderProposal(m)}
            </div>
          ))}
          {loading && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <Loader2 className="w-3 h-3 animate-spin" /> Mediator thinking…
            </div>
          )}
        </div>
      </ScrollArea>

      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask the mediator…"
          className="h-8 text-xs"
          disabled={loading}
        />
        <Button size="sm" onClick={send} disabled={loading || !input.trim()} className="h-8">
          <Send className="w-3 h-3" />
        </Button>
      </div>
    </Card>
  );
}
