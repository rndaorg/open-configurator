import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { Sparkles, Check, X, Loader2, Wand2 } from 'lucide-react';

export default function AdminCatalogAI() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [productId, setProductId] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [selections, setSelections] = useState<Record<string, { config_options: Set<number>; rules: Set<number>; pricing: Set<number> }>>({});

  const { data: products } = useQuery({
    queryKey: ['ai-catalog-products'],
    queryFn: async () => {
      const { data, error } = await supabase.from('products').select('id, name').order('name');
      if (error) throw error;
      return data;
    },
  });

  const { data: proposals, isLoading } = useQuery({
    queryKey: ['catalog-ai-proposals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('catalog_ai_proposals')
        .select('*, products(name)')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  const generate = async () => {
    if (!productId) {
      toast({ title: 'Select a product first', variant: 'destructive' });
      return;
    }
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('catalog-ai-suggest', { body: { productId } });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast({ title: 'AI proposal generated', description: 'Review and approve below.' });
      qc.invalidateQueries({ queryKey: ['catalog-ai-proposals'] });
    } catch (e: any) {
      toast({ title: 'Failed to generate', description: e.message, variant: 'destructive' });
    } finally {
      setGenerating(false);
    }
  };

  const decide = useMutation({
    mutationFn: async ({ proposalId, decision }: { proposalId: string; decision: 'approve' | 'reject' }) => {
      const sel = selections[proposalId];
      const payload: any = { proposalId, decision };
      if (decision === 'approve' && sel) {
        payload.selections = {
          config_options: Array.from(sel.config_options),
          rules: Array.from(sel.rules),
          pricing: Array.from(sel.pricing),
        };
      }
      const { data, error } = await supabase.functions.invoke('catalog-ai-apply', { body: payload });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data;
    },
    onSuccess: (data: any, vars) => {
      toast({
        title: vars.decision === 'approve' ? 'Proposal approved & applied' : 'Proposal rejected',
        description: vars.decision === 'approve'
          ? `Created ${data.applied?.config_options ?? 0} options, ${data.applied?.rules ?? 0} rules, ${data.applied?.pricing ?? 0} pricing rules (rules/pricing inserted inactive for review).`
          : undefined,
      });
      qc.invalidateQueries({ queryKey: ['catalog-ai-proposals'] });
    },
    onError: (e: any) => toast({ title: 'Action failed', description: e.message, variant: 'destructive' }),
  });

  const toggle = (proposalId: string, kind: 'config_options' | 'rules' | 'pricing', idx: number, allLengths: { c: number; r: number; p: number }) => {
    setSelections((prev) => {
      const cur = prev[proposalId] ?? {
        config_options: new Set<number>(Array.from({ length: allLengths.c }, (_, i) => i)),
        rules: new Set<number>(Array.from({ length: allLengths.r }, (_, i) => i)),
        pricing: new Set<number>(Array.from({ length: allLengths.p }, (_, i) => i)),
      };
      const next = { ...cur, [kind]: new Set(cur[kind]) };
      if (next[kind].has(idx)) next[kind].delete(idx); else next[kind].add(idx);
      return { ...prev, [proposalId]: next };
    });
  };

  const isChecked = (proposalId: string, kind: 'config_options' | 'rules' | 'pricing', idx: number) => {
    const s = selections[proposalId];
    if (!s) return true; // default selected
    return s[kind].has(idx);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-primary" />
          Catalog AI Agent
        </h1>
        <p className="text-muted-foreground mt-1">
          Reads product descriptions and proposes configuration options, compatibility rules, and pricing logic. Review and approve to apply.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Generate proposal</CardTitle>
          <CardDescription>Pick a product. The agent reads its description, category, and existing options.</CardDescription>
        </CardHeader>
        <CardContent className="flex gap-3 items-end">
          <div className="flex-1">
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Select a product…" /></SelectTrigger>
              <SelectContent>
                {products?.map((p: any) => (
                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={generate} disabled={generating || !productId}>
            {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
            Analyze with AI
          </Button>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-xl font-semibold">Proposals</h2>
        {isLoading && <p className="text-muted-foreground">Loading…</p>}
        {proposals?.length === 0 && <p className="text-muted-foreground">No proposals yet.</p>}
        {proposals?.map((p: any) => {
          const s = p.suggestions ?? {};
          const lengths = { c: s.config_options?.length ?? 0, r: s.rules?.length ?? 0, p: s.pricing?.length ?? 0 };
          return (
            <Card key={p.id}>
              <CardHeader>
                <div className="flex justify-between items-start gap-4">
                  <div>
                    <CardTitle className="text-lg">{p.products?.name ?? 'Product'}</CardTitle>
                    <CardDescription className="mt-1">{p.summary}</CardDescription>
                  </div>
                  <Badge variant={p.status === 'pending' ? 'default' : p.status === 'approved' ? 'secondary' : 'outline'}>
                    {p.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {!!s.config_options?.length && (
                  <Section title={`Configuration options (${s.config_options.length})`}>
                    {s.config_options.map((o: any, i: number) => (
                      <Row key={i} disabled={p.status !== 'pending'} checked={isChecked(p.id, 'config_options', i)} onToggle={() => toggle(p.id, 'config_options', i, lengths)}>
                        <div className="font-medium">{o.name} <Badge variant="outline" className="ml-1">{o.option_type}</Badge>{o.is_required && <Badge variant="secondary" className="ml-1">required</Badge>}</div>
                        <div className="text-sm text-muted-foreground">{o.rationale}</div>
                        {!!o.values?.length && (
                          <div className="text-xs text-muted-foreground mt-1">
                            Values: {o.values.map((v: any) => `${v.name}${v.price_modifier ? ` (+$${v.price_modifier})` : ''}`).join(', ')}
                          </div>
                        )}
                      </Row>
                    ))}
                  </Section>
                )}
                {!!s.rules?.length && (
                  <Section title={`Compatibility rules (${s.rules.length})`}>
                    {s.rules.map((r: any, i: number) => (
                      <Row key={i} disabled={p.status !== 'pending'} checked={isChecked(p.id, 'rules', i)} onToggle={() => toggle(p.id, 'rules', i, lengths)}>
                        <div className="font-medium">{r.rule_name} <Badge variant="outline" className="ml-1">{r.rule_type}</Badge></div>
                        <div className="text-sm">{r.description_plain}</div>
                        <div className="text-xs text-muted-foreground">{r.rationale}</div>
                      </Row>
                    ))}
                  </Section>
                )}
                {!!s.pricing?.length && (
                  <Section title={`Pricing logic (${s.pricing.length})`}>
                    {s.pricing.map((pr: any, i: number) => (
                      <Row key={i} disabled={p.status !== 'pending'} checked={isChecked(p.id, 'pricing', i)} onToggle={() => toggle(p.id, 'pricing', i, lengths)}>
                        <div className="font-medium">{pr.rule_name} <Badge variant="outline" className="ml-1">{pr.discount_type} {pr.discount_value}</Badge></div>
                        <div className="text-sm">{pr.description_plain}</div>
                        <div className="text-xs text-muted-foreground">Min qty: {pr.min_quantity ?? 1}</div>
                      </Row>
                    ))}
                  </Section>
                )}

                {p.status === 'pending' && (
                  <div className="flex gap-2 pt-2 border-t">
                    <Button size="sm" onClick={() => decide.mutate({ proposalId: p.id, decision: 'approve' })} disabled={decide.isPending}>
                      <Check className="h-4 w-4 mr-1" /> Approve selected
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => decide.mutate({ proposalId: p.id, decision: 'reject' })} disabled={decide.isPending}>
                      <X className="h-4 w-4 mr-1" /> Reject
                    </Button>
                  </div>
                )}
                {p.applied_summary && (
                  <p className="text-xs text-muted-foreground">
                    Applied: {p.applied_summary.config_options} options, {p.applied_summary.rules} rules, {p.applied_summary.pricing} pricing rules.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-sm font-semibold mb-2">{title}</h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function Row({ children, checked, onToggle, disabled }: { children: React.ReactNode; checked: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <div className="flex gap-3 p-3 rounded-md border bg-muted/30">
      <Checkbox checked={checked} onCheckedChange={onToggle} disabled={disabled} className="mt-1" />
      <div className="flex-1">{children}</div>
    </div>
  );
}
