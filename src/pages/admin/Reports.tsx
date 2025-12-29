import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, subDays } from 'date-fns';
import { CalendarIcon, TrendingUp, Filter, Users, FlaskConical, Download } from 'lucide-react';
import { cn } from '@/lib/utils';
import SalesAnalytics from '@/components/reports/SalesAnalytics';
import ConversionFunnel from '@/components/reports/ConversionFunnel';
import CustomerInsights from '@/components/reports/CustomerInsights';
import ABTestingResults from '@/components/reports/ABTestingResults';
import ReportExport from '@/components/reports/ReportExport';

export default function Reports() {
  const { t } = useTranslation();
  const [dateRange, setDateRange] = useState({
    from: subDays(new Date(), 30),
    to: new Date(),
  });

  const presets = [
    { label: t('reports.datePresets.last7Days'), days: 7 },
    { label: t('reports.datePresets.last30Days'), days: 30 },
    { label: t('reports.datePresets.last90Days'), days: 90 },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <h1 className="text-3xl font-bold">{t('reports.title')}</h1>
        
        <div className="flex items-center gap-2">
          {presets.map((preset) => (
            <Button
              key={preset.days}
              variant="outline"
              size="sm"
              onClick={() => setDateRange({ from: subDays(new Date(), preset.days), to: new Date() })}
            >
              {preset.label}
            </Button>
          ))}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="gap-2">
                <CalendarIcon className="h-4 w-4" />
                {format(dateRange.from, 'MMM dd')} - {format(dateRange.to, 'MMM dd')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      <Tabs defaultValue="sales" className="space-y-6">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="sales" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            <span className="hidden sm:inline">{t('reports.tabs.sales')}</span>
          </TabsTrigger>
          <TabsTrigger value="funnel" className="gap-2">
            <Filter className="h-4 w-4" />
            <span className="hidden sm:inline">{t('reports.tabs.funnel')}</span>
          </TabsTrigger>
          <TabsTrigger value="customers" className="gap-2">
            <Users className="h-4 w-4" />
            <span className="hidden sm:inline">{t('reports.tabs.customers')}</span>
          </TabsTrigger>
          <TabsTrigger value="abtesting" className="gap-2">
            <FlaskConical className="h-4 w-4" />
            <span className="hidden sm:inline">{t('reports.tabs.abTesting')}</span>
          </TabsTrigger>
          <TabsTrigger value="export" className="gap-2">
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">{t('reports.tabs.export')}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="sales">
          <SalesAnalytics dateRange={dateRange} />
        </TabsContent>
        <TabsContent value="funnel">
          <ConversionFunnel dateRange={dateRange} />
        </TabsContent>
        <TabsContent value="customers">
          <CustomerInsights dateRange={dateRange} />
        </TabsContent>
        <TabsContent value="abtesting">
          <ABTestingResults dateRange={dateRange} />
        </TabsContent>
        <TabsContent value="export">
          <ReportExport dateRange={dateRange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
