import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Zap, 
  Palette, 
  ShoppingCart, 
  BarChart3, 
  Smartphone, 
  Shield,
  Users,
  Rocket,
  Code
} from 'lucide-react';

interface Feature {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  badge?: string;
}

const features: Feature[] = [
  {
    icon: Zap,
    title: "Real-time Configuration",
    description: "Instant price updates and visual feedback as customers build their perfect product.",
    badge: "Core Feature"
  },
  {
    icon: Palette,
    title: "Visual Customization",
    description: "Support for colors, images, and interactive product previews with smooth animations."
  },
  {
    icon: ShoppingCart,
    title: "E-commerce Ready",
    description: "Built-in cart functionality, pricing engine, and checkout integration capabilities."
  },
  {
    icon: BarChart3,
    title: "Analytics & Insights",
    description: "Track configuration completion rates, popular options, and customer preferences."
  },
  {
    icon: Smartphone,
    title: "Mobile Optimized",
    description: "Beautiful, responsive design that works perfectly on all devices and screen sizes."
  },
  {
    icon: Shield,
    title: "Enterprise Security",
    description: "Row-level security, data encryption, and compliance-ready infrastructure."
  },
  {
    icon: Users,
    title: "Multi-tenant Support",
    description: "Handle multiple product lines, brands, or client stores from a single platform."
  },
  {
    icon: Rocket,
    title: "Lightning Fast",
    description: "Optimized performance with lazy loading, caching, and CDN-ready deployment."
  },
  {
    icon: Code,
    title: "Developer Friendly",
    description: "Full API access, webhooks, custom integrations, and extensive documentation.",
    badge: "Open Source"
  }
];

export const FeaturesSection = () => {
  return (
    <section className="py-20 px-6 bg-gradient-to-b from-background to-muted/5">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-glass backdrop-blur-xl rounded-full border border-white/10">
            <Zap className="w-4 h-4 text-primary-glow" />
            <span className="text-sm text-primary-glow font-medium">Powerful Features</span>
          </div>
          
          <h2 className="text-4xl md:text-5xl font-bold">
            Everything You Need to
            <span className="block bg-gradient-primary bg-clip-text text-transparent">
              Build & Sell Custom Products
            </span>
          </h2>
          
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Open Configurator provides all the tools you need to create stunning product configurators 
            that convert browsers into buyers.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {features.map((feature, index) => (
            <Card
              key={feature.title}
              className="glass-card p-6 hover:shadow-glow transition-all duration-300 group"
              style={{ animationDelay: `${index * 0.1}s` }}
            >
              <div className="space-y-4">
                {/* Icon & Badge */}
                <div className="flex items-start justify-between">
                  <div className="w-12 h-12 bg-gradient-primary rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                    <feature.icon className="w-6 h-6 text-white" />
                  </div>
                  {feature.badge && (
                    <Badge variant="secondary" className="text-xs">
                      {feature.badge}
                    </Badge>
                  )}
                </div>

                {/* Content */}
                <div className="space-y-2">
                  <h3 className="text-lg font-semibold group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground text-sm leading-relaxed">
                    {feature.description}
                  </p>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* CTA Section */}
        <div className="text-center mt-16 space-y-6">
          <div className="space-y-2">
            <h3 className="text-2xl font-bold">Ready to Get Started?</h3>
            <p className="text-muted-foreground">
              Deploy your product configurator in minutes, not months.
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Card className="glass-card p-6 text-center max-w-sm">
              <div className="space-y-3">
                <div className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  Free
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">Open Source</p>
                  <p className="text-sm text-muted-foreground">
                    Self-hosted, unlimited products, full source code
                  </p>
                </div>
                <div className="pt-2">
                  <button className="text-primary hover:underline text-sm font-medium">
                    Deploy Now →
                  </button>
                </div>
              </div>
            </Card>
            
            <Card className="glass-card p-6 text-center max-w-sm border-primary/50">
              <div className="space-y-3">
                <div className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  $99
                  <span className="text-lg text-muted-foreground">/mo</span>
                </div>
                <div className="space-y-1">
                  <p className="font-semibold">Managed Cloud</p>
                  <p className="text-sm text-muted-foreground">
                    Hosted, managed, support, analytics & integrations
                  </p>
                </div>
                <div className="pt-2">
                  <button className="text-primary hover:underline text-sm font-medium">
                    Start Free Trial →
                  </button>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};