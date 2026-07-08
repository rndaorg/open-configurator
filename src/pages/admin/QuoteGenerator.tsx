import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, FileText, Mic, MicOff, Download, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface Quote {
  customer: { name: string; company?: string; email?: string; address?: string };
  quote_number: string;
  issue_date: string;
  valid_until: string;
  line_items: { label: string; detail: string; quantity: number; unit_price: number; total: number }[];
  subtotal: number;
  discount: { label: string; amount: number };
  tax: { label: string; rate: number; amount: number };
  grand_total: number;
  financing?: { enabled: boolean; months: number; apr: number; monthly_payment: number } | null;
  executive_summary: string;
  terms: string;
  delivery: string;
}

export default function QuoteGenerator() {
  const [command, setCommand] = useState('Generate a quote for Acme Corp with 10% volume discount and 24-month financing at 6.9% APR.');
  const [configurations, setConfigurations] = useState<any[]>([]);
  const [selectedConfigId, setSelectedConfigId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [quote, setQuote] = useState<Quote | null>(null);
  const [product, setProduct] = useState<any>(null);
  const [listening, setListening] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    supabase
      .from('product_configurations')
      .select('id, total_price, created_at, product_id, products(name)')
      .order('created_at', { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (data) {
          setConfigurations(data);
          if (data[0]) setSelectedConfigId(data[0].id);
        }
      });
  }, []);

  const startVoice = () => {
    const SR: any = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) return toast.error('Voice input not supported in this browser');
    const rec = new SR();
    rec.lang = 'en-US';
    rec.interimResults = false;
    rec.onresult = (e: any) => {
      const t = Array.from(e.results).map((r: any) => r[0].transcript).join(' ');
      setCommand((prev) => (prev ? prev + ' ' + t : t));
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    rec.start();
    recognitionRef.current = rec;
    setListening(true);
  };

  const stopVoice = () => {
    recognitionRef.current?.stop();
    setListening(false);
  };

  const generate = async () => {
    if (!selectedConfigId) return toast.error('Pick a configuration');
    setLoading(true);
    setQuote(null);
    try {
      const { data, error } = await supabase.functions.invoke('quote-agent', {
        body: { command, configurationId: selectedConfigId },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setQuote(data.quote);
      setProduct(data.product);
      toast.success('Quote generated');
    } catch (e: any) {
      toast.error(e.message ?? 'Failed');
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!previewRef.current || !quote) return;
    toast.info('Rendering PDF…');
    try {
      const canvas = await html2canvas(previewRef.current, { scale: 2, backgroundColor: '#ffffff' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth - 40;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      let position = 20;
      let heightLeft = imgHeight;
      pdf.addImage(imgData, 'PNG', 20, position, imgWidth, imgHeight);
      heightLeft -= pageHeight - 40;
      while (heightLeft > 0) {
        pdf.addPage();
        position = 20 - (imgHeight - heightLeft);
        pdf.addImage(imgData, 'PNG', 20, position, imgWidth, imgHeight);
        heightLeft -= pageHeight - 40;
      }
      pdf.save(`${quote.quote_number || 'quote'}.pdf`);
    } catch (e: any) {
      toast.error('PDF failed: ' + e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <FileText className="h-7 w-7" /> Quote & Proposal Agent
        </h1>
        <p className="text-muted-foreground mt-1">
          Turn any configuration into a branded PDF proposal via voice or text commands.
        </p>
      </div>

      <Card>
        <CardHeader><CardTitle>Command</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Source configuration</Label>
            <Select value={selectedConfigId} onValueChange={setSelectedConfigId}>
              <SelectTrigger><SelectValue placeholder="Pick a saved config" /></SelectTrigger>
              <SelectContent>
                {configurations.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.products?.name ?? 'Product'} · ${Number(c.total_price).toFixed(2)} · {new Date(c.created_at).toLocaleDateString()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Instruction (voice or text)</Label>
            <div className="flex gap-2 items-start">
              <Textarea rows={3} value={command} onChange={(e) => setCommand(e.target.value)} placeholder='e.g. "Generate a quote for Acme Corp with 10% volume discount"' />
              <Button type="button" variant={listening ? 'destructive' : 'outline'} onClick={listening ? stopVoice : startVoice}>
                {listening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={generate} disabled={loading}>
              {loading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2" />}
              Generate quote
            </Button>
            {quote && (
              <Button variant="secondary" onClick={downloadPDF}>
                <Download className="h-4 w-4 mr-2" /> Download PDF
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {quote && (
        <Card>
          <CardHeader><CardTitle>Preview</CardTitle></CardHeader>
          <CardContent>
            <div ref={previewRef} className="bg-white text-black p-10 font-sans" style={{ minHeight: 800 }}>
              <div className="flex justify-between items-start border-b-2 border-gray-900 pb-4 mb-6">
                <div>
                  <h1 className="text-3xl font-bold">Proposal</h1>
                  <p className="text-sm text-gray-600 mt-1">Open Configurator</p>
                </div>
                <div className="text-right text-sm">
                  <div><strong>{quote.quote_number}</strong></div>
                  <div>Issued: {quote.issue_date}</div>
                  <div>Valid until: {quote.valid_until}</div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-6 mb-6">
                <div>
                  <div className="text-xs uppercase text-gray-500 mb-1">Prepared for</div>
                  <div className="font-semibold">{quote.customer?.name}</div>
                  {quote.customer?.company && <div>{quote.customer.company}</div>}
                  {quote.customer?.email && <div className="text-sm">{quote.customer.email}</div>}
                  {quote.customer?.address && <div className="text-sm whitespace-pre-line">{quote.customer.address}</div>}
                </div>
                {product?.image_url && (
                  <div className="flex justify-end">
                    <img src={product.image_url} alt={product.name} crossOrigin="anonymous" style={{ maxHeight: 120, objectFit: 'contain' }} />
                  </div>
                )}
              </div>

              <div className="mb-6">
                <h3 className="font-semibold mb-2">Executive Summary</h3>
                <p className="text-sm leading-relaxed">{quote.executive_summary}</p>
              </div>

              <table className="w-full text-sm mb-6">
                <thead>
                  <tr className="border-b-2 border-gray-900">
                    <th className="text-left py-2">Item</th>
                    <th className="text-right py-2">Qty</th>
                    <th className="text-right py-2">Unit</th>
                    <th className="text-right py-2">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {quote.line_items?.map((li, i) => (
                    <tr key={i} className="border-b border-gray-200">
                      <td className="py-2">
                        <div className="font-medium">{li.label}</div>
                        <div className="text-xs text-gray-600">{li.detail}</div>
                      </td>
                      <td className="text-right py-2">{li.quantity}</td>
                      <td className="text-right py-2">${Number(li.unit_price).toFixed(2)}</td>
                      <td className="text-right py-2">${Number(li.total).toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="flex justify-end mb-6">
                <div className="w-64 text-sm space-y-1">
                  <div className="flex justify-between"><span>Subtotal</span><span>${Number(quote.subtotal).toFixed(2)}</span></div>
                  {quote.discount?.amount > 0 && (
                    <div className="flex justify-between text-green-700">
                      <span>{quote.discount.label || 'Discount'}</span><span>-${Number(quote.discount.amount).toFixed(2)}</span>
                    </div>
                  )}
                  {quote.tax?.amount > 0 && (
                    <div className="flex justify-between"><span>{quote.tax.label || 'Tax'} ({quote.tax.rate}%)</span><span>${Number(quote.tax.amount).toFixed(2)}</span></div>
                  )}
                  <div className="flex justify-between font-bold text-lg border-t-2 border-gray-900 pt-2">
                    <span>Total</span><span>${Number(quote.grand_total).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {quote.financing?.enabled && (
                <div className="bg-gray-100 p-4 rounded mb-6">
                  <h3 className="font-semibold mb-2">Financing Option</h3>
                  <div className="text-sm">
                    {quote.financing.months} monthly payments of{' '}
                    <strong>${Number(quote.financing.monthly_payment).toFixed(2)}</strong> at {quote.financing.apr}% APR.
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-6 text-xs text-gray-700">
                <div>
                  <div className="font-semibold mb-1">Delivery</div>
                  <p className="whitespace-pre-line">{quote.delivery}</p>
                </div>
                <div>
                  <div className="font-semibold mb-1">Terms</div>
                  <p className="whitespace-pre-line">{quote.terms}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
