import { HeroSection } from '@/components/HeroSection';
import { Navigation } from '@/components/Navigation';
import { Footer } from '@/components/Footer';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();
  
  const handleExploreProducts = () => {
    navigate('/products');
  };
  
  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      <HeroSection onExploreProducts={handleExploreProducts} />
      <Footer />
    </div>
  );
};

export default Home;