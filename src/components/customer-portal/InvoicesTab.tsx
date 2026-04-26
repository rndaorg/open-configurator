import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Download, FileText, Receipt } from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface Invoice {
  id: string;
  invoice_number: string;
  amount_usd: number;
  currency: string;
  status: string;
  payment_provider: string;
  invoice_pdf_url: string | null;
  billing_period_start: string | null;
  billing_period_end: string | null;
  paid_at: string | null;
  description: string | null;
  created_at: string;
}

const statusVariant: Record<string, string> = {
  paid: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  refunded: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

export function InvoicesTab() {
  const { user } = useAuth();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadInvoices();
  }, [user]);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setInvoices(data || []);
    } catch (error) {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = (invoice: Invoice) => {
    if (invoice.invoice_pdf_url) {
      window.open(invoice.invoice_pdf_url, '_blank');
    } else {
      toast.info('Invoice PDF not yet available');
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
          <Receipt className="h-5 w-5 text-primary" />
          <div>
            <CardTitle>Invoice History</CardTitle>
            <CardDescription>Download invoices and review past charges</CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {invoices.length === 0 ? (
          <div className="py-12 text-center">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">No invoices yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your invoices will appear here once you subscribe to a paid plan
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Invoice #</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Period</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="font-mono text-xs">{invoice.invoice_number}</TableCell>
                    <TableCell>{format(new Date(invoice.created_at), 'MMM d, yyyy')}</TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {invoice.billing_period_start && invoice.billing_period_end
                        ? `${format(new Date(invoice.billing_period_start), 'MMM d')} - ${format(new Date(invoice.billing_period_end), 'MMM d')}`
                        : '—'}
                    </TableCell>
                    <TableCell className="font-medium">
                      {invoice.currency} {Number(invoice.amount_usd).toFixed(2)}
                    </TableCell>
                    <TableCell>
                      <Badge className={statusVariant[invoice.status] || statusVariant.pending}>
                        {invoice.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => handleDownload(invoice)}>
                        <Download className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
