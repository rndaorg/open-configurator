import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface Category {
  id: string;
  name: string;
  description: string | null;
  image_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Product {
  id: string;
  category_id: string | null;
  name: string;
  description: string | null;
  base_price: number;
  image_url: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  categories?: Category;
}

export interface ConfigOption {
  id: string;
  product_id: string;
  name: string;
  option_type: 'color' | 'size' | 'accessory' | 'feature' | 'material';
  is_required: boolean;
  display_order: number;
  created_at: string;
}

export interface OptionValue {
  id: string;
  config_option_id: string;
  name: string;
  price_modifier: number;
  image_url: string | null;
  hex_color: string | null;
  is_available: boolean;
  display_order: number;
  created_at: string;
}

export const useCategories = (tenantId?: string | null) => {
  return useQuery({
    queryKey: ['categories', tenantId],
    queryFn: async () => {
      let query = supabase.from('categories').select('*').order('name');
      if (tenantId) query = query.eq('tenant_id', tenantId);

      const { data, error } = await query;

      if (error) throw error;
      return data as Category[];
    }
  });
};

export const useProducts = (categoryId?: string, tenantId?: string | null) => {
  return useQuery({
    queryKey: ['products', categoryId, tenantId],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select(`
          *,
          categories(*)
        `)
        .eq('is_active', true)
        .order('name');
      
      if (categoryId) {
        query = query.eq('category_id', categoryId);
      }
      if (tenantId) {
        query = query.eq('tenant_id', tenantId);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data as Product[];
    }
  });
};

export const useProductById = (productId: string) => {
  return useQuery({
    queryKey: ['product', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`
          *,
          categories(*),
          config_options(
            *,
            option_values(*)
          )
        `)
        .eq('id', productId)
        .single();
      
      if (error) throw error;
      return data;
    },
    enabled: !!productId
  });
};