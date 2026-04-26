import { useSubscription } from '@/hooks/useSubscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Link } from 'react-router-dom';
import { Crown, CreditCard, AlertTriangle, ExternalLink } from 'lucide-react';
import { format } from 'date-fns';
import { useState } from 'react';
import { CancellationFlow } from '@/components/customer-portal/CancellationFlow';

export function SubscriptionManagement() {
  const { subscription, currentTier, loading, refresh } = useSubscription();
  const [cancelOpen, setCancelOpen] = useState(false);

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </CardContent>
      </Card>
    );
  }

  const statusColors: Record<string, string> = {
    active: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    canceled: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
    past_due: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    trialing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    paused: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
  };

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Current Plan: {currentTier?.name || 'Free'}</CardTitle>
                <CardDescription>{currentTier?.description}</CardDescription>
              </div>
            </div>
            {subscription && (
              <Badge className={statusColors[subscription.status] || statusColors.active}>
                {subscription.status}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            {currentTier && (
              <>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Products</p>
                  <p className="text-lg font-semibold">
                    {currentTier.max_products === -1 ? 'Unlimited' : `Up to ${currentTier.max_products}`}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Categories</p>
                  <p className="text-lg font-semibold">
                    {currentTier.max_categories === -1 ? 'Unlimited' : `Up to ${currentTier.max_categories}`}
                  </p>
                </div>
              </>
            )}
          </div>

          {subscription?.cancel_at_period_end && (
            <div className="flex items-center gap-2 p-3 bg-destructive/10 rounded-lg mb-4">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              <span className="text-sm">
                Your subscription will cancel at the end of the current period
              </span>
            </div>
          )}

          <div className="flex gap-3">
            <Button asChild>
              <Link to="/pricing">
                {currentTier?.slug === 'free' ? 'Upgrade Plan' : 'Change Plan'}
              </Link>
            </Button>
            {subscription && currentTier?.slug !== 'free' && !subscription.cancel_at_period_end && (
              <Button
                variant="outline"
                onClick={handleCancelSubscription}
                disabled={canceling}
              >
                {canceling ? 'Canceling...' : 'Cancel Subscription'}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Billing Info */}
      {subscription && currentTier?.slug !== 'free' && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <CreditCard className="h-5 w-5 text-primary" />
              <CardTitle>Billing</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Payment Provider</p>
                <p className="font-medium capitalize">{subscription.payment_provider}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Billing Interval</p>
                <p className="font-medium capitalize">{subscription.billing_interval}</p>
              </div>
              {subscription.current_period_end && (
                <div>
                  <p className="text-sm text-muted-foreground">Next Billing Date</p>
                  <p className="font-medium">
                    {format(new Date(subscription.current_period_end), 'MMM d, yyyy')}
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
