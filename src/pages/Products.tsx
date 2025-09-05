import { useState } from 'react';
import { Navigation } from '@/components/Navigation';
import { ProductCatalog } from '@/components/ProductCatalog';
import { ProductConfigurator } from '@/components/ProductConfigurator';
import { Footer } from '@/components/Footer';

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
      <Navigation />
      <ProductCatalog onConfigureProduct={handleConfigureProduct} />
      <Footer />
    </div>
  );
};

export default Products;