import { Navigation } from '@/components/Navigation';
import { FeaturesSection } from '@/components/FeaturesSection';
import { Footer } from '@/components/Footer';
import { SEO } from '@/components/SEO';

const Features = () => {
  return (
    <div className="min-h-screen bg-background">
      <SEO
        title="Features — Open Configurator"
        description="Real-time configuration, visual customization, analytics, and enterprise-ready infrastructure. Everything you need to build and sell custom products."
        path="/features"
      />
      <Navigation />
      <FeaturesSection />
      <Footer />
    </div>
  );
};

export default Features;