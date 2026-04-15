import { Filter, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SearchFilters as SearchFiltersType, SearchFacets } from '@/hooks/useSearch';
import { useLocale } from '@/contexts/LocaleContext';
import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { cn } from '@/lib/utils';

interface SearchFiltersProps {
  filters: SearchFiltersType;
  facets: SearchFacets;
  onUpdateFilter: <K extends keyof SearchFiltersType>(key: K, value: SearchFiltersType[K]) => void;
  onToggleCategory: (categoryId: string) => void;
  onResetFilters: () => void;
  totalResults: number;
}

export function SearchFilters({
  filters,
  facets,
  onUpdateFilter,
  onToggleCategory,
  onResetFilters,
  totalResults,
}: SearchFiltersProps) {
  const { t } = useTranslation();
  const { formatCurrency } = useLocale();
  const [categoriesOpen, setCategoriesOpen] = useState(true);
  const [priceOpen, setPriceOpen] = useState(true);

  const hasActiveFilters =
    filters.categoryIds.length > 0 ||
    filters.minPrice !== null ||
    filters.maxPrice !== null ||
    filters.sortBy !== 'relevance';

  const priceRange = [
    filters.minPrice ?? facets.priceRange.min,
    filters.maxPrice ?? facets.priceRange.max,
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <h3 className="font-semibold">{t('search.filters', 'Filters')}</h3>
        </div>
        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={onResetFilters} className="text-xs">
            <X className="h-3 w-3 me-1" />
            {t('search.clearAll', 'Clear all')}
          </Button>
        )}
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {t('search.resultsCount', '{{count}} products found', { count: totalResults })}
      </p>

      {/* Sort */}
      <div className="space-y-2">
        <label className="text-sm font-medium">{t('search.sortBy', 'Sort by')}</label>
        <Select
          value={filters.sortBy}
          onValueChange={(value) => onUpdateFilter('sortBy', value as SearchFiltersType['sortBy'])}
        >
          <SelectTrigger className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="relevance">{t('search.sort.relevance', 'Relevance')}</SelectItem>
            <SelectItem value="price_asc">{t('search.sort.priceAsc', 'Price: Low to High')}</SelectItem>
            <SelectItem value="price_desc">{t('search.sort.priceDesc', 'Price: High to Low')}</SelectItem>
            <SelectItem value="name_asc">{t('search.sort.nameAsc', 'Name: A to Z')}</SelectItem>
            <SelectItem value="name_desc">{t('search.sort.nameDesc', 'Name: Z to A')}</SelectItem>
            <SelectItem value="newest">{t('search.sort.newest', 'Newest First')}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Categories */}
      <Collapsible open={categoriesOpen} onOpenChange={setCategoriesOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:text-primary transition-colors">
          <span>{t('search.categories', 'Categories')}</span>
          {categoriesOpen ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-2 pt-2">
          {facets.categories.map((category) => (
            <label
              key={category.id}
              className="flex items-center gap-3 cursor-pointer py-1 hover:text-primary transition-colors"
            >
              <Checkbox
                checked={filters.categoryIds.includes(category.id)}
                onCheckedChange={() => onToggleCategory(category.id)}
              />
              <span className="flex-1 text-sm">{category.name}</span>
              <Badge variant="secondary" className="text-xs">
                {category.count}
              </Badge>
            </label>
          ))}
          {facets.categories.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('search.noCategories', 'No categories')}</p>
          )}
        </CollapsibleContent>
      </Collapsible>

      {/* Price Range */}
      <Collapsible open={priceOpen} onOpenChange={setPriceOpen}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 text-sm font-medium hover:text-primary transition-colors">
          <span>{t('search.priceRange', 'Price Range')}</span>
          {priceOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="space-y-4 pt-4">
          <div className="px-1">
            <Slider
              value={priceRange}
              min={facets.priceRange.min}
              max={facets.priceRange.max}
              step={10}
              onValueChange={([min, max]) => {
                onUpdateFilter('minPrice', min === facets.priceRange.min ? null : min);
                onUpdateFilter('maxPrice', max === facets.priceRange.max ? null : max);
              }}
              className="w-full"
            />
          </div>
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>{formatCurrency(priceRange[0])}</span>
            <span>{formatCurrency(priceRange[1])}</span>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {/* Active filters summary */}
      {hasActiveFilters && (
        <div className="pt-4 border-t border-border space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase">
            {t('search.activeFilters', 'Active Filters')}
          </p>
          <div className="flex flex-wrap gap-2">
            {filters.categoryIds.map((catId) => {
              const cat = facets.categories.find((c) => c.id === catId);
              return cat ? (
                <Badge key={catId} variant="secondary" className="gap-1">
                  {cat.name}
                  <button onClick={() => onToggleCategory(catId)} className="hover:text-destructive">
                    <X className="h-3 w-3" />
                  </button>
                </Badge>
              ) : null;
            })}
            {(filters.minPrice !== null || filters.maxPrice !== null) && (
              <Badge variant="secondary" className="gap-1">
                {formatCurrency(filters.minPrice ?? facets.priceRange.min)} -{' '}
                {formatCurrency(filters.maxPrice ?? facets.priceRange.max)}
                <button
                  onClick={() => {
                    onUpdateFilter('minPrice', null);
                    onUpdateFilter('maxPrice', null);
                  }}
                  className="hover:text-destructive"
                >
                  <X className="h-3 w-3" />
                </button>
              </Badge>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
