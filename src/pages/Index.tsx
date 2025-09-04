import { useState, useRef } from 'react';
import { HeroSection } from '@/components/HeroSection';
import { ProductCatalog } from '@/components/ProductCatalog';
import { ProductConfigurator } from '@/components/ProductConfigurator';
import { FeaturesSection } from '@/components/FeaturesSection';
import { Footer } from '@/components/Footer';

const Index = () => {
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const catalogRef = useRef<HTMLDivElement>(null);
  
  const handleExploreProducts = () => {
    catalogRef.current?.scrollIntoView({ behavior: 'smooth' });
  };
  
  const handleConfigureProduct = (productId: string) => {
    setSelectedProductId(productId);
  };
  
  const handleBackToCatalog = () => {
    setSelectedProductId(null);
  };
  
  if (selectedProductId) {
    return (
      <ProductConfigurator
        productId={selectedProductId}
        onBack={handleBackToCatalog}
      />
    );
  }
  
  return (
    <div className="min-h-screen bg-background">
      <HeroSection onExploreProducts={handleExploreProducts} />
      <FeaturesSection />
      <div ref={catalogRef}>
        <ProductCatalog onConfigureProduct={handleConfigureProduct} />
      </div>
      <Footer />
    </div>
  );
};

export default Index;
