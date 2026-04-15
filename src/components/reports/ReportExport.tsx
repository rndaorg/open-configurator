import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import { useToast } from '@/hooks/use-toast';
import { Download, FileSpreadsheet, FileText, Calendar, Clock, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

interface ReportExportProps {
  dateRange: { from: Date; to: Date };
}

type ReportType = 'sales' | 'orders' | 'customers' | 'products' | 'full';
type ExportFormat = 'csv' | 'json';

export default function ReportExport({ dateRange }: ReportExportProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const [reportType, setReportType] = useState<ReportType>('sales');
  const [exportFormat, setExportFormat] = useState<ExportFormat>('csv');
  const [includeCharts, setIncludeCharts] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const { data: reportData, isLoading } = useQuery({
    queryKey: ['export-preview', dateRange, reportType],
    queryFn: async () => {
      let data: Record<string, unknown>[] = [];
      let columns: string[] = [];

      switch (reportType) {
        case 'sales': {
          const { data: orders } = await supabase
            .from('orders')
            .select('*, products(name)')
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString());
          data = (orders || []).map((o) => ({
            order_id: o.id,
            date: format(new Date(o.created_at), 'yyyy-MM-dd'),
            product: (o.products as { name: string } | null)?.name || 'N/A',
            quantity: o.quantity,
            total_price: o.total_price,
            status: o.status,
          }));
          columns = ['order_id', 'date', 'product', 'quantity', 'total_price', 'status'];
          break;
        }
        case 'orders': {
          const { data: orders } = await supabase
            .from('orders')
            .select('*')
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString());
          data = (orders || []).map((o) => ({
            order_id: o.id,
            user_id: o.user_id,
            date: format(new Date(o.created_at), 'yyyy-MM-dd HH:mm'),
            total_price: o.total_price,
            status: o.status,
            payment_status: o.payment_status,
            shipping_method: o.shipping_method,
          }));
          columns = ['order_id', 'user_id', 'date', 'total_price', 'status', 'payment_status', 'shipping_method'];
          break;
        }
        case 'customers': {
          const { data: orders } = await supabase
            .from('orders')
            .select('user_id, total_price, created_at')
            .gte('created_at', dateRange.from.toISOString())
            .lte('created_at', dateRange.to.toISOString());

          const customerStats: Record<string, { orders: number; total_spent: number; first_order: string; last_order: string }> = {};
          (orders || []).forEach((o) => {
            if (!customerStats[o.user_id]) {
              customerStats[o.user_id] = { orders: 0, total_spent: 0, first_order: o.created_at, last_order: o.created_at };
            }
            customerStats[o.user_id].orders += 1;
            customerStats[o.user_id].total_spent += Number(o.total_price);
            if (o.created_at < customerStats[o.user_id].first_order) customerStats[o.user_id].first_order = o.created_at;
            if (o.created_at > customerStats[o.user_id].last_order) customerStats[o.user_id].last_order = o.created_at;
          });

          data = Object.entries(customerStats).map(([userId, stats]) => ({
            customer_id: userId,
            total_orders: stats.orders,
            total_spent: stats.total_spent.toFixed(2),
            avg_order_value: (stats.total_spent / stats.orders).toFixed(2),
            first_order: format(new Date(stats.first_order), 'yyyy-MM-dd'),
            last_order: format(new Date(stats.last_order), 'yyyy-MM-dd'),
          }));
          columns = ['customer_id', 'total_orders', 'total_spent', 'avg_order_value', 'first_order', 'last_order'];
          break;
        }
        case 'products': {
          const { data: products } = await supabase.from('products').select('*, categories(name)');
          data = (products || []).map((p) => ({
            product_id: p.id,
            name: p.name,
            category: (p.categories as { name: string } | null)?.name || 'N/A',
            base_price: p.base_price,
            is_active: p.is_active,
          }));
          columns = ['product_id', 'name', 'category', 'base_price', 'is_active'];
          break;
        }
        case 'full': {
          const [ordersRes, productsRes, categoriesRes] = await Promise.all([
            supabase
              .from('orders')
              .select('*')
              .gte('created_at', dateRange.from.toISOString())
              .lte('created_at', dateRange.to.toISOString()),
            supabase.from('products').select('*'),
            supabase.from('categories').select('*'),
          ]);
          data = [
            { section: 'Summary', total_orders: ordersRes.data?.length || 0, total_products: productsRes.data?.length || 0, total_categories: categoriesRes.data?.length || 0 },
          ];
          columns = ['section', 'total_orders', 'total_products', 'total_categories'];
          break;
        }
      }

      return { data, columns, rowCount: data.length };
    },
  });

  const handleExport = async () => {
    if (!reportData?.data || reportData.data.length === 0) {
      toast({
        title: t('reports.export.noData'),
        description: t('reports.export.noDataDesc'),
        variant: 'destructive',
      });
      return;
    }

    setIsExporting(true);

    try {
      let content: string;
      let mimeType: string;
      let filename: string;

      if (exportFormat === 'csv') {
        // Generate CSV
        const headers = reportData.columns.join(',');
        const rows = reportData.data.map((row) =>
          reportData.columns.map((col) => {
            const value = row[col];
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        );
        content = [headers, ...rows].join('\n');
        mimeType = 'text/csv';
        filename = `${reportType}-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
      } else {
        // Generate JSON
        content = JSON.stringify(reportData.data, null, 2);
        mimeType = 'application/json';
        filename = `${reportType}-report-${format(new Date(), 'yyyy-MM-dd')}.json`;
      }

      // Create and download file
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast({
        title: t('reports.export.success'),
        description: t('reports.export.successDesc', { filename }),
      });
    } catch (error) {
      toast({
        title: t('reports.export.error'),
        description: t('reports.export.errorDesc'),
        variant: 'destructive',
      });
    } finally {
      setIsExporting(false);
    }
  };

  const reportTypes: { value: ReportType; label: string; description: string }[] = [
    { value: 'sales', label: t('reports.export.types.sales'), description: t('reports.export.types.salesDesc') },
    { value: 'orders', label: t('reports.export.types.orders'), description: t('reports.export.types.ordersDesc') },
    { value: 'customers', label: t('reports.export.types.customers'), description: t('reports.export.types.customersDesc') },
    { value: 'products', label: t('reports.export.types.products'), description: t('reports.export.types.productsDesc') },
    { value: 'full', label: t('reports.export.types.full'), description: t('reports.export.types.fullDesc') },
  ];

  return (
    <div className="space-y-6">
      {/* Export Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>{t('reports.export.title')}</CardTitle>
          <CardDescription>{t('reports.export.description')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Report Type Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {reportTypes.map((type) => (
              <Card
                key={type.value}
                className={`cursor-pointer transition-all ${reportType === type.value ? 'ring-2 ring-primary' : 'hover:bg-muted/50'}`}
                onClick={() => setReportType(type.value)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${reportType === type.value ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                      <FileSpreadsheet className="h-5 w-5" />
                    </div>
                    <div>
                      <p className="font-medium">{type.label}</p>
                      <p className="text-xs text-muted-foreground">{type.description}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Format Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label>{t('reports.export.format')}</Label>
              <Select value={exportFormat} onValueChange={(v) => setExportFormat(v as ExportFormat)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="csv">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      CSV (Excel compatible)
                    </div>
                  </SelectItem>
                  <SelectItem value="json">
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4" />
                      JSON
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t('reports.export.dateRange')}</Label>
              <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">
                  {format(dateRange.from, 'MMM dd, yyyy')} - {format(dateRange.to, 'MMM dd, yyyy')}
                </span>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="space-y-2">
            <Label>{t('reports.export.preview')}</Label>
            {isLoading ? (
              <Skeleton className="h-32 w-full" />
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted">
                      <tr>
                        {reportData?.columns.map((col) => (
                          <th key={col} className="px-4 py-2 text-left font-medium">
                            {col}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {reportData?.data.slice(0, 5).map((row, i) => (
                        <tr key={i} className="border-t">
                          {reportData.columns.map((col) => (
                            <td key={col} className="px-4 py-2 truncate max-w-xs">
                              {String(row[col] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {(reportData?.rowCount || 0) > 5 && (
                  <div className="px-4 py-2 bg-muted/50 text-sm text-muted-foreground">
                    {t('reports.export.andMore', { count: (reportData?.rowCount || 0) - 5 })}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Export Button */}
          <Button onClick={handleExport} disabled={isExporting || isLoading} className="w-full md:w-auto">
            {isExporting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                {t('reports.export.exporting')}
              </>
            ) : (
              <>
                <Download className="h-4 w-4 mr-2" />
                {t('reports.export.download')}
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Scheduled Reports */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            {t('reports.scheduled.title')}
          </CardTitle>
          <CardDescription>{t('reports.scheduled.description')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-muted-foreground">
            <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>{t('reports.scheduled.comingSoon')}</p>
            <p className="text-sm">{t('reports.scheduled.comingSoonDesc')}</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
