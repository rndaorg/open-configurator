import { useMemo, useState } from 'react';
import { format, subDays } from 'date-fns';
import {
  Activity,
  CalendarIcon,
  DollarSign,
  Download,
  FileText,
  Repeat,
  ShoppingCart,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as ChartTooltip,
  XAxis,
  YAxis,
} from 'recharts';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { useAdvancedAnalytics } from '@/hooks/useAdvancedAnalytics';
import { downloadCSV, downloadPDF, type ExportSection } from '@/lib/analyticsExport';

const currency = (value: number) =>
  new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(
    value || 0
  );

export default function AdvancedAnalytics() {
  const [dateRange, setDateRange] = useState({ from: subDays(new Date(), 30), to: new Date() });
  const { data, isLoading, isFetching } = useAdvancedAnalytics(dateRange);

  const presets = [
    { label: '7D', days: 7 },
    { label: '30D', days: 30 },
    { label: '90D', days: 90 },
    { label: '1Y', days: 365 },
  ];

  const sections: ExportSection[] = useMemo(() => {
    if (!data) return [];
    return [
      {
        title: 'Key Metrics',
        columns: ['Metric', 'Value'],
        rows: [
          ['Revenue', data.kpis.revenue.toFixed(2)],
          ['Collected revenue', data.kpis.paidRevenue.toFixed(2)],
          ['Orders', data.kpis.totalOrders],
          ['Average order value', data.kpis.avgOrderValue.toFixed(2)],
          ['Active customers', data.kpis.activeCustomers],
          ['New customers', data.kpis.newCustomers],
          ['Average lifetime value', data.kpis.avgLtv.toFixed(2)],
          ['Repeat purchase rate', `${(data.kpis.repeatRate * 100).toFixed(1)}%`],
          ['Configurations built', data.kpis.configurations],
        ],
      },
      {
        title: 'Revenue Over Time',
        columns: ['Date', 'Revenue', 'Orders', 'Cumulative'],
        rows: data.revenueTrend.map((d) => [d.date, d.revenue, d.orders, d.cumulative]),
      },
      {
        title: 'Product Performance',
        columns: ['Product', 'Category', 'Revenue', ...data.heatmapBuckets],
        rows: data.heatmap.map((r) => [r.name, r.category, r.total.toFixed(2), ...r.cells.map((c) => c.value)]),
      },
      {
        title: 'Configuration Popularity',
        columns: ['Option', 'Selections', 'Share %'],
        rows: data.configPopularity.map((c) => [c.label, c.count, c.share]),
      },
      {
        title: 'Cohort Retention (%)',
        columns: ['Cohort', 'Size', ...Array.from({ length: data.maxPeriods }, (_, i) => `M${i}`)],
        rows: data.cohorts.map((c) => [c.label, c.size, ...c.periods.map((p) => p.retention)]),
      },
      {
        title: 'Top Customers by Lifetime Value',
        columns: ['Customer ID', 'Lifetime revenue', 'Orders', 'AOV'],
        rows: data.topCustomers.map((c) => [
          c.userId.slice(0, 8),
          c.revenue.toFixed(2),
          c.orders,
          c.aov.toFixed(2),
        ]),
      },
    ];
  }, [data]);

  const rangeLabel = `${format(dateRange.from, 'MMM dd, yyyy')} – ${format(dateRange.to, 'MMM dd, yyyy')}`;
  const fileBase = `analytics-${format(dateRange.from, 'yyyyMMdd')}-${format(dateRange.to, 'yyyyMMdd')}`;

  const kpiCards = data
    ? [
        { title: 'Revenue', value: currency(data.kpis.revenue), sub: `${data.kpis.totalOrders} orders`, icon: DollarSign },
        { title: 'Avg order value', value: currency(data.kpis.avgOrderValue), sub: `${data.kpis.activeCustomers} buyers`, icon: ShoppingCart },
        { title: 'Avg lifetime value', value: currency(data.kpis.avgLtv), sub: `${data.kpis.avgOrdersPerCustomer.toFixed(1)} orders / customer`, icon: Users },
        { title: 'Repeat rate', value: `${(data.kpis.repeatRate * 100).toFixed(1)}%`, sub: `${data.kpis.newCustomers} new customers`, icon: Repeat },
        { title: 'Configurations', value: String(data.kpis.configurations), sub: 'built in range', icon: Activity },
      ]
    : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold">Advanced Analytics</h1>
          <p className="text-sm text-muted-foreground">
            Live revenue, lifetime value, product heatmaps and cohorts · {rangeLabel}
            {isFetching && <span className="ms-2 animate-pulse">updating…</span>}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {presets.map((p) => (
            <Button
              key={p.days}
              size="sm"
              variant="outline"
              onClick={() => setDateRange({ from: subDays(new Date(), p.days), to: new Date() })}
            >
              {p.label}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(dateRange.from, 'MMM dd')} – {format(dateRange.to, 'MMM dd')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) setDateRange({ from: range.from, to: range.to });
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
          <Button size="sm" variant="secondary" className="gap-2" disabled={!data} onClick={() => downloadCSV(fileBase, sections)}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button
            size="sm"
            className="gap-2"
            disabled={!data}
            onClick={() => downloadPDF(fileBase, 'Advanced Analytics Report', rangeLabel, sections)}
          >
            <FileText className="h-4 w-4" /> PDF
          </Button>
        </div>
      </div>

      {isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-28 w-full" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-5">
            {kpiCards.map((card) => (
              <Card key={card.title}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                  <card.icon className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{card.value}</div>
                  <p className="text-xs text-muted-foreground">{card.sub}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <Tabs defaultValue="revenue" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2 lg:grid-cols-5">
              <TabsTrigger value="revenue">Revenue</TabsTrigger>
              <TabsTrigger value="ltv">Lifetime value</TabsTrigger>
              <TabsTrigger value="products">Product heatmap</TabsTrigger>
              <TabsTrigger value="configs">Configurations</TabsTrigger>
              <TabsTrigger value="cohorts">Cohorts</TabsTrigger>
            </TabsList>

            <TabsContent value="revenue" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Revenue trend</CardTitle>
                  <CardDescription>Daily and cumulative revenue, refreshed in real time</CardDescription>
                </CardHeader>
                <CardContent className="h-[340px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={data.revenueTrend}>
                      <defs>
                        <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <ChartTooltip />
                      <Legend />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--primary))" fill="url(#revFill)" name="Revenue" />
                      <Area type="monotone" dataKey="cumulative" stroke="hsl(var(--accent))" fill="transparent" name="Cumulative" />
                    </AreaChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Order volume</CardTitle>
                </CardHeader>
                <CardContent className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.revenueTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <ChartTooltip />
                      <Bar dataKey="orders" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Orders" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="ltv" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Lifetime value distribution</CardTitle>
                  <CardDescription>All-time revenue per customer</CardDescription>
                </CardHeader>
                <CardContent className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={data.ltvBuckets}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <ChartTooltip />
                      <Bar dataKey="customers" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Customers" />
                    </BarChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Top customers</CardTitle>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Customer</TableHead>
                        <TableHead className="text-end">Lifetime revenue</TableHead>
                        <TableHead className="text-end">Orders</TableHead>
                        <TableHead className="text-end">AOV</TableHead>
                        <TableHead className="text-end">Last order</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.topCustomers.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center text-muted-foreground">
                            No customer orders yet
                          </TableCell>
                        </TableRow>
                      )}
                      {data.topCustomers.map((c) => (
                        <TableRow key={c.userId}>
                          <TableCell className="font-mono text-xs">{c.userId.slice(0, 8)}</TableCell>
                          <TableCell className="text-end font-medium">{currency(c.revenue)}</TableCell>
                          <TableCell className="text-end">{c.orders}</TableCell>
                          <TableCell className="text-end">{currency(c.aov)}</TableCell>
                          <TableCell className="text-end">{format(c.lastOrder, 'MMM dd, yyyy')}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="products">
              <Card>
                <CardHeader>
                  <CardTitle>Product performance heatmap</CardTitle>
                  <CardDescription>Revenue intensity per product across the selected range</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {data.heatmap.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No product revenue in this range.</p>
                  ) : (
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="p-2 text-start font-medium">Product</th>
                          {data.heatmapBuckets.map((b) => (
                            <th key={b} className="p-2 text-center text-xs font-medium">
                              {b}
                            </th>
                          ))}
                          <th className="p-2 text-end font-medium">Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.heatmap.map((row) => (
                          <tr key={row.productId}>
                            <td className="p-2">
                              <div className="font-medium">{row.name}</div>
                              <div className="text-xs text-muted-foreground">{row.category}</div>
                            </td>
                            {row.cells.map((cell, i) => (
                              <td key={i} className="p-1">
                                <div
                                  className="flex h-10 items-center justify-center rounded-md text-xs font-medium"
                                  style={{
                                    backgroundColor: `hsl(var(--primary) / ${Math.max(
                                      0.06,
                                      cell.value / data.heatmapMax
                                    )})`,
                                  }}
                                  title={`${cell.label}: ${currency(cell.value)}`}
                                >
                                  {cell.value > 0 ? currency(cell.value) : '—'}
                                </div>
                              </td>
                            ))}
                            <td className="p-2 text-end font-semibold">{currency(row.total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="configs" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Configuration popularity</CardTitle>
                  <CardDescription>Most selected options across orders and saved configurations</CardDescription>
                </CardHeader>
                <CardContent>
                  {data.configPopularity.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No configuration data in this range.</p>
                  ) : (
                    <div className="space-y-3">
                      {data.configPopularity.map((option) => (
                        <div key={option.label} className="space-y-1">
                          <div className="flex items-center justify-between text-sm">
                            <span className="truncate pe-4">{option.label}</span>
                            <Badge variant="secondary">
                              {option.count} · {option.share}%
                            </Badge>
                          </div>
                          <div className="h-2 w-full rounded-full bg-muted">
                            <div
                              className="h-2 rounded-full bg-primary"
                              style={{
                                width: `${Math.max(
                                  2,
                                  (option.count / data.configPopularity[0].count) * 100
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Configuration activity trend</CardTitle>
                </CardHeader>
                <CardContent className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={data.configTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="date" tick={{ fontSize: 11 }} minTickGap={24} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                      <ChartTooltip />
                      <Legend />
                      <Line type="monotone" dataKey="configurations" stroke="hsl(var(--primary))" name="Built" dot={false} />
                      <Line type="monotone" dataKey="abandoned" stroke="hsl(var(--destructive))" name="Abandoned" dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="cohorts">
              <Card>
                <CardHeader>
                  <CardTitle>Cohort analysis</CardTitle>
                  <CardDescription>Signup cohorts and their purchase retention by month</CardDescription>
                </CardHeader>
                <CardContent className="overflow-x-auto">
                  {data.cohorts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No cohorts available yet.</p>
                  ) : (
                    <table className="w-full min-w-[640px] text-sm">
                      <thead>
                        <tr className="text-muted-foreground">
                          <th className="p-2 text-start font-medium">Cohort</th>
                          <th className="p-2 text-start font-medium">Users</th>
                          {Array.from({ length: data.maxPeriods }, (_, i) => (
                            <th key={i} className="p-2 text-center text-xs font-medium">
                              M{i}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {data.cohorts.map((cohort) => (
                          <tr key={cohort.label}>
                            <td className="p-2 font-medium">{cohort.label}</td>
                            <td className="p-2">{cohort.size}</td>
                            {cohort.periods.map((p) => (
                              <td key={p.month} className="p-1">
                                <div
                                  className={cn(
                                    'flex h-10 flex-col items-center justify-center rounded-md text-xs font-medium'
                                  )}
                                  style={{
                                    backgroundColor: `hsl(var(--primary) / ${Math.max(0.06, p.retention / 100)})`,
                                  }}
                                  title={`${p.activeUsers} active · ${currency(p.revenue)}`}
                                >
                                  {p.retention > 0 ? `${p.retention}%` : '—'}
                                </div>
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
