import { useState, useRef, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Send, Loader2, Bot, User as UserIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Selection {
  option_id: string;
  value_id: string;
  reason: string;
}

interface ChatMsg {
  role: 'user' | 'assistant';
  content: string;
  selections?: Selection[];
  explanation?: string;
  estimatedTotal?: number | null;
}

interface ConfiguratorAIChatProps {
  productId: string;
  productName: string;
  currentSelections: Record<string, string>;
  onApplySelections: (selections: Record<string, string>) => void;
  optionNameLookup: Record<string, string>;
  valueNameLookup: Record<string, string>;
}

const SUGGESTIONS = [
  'I need something lightweight under $1,500',
  'Build me the most premium configuration',
  'Recommend an eco-friendly setup',
  'I want bold colors and the best performance',
];

export const ConfiguratorAIChat = ({
  productId,
  productName,
  currentSelections,
  onApplySelections,
  optionNameLookup,
  valueNameLookup,
}: ConfiguratorAIChatProps) => {
  const [messages, setMessages] = useState<ChatMsg[]>([
    {
      role: 'assistant',
      content: `Hi! Tell me what you're looking for in your ${productName} (budget, style, use case) and I'll build a configuration for you.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: ChatMsg = { role: 'user', content: text.trim() };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setInput('');
    setLoading(true);

    try {
      const history = newMessages
        .slice(-10)
        .filter((m) => m.role !== 'assistant' || m.content)
        .map((m) => ({ role: m.role, content: m.content }));

      const { data, error } = await supabase.functions.invoke('configurator-ai-agent', {
        body: {
          productId,
          message: text.trim(),
          currentSelections,
          history: history.slice(0, -1), // exclude the just-sent message; backend appends it
        },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const selections: Selection[] = data?.selections ?? [];
      const assistantMsg: ChatMsg = {
        role: 'assistant',
        content: data?.reply ?? 'Here is a configuration for you.',
        selections,
        explanation: data?.explanation,
        estimatedTotal: data?.estimated_total ?? null,
      };
      setMessages((prev) => [...prev, assistantMsg]);

      if (selections.length > 0) {
        const map: Record<string, string> = { ...currentSelections };
        selections.forEach((s) => {
          map[s.option_id] = s.value_id;
        });
        onApplySelections(map);
        toast.success(`Applied ${selections.length} option${selections.length === 1 ? '' : 's'}`);
      }
    } catch (e: any) {
      console.error('AI chat error:', e);
      const msg = e?.message?.includes('Rate limit')
        ? 'Rate limit reached, please retry in a moment.'
        : e?.message?.includes('credits')
        ? 'AI credits exhausted. Please top up your workspace.'
        : 'The assistant ran into an error. Please try again.';
      toast.error(msg);
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: msg },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
          <Sparkles className="w-4 h-4 text-primary-foreground" />
        </div>
        <div>
          <h3 className="font-semibold text-sm">AI Configurator Agent</h3>
          <p className="text-xs text-muted-foreground">Describe what you want in plain English</p>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="max-h-80 overflow-y-auto space-y-3 pr-1"
      >
        {messages.map((m, i) => (
          <div
            key={i}
            className={`flex gap-2 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {m.role === 'assistant' && (
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center shrink-0">
                <Bot className="w-3.5 h-3.5 text-primary" />
              </div>
            )}
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${
                m.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-muted text-foreground'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.selections && m.selections.length > 0 && (
                <div className="mt-2 space-y-1.5 border-t border-border/40 pt-2">
                  {m.selections.map((s, j) => (
                    <div key={j} className="flex items-start gap-1.5 text-xs">
                      <Badge variant="secondary" className="shrink-0">
                        {optionNameLookup[s.option_id] ?? 'Option'}
                      </Badge>
                      <span className="font-medium">
                        {valueNameLookup[s.value_id] ?? s.value_id}
                      </span>
                    </div>
                  ))}
                  {m.estimatedTotal != null && (
                    <p className="text-xs text-muted-foreground pt-1">
                      Estimated total: <span className="font-semibold text-foreground">${Number(m.estimatedTotal).toLocaleString()}</span>
                    </p>
                  )}
                </div>
              )}
              {m.explanation && (
                <p className="mt-2 text-xs text-muted-foreground italic border-t border-border/40 pt-2 whitespace-pre-wrap">
                  {m.explanation}
                </p>
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

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              disabled={loading}
              className="text-xs px-2.5 py-1 rounded-full border border-border hover:border-primary hover:bg-muted transition-colors disabled:opacity-50"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2">
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send(input);
            }
          }}
          placeholder='e.g. "Lightweight road bike under $2,000 with carbon fork"'
          className="min-h-[60px] text-sm resize-none"
          disabled={loading}
        />
        <Button
          onClick={() => send(input)}
          disabled={loading || !input.trim()}
          size="icon"
          className="bg-gradient-primary hover:shadow-glow shrink-0 h-auto"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </Button>
      </div>
    </Card>
  );
};
