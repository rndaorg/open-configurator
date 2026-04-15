import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import {
  FunnelChart,
  Funnel,
  LabelList,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import { Eye, ShoppingCart, CreditCard, CheckCircle, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ConversionFunnelProps {
  dateRange: { from: Date; to: Date };
}

export default function ConversionFunnel({ dateRange }: ConversionFunnelProps) {
  const { t } = useTranslation();

  const { data: funnelData, isLoading } = useQuery({
    queryKey: ['conversion-funnel', dateRange],
    queryFn: async () => {
      const [analyticsResult, configsResult, ordersResult, searchResult] = await Promise.all([
        supabase
          .from('configuration_analytics')
          .select('*')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
        supabase
          .from('product_configurations')
          .select('*')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
        supabase
          .from('orders')
          .select('*')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
        supabase
          .from('search_analytics')
          .select('*')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
      ]);

      const analytics = analyticsResult.data || [];
      const configs = configsResult.data || [];
      const orders = ordersResult.data || [];
      const searches = searchResult.data || [];

      // Estimate unique sessions (using search analytics and configurations)
      const uniqueSessions = new Set([
        ...searches.map((s) => s.session_id),
        ...analytics.map((a) => a.session_id),
        ...configs.map((c) => c.session_id),
      ]).size;

      // Calculate funnel stages
      const productViews = Math.max(uniqueSessions, searches.length + analytics.length);
      const configurationsStarted = configs.length + analytics.length;
      const configurationsCompleted = configs.filter((c) => c.configuration_data).length;
      const ordersPlaced = orders.length;
      const ordersCompleted = orders.filter((o) => o.status === 'completed' || o.status === 'shipped').length;

      const funnelStages = [
        {
          name: t('reports.funnel.productViews'),
          value: productViews,
          fill: 'hsl(var(--primary))',
        },
        {
          name: t('reports.funnel.configurationsStarted'),
          value: configurationsStarted,
          fill: 'hsl(var(--primary) / 0.8)',
        },
        {
          name: t('reports.funnel.configurationsCompleted'),
          value: configurationsCompleted,
          fill: 'hsl(var(--primary) / 0.6)',
        },
        {
          name: t('reports.funnel.ordersPlaced'),
          value: ordersPlaced,
          fill: 'hsl(var(--primary) / 0.4)',
        },
        {
          name: t('reports.funnel.ordersCompleted'),
          value: ordersCompleted,
          fill: 'hsl(var(--primary) / 0.3)',
        },
      ];

      // Calculate conversion rates between stages
      const conversionRates = [
        {
          stage: `${t('reports.funnel.productViews')} → ${t('reports.funnel.configurationsStarted')}`,
          rate: productViews > 0 ? (configurationsStarted / productViews) * 100 : 0,
        },
        {
          stage: `${t('reports.funnel.configurationsStarted')} → ${t('reports.funnel.configurationsCompleted')}`,
          rate: configurationsStarted > 0 ? (configurationsCompleted / configurationsStarted) * 100 : 0,
        },
        {
          stage: `${t('reports.funnel.configurationsCompleted')} → ${t('reports.funnel.ordersPlaced')}`,
          rate: configurationsCompleted > 0 ? (ordersPlaced / configurationsCompleted) * 100 : 0,
        },
        {
          stage: `${t('reports.funnel.ordersPlaced')} → ${t('reports.funnel.ordersCompleted')}`,
          rate: ordersPlaced > 0 ? (ordersCompleted / ordersPlaced) * 100 : 0,
        },
      ];

      // Abandonment points
      type AbandonmentPoint = string | null;
      const abandonmentPoints: Record<string, number> = {};
      analytics.forEach((a) => {
        const point = (a.abandonment_point as AbandonmentPoint) || 'unknown';
        abandonmentPoints[point] = (abandonmentPoints[point] || 0) + 1;
      });

      const abandonmentData = Object.entries(abandonmentPoints)
        .map(([point, count]) => ({
          name: point.charAt(0).toUpperCase() + point.slice(1).replace(/_/g, ' '),
          value: count,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 5);

      return {
        funnelStages,
        conversionRates,
        abandonmentData,
        overallConversion: productViews > 0 ? (ordersCompleted / productViews) * 100 : 0,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <Skeleton className="h-80 w-full" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  const stageIcons = [Eye, ShoppingCart, CheckCircle, CreditCard, CheckCircle];

  return (
    <div className="space-y-6">
      {/* Overall Conversion Rate */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">{t('reports.overallConversion')}</p>
              <p className="text-4xl font-bold mt-1">{(funnelData?.overallConversion || 0).toFixed(2)}%</p>
            </div>
            <div className="flex items-center gap-2">
              {stageIcons.map((Icon, index) => (
                <div key={index} className="flex items-center">
                  <div
                    className={cn(
                      'p-2 rounded-full',
                      index === stageIcons.length - 1 ? 'bg-emerald-100 text-emerald-600' : 'bg-muted'
                    )}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  {index < stageIcons.length - 1 && <ArrowRight className="h-4 w-4 text-muted-foreground mx-1" />}
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Funnel Visualization */}
      <Card>
        <CardHeader>
          <CardTitle>{t('reports.conversionFunnel')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <FunnelChart>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Funnel dataKey="value" data={funnelData?.funnelStages || []} isAnimationActive>
                  <LabelList position="right" fill="hsl(var(--foreground))" stroke="none" dataKey="name" />
                  <LabelList
                    position="center"
                    fill="hsl(var(--primary-foreground))"
                    stroke="none"
                    dataKey="value"
                    formatter={(value: number) => value.toLocaleString()}
                  />
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Conversion Rates and Abandonment */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.stageConversionRates')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {(funnelData?.conversionRates || []).map((rate, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{rate.stage}</span>
                    <span className="font-medium">{rate.rate.toFixed(1)}%</span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all duration-500"
                      style={{ width: `${Math.min(rate.rate, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('reports.abandonmentPoints')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={funnelData?.abandonmentData || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" className="text-xs" width={120} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--destructive))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
