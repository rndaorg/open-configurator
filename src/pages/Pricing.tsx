import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Check, Sparkles, Zap, Crown } from 'lucide-react';
import { useSubscription } from '@/hooks/useSubscription';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const tierIcons: Record<string, React.ReactNode> = {
  free: <Zap className="h-6 w-6" />,
  pro: <Sparkles className="h-6 w-6" />,
  enterprise: <Crown className="h-6 w-6" />,
};

export default function Pricing() {
  const [yearly, setYearly] = useState(false);
  const [subscribing, setSubscribing] = useState<string | null>(null);
  const { tiers, currentTier, activeProvider, loading, refresh } = useSubscription();
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleSubscribe = async (tier: typeof tiers[0]) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    if (tier.slug === 'free') {
      toast.info('You are already on the Free plan');
      return;
    }

    if (currentTier?.slug === tier.slug) {
      toast.info(`You are already on the ${tier.name} plan`);
      return;
    }

    if (!activeProvider) {
      toast.error('No payment provider is configured. Contact support.');
      return;
    }

    setSubscribing(tier.id);

    try {
      const { data, error } = await supabase.functions.invoke('subscription-checkout', {
        body: {
          tierId: tier.id,
          billingInterval: yearly ? 'yearly' : 'monthly',
          provider: activeProvider.provider,
        },
      });

      if (error) throw error;

      if (data?.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else if (data?.demo) {
        toast.success(`Demo: Subscribed to ${tier.name} plan!`);
        await refresh();
      }
    } catch (error: any) {
      console.error('Subscription error:', error);
      toast.error('Failed to start checkout. Please try again.');
    } finally {
      setSubscribing(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <main className="container mx-auto px-4 py-16">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Simple, transparent{' '}
            <span className="bg-gradient-primary bg-clip-text text-transparent">pricing</span>
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-8">
            Choose the plan that fits your business. Upgrade or downgrade anytime.
          </p>

          <div className="flex items-center justify-center gap-3">
            <Label htmlFor="billing" className={!yearly ? 'text-foreground' : 'text-muted-foreground'}>
              Monthly
            </Label>
            <Switch id="billing" checked={yearly} onCheckedChange={setYearly} />
            <Label htmlFor="billing" className={yearly ? 'text-foreground' : 'text-muted-foreground'}>
              Yearly
            </Label>
            {yearly && (
              <Badge variant="secondary" className="ml-2 bg-accent/20 text-accent border-accent/30">
                Save ~17%
              </Badge>
            )}
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {tiers.map((tier) => {
            const isCurrentPlan = currentTier?.slug === tier.slug;
            const isPopular = tier.slug === 'pro';
            const price = yearly ? tier.yearly_price_usd : tier.monthly_price_usd;

            return (
              <Card
                key={tier.id}
                className={`relative flex flex-col transition-all duration-300 hover:scale-[1.02] ${
                  isPopular
                    ? 'border-primary shadow-[0_0_30px_hsla(var(--primary),0.3)] scale-[1.02]'
                    : 'border-border'
                }`}
              >
                {isPopular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <Badge className="bg-gradient-primary text-primary-foreground border-0 px-4">
                      Most Popular
                    </Badge>
                  </div>
                )}

                <CardHeader className="text-center pb-2">
                  <div className="flex justify-center mb-3 text-primary">
                    {tierIcons[tier.slug] || <Zap className="h-6 w-6" />}
                  </div>
                  <CardTitle className="text-2xl">{tier.name}</CardTitle>
                  <CardDescription>{tier.description}</CardDescription>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col">
                  <div className="text-center mb-6">
                    <span className="text-4xl font-bold">
                      ${price}
                    </span>
                    {tier.slug !== 'free' && (
                      <span className="text-muted-foreground">
                        /{yearly ? 'year' : 'month'}
                      </span>
                    )}
                  </div>

                  <ul className="space-y-3 mb-8 flex-1">
                    {tier.features.map((feature, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <Check className="h-5 w-5 text-accent shrink-0 mt-0.5" />
                        <span className="text-sm">{feature}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className={`w-full ${isPopular ? 'bg-gradient-primary hover:opacity-90' : ''}`}
                    variant={isPopular ? 'default' : 'outline'}
                    disabled={isCurrentPlan || subscribing === tier.id}
                    onClick={() => handleSubscribe(tier)}
                  >
                    {subscribing === tier.id
                      ? 'Processing...'
                      : isCurrentPlan
                      ? 'Current Plan'
                      : tier.slug === 'free'
                      ? 'Get Started'
                      : `Upgrade to ${tier.name}`}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {activeProvider && (
          <p className="text-center text-xs text-muted-foreground mt-8">
            Payments processed securely via {activeProvider.provider === 'stripe' ? 'Stripe' : 'Paddle'}.
            {activeProvider.provider === 'paddle' && ' Paddle is the Merchant of Record.'}
          </p>
        )}
      </main>
      <Footer />
    </div>
  );
}
