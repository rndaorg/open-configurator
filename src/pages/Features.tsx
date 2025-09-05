import { Navigation } from '@/components/Navigation';
import { FeaturesSection } from '@/components/FeaturesSection';
import { Footer } from '@/components/Footer';

const Features = () => {
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <FeaturesSection />
      <Footer />
    </div>
  );
};

export default Features;