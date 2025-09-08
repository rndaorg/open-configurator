# Contributing to Open Configurator

We love your input! We want to make contributing to Open Configurator as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

## Pull Requests

Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Fork the repo and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed APIs, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints.
6. Issue that pull request!

## Any contributions you make will be under the MIT Software License

In short, when you submit code changes, your submissions are understood to be under the same [MIT License](http://choosealicense.com/licenses/mit/) that covers the project. Feel free to contact the maintainers if that's a concern.

## Report bugs using GitHub's [issue tracker](https://github.com/your-username/configuremax/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/your-username/configuremax/issues/new).

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Development Setup

### Prerequisites
- Node.js 18 or higher
- npm or yarn
- A Supabase account for database testing

### Setup Steps
1. Fork and clone the repository
2. Install dependencies: `npm install`
3. Copy `.env.example` to `.env` and configure your Supabase credentials
4. Run the development server: `npm run dev`
5. Open `http://localhost:5173` to view the app

### Project Structure
```
open-configurator/
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # Reusable UI components (shadcn/ui)
│   │   ├── Navigation.tsx  # Multi-page navigation
│   │   ├── ProductConfigurator.tsx  # Main configuration interface
│   │   ├── Product3DVisualization.tsx  # 3D model viewer
│   │   ├── RecommendationEngine.tsx    # AI-powered recommendations
│   │   ├── ConfigurationComparison.tsx # Side-by-side comparison
│   │   └── ...             # Other feature-specific components
│   ├── hooks/              # Custom React hooks
│   │   ├── useProducts.ts  # Product data management
│   │   └── useInventoryCheck.ts  # Real-time inventory
│   ├── services/           # Business logic engines
│   │   ├── ruleEngine.ts   # Business rule validation
│   │   ├── pricingEngine.ts # Dynamic pricing calculations
│   │   └── analyticsTracker.ts # User behavior tracking
│   ├── pages/              # Route components (Home, Features, Products)
│   ├── lib/                # Utility functions
│   └── integrations/       # External service integrations
├── supabase/
│   ├── migrations/         # Database migrations with advanced schema
│   └── config.toml        # Supabase configuration
└── docs/                  # Documentation
```

## Coding Standards

### TypeScript
- Use TypeScript for all new code
- Define proper interfaces for data structures
- Avoid `any` types - use proper typing

### React Components
- Use functional components with hooks
- Prefer composition over inheritance
- Keep components small and focused
- Use proper prop types
- Leverage the advanced engines (Rule Engine, Pricing Engine)
- Implement proper 3D rendering optimization
- Follow analytics tracking patterns

### Styling
- Use Tailwind CSS classes
- Follow the design system in `src/index.css`
- Use semantic color tokens, not hardcoded colors
- Ensure responsive design

### Code Style
- Use Prettier for formatting (configured in the project)
- Follow ESLint rules (configured in the project)
- Use meaningful variable and function names
- Add comments for complex logic

### Example Component
```tsx
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { RuleEngine } from '@/services/ruleEngine';
import { analyticsTracker } from '@/services/analyticsTracker';

interface ProductCardProps {
  product: Product;
  onSelect: (id: string) => void;
}

export const ProductCard = ({ product, onSelect }: ProductCardProps) => {
  const [isLoading, setIsLoading] = useState(false);
  const [ruleEngine] = useState(() => new RuleEngine());

  useEffect(() => {
    // Track card view
    analyticsTracker.trackProductView(product.id);
  }, [product.id]);

  const handleSelect = async () => {
    setIsLoading(true);
    try {
      // Validate product availability with rule engine
      await ruleEngine.loadRules(product.id);
      const isAvailable = await ruleEngine.validateProductAvailability(product.id);
      
      if (isAvailable) {
        analyticsTracker.trackProductSelection(product.id);
        await onSelect(product.id);
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="glass-card hover:shadow-glow transition-all duration-300">
      <img 
        src={product.image_url} 
        alt={product.name}
        className="w-full h-48 object-cover rounded-t-lg"
        loading="lazy"
      />
      <div className="p-6 space-y-4">
        <h3 className="text-xl font-semibold">{product.name}</h3>
        <p className="text-muted-foreground">{product.description}</p>
        <div className="flex items-center justify-between">
          <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            ${product.base_price.toLocaleString()}
          </span>
          <Button 
            onClick={handleSelect}
            disabled={isLoading}
            className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
          >
            {isLoading ? 'Loading...' : 'Configure Product'}
          </Button>
        </div>
      </div>
    </Card>
  );
};
```

### Database Conventions

### Tables
- Use snake_case for table and column names
- Include `id`, `created_at`, `updated_at` on all tables
- Use UUIDs for primary keys
- Enable Row Level Security (RLS) on all tables
- Include analytics tracking fields where appropriate
- Design for 3D model associations and rule definitions

### Migrations
- Create descriptive migration names
- Include both up and down migrations
- Test migrations on sample data
- Document any breaking changes
- Consider impact on rule engine and pricing engine

### Example Migration
```sql
-- Add advanced analytics table for user behavior tracking
CREATE TABLE IF NOT EXISTS public.analytics_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  session_start TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  session_end TIMESTAMP WITH TIME ZONE,
  total_interactions INTEGER NOT NULL DEFAULT 0,
  final_price DECIMAL(10,2),
  configuration_completed BOOLEAN NOT NULL DEFAULT false,
  conversion_achieved BOOLEAN NOT NULL DEFAULT false,
  session_data JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.analytics_sessions ENABLE ROW LEVEL SECURITY;

-- Create policies for analytics data
CREATE POLICY "Analytics sessions are viewable by everyone" 
  ON public.analytics_sessions FOR SELECT 
  USING (true);

CREATE POLICY "Analytics sessions can be created by everyone" 
  ON public.analytics_sessions FOR INSERT 
  WITH CHECK (true);

-- Add indexes for performance
CREATE INDEX idx_analytics_sessions_product_id ON public.analytics_sessions(product_id);
CREATE INDEX idx_analytics_sessions_date ON public.analytics_sessions(session_start);

-- Add 3D model configuration table
CREATE TABLE IF NOT EXISTS public.product_3d_models (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  model_url TEXT NOT NULL,
  model_type TEXT NOT NULL DEFAULT 'gltf',
  configuration_mappings JSONB,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.product_3d_models ENABLE ROW LEVEL SECURITY;
CREATE POLICY "3D models are viewable by everyone" 
  ON public.product_3d_models FOR SELECT 
  USING (true);
```

## Testing

### Unit Tests
- Write tests for utility functions
- Test component rendering and interactions
- Use React Testing Library for component tests

### Integration Tests
- Test API endpoints
- Test database operations
- Test user workflows

### Example Test
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductCard } from './ProductCard';

const mockProduct = {
  id: '1',
  name: 'Test Product',
  description: 'A test product',
  base_price: 100,
  image_url: '/test.jpg'
};

describe('ProductCard', () => {
  it('renders product information correctly', () => {
    const mockOnSelect = jest.fn();
    
    render(<ProductCard product={mockProduct} onSelect={mockOnSelect} />);
    
    expect(screen.getByText('Test Product')).toBeInTheDocument();
    expect(screen.getByText('A test product')).toBeInTheDocument();
  });

  it('calls onSelect when configure button is clicked', () => {
    const mockOnSelect = jest.fn();
    
    render(<ProductCard product={mockProduct} onSelect={mockOnSelect} />);
    
    fireEvent.click(screen.getByText('Configure Product'));
    
    expect(mockOnSelect).toHaveBeenCalledWith('1');
  });
});
```

## Feature Development

### Adding New Configuration Option Types

1. Update the database schema in `supabase/migrations/`
2. Update TypeScript types in `src/integrations/supabase/types.ts`
3. Add UI components for the new option type
4. Update the configurator logic and rule engine
5. Add 3D visualization support if applicable
6. Update pricing engine calculations
7. Add analytics tracking for the new option type
8. Add tests
9. Update documentation

### Adding New Advanced Engine Rules

1. Define rule logic in the appropriate engine (`ruleEngine.ts` or `pricingEngine.ts`)
2. Create database entries for rule definitions
3. Add UI for rule management (admin interface)
4. Test rule validation and application
5. Add analytics tracking for rule applications
6. Document the new rule types

### Adding New 3D Visualization Features

1. Update the `Product3DVisualization.tsx` component
2. Add new 3D model loading capabilities
3. Implement configuration-to-3D mapping logic
4. Optimize performance for new visualization features
5. Add user interaction tracking
6. Test across different devices and browsers

### Adding New Analytics Features

1. Update the `analyticsTracker.ts` service
2. Define new event types and data structures
3. Update database schema for new analytics data
4. Add visualization components for new metrics
5. Implement proper data privacy measures
6. Test analytics accuracy and performance

## Documentation

### Code Documentation
- Add JSDoc comments for complex functions
- Document API endpoints and data models
- Keep README.md up to date

### User Documentation
- Update getting started guides for new features
- Add screenshots for UI changes
- Document configuration options

## Performance Considerations

### Frontend Performance
- Lazy load images and components
- Implement proper caching strategies
- Optimize bundle sizes
- Use React.memo for expensive components

### Database Performance
- Add appropriate indexes
- Use query optimization
- Implement pagination for large datasets
- Monitor slow queries

## Security

### Frontend Security
- Validate all user inputs
- Sanitize data before display
- Use HTTPS in production
- Implement proper error handling

### Backend Security
- Use Row Level Security (RLS)
- Validate API inputs
- Implement proper authentication
- Regular security audits

## Release Process

1. Create a feature branch from `main`
2. Develop and test your changes
3. Update documentation
4. Create a pull request
5. Code review and approval
6. Merge to main
7. Deploy to staging for testing
8. Deploy to production

## Getting Help

- 📖 Read the [documentation](./docs/)
- 💬 Join our [Discord community](https://discord.gg/configuremax)
- 🐛 [Open an issue](https://github.com/your-username/configuremax/issues)
- 📧 Email us at [dev@configuremax.com](mailto:dev@configuremax.com)

## Recognition

Contributors will be recognized in:
- The project README
- Release notes for significant contributions
- Our community Discord server

Thank you for contributing to Open Configurator! 🚀