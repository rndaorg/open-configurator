import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
} from 'recharts';
import { Users, Repeat, Clock, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format, eachDayOfInterval, startOfDay, differenceInDays } from 'date-fns';

interface CustomerInsightsProps {
  dateRange: { from: Date; to: Date };
}

export default function CustomerInsights({ dateRange }: CustomerInsightsProps) {
  const { t } = useTranslation();

  const { data: insightsData, isLoading } = useQuery({
    queryKey: ['customer-insights', dateRange],
    queryFn: async () => {
      const [ordersResult, preferencesResult, searchResult, configsResult] = await Promise.all([
        supabase
          .from('orders')
          .select('*')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString())
          .order('created_at', { ascending: true }),
        supabase.from('user_preferences').select('*'),
        supabase
          .from('search_analytics')
          .select('*')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
        supabase
          .from('product_configurations')
          .select('*')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString()),
      ]);

      const orders = ordersResult.data || [];
      const preferences = preferencesResult.data || [];
      const searches = searchResult.data || [];
      const configs = configsResult.data || [];

      // Unique customers
      const uniqueCustomers = new Set(orders.map((o) => o.user_id)).size;

      // Repeat customers
      const customerOrderCounts: Record<string, number> = {};
      orders.forEach((order) => {
        customerOrderCounts[order.user_id] = (customerOrderCounts[order.user_id] || 0) + 1;
      });
      const repeatCustomers = Object.values(customerOrderCounts).filter((count) => count > 1).length;
      const repeatRate = uniqueCustomers > 0 ? (repeatCustomers / uniqueCustomers) * 100 : 0;

      // Average customer lifetime value
      const customerValues: Record<string, number> = {};
      orders.forEach((order) => {
        customerValues[order.user_id] = (customerValues[order.user_id] || 0) + Number(order.total_price);
      });
      const avgCustomerValue =
        Object.keys(customerValues).length > 0
          ? Object.values(customerValues).reduce((a, b) => a + b, 0) / Object.keys(customerValues).length
          : 0;

      // Customer acquisition over time
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      const firstOrderByUser: Record<string, Date> = {};
      orders.forEach((order) => {
        const orderDate = new Date(order.created_at);
        if (!firstOrderByUser[order.user_id] || orderDate < firstOrderByUser[order.user_id]) {
          firstOrderByUser[order.user_id] = orderDate;
        }
      });

      const acquisitionData = days.map((day) => {
        const dayStart = startOfDay(day);
        const newCustomers = Object.values(firstOrderByUser).filter(
          (date) => startOfDay(date).getTime() === dayStart.getTime()
        ).length;
        return {
          date: format(day, 'MMM dd'),
          newCustomers,
        };
      });

      // Top search queries
      const searchCounts: Record<string, number> = {};
      searches.forEach((search) => {
        const query = search.search_query.toLowerCase().trim();
        if (query) {
          searchCounts[query] = (searchCounts[query] || 0) + 1;
        }
      });

      const topSearches = Object.entries(searchCounts)
        .map(([query, count]) => ({ name: query, value: count }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 10);

      // Customer behavior segments (based on preferences and interactions)
      const segments = [
        { subject: t('reports.segments.priceConscious'), A: 0, fullMark: 100 },
        { subject: t('reports.segments.qualityFocused'), A: 0, fullMark: 100 },
        { subject: t('reports.segments.frequentBuyer'), A: 0, fullMark: 100 },
        { subject: t('reports.segments.configurator'), A: 0, fullMark: 100 },
        { subject: t('reports.segments.researcher'), A: 0, fullMark: 100 },
      ];

      // Calculate segment scores based on available data
      const avgOrdersPerCustomer = uniqueCustomers > 0 ? orders.length / uniqueCustomers : 0;
      segments[2].A = Math.min((avgOrdersPerCustomer / 3) * 100, 100); // Frequent buyer

      const avgConfigsPerUser = configs.length / Math.max(uniqueCustomers, 1);
      segments[3].A = Math.min((avgConfigsPerUser / 5) * 100, 100); // Configurator

      const avgSearchesPerUser = searches.length / Math.max(uniqueCustomers, 1);
      segments[4].A = Math.min((avgSearchesPerUser / 10) * 100, 100); // Researcher

      // Estimate price consciousness from avg order value
      segments[0].A = avgCustomerValue < 100 ? 80 : avgCustomerValue < 500 ? 50 : 20;
      segments[1].A = 100 - segments[0].A;

      // Average session duration estimate (based on config interactions)
      const avgConfigTime = configs.length > 0 ? 8 : 3; // minutes estimate

      return {
        uniqueCustomers,
        repeatCustomers,
        repeatRate,
        avgCustomerValue,
        acquisitionData,
        topSearches,
        segments,
        avgSessionDuration: avgConfigTime,
        totalSearches: searches.length,
        totalConfigurations: configs.length,
      };
    },
  });

  if (isLoading) {
    return (
      <div className="grid gap-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-20 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
        <Skeleton className="h-80 w-full" />
      </div>
    );
  }

  const kpiCards = [
    {
      title: t('reports.uniqueCustomers'),
      value: insightsData?.uniqueCustomers || 0,
      icon: Users,
      color: 'text-blue-500',
    },
    {
      title: t('reports.repeatRate'),
      value: `${(insightsData?.repeatRate || 0).toFixed(1)}%`,
      icon: Repeat,
      color: 'text-emerald-500',
    },
    {
      title: t('reports.avgCustomerValue'),
      value: `$${(insightsData?.avgCustomerValue || 0).toFixed(2)}`,
      icon: TrendingUp,
      color: 'text-purple-500',
    },
    {
      title: t('reports.avgSessionDuration'),
      value: `${insightsData?.avgSessionDuration || 0} min`,
      icon: Clock,
      color: 'text-amber-500',
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiCards.map((card) => (
          <Card key={card.title}>
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{card.title}</p>
                  <p className="text-2xl font-bold mt-1">{card.value}</p>
                </div>
                <card.icon className={cn('h-10 w-10', card.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Customer Acquisition Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t('reports.customerAcquisition')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={insightsData?.acquisitionData || []}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="newCustomers"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ fill: 'hsl(var(--primary))' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Search and Segments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.topSearchQueries')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={insightsData?.topSearches || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" className="text-xs" width={100} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Bar dataKey="value" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('reports.customerSegments')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart cx="50%" cy="50%" outerRadius="80%" data={insightsData?.segments || []}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" className="text-xs" />
                  <PolarRadiusAxis angle={30} domain={[0, 100]} />
                  <Radar name="Score" dataKey="A" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.5} />
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
