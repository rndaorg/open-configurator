import { useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Product, Category } from './useProducts';
import { useDebounce } from './useDebounce';

export interface SearchFilters {
  categoryIds: string[];
  minPrice: number | null;
  maxPrice: number | null;
  sortBy: 'relevance' | 'price_asc' | 'price_desc' | 'name_asc' | 'name_desc' | 'newest';
}

export interface SearchResult {
  products: Product[];
  totalCount: number;
  facets: SearchFacets;
}

export interface SearchFacets {
  categories: { id: string; name: string; count: number }[];
  priceRange: { min: number; max: number };
}

interface PopularSearch {
  query: string;
  count: number;
}

const defaultFilters: SearchFilters = {
  categoryIds: [],
  minPrice: null,
  maxPrice: null,
  sortBy: 'relevance',
};

// Track search analytics
async function trackSearch(
  query: string,
  resultsCount: number,
  filters: SearchFilters,
  clickedProductId?: string
) {
  try {
    const sessionId = localStorage.getItem('search_session_id') || crypto.randomUUID();
    localStorage.setItem('search_session_id', sessionId);

    // Use type assertion since the table was just created
    await (supabase.from('search_analytics') as any).insert({
      search_query: query.toLowerCase().trim(),
      results_count: resultsCount,
      filters_applied: filters,
      session_id: sessionId,
      clicked_product_id: clickedProductId || null,
    });
  } catch (error) {
    console.error('Failed to track search:', error);
  }
}

export function useSearch() {
  const [query, setQuery] = useState('');
  const [filters, setFilters] = useState<SearchFilters>(defaultFilters);
  const [isSearchOpen, setIsSearchOpen] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  // Fetch all products and categories for client-side filtering
  const { data: allProducts = [], isLoading: productsLoading } = useQuery({
    queryKey: ['all-products-search'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select(`*, categories(*)`)
        .eq('is_active', true);
      if (error) throw error;
      return data as Product[];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['categories-search'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('*').order('name');
      if (error) throw error;
      return data as Category[];
    },
  });

  // Calculate facets from all products
  const facets = useMemo<SearchFacets>(() => {
    const categoryCount: Record<string, number> = {};
    let minPrice = Infinity;
    let maxPrice = 0;

    allProducts.forEach((product) => {
      if (product.category_id) {
        categoryCount[product.category_id] = (categoryCount[product.category_id] || 0) + 1;
      }
      minPrice = Math.min(minPrice, product.base_price);
      maxPrice = Math.max(maxPrice, product.base_price);
    });

    return {
      categories: categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        count: categoryCount[cat.id] || 0,
      })),
      priceRange: {
        min: minPrice === Infinity ? 0 : minPrice,
        max: maxPrice || 1000,
      },
    };
  }, [allProducts, categories]);

  // Filter and search products
  const searchResults = useMemo<SearchResult>(() => {
    let filtered = [...allProducts];
    const searchTerms = debouncedQuery.toLowerCase().trim().split(/\s+/).filter(Boolean);

    // Text search
    if (searchTerms.length > 0) {
      filtered = filtered.filter((product) => {
        const searchableText = `${product.name} ${product.description || ''} ${product.categories?.name || ''}`.toLowerCase();
        return searchTerms.every((term) => searchableText.includes(term));
      });
    }

    // Category filter
    if (filters.categoryIds.length > 0) {
      filtered = filtered.filter(
        (product) => product.category_id && filters.categoryIds.includes(product.category_id)
      );
    }

    // Price range filter
    if (filters.minPrice !== null) {
      filtered = filtered.filter((product) => product.base_price >= filters.minPrice!);
    }
    if (filters.maxPrice !== null) {
      filtered = filtered.filter((product) => product.base_price <= filters.maxPrice!);
    }

    // Sorting
    switch (filters.sortBy) {
      case 'price_asc':
        filtered.sort((a, b) => a.base_price - b.base_price);
        break;
      case 'price_desc':
        filtered.sort((a, b) => b.base_price - a.base_price);
        break;
      case 'name_asc':
        filtered.sort((a, b) => a.name.localeCompare(b.name));
        break;
      case 'name_desc':
        filtered.sort((a, b) => b.name.localeCompare(a.name));
        break;
      case 'newest':
        filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'relevance':
      default:
        // For relevance, prioritize exact name matches
        if (searchTerms.length > 0) {
          filtered.sort((a, b) => {
            const aNameMatch = searchTerms.some((term) => a.name.toLowerCase().includes(term));
            const bNameMatch = searchTerms.some((term) => b.name.toLowerCase().includes(term));
            if (aNameMatch && !bNameMatch) return -1;
            if (!aNameMatch && bNameMatch) return 1;
            return 0;
          });
        }
        break;
    }

    return {
      products: filtered,
      totalCount: filtered.length,
      facets,
    };
  }, [allProducts, debouncedQuery, filters, facets]);

  // Track search when results change
  useEffect(() => {
    if (debouncedQuery.trim().length >= 2) {
      trackSearch(debouncedQuery, searchResults.totalCount, filters);
    }
  }, [debouncedQuery, searchResults.totalCount, filters]);

  // Get suggestions based on current query
  const suggestions = useMemo(() => {
    if (query.length < 2) return [];
    const lowerQuery = query.toLowerCase();
    
    const productSuggestions = allProducts
      .filter((p) => p.name.toLowerCase().includes(lowerQuery))
      .slice(0, 5)
      .map((p) => ({ type: 'product' as const, text: p.name, id: p.id }));

    const categorySuggestions = categories
      .filter((c) => c.name.toLowerCase().includes(lowerQuery))
      .slice(0, 3)
      .map((c) => ({ type: 'category' as const, text: c.name, id: c.id }));

    return [...productSuggestions, ...categorySuggestions];
  }, [query, allProducts, categories]);

  const updateFilter = useCallback(<K extends keyof SearchFilters>(key: K, value: SearchFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters(defaultFilters);
  }, []);

  const toggleCategory = useCallback((categoryId: string) => {
    setFilters((prev) => ({
      ...prev,
      categoryIds: prev.categoryIds.includes(categoryId)
        ? prev.categoryIds.filter((id) => id !== categoryId)
        : [...prev.categoryIds, categoryId],
    }));
  }, []);

  const trackProductClick = useCallback((productId: string) => {
    if (debouncedQuery.trim().length >= 2) {
      trackSearch(debouncedQuery, searchResults.totalCount, filters, productId);
    }
  }, [debouncedQuery, searchResults.totalCount, filters]);

  return {
    query,
    setQuery,
    filters,
    updateFilter,
    resetFilters,
    toggleCategory,
    searchResults,
    suggestions,
    isLoading: productsLoading,
    isSearchOpen,
    setIsSearchOpen,
    trackProductClick,
    facets,
  };
}

// Hook to get popular searches
export function usePopularSearches(limit = 5) {
  return useQuery({
    queryKey: ['popular-searches', limit],
    queryFn: async () => {
      // Use type assertion since the table was just created
      const { data, error } = await (supabase.from('search_analytics') as any)
        .select('search_query')
        .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Count occurrences and get top searches
      const counts: Record<string, number> = {};
      data?.forEach((item) => {
        const q = item.search_query.toLowerCase().trim();
        if (q.length >= 2) {
          counts[q] = (counts[q] || 0) + 1;
        }
      });

      const sorted: PopularSearch[] = Object.entries(counts)
        .map(([query, count]) => ({ query, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limit);

      return sorted;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}
