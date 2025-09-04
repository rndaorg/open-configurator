import { useState } from 'react';
import { useCategories, useProducts } from '@/hooks/useProducts';
import { ProductCard } from './ProductCard';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package } from 'lucide-react';

interface ProductCatalogProps {
  onConfigureProduct: (productId: string) => void;
}

export const ProductCatalog = ({ onConfigureProduct }: ProductCatalogProps) => {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const { data: products, isLoading: productsLoading } = useProducts(selectedCategory || undefined);
  
  const isLoading = categoriesLoading || productsLoading;
  
  if (isLoading) {
    return (
      <section className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center space-y-4">
              <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
              <p className="text-muted-foreground">Loading products...</p>
            </div>
          </div>
        </div>
      </section>
    );
  }
  
  return (
    <section className="py-20 px-6 bg-gradient-to-b from-background to-muted/5">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <div className="text-center space-y-4 animate-slide-up">
          <h2 className="text-4xl md:text-5xl font-bold">
            Choose Your
            <span className="block bg-gradient-accent bg-clip-text text-transparent">
              Product Category
            </span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            Browse our collection of customizable products and start building something amazing
          </p>
        </div>
        
        {/* Category filter dropdown */}
        <div className="flex justify-center animate-slide-up">
          <div className="w-full max-w-xs">
            <Select
              value={selectedCategory || "all"}
              onValueChange={(value) => setSelectedCategory(value === "all" ? null : value)}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  All Products
                  <Badge variant="secondary" className="ml-2">
                    {products?.length || 0}
                  </Badge>
                </SelectItem>
                {categories?.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        
        {/* Products grid */}
        {products && products.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {products.map((product, index) => (
              <div
                key={product.id}
                style={{ animationDelay: `${index * 0.1}s` }}
                className="animate-slide-up"
              >
                <ProductCard
                  product={product}
                  onConfigure={onConfigureProduct}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Package className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-muted-foreground mb-2">
              No products found
            </h3>
            <p className="text-muted-foreground">
              Try selecting a different category or check back later
            </p>
          </div>
        )}
      </div>
    </section>
  );
};