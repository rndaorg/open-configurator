import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ProductReview {
  id: string;
  user_id: string;
  product_id: string;
  configuration_id: string | null;
  order_id: string | null;
  rating: number;
  title: string | null;
  content: string | null;
  status: 'pending' | 'approved' | 'rejected';
  is_verified_purchase: boolean;
  helpful_count: number;
  admin_notes: string | null;
  created_at: string;
  updated_at: string;
  reviewer_name?: string | null;
}

export interface RatingSummary {
  product_id: string;
  review_count: number;
  average_rating: number;
}

export function useProductReviews(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-reviews', productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('product_id', productId!)
        .eq('status', 'approved')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as ProductReview[];
    },
  });
}

export function useProductRatingSummary(productId: string | undefined) {
  return useQuery({
    queryKey: ['product-rating-summary', productId],
    enabled: !!productId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('product_rating_summary')
        .select('*')
        .eq('product_id', productId!)
        .maybeSingle();
      if (error) throw error;
      return (data as RatingSummary | null) ?? { product_id: productId!, review_count: 0, average_rating: 0 };
    },
  });
}

export function useAllRatingSummaries() {
  return useQuery({
    queryKey: ['rating-summaries'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('product_rating_summary')
        .select('*');
      if (error) throw error;
      const map: Record<string, RatingSummary> = {};
      (data ?? []).forEach((r: RatingSummary) => { map[r.product_id] = r; });
      return map;
    },
    staleTime: 60_000,
  });
}

export function useMyReview(productId: string | undefined, userId: string | undefined) {
  return useQuery({
    queryKey: ['my-review', productId, userId],
    enabled: !!productId && !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_reviews')
        .select('*')
        .eq('product_id', productId!)
        .eq('user_id', userId!)
        .maybeSingle();
      if (error) throw error;
      return data as ProductReview | null;
    },
  });
}

export function useSubmitReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      product_id: string;
      rating: number;
      title?: string;
      content?: string;
      configuration_id?: string | null;
    }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be signed in to leave a review');
      const { data, error } = await supabase
        .from('product_reviews')
        .upsert({
          user_id: user.id,
          product_id: input.product_id,
          rating: input.rating,
          title: input.title ?? null,
          content: input.content ?? null,
          configuration_id: input.configuration_id ?? null,
          status: 'pending',
        }, { onConflict: 'user_id,product_id' })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, vars) => {
      toast.success('Review submitted! It will appear once approved.');
      qc.invalidateQueries({ queryKey: ['my-review', vars.product_id] });
      qc.invalidateQueries({ queryKey: ['product-reviews', vars.product_id] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed to submit review'),
  });
}

// Admin
export function useAdminReviews(status?: 'pending' | 'approved' | 'rejected' | 'all') {
  return useQuery({
    queryKey: ['admin-reviews', status],
    queryFn: async () => {
      let q = supabase.from('product_reviews').select('*').order('created_at', { ascending: false });
      if (status && status !== 'all') q = q.eq('status', status);
      const { data, error } = await q;
      if (error) throw error;
      const reviews = (data ?? []) as any[];
      const productIds = Array.from(new Set(reviews.map((r) => r.product_id)));
      if (productIds.length === 0) return reviews;
      const { data: products } = await supabase.from('products').select('id, name').in('id', productIds);
      const map = new Map((products ?? []).map((p: any) => [p.id, p.name]));
      return reviews.map((r) => ({ ...r, products: { name: map.get(r.product_id) ?? 'Unknown' } }));
    },
  });
}

export function useModerateReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status, admin_notes }: { id: string; status: 'approved' | 'rejected' | 'pending'; admin_notes?: string }) => {
      const { error } = await supabase
        .from('product_reviews')
        .update({ status, admin_notes: admin_notes ?? null })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Review updated');
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
      qc.invalidateQueries({ queryKey: ['product-reviews'] });
      qc.invalidateQueries({ queryKey: ['rating-summaries'] });
    },
    onError: (e: any) => toast.error(e.message ?? 'Failed'),
  });
}

export function useDeleteReview() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('product_reviews').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Review deleted');
      qc.invalidateQueries({ queryKey: ['admin-reviews'] });
      qc.invalidateQueries({ queryKey: ['product-reviews'] });
    },
  });
}
