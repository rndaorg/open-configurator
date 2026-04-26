import { useState, useEffect } from 'react';
import { useAuth } from './useAuth';
import { useSubscription } from './useSubscription';
import { supabase } from '@/integrations/supabase/client';

export interface UsageMetrics {
  productsUsed: number;
  productsLimit: number;
  productsPercentage: number;
  categoriesUsed: number;
  categoriesLimit: number;
  categoriesPercentage: number;
  configurationsCount: number;
  ordersCount: number;
}

export function useUsageMetrics() {
  const { user } = useAuth();
  const { currentTier } = useSubscription();
  const [metrics, setMetrics] = useState<UsageMetrics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user && currentTier) {
      loadMetrics();
    }
  }, [user, currentTier]);

  const loadMetrics = async () => {
    if (!user || !currentTier) return;
    try {
      setLoading(true);

      const [productsRes, categoriesRes, configsRes, ordersRes] = await Promise.all([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('categories').select('id', { count: 'exact', head: true }),
        supabase.from('product_configurations').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        supabase.from('orders').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
      ]);

      const productsUsed = productsRes.count || 0;
      const categoriesUsed = categoriesRes.count || 0;
      const productsLimit = currentTier.max_products;
      const categoriesLimit = currentTier.max_categories;

      setMetrics({
        productsUsed,
        productsLimit,
        productsPercentage: productsLimit === -1 ? 0 : Math.min(100, (productsUsed / productsLimit) * 100),
        categoriesUsed,
        categoriesLimit,
        categoriesPercentage: categoriesLimit === -1 ? 0 : Math.min(100, (categoriesUsed / categoriesLimit) * 100),
        configurationsCount: configsRes.count || 0,
        ordersCount: ordersRes.count || 0,
      });
    } catch (error) {
      console.error('Error loading usage metrics:', error);
    } finally {
      setLoading(false);
    }
  };

  return { metrics, loading, refresh: loadMetrics };
}
