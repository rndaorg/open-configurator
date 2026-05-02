import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { supabase } from '@/integrations/supabase/client';

export interface SubscriptionTier {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  monthly_price_usd: number;
  yearly_price_usd: number;
  max_products: number;
  max_categories: number;
  analytics_access: boolean;
  api_access: boolean;
  white_label: boolean;
  priority_support: boolean;
  is_active: boolean;
  display_order: number;
  features: string[];
}

export interface UserSubscription {
  id: string;
  user_id: string;
  tier_id: string;
  status: string;
  payment_provider: string;
  provider_subscription_id: string | null;
  provider_customer_id: string | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  billing_interval: string;
}

export interface PaymentProviderConfig {
  id: string;
  provider: string;
  is_enabled: boolean;
  is_live_mode: boolean;
  config: Record<string, unknown>;
}

export function useSubscription() {
  const { user } = useAuth();
  const [subscription, setSubscription] = useState<UserSubscription | null>(null);
  const [currentTier, setCurrentTier] = useState<SubscriptionTier | null>(null);
  const [tiers, setTiers] = useState<SubscriptionTier[]>([]);
  const [activeProvider, setActiveProvider] = useState<PaymentProviderConfig | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, [user]);

  const loadData = async () => {
    try {
      setLoading(true);

      // Load tiers
      const { data: tiersData } = await supabase
        .from('subscription_tiers')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      const parsedTiers = (tiersData || []).map(t => ({
        ...t,
        features: Array.isArray(t.features) ? t.features as string[] : [],
      }));
      setTiers(parsedTiers);

      // Load active payment provider
      const { data: providerData } = await supabase
        .from('payment_provider_config')
        .select('*')
        .eq('is_enabled', true)
        .limit(1)
        .single();

      setActiveProvider(providerData as PaymentProviderConfig | null);

      // Load user subscription
      if (user) {
        const { data: subData } = await supabase
          .from('user_subscriptions')
          .select('*')
          .eq('user_id', user.id)
          .single();

        if (subData) {
          setSubscription(subData as unknown as UserSubscription);
          const tier = parsedTiers.find(t => t.id === subData.tier_id);
          setCurrentTier(tier || null);
        }
      }
    } catch (error) {
      console.error('Error loading subscription data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Pricing hidden — all features unlocked for free.
  // Original gating logic preserved below for future re-enablement.
  const canAccess = (_feature: 'analytics' | 'api' | 'white_label' | 'priority_support'): boolean => {
    return true;
  };

  const isWithinLimit = (_resource: 'products' | 'categories', _count: number): boolean => {
    return true;
  };

  return {
    subscription,
    currentTier,
    tiers,
    activeProvider,
    loading,
    canAccess,
    isWithinLimit,
    refresh: loadData,
  };
}
