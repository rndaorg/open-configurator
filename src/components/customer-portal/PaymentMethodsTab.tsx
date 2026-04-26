import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Plus, Trash2, Star, Smartphone, Building2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface PaymentMethod {
  id: string;
  type: string;
  brand: string | null;
  last4: string | null;
  exp_month: number | null;
  exp_year: number | null;
  is_default: boolean;
  payment_provider: string;
  billing_name: string | null;
}

export function PaymentMethodsTab() {
  const { user } = useAuth();
  const [methods, setMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [type, setType] = useState('card');
  const [brand, setBrand] = useState('');
  const [last4, setLast4] = useState('');
  const [expMonth, setExpMonth] = useState('');
  const [expYear, setExpYear] = useState('');
  const [billingName, setBillingName] = useState('');
  const [makeDefault, setMakeDefault] = useState(false);

  useEffect(() => {
    if (user) loadMethods();
  }, [user]);

  const loadMethods = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('payment_methods')
        .select('*')
        .eq('user_id', user!.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      setMethods(data || []);
    } catch (error) {
      toast.error('Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const handleAdd = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const { data: provider } = await supabase
        .from('payment_provider_config')
        .select('provider')
        .eq('is_enabled', true)
        .limit(1)
        .single();

      const { error } = await supabase.from('payment_methods').insert({
        user_id: user.id,
        payment_provider: provider?.provider || 'stripe',
        type,
        brand: type === 'card' ? brand : null,
        last4: last4 || null,
        exp_month: expMonth ? parseInt(expMonth) : null,
        exp_year: expYear ? parseInt(expYear) : null,
        billing_name: billingName || null,
        is_default: makeDefault || methods.length === 0,
      });
      if (error) throw error;
      toast.success('Payment method added');
      setDialogOpen(false);
      resetForm();
      await loadMethods();
    } catch (error) {
      toast.error('Failed to add payment method');
    } finally {
      setSubmitting(false);
    }
  };

  const resetForm = () => {
    setType('card'); setBrand(''); setLast4(''); setExpMonth(''); setExpYear('');
    setBillingName(''); setMakeDefault(false);
  };

  const handleSetDefault = async (id: string) => {
    try {
      const { error } = await supabase
        .from('payment_methods')
        .update({ is_default: true })
        .eq('id', id);
      if (error) throw error;
      toast.success('Default payment method updated');
      await loadMethods();
    } catch (error) {
      toast.error('Failed to update default');
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from('payment_methods').delete().eq('id', id);
      if (error) throw error;
      toast.success('Payment method removed');
      await loadMethods();
    } catch (error) {
      toast.error('Failed to remove payment method');
    }
  };

  const getIcon = (type: string) => {
    if (type === 'upi') return <Smartphone className="h-5 w-5" />;
    if (type === 'netbanking') return <Building2 className="h-5 w-5" />;
    return <CreditCard className="h-5 w-5" />;
  };

  const getLabel = (m: PaymentMethod) => {
    if (m.type === 'card') return `${m.brand || 'Card'} •••• ${m.last4 || '????'}`;
    if (m.type === 'upi') return `UPI ${m.last4 ? `(${m.last4})` : ''}`;
    if (m.type === 'netbanking') return `Net Banking ${m.brand ? `- ${m.brand}` : ''}`;
    return m.type;
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
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <CreditCard className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Payment Methods</CardTitle>
              <CardDescription>Manage cards, UPI, and net banking</CardDescription>
            </div>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Method</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Payment Method</DialogTitle>
                <DialogDescription>
                  Add a new payment method to your account. In production, this would securely tokenize via your provider.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="card">Credit / Debit Card</SelectItem>
                      <SelectItem value="upi">UPI</SelectItem>
                      <SelectItem value="netbanking">Net Banking</SelectItem>
                      <SelectItem value="wallet">Wallet</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {type === 'card' && (
                  <>
                    <div>
                      <Label>Brand</Label>
                      <Select value={brand} onValueChange={setBrand}>
                        <SelectTrigger><SelectValue placeholder="Select brand" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Visa">Visa</SelectItem>
                          <SelectItem value="Mastercard">Mastercard</SelectItem>
                          <SelectItem value="Amex">American Express</SelectItem>
                          <SelectItem value="RuPay">RuPay</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                      <div className="col-span-1">
                        <Label>Last 4</Label>
                        <Input maxLength={4} value={last4} onChange={(e) => setLast4(e.target.value.replace(/\D/g, ''))} placeholder="1234" />
                      </div>
                      <div>
                        <Label>Exp Mo</Label>
                        <Input maxLength={2} value={expMonth} onChange={(e) => setExpMonth(e.target.value.replace(/\D/g, ''))} placeholder="12" />
                      </div>
                      <div>
                        <Label>Exp Yr</Label>
                        <Input maxLength={4} value={expYear} onChange={(e) => setExpYear(e.target.value.replace(/\D/g, ''))} placeholder="2028" />
                      </div>
                    </div>
                  </>
                )}
                {type === 'upi' && (
                  <div>
                    <Label>UPI Handle</Label>
                    <Input value={last4} onChange={(e) => setLast4(e.target.value)} placeholder="user@bank" />
                  </div>
                )}
                {type === 'netbanking' && (
                  <div>
                    <Label>Bank Name</Label>
                    <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="HDFC Bank" />
                  </div>
                )}
                <div>
                  <Label>Billing Name</Label>
                  <Input value={billingName} onChange={(e) => setBillingName(e.target.value)} placeholder="Cardholder name" />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={makeDefault} onChange={(e) => setMakeDefault(e.target.checked)} />
                  Make this my default payment method
                </label>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleAdd} disabled={submitting}>
                  {submitting ? 'Adding...' : 'Add Method'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </CardHeader>
      <CardContent>
        {methods.length === 0 ? (
          <div className="py-12 text-center">
            <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No payment methods saved</p>
          </div>
        ) : (
          <div className="space-y-3">
            {methods.map((m) => (
              <div key={m.id} className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-muted rounded">{getIcon(m.type)}</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{getLabel(m)}</p>
                      {m.is_default && (
                        <Badge variant="secondary" className="gap-1">
                          <Star className="h-3 w-3" /> Default
                        </Badge>
                      )}
                    </div>
                    {m.exp_month && m.exp_year && (
                      <p className="text-xs text-muted-foreground">
                        Expires {String(m.exp_month).padStart(2, '0')}/{m.exp_year}
                      </p>
                    )}
                    {m.billing_name && (
                      <p className="text-xs text-muted-foreground">{m.billing_name}</p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  {!m.is_default && (
                    <Button variant="ghost" size="sm" onClick={() => handleSetDefault(m.id)}>
                      Set Default
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleDelete(m.id)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
