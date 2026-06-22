import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Send, Loader2, Bot, User as UserIcon, X, MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

interface Suggestion {
  product_id: string;
  reason: string;
  name?: string;
  base_price?: number;
  category?: string;
}

interface ChatMsg {
  id?: string;
  role: 'user' | 'assistant';
  content: string;
  suggestions?: Suggestion[] | null;
}

const STORAGE_KEY = 'oc_shopper_agent_open';

export const PersonalShopperAgent = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMsg[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Hydrate history once when authenticated user opens widget
  useEffect(() => {
    if (!user || !open || hydrated) return;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke('personal-shopper-agent', {
          body: { action: 'history' },
        });
        if (error) throw error;
        const hist: ChatMsg[] = (data?.messages ?? []).map((m: any) => ({
          id: m.id, role: m.role, content: m.content, suggestions: m.suggestions,
        }));

        // Decide whether to trigger a proactive greeting
        const lastAt = data?.memory?.last_interaction_at
          ? new Date(data.memory.last_interaction_at).getTime()
          : 0;
        const daysAway = lastAt ? (Date.now() - lastAt) / (1000 * 60 * 60 * 24) : 999;
        setMessages(hist);
        setHydrated(true);

        if (hist.length === 0 || daysAway > 1) {
          setLoading(true);
          const { data: g, error: gErr } = await supabase.functions.invoke('personal-shopper-agent', {
            body: { action: 'greet' },
          });
          if (gErr) throw gErr;
          if (g?.reply) {
            setMessages((prev) => [...prev, {
              role: 'assistant', content: g.reply, suggestions: g.suggestions,
            }]);
          }
          setLoading(false);
        }
      } catch (e: any) {
        console.error('Agent hydrate error:', e);
        setHydrated(true);
        setLoading(false);
      }
    })();
  }, [user, open, hydrated]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  useEffect(() => {
    const saved = sessionStorage.getItem(STORAGE_KEY);
    if (saved === '1') setOpen(true);
  }, []);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, open ? '1' : '0');
  }, [open]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    setMessages((prev) => [...prev, { role: 'user', content: text.trim() }]);
    setInput('');
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('personal-shopper-agent', {
        body: { action: 'chat', message: text.trim() },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages((prev) => [...prev, {
        role: 'assistant', content: data.reply, suggestions: data.suggestions,
      }]);
    } catch (e: any) {
      const msg = e?.message?.includes('Rate limit')
        ? 'Rate limit reached, please retry in a moment.'
        : e?.message?.includes('credits')
        ? 'AI credits exhausted. Please top up your workspace.'
        : 'The agent ran into an error. Please try again.';
      toast.error(msg);
      setMessages((prev) => [...prev, { role: 'assistant', content: msg }]);
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <>
      {/* Floating launcher */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 group flex items-center gap-2 px-4 py-3 rounded-full bg-gradient-primary text-primary-foreground shadow-glow hover:scale-105 transition-transform"
          aria-label="Open AI personal shopper"
        >
          <div className="relative">
            <Sparkles className="w-5 h-5" />
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-green-400 rounded-full ring-2 ring-background animate-pulse" />
          </div>
          <span className="text-sm font-medium hidden sm:inline">Your AI shopper</span>
        </button>
      )}

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[380px] max-w-[calc(100vw-2rem)]">
          <Card className="glass-card flex flex-col h-[560px] max-h-[80vh] overflow-hidden border-primary/30 shadow-glow">
            <div className="flex items-center justify-between p-4 border-b border-border/40 bg-gradient-primary/10">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
                  <Sparkles className="w-4 h-4 text-primary-foreground" />
                </div>
                <div>
                  <h3 className="font-semibold text-sm">Your AI Shopper</h3>
                  <p className="text-xs text-muted-foreground">Remembers you across sessions</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
              {!hydrated && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" /> Recalling our last chat...
                </div>
              )}
              {hydrated && messages.length === 0 && !loading && (
                <div className="text-center text-sm text-muted-foreground py-8">
                  <MessageCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  Say hi — I'll learn what you like and remember it next time.
                </div>
              )}
              {messages.map((m, i) => (
                <div key={i} className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  {m.role === 'assistant' && (
                    <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                      <Bot className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                  <div className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                    m.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground'
                  }`}>
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    {m.suggestions && m.suggestions.length > 0 && (
                      <div className="mt-2 space-y-2 border-t border-border/40 pt-2">
                        {m.suggestions.map((s, j) => (
                          <Link
                            key={j}
                            to={`/products/${s.product_id}`}
                            className="block rounded-md border border-border/60 hover:border-primary p-2 transition-colors bg-background/40"
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="font-medium text-xs">{s.name ?? 'Product'}</div>
                              {s.base_price != null && (
                                <Badge variant="secondary" className="text-[10px]">
                                  ${Number(s.base_price).toLocaleString()}
                                </Badge>
                              )}
                            </div>
                            {s.category && (
                              <div className="text-[10px] text-muted-foreground">{s.category}</div>
                            )}
                            <div className="text-[11px] text-muted-foreground mt-1 italic">{s.reason}</div>
                          </Link>
                        ))}
                      </div>
                    )}
                  </div>
                  {m.role === 'user' && (
                    <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                      <UserIcon className="w-3.5 h-3.5 text-primary" />
                    </div>
                  )}
                </div>
              ))}
              {loading && (
                <div className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center">
                    <Bot className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg px-3 py-2 text-sm flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span className="text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              )}
            </div>

            <div className="border-t border-border/40 p-3 flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    send(input);
                  }
                }}
                placeholder="Tell me what you're after..."
                className="min-h-[44px] max-h-32 text-sm resize-none"
                disabled={loading}
              />
              <Button
                onClick={() => send(input)}
                disabled={loading || !input.trim()}
                size="icon"
                className="bg-gradient-primary hover:shadow-glow shrink-0"
              >
                {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </Card>
        </div>
      )}
    </>
  );
};
