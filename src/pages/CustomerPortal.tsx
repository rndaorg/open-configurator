import { useState } from 'react';
import { useSubscription } from '@/hooks/useSubscription';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Crown, Calendar, AlertTriangle, ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { InvoicesTab } from '@/components/customer-portal/InvoicesTab';
import { PaymentMethodsTab } from '@/components/customer-portal/PaymentMethodsTab';
import { UsageMetricsTab } from '@/components/customer-portal/UsageMetricsTab';
import { SubscriptionHistoryTab } from '@/components/customer-portal/SubscriptionHistoryTab';
import { CancellationFlow } from '@/components/customer-portal/CancellationFlow';

const statusColors: Record<string, string> = {
  active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  canceled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  past_due: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  trialing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  paused: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

export default function CustomerPortal() {
  const { subscription, currentTier, loading, refresh } = useSubscription();
  const [cancelOpen, setCancelOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-12 max-w-6xl">
        <div className="mb-8">
          <Button variant="ghost" size="sm" asChild className="mb-4">
            <Link to="/profile"><ArrowLeft className="h-4 w-4 mr-1" /> Back to Profile</Link>
          </Button>
          <h1 className="text-4xl font-bold mb-2">Customer Portal</h1>
          <p className="text-muted-foreground">
            Manage your subscription, payment methods, invoices, and usage
          </p>
        </div>

        {/* Plan Summary Banner */}
        {!loading && (
          <Card className="mb-6">
            <CardContent className="p-6">
              <div className="flex items-start justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <Crown className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h2 className="text-xl font-semibold">
                        {currentTier?.name || 'Free'} Plan
                      </h2>
                      {subscription && (
                        <Badge className={statusColors[subscription.status] || statusColors.active}>
                          {subscription.status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">{currentTier?.description}</p>
                    {subscription?.current_period_end && currentTier?.slug !== 'free' && (
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Next billing: {format(new Date(subscription.current_period_end), 'MMM d, yyyy')}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button asChild>
                    <Link to="/pricing">
                      {currentTier?.slug === 'free' ? 'Upgrade Plan' : 'Change Plan'}
                    </Link>
                  </Button>
                  {subscription && currentTier?.slug !== 'free' && !subscription.cancel_at_period_end && (
                    <Button variant="outline" onClick={() => setCancelOpen(true)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>

              {subscription?.cancel_at_period_end && (
                <div className="mt-4 flex items-center gap-2 p-3 bg-destructive/10 rounded-lg">
                  <AlertTriangle className="h-4 w-4 text-destructive shrink-0" />
                  <span className="text-sm">
                    Your subscription will end on{' '}
                    {subscription.current_period_end &&
                      format(new Date(subscription.current_period_end), 'MMM d, yyyy')}
                    . You'll be moved to the Free plan.
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="usage" className="w-full">
          <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4 mb-6">
            <TabsTrigger value="usage">Usage</TabsTrigger>
            <TabsTrigger value="invoices">Invoices</TabsTrigger>
            <TabsTrigger value="payment">Payment</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>

          <TabsContent value="usage"><UsageMetricsTab /></TabsContent>
          <TabsContent value="invoices"><InvoicesTab /></TabsContent>
          <TabsContent value="payment"><PaymentMethodsTab /></TabsContent>
          <TabsContent value="history"><SubscriptionHistoryTab /></TabsContent>
        </Tabs>

        {subscription && currentTier && (
          <CancellationFlow
            subscriptionId={subscription.id}
            tierName={currentTier.name}
            periodEnd={subscription.current_period_end}
            open={cancelOpen}
            onOpenChange={setCancelOpen}
            onCancelComplete={refresh}
          />
        )}
      </main>
      <Footer />
    </div>
  );
}
