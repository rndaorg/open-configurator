import { useState, useRef, useEffect } from 'react';
import { Search, X, TrendingUp, Package, FolderOpen } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { usePopularSearches } from '@/hooks/useSearch';
import { useTranslation } from 'react-i18next';
import { cn } from '@/lib/utils';

interface Suggestion {
  type: 'product' | 'category';
  text: string;
  id: string;
}

interface SearchBarProps {
  query: string;
  onQueryChange: (query: string) => void;
  suggestions: Suggestion[];
  onSuggestionClick: (suggestion: Suggestion) => void;
  onClear: () => void;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  placeholder?: string;
}

export function SearchBar({
  query,
  onQueryChange,
  suggestions,
  onSuggestionClick,
  onClear,
  isOpen,
  onOpenChange,
  placeholder,
}: SearchBarProps) {
  const { t } = useTranslation();
  const [isFocused, setIsFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: popularSearches = [] } = usePopularSearches();

  const showDropdown = isFocused && (query.length >= 2 || popularSearches.length > 0);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsFocused(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      setIsFocused(false);
      inputRef.current?.blur();
    }
  };

  return (
    <div ref={containerRef} className="relative w-full max-w-2xl mx-auto">
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => onQueryChange(e.target.value)}
          onFocus={() => setIsFocused(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder || t('search.placeholder', 'Search products...')}
          className="ps-10 pe-10 h-12 text-base bg-background/80 backdrop-blur-sm border-border/50 focus:border-primary/50 transition-all"
        />
        {query && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute end-1 top-1/2 -translate-y-1/2 h-8 w-8"
            onClick={() => {
              onClear();
              inputRef.current?.focus();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Dropdown */}
      {showDropdown && (
        <div className="absolute top-full mt-2 w-full bg-popover border border-border rounded-lg shadow-xl z-50 overflow-hidden animate-in fade-in-0 slide-in-from-top-2">
          {/* Suggestions */}
          {query.length >= 2 && suggestions.length > 0 && (
            <div className="p-2 border-b border-border">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1">
                {t('search.suggestions', 'Suggestions')}
              </p>
              <ul>
                {suggestions.map((suggestion) => (
                  <li key={`${suggestion.type}-${suggestion.id}`}>
                    <button
                      className="w-full flex items-center gap-3 px-3 py-2 text-start hover:bg-accent rounded-md transition-colors"
                      onClick={() => {
                        onSuggestionClick(suggestion);
                        setIsFocused(false);
                      }}
                    >
                      {suggestion.type === 'product' ? (
                        <Package className="h-4 w-4 text-muted-foreground shrink-0" />
                      ) : (
                        <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="truncate">{suggestion.text}</span>
                      <Badge variant="secondary" className="ms-auto text-xs">
                        {suggestion.type === 'product' ? t('search.product', 'Product') : t('search.category', 'Category')}
                      </Badge>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Popular searches */}
          {query.length < 2 && popularSearches.length > 0 && (
            <div className="p-2">
              <p className="text-xs font-medium text-muted-foreground px-2 py-1 flex items-center gap-1">
                <TrendingUp className="h-3 w-3" />
                {t('search.popularSearches', 'Popular Searches')}
              </p>
              <ul>
                {popularSearches.map((search) => (
                  <li key={search.query}>
                    <button
                      className="w-full flex items-center gap-3 px-3 py-2 text-start hover:bg-accent rounded-md transition-colors"
                      onClick={() => {
                        onQueryChange(search.query);
                        setIsFocused(false);
                      }}
                    >
                      <Search className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="truncate">{search.query}</span>
                      <span className="ms-auto text-xs text-muted-foreground">
                        {search.count} {t('search.searches', 'searches')}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* No results hint */}
          {query.length >= 2 && suggestions.length === 0 && (
            <div className="p-4 text-center text-muted-foreground">
              <p className="text-sm">{t('search.noSuggestions', 'No suggestions found')}</p>
              <p className="text-xs mt-1">{t('search.tryDifferentTerms', 'Try different search terms')}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
