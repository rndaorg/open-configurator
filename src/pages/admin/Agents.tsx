import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Loader2, Bot, Users, DollarSign, Boxes, ShieldCheck, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';

interface Trace {
  agent: string;
  input: unknown;
  output: unknown;
  ms: number;
}

const AGENT_META: Record<string, { label: string; icon: any; color: string }> = {
  call_customer_agent: { label: 'Customer Agent', icon: Users, color: 'bg-blue-500/10 text-blue-500 border-blue-500/30' },
  call_rules_agent: { label: 'Rules Agent', icon: ShieldCheck, color: 'bg-purple-500/10 text-purple-500 border-purple-500/30' },
  call_inventory_agent: { label: 'Inventory Agent', icon: Boxes, color: 'bg-amber-500/10 text-amber-500 border-amber-500/30' },
  call_pricing_agent: { label: 'Pricing Agent', icon: DollarSign, color: 'bg-green-500/10 text-green-500 border-green-500/30' },
  finalize: { label: 'Master Finalize', icon: Bot, color: 'bg-primary/10 text-primary border-primary/30' },
};

export default function AdminAgents() {
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [productId, setProductId] = useState<string>('');
  const [message, setMessage] = useState('I need a lightweight option under $1500 with the best available frame.');
  const [quantity, setQuantity] = useState(1);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  useEffect(() => {
    supabase.from('products').select('id, name').eq('is_active', true).then(({ data }) => {
      if (data) {
        setProducts(data);
        if (data[0]) setProductId(data[0].id);
      }
    });
  }, []);

  const run = async () => {
    if (!productId) return toast.error('Pick a product');
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('agents-orchestrator', {
        body: { productId, message, quantity },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
    } catch (e: any) {
      toast.error(e.message ?? 'Orchestration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Bot className="h-7 w-7" /> Multi-Agent Orchestration</h1>
        <p className="text-muted-foreground mt-1">
          A master agent delegates to specialized sub-agents (Customer, Rules, Inventory, Pricing) via tool calling.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Request</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <Label>Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger><SelectValue placeholder="Select a product" /></SelectTrigger>
                <SelectContent>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Quantity</Label>
              <Input type="number" min={1} value={quantity} onChange={e => setQuantity(parseInt(e.target.value) || 1)} />
            </div>
          </div>
          <div>
            <Label>Customer message</Label>
            <Textarea rows={3} value={message} onChange={e => setMessage(e.target.value)} />
          </div>
          <Button onClick={run} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
            Run orchestration
          </Button>
        </CardContent>
      </Card>

      {result && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader><CardTitle>Master reply</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              <p className="whitespace-pre-wrap">{result.reply}</p>
              {result.summary && <p className="text-sm text-muted-foreground whitespace-pre-wrap">{result.summary}</p>}
              {result.pricing && (
                <div className="rounded-md border p-3 text-sm space-y-1">
                  <div className="font-medium">Pricing</div>
                  <div>Base: ${result.pricing.basePrice}</div>
                  <div>Modifiers: ${result.pricing.modifiers}</div>
                  <div>Discounts: -${result.pricing.discounts?.toFixed(2)}</div>
                  <div className="font-semibold">Total: ${result.pricing.total?.toFixed(2)}</div>
                  {result.pricing.applied?.length > 0 && (
                    <ul className="list-disc pl-4 text-muted-foreground">
                      {result.pricing.applied.map((a: string, i: number) => <li key={i}>{a}</li>)}
                    </ul>
                  )}
                </div>
              )}
              {result.inventory && (
                <div className="rounded-md border p-3 text-sm">
                  <div className="font-medium">Inventory</div>
                  <Badge variant={result.inventory.inStock ? 'default' : 'destructive'}>
                    {result.inventory.inStock ? 'In stock' : 'Issues'}
                  </Badge>
                  {result.inventory.issues?.length > 0 && (
                    <ul className="list-disc pl-4 mt-1 text-muted-foreground">
                      {result.inventory.issues.map((i: string, k: number) => <li key={k}>{i}</li>)}
                    </ul>
                  )}
                </div>
              )}
              {result.rules && (
                <div className="rounded-md border p-3 text-sm">
                  <div className="font-medium">Rules</div>
                  {result.rules.violations?.length > 0 ? (
                    <ul className="list-disc pl-4 text-destructive">
                      {result.rules.violations.map((v: string, i: number) => <li key={i}>{v}</li>)}
                    </ul>
                  ) : <span className="text-muted-foreground">No violations</span>}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Agent trace ({result.traces?.length ?? 0} calls)</CardTitle></CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-3">
                <ol className="space-y-3">
                  {(result.traces as Trace[]).map((t, i) => {
                    const meta = AGENT_META[t.agent] ?? { label: t.agent, icon: Bot, color: '' };
                    const Icon = meta.icon;
                    return (
                      <li key={i} className={`border rounded-md p-3 ${meta.color}`}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="flex items-center gap-2 font-medium">
                            <Icon className="h-4 w-4" /> #{i + 1} {meta.label}
                          </span>
                          <Badge variant="outline">{t.ms}ms</Badge>
                        </div>
                        <details className="text-xs">
                          <summary className="cursor-pointer text-muted-foreground">Input / Output</summary>
                          <pre className="mt-2 overflow-auto bg-background/50 p-2 rounded">{JSON.stringify(t.input, null, 2)}</pre>
                          <pre className="mt-1 overflow-auto bg-background/50 p-2 rounded">{JSON.stringify(t.output, null, 2)}</pre>
                        </details>
                      </li>
                    );
                  })}
                </ol>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
