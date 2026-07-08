import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mic, MicOff, ImagePlus, Wand2, Camera } from 'lucide-react';
import { toast } from 'sonner';

interface Selection {
  option_id: string;
  option_name: string;
  value_id: string;
  value_name: string;
  reason: string;
}

interface AgentResult {
  interpretation: string;
  selections: Selection[];
  confidence: number;
  follow_up_questions: string[];
}

export default function MultimodalAgent() {
  const [products, setProducts] = useState<{ id: string; name: string }[]>([]);
  const [productId, setProductId] = useState('');
  const [transcript, setTranscript] = useState('');
  const [imageDataUrl, setImageDataUrl] = useState<string | null>(null);
  const [listening, setListening] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AgentResult | null>(null);
  const recognitionRef = useRef<any>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('products').select('id, name').eq('is_active', true).then(({ data }) => {
      if (data) { setProducts(data); if (data[0]) setProductId(data[0].id); }
    });
  }, []);

  const startVoice = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return toast.error('Voice input not supported in this browser');
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    rec.onresult = (e: any) => {
      let final = '';
      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) final += e.results[i][0].transcript + ' ';
      }
      if (final) setTranscript((prev) => (prev + ' ' + final).trim());
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  };

  const stopVoice = () => { recognitionRef.current?.stop(); setListening(false); };

  const onImage = (f: File | null) => {
    if (!f) return;
    if (f.size > 5_000_000) return toast.error('Image too large (max 5 MB)');
    const reader = new FileReader();
    reader.onload = () => setImageDataUrl(reader.result as string);
    reader.readAsDataURL(f);
  };

  const run = async () => {
    if (!productId) return toast.error('Pick a product');
    if (!transcript && !imageDataUrl) return toast.error('Provide voice or image input');
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke('multimodal-config-agent', {
        body: { productId, transcript: transcript || undefined, imageDataUrl: imageDataUrl || undefined },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setResult(data);
      toast.success('Configuration suggested');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2"><Camera className="h-7 w-7" /> Multi-Modal Configuration Agent</h1>
        <p className="text-muted-foreground mt-1">
          Describe out loud what you want, upload an inspiration photo, and let AI map it to concrete product options.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Inputs</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Product</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger><SelectValue placeholder="Pick a product" /></SelectTrigger>
              <SelectContent>
                {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <Label>Voice / text description</Label>
              <Button type="button" size="sm" variant={listening ? 'destructive' : 'outline'} onClick={listening ? stopVoice : startVoice}>
                {listening ? <><MicOff className="h-4 w-4 mr-1" /> Stop</> : <><Mic className="h-4 w-4 mr-1" /> Record</>}
              </Button>
            </div>
            <Textarea rows={4} value={transcript} onChange={(e) => setTranscript(e.target.value)}
              placeholder='e.g. "I want something lightweight, matte black, for weekend touring"' />
          </div>

          <div>
            <Label>Inspiration image (optional)</Label>
            <div className="flex items-center gap-3 mt-1">
              <input ref={fileRef} type="file" accept="image/*" className="hidden"
                onChange={(e) => onImage(e.target.files?.[0] ?? null)} />
              <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
                <ImagePlus className="h-4 w-4 mr-2" /> Upload image
              </Button>
              {imageDataUrl && (
                <div className="flex items-center gap-2">
                  <img src={imageDataUrl} alt="preview" className="h-16 w-16 object-cover rounded border" />
                  <Button type="button" size="sm" variant="ghost" onClick={() => setImageDataUrl(null)}>Remove</Button>
                </div>
              )}
            </div>
          </div>

          <Button onClick={run} disabled={loading}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Wand2 className="h-4 w-4 mr-2" />}
            Suggest configuration
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <span>AI Interpretation</span>
              <Badge variant="secondary">Confidence {result.confidence}%</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm">{result.interpretation}</p>
            <div className="space-y-2">
              {result.selections?.map((s, i) => (
                <div key={i} className="border rounded-md p-3">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{s.option_name}</span>
                    <span className="text-primary">{s.value_name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{s.reason}</p>
                </div>
              ))}
            </div>
            {result.follow_up_questions?.length > 0 && (
              <div>
                <div className="text-sm font-medium mb-1">Follow-up questions</div>
                <ul className="list-disc pl-5 text-sm text-muted-foreground">
                  {result.follow_up_questions.map((q, i) => <li key={i}>{q}</li>)}
                </ul>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
