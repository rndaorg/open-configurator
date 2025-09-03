import { Product } from '@/hooks/useProducts';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Settings } from 'lucide-react';

interface ProductCardProps {
  product: Product;
  onConfigure: (productId: string) => void;
}

export const ProductCard = ({ product, onConfigure }: ProductCardProps) => {
  return (
    <Card className="glass-card overflow-hidden group hover:glow-primary transition-all duration-500 animate-slide-up">
      <div className="aspect-square overflow-hidden">
        <img
          src={product.image_url || '/placeholder.svg'}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
        />
      </div>
      
      <div className="p-6 space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-foreground group-hover:text-primary-glow transition-colors">
              {product.name}
            </h3>
            {product.categories && (
              <Badge variant="secondary" className="text-xs">
                {product.categories.name}
              </Badge>
            )}
          </div>
          
          <p className="text-muted-foreground text-sm line-clamp-2">
            {product.description}
          </p>
        </div>
        
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">Starting at</p>
            <p className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
              ${product.base_price.toLocaleString()}
            </p>
          </div>
          
          <Button
            onClick={() => onConfigure(product.id)}
            className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
            size="sm"
          >
            <Settings className="w-4 h-4 mr-2" />
            Configure
          </Button>
        </div>
      </div>
    </Card>
  );
};