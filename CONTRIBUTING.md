# Contributing to ConfigureMax

We love your input! We want to make contributing to ConfigureMax as easy and transparent as possible, whether it's:

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
configuremax/
├── src/
│   ├── components/          # React components
│   │   ├── ui/             # Reusable UI components (shadcn/ui)
│   │   └── ...             # Feature-specific components
│   ├── hooks/              # Custom React hooks
│   ├── pages/              # Route components
│   ├── lib/                # Utility functions
│   └── integrations/       # External service integrations
├── supabase/
│   ├── migrations/         # Database migrations
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
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface ProductCardProps {
  product: Product;
  onSelect: (id: string) => void;
}

export const ProductCard = ({ product, onSelect }: ProductCardProps) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleSelect = async () => {
    setIsLoading(true);
    try {
      await onSelect(product.id);
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
      />
      <div className="p-6 space-y-4">
        <h3 className="text-xl font-semibold">{product.name}</h3>
        <p className="text-muted-foreground">{product.description}</p>
        <Button 
          onClick={handleSelect}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? 'Loading...' : 'Configure Product'}
        </Button>
      </div>
    </Card>
  );
};
```

## Database Conventions

### Tables
- Use snake_case for table and column names
- Include `id`, `created_at`, `updated_at` on all tables
- Use UUIDs for primary keys
- Enable Row Level Security (RLS) on all tables

### Migrations
- Create descriptive migration names
- Include both up and down migrations
- Test migrations on sample data
- Document any breaking changes

### Example Migration
```sql
-- Add new feature configuration table
CREATE TABLE IF NOT EXISTS public.feature_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  product_id UUID REFERENCES public.products(id) ON DELETE CASCADE,
  feature_name TEXT NOT NULL,
  is_enabled BOOLEAN NOT NULL DEFAULT false,
  configuration JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.feature_configs ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Feature configs are viewable by everyone" 
  ON public.feature_configs FOR SELECT 
  USING (true);

-- Add indexes for performance
CREATE INDEX idx_feature_configs_product_id ON public.feature_configs(product_id);
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
4. Update the configurator logic
5. Add tests
6. Update documentation

### Adding New Product Categories

1. Create database entries for the new category
2. Add appropriate sample products
3. Update any category-specific UI logic
4. Test the full user flow

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

Thank you for contributing to ConfigureMax! 🚀