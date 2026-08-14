import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import {
  eachDayOfInterval,
  startOfDay,
  format,
  differenceInCalendarMonths,
  startOfMonth,
} from 'date-fns';

export interface DateRange {
  from: Date;
  to: Date;
}

const REVENUE_STATUSES = new Set(['paid', 'processing', 'shipped', 'delivered', 'completed']);

const flattenConfig = (data: unknown, prefix = ''): { option: string; value: string }[] => {
  if (!data || typeof data !== 'object') return [];
  return Object.entries(data as Record<string, unknown>).flatMap(([key, value]) => {
    const label = prefix ? `${prefix} / ${key}` : key;
    if (value == null) return [];
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return [{ option: label, value: String(value) }];
    }
    if (Array.isArray(value)) {
      return value.flatMap((v) =>
        typeof v === 'object' && v !== null
          ? flattenConfig(v, label)
          : [{ option: label, value: String(v) }]
      );
    }
    const obj = value as Record<string, unknown>;
    if (typeof obj.name === 'string') return [{ option: label, value: obj.name }];
    return flattenConfig(obj, label);
  });
};

export function useAdvancedAnalytics(dateRange: DateRange) {
  const queryClient = useQueryClient();
  const key = ['advanced-analytics', dateRange.from.toISOString(), dateRange.to.toISOString()];

  useEffect(() => {
    const channel = supabase
      .channel('advanced-analytics-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, () => {
        queryClient.invalidateQueries({ queryKey: ['advanced-analytics'] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'product_configurations' }, () => {
        queryClient.invalidateQueries({ queryKey: ['advanced-analytics'] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  return useQuery({
    queryKey: key,
    queryFn: async () => {
      const fromIso = dateRange.from.toISOString();
      const toIso = dateRange.to.toISOString();

      const [ordersRes, allOrdersRes, productsRes, categoriesRes, profilesRes, configsRes, sessionsRes] =
        await Promise.all([
          supabase
            .from('orders')
            .select('id, user_id, product_id, total_price, status, quantity, configuration_data, created_at')
            .gte('created_at', fromIso)
            .lte('created_at', toIso)
            .order('created_at', { ascending: true }),
          supabase.from('orders').select('id, user_id, total_price, status, created_at'),
          supabase.from('products').select('id, name, category_id, base_price'),
          supabase.from('categories').select('id, name'),
          supabase.from('profiles').select('id, created_at'),
          supabase
            .from('product_configurations')
            .select('id, product_id, configuration_data, total_price, created_at')
            .gte('created_at', fromIso)
            .lte('created_at', toIso)
            .limit(2000),
          supabase
            .from('configuration_analytics')
            .select('id, product_id, completion_rate, abandonment_point, created_at')
            .gte('created_at', fromIso)
            .lte('created_at', toIso)
            .limit(2000),
        ]);

      const orders = (ordersRes.data || []).filter((o) => o.status !== 'cancelled');
      const allOrders = (allOrdersRes.data || []).filter((o) => o.status !== 'cancelled');
      const products = productsRes.data || [];
      const categories = categoriesRes.data || [];
      const profiles = profilesRes.data || [];
      const configurations = configsRes.data || [];
      const sessions = sessionsRes.data || [];

      const productMap = new Map(products.map((p) => [p.id, p]));
      const categoryMap = new Map(categories.map((c) => [c.id, c.name]));

      // ---- KPIs ----
      const revenue = orders.reduce((s, o) => s + Number(o.total_price || 0), 0);
      const paidRevenue = orders
        .filter((o) => REVENUE_STATUSES.has(o.status))
        .reduce((s, o) => s + Number(o.total_price || 0), 0);
      const totalOrders = orders.length;
      const avgOrderValue = totalOrders ? revenue / totalOrders : 0;
      const customers = new Set(orders.map((o) => o.user_id).filter(Boolean));

      // ---- Customer lifetime value (all-time, per customer) ----
      const perCustomer = new Map<string, { revenue: number; orders: number; first: Date; last: Date }>();
      allOrders.forEach((o) => {
        if (!o.user_id) return;
        const created = new Date(o.created_at);
        const entry = perCustomer.get(o.user_id) || { revenue: 0, orders: 0, first: created, last: created };
        entry.revenue += Number(o.total_price || 0);
        entry.orders += 1;
        if (created < entry.first) entry.first = created;
        if (created > entry.last) entry.last = created;
        perCustomer.set(o.user_id, entry);
      });
      const ltvValues = Array.from(perCustomer.values());
      const avgLtv = ltvValues.length
        ? ltvValues.reduce((s, c) => s + c.revenue, 0) / ltvValues.length
        : 0;
      const repeatRate = ltvValues.length
        ? ltvValues.filter((c) => c.orders > 1).length / ltvValues.length
        : 0;
      const avgOrdersPerCustomer = ltvValues.length
        ? ltvValues.reduce((s, c) => s + c.orders, 0) / ltvValues.length
        : 0;

      const ltvBuckets = [
        { label: '$0–500', min: 0, max: 500 },
        { label: '$500–1k', min: 500, max: 1000 },
        { label: '$1k–5k', min: 1000, max: 5000 },
        { label: '$5k–10k', min: 5000, max: 10000 },
        { label: '$10k+', min: 10000, max: Infinity },
      ].map((b) => ({
        label: b.label,
        customers: ltvValues.filter((c) => c.revenue >= b.min && c.revenue < b.max).length,
      }));

      const topCustomers = Array.from(perCustomer.entries())
        .map(([userId, v]) => ({
          userId,
          revenue: v.revenue,
          orders: v.orders,
          aov: v.orders ? v.revenue / v.orders : 0,
          lastOrder: v.last,
        }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 10);

      // ---- Revenue over time ----
      const days = eachDayOfInterval({ start: dateRange.from, end: dateRange.to });
      let running = 0;
      const revenueTrend = days.map((day) => {
        const dayStart = startOfDay(day).getTime();
        const dayOrders = orders.filter((o) => startOfDay(new Date(o.created_at)).getTime() === dayStart);
        const dayRevenue = dayOrders.reduce((s, o) => s + Number(o.total_price || 0), 0);
        running += dayRevenue;
        return {
          date: format(day, 'MMM dd'),
          revenue: Number(dayRevenue.toFixed(2)),
          orders: dayOrders.length,
          cumulative: Number(running.toFixed(2)),
        };
      });

      // ---- Product performance heatmap (product x day-bucket revenue) ----
      const bucketCount = Math.min(12, Math.max(4, Math.ceil(days.length / 7)));
      const bucketSize = Math.ceil(days.length / bucketCount);
      const buckets = Array.from({ length: bucketCount }, (_, i) => {
        const slice = days.slice(i * bucketSize, (i + 1) * bucketSize).filter(Boolean);
        return {
          label: slice.length ? format(slice[0], 'MMM dd') : '',
          start: slice.length ? startOfDay(slice[0]).getTime() : 0,
          end: slice.length ? startOfDay(slice[slice.length - 1]).getTime() + 86400000 : 0,
        };
      }).filter((b) => b.end > 0);

      const productTotals = new Map<string, number>();
      orders.forEach((o) => {
        if (!o.product_id) return;
        productTotals.set(o.product_id, (productTotals.get(o.product_id) || 0) + Number(o.total_price || 0));
      });
      const heatmapProducts = Array.from(productTotals.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([id]) => id);

      const heatmap = heatmapProducts.map((id) => ({
        productId: id,
        name: productMap.get(id)?.name || 'Unknown product',
        category: categoryMap.get(productMap.get(id)?.category_id || '') || 'Uncategorized',
        total: productTotals.get(id) || 0,
        cells: buckets.map((b) => {
          const value = orders
            .filter((o) => {
              const t = new Date(o.created_at).getTime();
              return o.product_id === id && t >= b.start && t < b.end;
            })
            .reduce((s, o) => s + Number(o.total_price || 0), 0);
          return { label: b.label, value: Number(value.toFixed(2)) };
        }),
      }));
      const heatmapMax = Math.max(1, ...heatmap.flatMap((r) => r.cells.map((c) => c.value)));

      // ---- Configuration popularity ----
      const optionCounts = new Map<string, number>();
      const sources = [
        ...orders.map((o) => o.configuration_data),
        ...configurations.map((c) => c.configuration_data),
      ];
      sources.forEach((data) => {
        flattenConfig(data).forEach(({ option, value }) => {
          const label = `${option}: ${value}`;
          optionCounts.set(label, (optionCounts.get(label) || 0) + 1);
        });
      });
      const totalOptionPicks = Array.from(optionCounts.values()).reduce((s, v) => s + v, 0) || 1;
      const configPopularity = Array.from(optionCounts.entries())
        .map(([label, count]) => ({
          label,
          count,
          share: Number(((count / totalOptionPicks) * 100).toFixed(1)),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 15);

      const configTrend = days.map((day) => {
        const dayStart = startOfDay(day).getTime();
        const built = configurations.filter(
          (c) => startOfDay(new Date(c.created_at)).getTime() === dayStart
        );
        const dropped = sessions.filter(
          (s) => startOfDay(new Date(s.created_at)).getTime() === dayStart && s.abandonment_point
        );
        return {
          date: format(day, 'MMM dd'),
          configurations: built.length,
          abandoned: dropped.length,
        };
      });

      // ---- Cohort analysis (signup month x months since signup) ----
      const cohortMap = new Map<string, { users: Set<string>; start: Date }>();
      profiles.forEach((p) => {
        const start = startOfMonth(new Date(p.created_at));
        const label = format(start, 'MMM yyyy');
        const entry = cohortMap.get(label) || { users: new Set<string>(), start };
        entry.users.add(p.id);
        cohortMap.set(label, entry);
      });

      const maxPeriods = 6;
      const cohorts = Array.from(cohortMap.entries())
        .sort((a, b) => a[1].start.getTime() - b[1].start.getTime())
        .slice(-8)
        .map(([label, entry]) => {
          const periods = Array.from({ length: maxPeriods }, (_, i) => {
            const active = new Set<string>();
            let cohortRevenue = 0;
            allOrders.forEach((o) => {
              if (!o.user_id || !entry.users.has(o.user_id)) return;
              const offset = differenceInCalendarMonths(new Date(o.created_at), entry.start);
              if (offset === i) {
                active.add(o.user_id);
                cohortRevenue += Number(o.total_price || 0);
              }
            });
            return {
              month: i,
              activeUsers: active.size,
              retention: entry.users.size ? Number(((active.size / entry.users.size) * 100).toFixed(1)) : 0,
              revenue: Number(cohortRevenue.toFixed(2)),
            };
          });
          return { label, size: entry.users.size, periods };
        });

      return {
        kpis: {
          revenue,
          paidRevenue,
          totalOrders,
          avgOrderValue,
          activeCustomers: customers.size,
          avgLtv,
          repeatRate,
          avgOrdersPerCustomer,
          newCustomers: profiles.filter(
            (p) => new Date(p.created_at) >= dateRange.from && new Date(p.created_at) <= dateRange.to
          ).length,
          configurations: configurations.length,
        },
        revenueTrend,
        heatmap,
        heatmapBuckets: buckets.map((b) => b.label),
        heatmapMax,
        configPopularity,
        configTrend,
        ltvBuckets,
        topCustomers,
        cohorts,
        maxPeriods,
      };
    },
    refetchInterval: 60_000,
  });
}

export type AdvancedAnalytics = NonNullable<ReturnType<typeof useAdvancedAnalytics>['data']>;
