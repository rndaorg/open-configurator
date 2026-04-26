import { useUsageMetrics } from '@/hooks/useUsageMetrics';
import { useSubscription } from '@/hooks/useSubscription';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Activity, Package, FolderTree, Settings, ShoppingBag, AlertCircle, TrendingUp } from 'lucide-react';

export function UsageMetricsTab() {
  const { metrics, loading } = useUsageMetrics();
  const { currentTier, canAccess } = useSubscription();

  if (loading || !metrics) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
        </CardContent>
      </Card>
    );
  }

  const limitText = (limit: number) => (limit === -1 ? 'Unlimited' : limit.toString());
  const isNearLimit = (pct: number) => pct >= 80 && pct < 100;
  const isAtLimit = (pct: number) => pct >= 100;

  const features = [
    { key: 'analytics', label: 'Analytics Access', enabled: canAccess('analytics') },
    { key: 'api', label: 'API Access', enabled: canAccess('api') },
    { key: 'white_label', label: 'White Labeling', enabled: canAccess('white_label') },
    { key: 'priority_support', label: 'Priority Support', enabled: canAccess('priority_support') },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Activity className="h-5 w-5 text-primary" />
            <div>
              <CardTitle>Usage Overview</CardTitle>
              <CardDescription>
                Your current usage on the {currentTier?.name || 'Free'} plan
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Products */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Products</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {metrics.productsUsed} / {limitText(metrics.productsLimit)}
              </span>
            </div>
            {metrics.productsLimit !== -1 && (
              <Progress value={metrics.productsPercentage} className="h-2" />
            )}
            {isAtLimit(metrics.productsPercentage) && (
              <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> You've reached your product limit
              </p>
            )}
            {isNearLimit(metrics.productsPercentage) && (
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-2">
                Approaching your product limit
              </p>
            )}
          </div>

          {/* Categories */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <FolderTree className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Categories</span>
              </div>
              <span className="text-sm text-muted-foreground">
                {metrics.categoriesUsed} / {limitText(metrics.categoriesLimit)}
              </span>
            </div>
            {metrics.categoriesLimit !== -1 && (
              <Progress value={metrics.categoriesPercentage} className="h-2" />
            )}
            {isAtLimit(metrics.categoriesPercentage) && (
              <p className="text-xs text-destructive mt-2 flex items-center gap-1">
                <AlertCircle className="h-3 w-3" /> You've reached your category limit
              </p>
            )}
          </div>

          {(isNearLimit(metrics.productsPercentage) || isAtLimit(metrics.productsPercentage) ||
            isNearLimit(metrics.categoriesPercentage) || isAtLimit(metrics.categoriesPercentage)) && (
            <div className="p-4 bg-primary/5 border border-primary/20 rounded-lg flex items-start gap-3">
              <TrendingUp className="h-5 w-5 text-primary mt-0.5" />
              <div className="flex-1">
                <p className="font-medium text-sm">Need more capacity?</p>
                <p className="text-xs text-muted-foreground mt-1">
                  Upgrade your plan to unlock higher limits and more features.
                </p>
              </div>
              <Button asChild size="sm"><Link to="/pricing">Upgrade</Link></Button>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid sm:grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              <CardDescription>Saved Configurations</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics.configurationsCount}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4 text-muted-foreground" />
              <CardDescription>Total Orders</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{metrics.ordersCount}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Plan Features</CardTitle>
          <CardDescription>Features included in your current tier</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid sm:grid-cols-2 gap-3">
            {features.map((f) => (
              <div
                key={f.key}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  f.enabled ? 'bg-primary/5 border-primary/20' : 'bg-muted/30 opacity-60'
                }`}
              >
                <span className="text-sm font-medium">{f.label}</span>
                <span className={`text-xs ${f.enabled ? 'text-primary' : 'text-muted-foreground'}`}>
                  {f.enabled ? '✓ Active' : 'Locked'}
                </span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
