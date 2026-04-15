import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useTranslation } from 'react-i18next';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  Legend,
} from 'recharts';
import { format, subDays, startOfDay, eachDayOfInterval } from 'date-fns';
import { TrendingUp, TrendingDown, DollarSign, ShoppingCart, Package, Users } from 'lucide-react';
import { cn } from '@/lib/utils';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--accent))', 'hsl(var(--muted))'];

interface SalesAnalyticsProps {
  dateRange: { from: Date; to: Date };
}

export default function SalesAnalytics({ dateRange }: SalesAnalyticsProps) {
  const { t } = useTranslation();

  const { data: salesData, isLoading } = useQuery({
    queryKey: ['sales-analytics', dateRange],
    queryFn: async () => {
      const [ordersResult, productsResult, categoriesResult] = await Promise.all([
        supabase
          .from('orders')
          .select('*, order_items(*)')
          .gte('created_at', dateRange.from.toISOString())
          .lte('created_at', dateRange.to.toISOString())
          .order('created_at', { ascending: true }),
        supabase.from('products').select('id, name, base_price, category_id'),
        supabase.from('categories').select('id, name'),
      ]);

      const orders = ordersResult.data || [];
      const products = productsResult.data || [];
      const categories = categoriesResult.data || [];

      // Generate daily revenue data
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      const dailyRevenue = days.map((day) => {
        const dayStart = startOfDay(day);
        const dayOrders = orders.filter((order) => {
          const orderDate = startOfDay(new Date(order.created_at));
          return orderDate.getTime() === dayStart.getTime();
        });
        const revenue = dayOrders.reduce((sum, order) => sum + Number(order.total_price), 0);
        const orderCount = dayOrders.length;
        return {
          date: format(day, 'MMM dd'),
          revenue,
          orders: orderCount,
        };
      });

      // Calculate totals and trends
      const totalRevenue = orders.reduce((sum, order) => sum + Number(order.total_price), 0);
      const totalOrders = orders.length;
      const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Category breakdown
      const categoryRevenue: Record<string, number> = {};
      orders.forEach((order) => {
        const product = products.find((p) => p.id === order.product_id);
        if (product) {
          const category = categories.find((c) => c.id === product.category_id);
          const categoryName = category?.name || 'Uncategorized';
          categoryRevenue[categoryName] = (categoryRevenue[categoryName] || 0) + Number(order.total_price);
        }
      });

      const categoryData = Object.entries(categoryRevenue).map(([name, value]) => ({
        name,
        value: Math.round(value * 100) / 100,
      }));

      // Order status breakdown
      const statusCounts: Record<string, number> = {};
      orders.forEach((order) => {
        statusCounts[order.status] = (statusCounts[order.status] || 0) + 1;
      });

      const statusData = Object.entries(statusCounts).map(([name, value]) => ({
        name: name.charAt(0).toUpperCase() + name.slice(1),
        value,
      }));

      // Compare with previous period
      const periodDays = Math.ceil((dateRange.to.getTime() - dateRange.from.getTime()) / (1000 * 60 * 60 * 24));
      const previousFrom = subDays(dateRange.from, periodDays);
      const previousTo = subDays(dateRange.to, periodDays);

      const previousOrdersResult = await supabase
        .from('orders')
        .select('total_price')
        .gte('created_at', previousFrom.toISOString())
        .lte('created_at', previousTo.toISOString());

      const previousOrders = previousOrdersResult.data || [];
      const previousRevenue = previousOrders.reduce((sum, order) => sum + Number(order.total_price), 0);
      const revenueGrowth = previousRevenue > 0 ? ((totalRevenue - previousRevenue) / previousRevenue) * 100 : 0;

      return {
        dailyRevenue,
        totalRevenue,
        totalOrders,
        avgOrderValue,
        categoryData,
        statusData,
        revenueGrowth,
        previousOrders: previousOrders.length,
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
      title: t('reports.totalRevenue'),
      value: `$${(salesData?.totalRevenue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: DollarSign,
      trend: salesData?.revenueGrowth || 0,
      color: 'text-emerald-500',
    },
    {
      title: t('reports.totalOrders'),
      value: salesData?.totalOrders || 0,
      icon: ShoppingCart,
      trend: salesData?.previousOrders
        ? ((salesData.totalOrders - salesData.previousOrders) / salesData.previousOrders) * 100
        : 0,
      color: 'text-blue-500',
    },
    {
      title: t('reports.avgOrderValue'),
      value: `$${(salesData?.avgOrderValue || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}`,
      icon: Package,
      trend: 0,
      color: 'text-purple-500',
    },
    {
      title: t('reports.uniqueProducts'),
      value: salesData?.categoryData?.length || 0,
      icon: Users,
      trend: 0,
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
                  {card.trend !== 0 && (
                    <div
                      className={cn(
                        'flex items-center gap-1 text-sm mt-1',
                        card.trend > 0 ? 'text-emerald-500' : 'text-red-500'
                      )}
                    >
                      {card.trend > 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                      <span>{Math.abs(card.trend).toFixed(1)}%</span>
                    </div>
                  )}
                </div>
                <card.icon className={cn('h-10 w-10', card.color)} />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Revenue Chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t('reports.revenueOverTime')}</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={salesData?.dailyRevenue || []}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" className="text-xs" />
                <YAxis className="text-xs" tickFormatter={(value) => `$${value}`} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'hsl(var(--background))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '8px',
                  }}
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                />
                <Area
                  type="monotone"
                  dataKey="revenue"
                  stroke="hsl(var(--primary))"
                  fill="url(#revenueGradient)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Category and Status Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('reports.revenueByCategory')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={salesData?.categoryData || []}
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {(salesData?.categoryData || []).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number) => [`$${value.toFixed(2)}`, 'Revenue']}
                    contentStyle={{
                      backgroundColor: 'hsl(var(--background))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '8px',
                    }}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('reports.ordersByStatus')}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesData?.statusData || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis type="number" className="text-xs" />
                  <YAxis dataKey="name" type="category" className="text-xs" width={80} />
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
      </div>
    </div>
  );
}
