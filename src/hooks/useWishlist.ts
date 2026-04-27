import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export interface WishlistItem {
  id: string;
  user_id: string;
  product_id: string;
  configuration_id: string | null;
  configuration_data: any;
  notes: string | null;
  created_at: string;
  updated_at: string;
  products?: {
    id: string;
    name: string;
    description: string | null;
    image_url: string | null;
    base_price: number;
  } | null;
}

export function useWishlist() {
  const { user } = useAuth();
  const [items, setItems] = useState<WishlistItem[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!user) {
      setItems([]);
      return;
    }
    setLoading(true);
    const { data, error } = await supabase
      .from('wishlists')
      .select('*, products(id, name, description, image_url, base_price)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('wishlist load error', error);
    } else {
      setItems((data as any) ?? []);
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const isInWishlist = useCallback(
    (productId: string, configurationId?: string | null) =>
      items.some(
        (i) =>
          i.product_id === productId &&
          (configurationId ? i.configuration_id === configurationId : true)
      ),
    [items]
  );

  const add = useCallback(
    async (params: {
      productId: string;
      configurationId?: string | null;
      configurationData?: any;
      notes?: string;
    }) => {
      if (!user) {
        toast.error('Sign in to save to your wishlist');
        return null;
      }
      const { data, error } = await supabase
        .from('wishlists')
        .insert({
          user_id: user.id,
          product_id: params.productId,
          configuration_id: params.configurationId ?? null,
          configuration_data: params.configurationData ?? null,
          notes: params.notes ?? null,
        })
        .select('*, products(id, name, description, image_url, base_price)')
        .single();
      if (error) {
        toast.error('Could not add to wishlist');
        return null;
      }
      setItems((prev) => [data as any, ...prev]);
      toast.success('Added to wishlist');
      return data;
    },
    [user]
  );

  const remove = useCallback(async (id: string) => {
    const { error } = await supabase.from('wishlists').delete().eq('id', id);
    if (error) {
      toast.error('Could not remove item');
      return;
    }
    setItems((prev) => prev.filter((i) => i.id !== id));
    toast.success('Removed from wishlist');
  }, []);

  const updateNotes = useCallback(async (id: string, notes: string) => {
    const { error } = await supabase
      .from('wishlists')
      .update({ notes })
      .eq('id', id);
    if (error) {
      toast.error('Could not update notes');
      return;
    }
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, notes } : i)));
  }, []);

  return { items, loading, isInWishlist, add, remove, updateNotes, refresh: load };
}
