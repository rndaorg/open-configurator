import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { SearchBar } from './SearchBar';
import { SearchFilters } from './SearchFilters';
import { ProductCard } from './ProductCard';
import { useSearch } from '@/hooks/useSearch';
import { useTranslation } from 'react-i18next';
import { Loader2, Package } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface ProductSearchProps {
  onConfigureProduct: (productId: string) => void;
}

export function ProductSearch({ onConfigureProduct }: ProductSearchProps) {
  const { t } = useTranslation();
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);

  const {
    query,
    setQuery,
    filters,
    updateFilter,
    resetFilters,
    toggleCategory,
    searchResults,
    suggestions,
    isLoading,
    trackProductClick,
    facets,
  } = useSearch();

  const handleSuggestionClick = (suggestion: { type: 'product' | 'category'; text: string; id: string }) => {
    if (suggestion.type === 'product') {
      setQuery(suggestion.text);
    } else {
      toggleCategory(suggestion.id);
    }
  };

  const handleConfigureClick = (productId: string) => {
    trackProductClick(productId);
    onConfigureProduct(productId);
  };

  const hasActiveFilters =
    filters.categoryIds.length > 0 ||
    filters.minPrice !== null ||
    filters.maxPrice !== null ||
    filters.sortBy !== 'relevance';

  const activeFilterCount =
    filters.categoryIds.length +
    (filters.minPrice !== null || filters.maxPrice !== null ? 1 : 0) +
    (filters.sortBy !== 'relevance' ? 1 : 0);

  if (isLoading) {
    return (
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">{t('common.loading', 'Loading...')}</p>
            </div>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 px-6 bg-gradient-to-b from-background to-muted/5">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4 animate-slide-up">
          <h2 className="text-4xl md:text-5xl font-bold">
            {t('search.title', 'Discover')}
            <span className="block bg-gradient-accent bg-clip-text text-transparent">
              {t('search.subtitle', 'Our Products')}
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            {t('search.description', 'Search and filter to find exactly what you need')}
          </p>
        </div>

        {/* Search Bar */}
        <div className="animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <SearchBar
            query={query}
            onQueryChange={setQuery}
            suggestions={suggestions}
            onSuggestionClick={handleSuggestionClick}
            onClear={() => setQuery('')}
            isOpen={false}
            onOpenChange={() => {}}
          />
        </div>

        {/* Mobile Filter Toggle */}
        <div className="lg:hidden flex justify-center">
          <Sheet open={mobileFiltersOpen} onOpenChange={setMobileFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2">
                <SlidersHorizontal className="h-4 w-4" />
                {t('search.filters', 'Filters')}
                {activeFilterCount > 0 && (
                  <Badge variant="secondary" className="ms-1">
                    {activeFilterCount}
                  </Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-[300px] sm:w-[400px]">
              <SheetHeader>
                <SheetTitle>{t('search.filters', 'Filters')}</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <SearchFilters
                  filters={filters}
                  facets={facets}
                  onUpdateFilter={updateFilter}
                  onToggleCategory={toggleCategory}
                  onResetFilters={resetFilters}
                  totalResults={searchResults.totalCount}
                />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        {/* Main Content */}
        <div className="flex gap-8">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-72 shrink-0">
            <div className="sticky top-24 bg-card rounded-xl border border-border p-6">
              <SearchFilters
                filters={filters}
                facets={facets}
                onUpdateFilter={updateFilter}
                onToggleCategory={toggleCategory}
                onResetFilters={resetFilters}
                totalResults={searchResults.totalCount}
              />
            </div>
          </aside>

          {/* Products Grid */}
          <div className="flex-1">
            {searchResults.products.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {searchResults.products.map((product, index) => (
                  <div
                    key={product.id}
                    style={{ animationDelay: `${index * 0.05}s` }}
                    className="animate-slide-up"
                  >
                    <ProductCard product={product} onConfigure={handleConfigureClick} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-20">
                <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-2xl font-bold text-muted-foreground mb-2">
                  {t('search.noResults', 'No products found')}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {query
                    ? t('search.noResultsQuery', 'No results for "{{query}}"', { query })
                    : t('search.noResultsFilters', 'Try adjusting your filters')}
                </p>
                {hasActiveFilters && (
                  <Button variant="outline" onClick={resetFilters}>
                    <X className="h-4 w-4 me-2" />
                    {t('search.clearFilters', 'Clear Filters')}
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
