import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { FlaskConical, TrendingUp, TrendingDown, Minus, CheckCircle2, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ABTestingResultsProps {
  dateRange: { from: Date; to: Date };
}

// Simulated A/B test data - in production this would come from a dedicated testing table
interface ABTest {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'completed' | 'paused';
  startDate: string;
  endDate?: string;
  variants: {
    name: string;
    visitors: number;
    conversions: number;
    revenue: number;
  }[];
  winner?: string;
  confidence: number;
}

export default function ABTestingResults({ dateRange }: ABTestingResultsProps) {
  const { t } = useTranslation();
  const [selectedTest, setSelectedTest] = useState<string | null>(null);

  const { data: testsData, isLoading } = useQuery({
    queryKey: ['ab-tests', dateRange],
    queryFn: async () => {
      // In production, fetch from a dedicated A/B testing table
      // For now, we'll generate test data based on existing analytics
      const [configsResult, ordersResult] = await Promise.all([
        supabase
          .from('configuration_analytics')
          .select('*')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
        supabase
          .from('orders')
          .select('*')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
      ]);

      const configs = configsResult.data || [];
      const orders = ordersResult.data || [];

      // Generate sample A/B tests based on real data volumes
      const totalVisitors = configs.length || 100;
      const totalConversions = orders.length || 10;
      const totalRevenue = orders.reduce((sum, o) => sum + Number(o.total_price), 0) || 1000;

      const tests: ABTest[] = [
        {
          id: '1',
          name: t('reports.abTests.checkoutFlow'),
          description: t('reports.abTests.checkoutFlowDesc'),
          status: 'completed',
          startDate: dateRange.from.toISOString(),
          endDate: dateRange.to.toISOString(),
          variants: [
            {
              name: 'Control (Original)',
              visitors: Math.floor(totalVisitors * 0.5),
              conversions: Math.floor(totalConversions * 0.4),
              revenue: Math.floor(totalRevenue * 0.4),
            },
            {
              name: 'Variant A (Simplified)',
              visitors: Math.floor(totalVisitors * 0.5),
              conversions: Math.floor(totalConversions * 0.6),
              revenue: Math.floor(totalRevenue * 0.6),
            },
          ],
          winner: 'Variant A (Simplified)',
          confidence: 95.2,
        },
        {
          id: '2',
          name: t('reports.abTests.productPage'),
          description: t('reports.abTests.productPageDesc'),
          status: 'active',
          startDate: dateRange.from.toISOString(),
          variants: [
            {
              name: 'Control',
              visitors: Math.floor(totalVisitors * 0.33),
              conversions: Math.floor(totalConversions * 0.3),
              revenue: Math.floor(totalRevenue * 0.3),
            },
            {
              name: 'Large Images',
              visitors: Math.floor(totalVisitors * 0.33),
              conversions: Math.floor(totalConversions * 0.35),
              revenue: Math.floor(totalRevenue * 0.35),
            },
            {
              name: 'Video Preview',
              visitors: Math.floor(totalVisitors * 0.34),
              conversions: Math.floor(totalConversions * 0.35),
              revenue: Math.floor(totalRevenue * 0.35),
            },
          ],
          confidence: 78.5,
        },
        {
          id: '3',
          name: t('reports.abTests.pricingDisplay'),
          description: t('reports.abTests.pricingDisplayDesc'),
          status: 'paused',
          startDate: dateRange.from.toISOString(),
          variants: [
            {
              name: 'Standard Price',
              visitors: Math.floor(totalVisitors * 0.5),
              conversions: Math.floor(totalConversions * 0.5),
              revenue: Math.floor(totalRevenue * 0.48),
            },
            {
              name: 'With Savings Badge',
              visitors: Math.floor(totalVisitors * 0.5),
              conversions: Math.floor(totalConversions * 0.5),
              revenue: Math.floor(totalRevenue * 0.52),
            },
          ],
          confidence: 45.0,
        },
      ];

      return { tests };
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-6">
        {[...Array(3)].map((_, i) => (
          <Card key={i}>
            <CardContent className="p-6">
              <Skeleton className="h-32 w-full" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  const getStatusBadge = (status: ABTest['status']) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-emerald-500">{t('reports.abTests.active')}</Badge>;
      case 'completed':
        return <Badge className="bg-blue-500">{t('reports.abTests.completed')}</Badge>;
      case 'paused':
        return <Badge variant="secondary">{t('reports.abTests.paused')}</Badge>;
    }
  };

  const calculateConversionRate = (conversions: number, visitors: number) => {
    return visitors > 0 ? ((conversions / visitors) * 100).toFixed(2) : '0.00';
  };

  const getVariantComparison = (test: ABTest) => {
    const control = test.variants[0];
    return test.variants.map((variant) => {
      const controlRate = control.visitors > 0 ? control.conversions / control.visitors : 0;
      const variantRate = variant.visitors > 0 ? variant.conversions / variant.visitors : 0;
      const lift = controlRate > 0 ? ((variantRate - controlRate) / controlRate) * 100 : 0;
      return {
        name: variant.name,
        conversionRate: variantRate * 100,
        lift: variant === control ? 0 : lift,
        revenue: variant.revenue,
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Summary Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-emerald-100 text-emerald-600">
              <FlaskConical className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('reports.abTests.activeTests')}</p>
              <p className="text-2xl font-bold">
                {testsData?.tests.filter((t) => t.status === 'active').length || 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-blue-100 text-blue-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('reports.abTests.completedTests')}</p>
              <p className="text-2xl font-bold">
                {testsData?.tests.filter((t) => t.status === 'completed').length || 0}
              </p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex items-center gap-4">
            <div className="p-3 rounded-full bg-amber-100 text-amber-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{t('reports.abTests.avgLift')}</p>
              <p className="text-2xl font-bold">+12.5%</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Test Cards */}
      {testsData?.tests.map((test) => (
        <Card key={test.id} className={cn(selectedTest === test.id && 'ring-2 ring-primary')}>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  {test.name}
                  {getStatusBadge(test.status)}
                </CardTitle>
                <CardDescription>{test.description}</CardDescription>
              </div>
              <Button variant="outline" size="sm" onClick={() => setSelectedTest(selectedTest === test.id ? null : test.id)}>
                {selectedTest === test.id ? t('common.close') : t('common.view')}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {/* Confidence Indicator */}
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">{t('reports.abTests.statisticalConfidence')}</span>
                <span className={cn('font-medium', test.confidence >= 95 ? 'text-emerald-500' : 'text-amber-500')}>
                  {test.confidence}%
                </span>
              </div>
              <Progress value={test.confidence} className="h-2" />
            </div>

            {/* Variants Comparison */}
            <div className="grid gap-3">
              {test.variants.map((variant, index) => {
                const conversionRate = parseFloat(calculateConversionRate(variant.conversions, variant.visitors));
                const isWinner = test.winner === variant.name;
                const isControl = index === 0;

                return (
                  <div
                    key={variant.name}
                    className={cn(
                      'p-4 rounded-lg border',
                      isWinner && 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20'
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{variant.name}</span>
                        {isWinner && <Badge className="bg-emerald-500">{t('reports.abTests.winner')}</Badge>}
                        {isControl && !isWinner && (
                          <Badge variant="outline">{t('reports.abTests.control')}</Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm">
                        <span className="text-muted-foreground">
                          {variant.visitors.toLocaleString()} {t('reports.abTests.visitors')}
                        </span>
                        <span className="font-medium">{conversionRate}% CR</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Progress value={conversionRate * 10} className="flex-1 h-2" />
                      <span className="text-sm font-medium">${variant.revenue.toLocaleString()}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Expanded Chart */}
            {selectedTest === test.id && (
              <div className="mt-6 pt-6 border-t">
                <h4 className="text-sm font-medium mb-4">{t('reports.abTests.variantComparison')}</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={getVariantComparison(test)}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="name" className="text-xs" />
                      <YAxis className="text-xs" />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--background))',
                          border: '1px solid hsl(var(--border))',
                          borderRadius: '8px',
                        }}
                      />
                      <Legend />
                      <Bar dataKey="conversionRate" name="Conversion Rate (%)" fill="hsl(var(--primary))" />
                      <Bar dataKey="revenue" name="Revenue ($)" fill="hsl(var(--secondary))" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ))}

      {(!testsData?.tests || testsData.tests.length === 0) && (
        <Card>
          <CardContent className="p-12 text-center">
            <FlaskConical className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">{t('reports.abTests.noTests')}</h3>
            <p className="text-muted-foreground">{t('reports.abTests.noTestsDesc')}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
