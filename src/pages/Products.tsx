import { useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { ProductSearch } from '@/components/ProductSearch';
import { ProductConfigurator } from '@/components/ProductConfigurator';
import { Footer } from '@/components/Footer';
import { SEO } from '@/components/SEO';

const Products = () => {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  
  const handleConfigureProduct = (productId: string) => {
    setSelectedProductId(productId);
  };
  
  const handleBackToCatalog = () => {
    setSelectedProductId(null);
  };
  
  if (selectedProductId) {
    return (
      <div className="min-h-screen bg-background">
        <Navigation />
        <ProductConfigurator
          productId={selectedProductId}
          onBack={handleBackToCatalog}
        />
      </div>
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Products — Open Configurator"
        description="Browse and configure customizable products. Pick options, see live pricing, and build exactly what you need."
        path="/products"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Open Configurator Products',
          url: 'https://open-configurator.lovable.app/products',
        }}
      />
      <Navigation />
      <ProductSearch onConfigureProduct={handleConfigureProduct} />
      <Footer />
    </div>
  );
};

export default Products;