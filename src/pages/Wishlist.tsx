import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useWishlist } from '@/hooks/useWishlist';
import { useAuth } from '@/hooks/useAuth';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Heart, Trash2, Settings, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';

const Wishlist = () => {
  const { user } = useAuth();
  const { items, loading, remove } = useWishlist();
  const navigate = useNavigate();

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <div className="max-w-2xl mx-auto px-6 py-24 text-center space-y-4">
          <Heart className="w-12 h-12 mx-auto text-muted-foreground" />
          <h1 className="text-3xl font-bold">Your wishlist</h1>
          <p className="text-muted-foreground">
            Sign in to save products and configurations for later.
          </p>
          <Button asChild>
            <Link to="/auth">Sign in</Link>
          </Button>
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <div className="max-w-7xl mx-auto px-6 py-12">
        <header className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold">My Wishlist</h1>
            <p className="text-muted-foreground mt-1">
              {items.length} {items.length === 1 ? 'item' : 'items'} saved
            </p>
          </div>
        </header>

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : items.length === 0 ? (
          <Card className="p-12 text-center space-y-4">
            <Heart className="w-12 h-12 mx-auto text-muted-foreground" />
            <h2 className="text-xl font-semibold">Nothing saved yet</h2>
            <p className="text-muted-foreground">
              Browse the catalog and tap the heart icon to save items for later.
            </p>
            <Button asChild>
              <Link to="/products">Browse products</Link>
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {items.map((item) => (
              <Card key={item.id} className="overflow-hidden group">
                <div className="aspect-square overflow-hidden bg-muted">
                  <img
                    src={item.products?.image_url || '/placeholder.svg'}
                    alt={item.products?.name ?? 'Product'}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-lg">{item.products?.name}</h3>
                    {item.configuration_id && (
                      <Badge variant="secondary" className="text-xs">Custom</Badge>
                    )}
                  </div>
                  {item.products?.description && (
                    <p className="text-sm text-muted-foreground line-clamp-2">
                      {item.products.description}
                    </p>
                  )}
                  <p className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                    ${item.products?.base_price.toLocaleString() ?? '—'}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => navigate('/products')}
                    >
                      <Settings className="w-4 h-4 mr-2" />
                      Configure
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => remove(item.id)}
                      aria-label="Remove from wishlist"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default Wishlist;
