import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Zap,
  Palette,
  ShoppingCart,
  BarChart3,
  Shield,
  Bot,
  Boxes,
  Sparkles,
  Workflow,
  Globe,
  Mail,
  Boxes as PackageIcon,
} from 'lucide-react';

interface Feature {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  badge?: string;
}

const features: Feature[] = [
  {
    icon: Bot,
    title: 'Multi-Agent Orchestration',
    description:
      'A master agent coordinates Customer, Pricing, Inventory, and Rules sub-agents with full execution traces.',
    badge: 'Agentic AI',
  },
  {
    icon: Sparkles,
    title: 'AI Configurator Chat',
    description:
      'Natural-language configuration powered by the Lovable AI Gateway with tool calling and live validation.',
    badge: 'New',
  },
  {
    icon: Workflow,
    title: 'AI Sales Copilot',
    description:
      'Internal dashboard that analyzes configurations, suggests upsells, drafts quotes, and writes follow-up emails.',
    badge: 'New',
  },
  {
    icon: Palette,
    title: '3D Visual Configurator',
    description:
      'Three.js-powered real-time previews, rule-driven option visibility, and compare-and-share flows.',
  },
  {
    icon: Zap,
    title: 'Server-side Rules & Pricing',
    description:
      'Deterministic rule engine and dynamic pricing evaluated in Edge Functions — never trust the client.',
  },
  {
    icon: ShoppingCart,
    title: 'Full Commerce Stack',
    description:
      'Cart, multi-step checkout, Stripe payments, subscriptions, orders, wishlist, and reviews — built in.',
  },
  {
    icon: PackageIcon,
    title: 'Advanced Inventory OS',
    description:
      'Multi-warehouse stock, suppliers, batches, demand forecasting, and automated reorder suggestions.',
  },
  {
    icon: Mail,
    title: 'Marketing Engine',
    description:
      'SendGrid transactional + promotional sends, drip campaigns, cart recovery, and per-category preferences.',
  },
  {
    icon: BarChart3,
    title: 'Reports & BI',
    description:
      'Sales analytics, conversion funnel, customer insights, A/B testing, and scheduled exports.',
  },
  {
    icon: Globe,
    title: 'Global by Default',
    description:
      '5 languages including RTL Arabic, 9 currencies, locale-aware formatting, and persistent preferences.',
  },
  {
    icon: Shield,
    title: 'Enterprise Security',
    description:
      'Supabase Auth, RBAC via user_roles, RLS on every table, and Zod-validated Edge Function inputs.',
  },
  {
    icon: Boxes,
    title: 'OS-grade Extensibility',
    description:
      'Edge Functions, CRM integration, demo-mode fallbacks, and a roadmap toward multi-tenant + plugin marketplace.',
    badge: 'Roadmap',
  },
];

export const FeaturesSection = () => {
  return (
    <section className="py-20 px-6 bg-gradient-to-b from-background to-muted/5">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center space-y-4 mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-glass backdrop-blur-xl rounded-full border border-white/10">
            <Sparkles className="w-4 h-4 text-primary-glow" />
            <span className="text-sm text-primary-glow font-medium">
              An Operating System for Configurable Commerce
            </span>
          </div>

          <h2 className="text-4xl md:text-5xl font-bold">
            Configurator, Commerce & AI Agents
            <span className="block bg-gradient-primary bg-clip-text text-transparent">
              In One Platform
            </span>
          </h2>

          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Open Configurator combines a 3D product configurator with a full commerce backend
            and a fleet of AI agents — so teams can design, price, sell, and operate custom
            products without stitching ten tools together.
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
            <h3 className="text-2xl font-bold">Ready to ship configurable commerce?</h3>
            <p className="text-muted-foreground">
              Deploy a configurator, storefront, and AI ops layer in days — not quarters.
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
                    Hosted agents, AI gateway, analytics & integrations
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
