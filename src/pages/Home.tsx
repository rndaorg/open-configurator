import { HeroSection } from '@/components/HeroSection';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { SEO } from '@/components/SEO';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();

  const handleExploreProducts = () => {
    navigate('/products');
  };

  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Open Configurator — Build Your Perfect Product"
        description="Configure custom products in real time with Open Configurator, an open-source visual product builder for bikes, generators, and more."
        path="/"
        jsonLd={{
          '@context': 'https://schema.org',
          '@type': 'WebSite',
          name: 'Open Configurator',
          url: 'https://open-configurator.lovable.app',
          potentialAction: {
            '@type': 'SearchAction',
            target: 'https://open-configurator.lovable.app/products?q={search_term_string}',
            'query-input': 'required name=search_term_string',
          },
        }}
      />
      <Navigation />
      <HeroSection onExploreProducts={handleExploreProducts} />
      <Footer />
    </div>
  );
};

export default Home;