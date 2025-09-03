import { Button } from '@/components/ui/button';
import { ArrowRight, Sparkles } from 'lucide-react';

interface HeroSectionProps {
  onExploreProducts: () => void;
}

export const HeroSection = ({ onExploreProducts }: HeroSectionProps) => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Animated background */}
      <div className="absolute inset-0 bg-gradient-to-br from-background via-background to-primary/5" />
      
      {/* Floating elements */}
      <div className="absolute top-1/4 left-1/4 w-32 h-32 bg-gradient-primary rounded-full opacity-20 animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-24 h-24 bg-gradient-accent rounded-full opacity-30 animate-float" style={{ animationDelay: '2s' }} />
      <div className="absolute top-1/3 right-1/3 w-16 h-16 bg-primary/30 rounded-full animate-float" style={{ animationDelay: '4s' }} />
      
      <div className="relative z-10 text-center max-w-4xl mx-auto px-6">
        <div className="space-y-8 animate-slide-up">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-glass backdrop-blur-xl rounded-full border border-white/10">
            <Sparkles className="w-4 h-4 text-primary-glow" />
            <span className="text-sm text-primary-glow font-medium">Custom Product Configurator</span>
          </div>
          
          <div className="space-y-6">
            <h1 className="text-6xl md:text-8xl font-bold leading-tight">
              Build Your
              <span className="block bg-gradient-primary bg-clip-text text-transparent">
                Perfect Product
              </span>
            </h1>
            
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Configure, customize, and create exactly what you need with our 
              intuitive product builder. From bicycles to generators, make it yours.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              onClick={onExploreProducts}
              size="lg"
              className="bg-gradient-primary hover:shadow-glow transition-all duration-300 text-lg px-8 py-4"
            >
              Explore Products
              <ArrowRight className="w-5 h-5 ml-2" />
            </Button>
            
            <Button
              variant="outline"
              size="lg"
              className="border-primary/20 hover:border-primary/40 hover:bg-gradient-glass backdrop-blur-xl text-lg px-8 py-4"
            >
              Watch Demo
            </Button>
          </div>
        </div>
      </div>
      
      {/* Glow effects */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/20 rounded-full blur-3xl opacity-50" />
      <div className="absolute bottom-0 right-0 w-64 h-64 bg-accent/20 rounded-full blur-3xl opacity-30" />
    </section>
  );
};