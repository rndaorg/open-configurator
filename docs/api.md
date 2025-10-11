# Open Configurator API Reference

Open Configurator uses Supabase as its backend, providing a full REST API for all product configuration operations. This document covers the available endpoints, advanced engines, and data models.

## Base URL

All API requests are made through the Supabase client:
```typescript
import { supabase } from '@/integrations/supabase/client';
```

## Advanced Engines

### Rule Engine
The rule engine provides intelligent validation and constraint management:
```typescript
import { RuleEngine } from '@/services/ruleEngine';

const ruleEngine = new RuleEngine();
await ruleEngine.loadRules(productId);
const violations = await ruleEngine.validateConfiguration(selectedOptions);
```

### Pricing Engine
Dynamic pricing with complex business rules:
```typescript
import { PricingEngine } from '@/services/pricingEngine';

const pricingEngine = new PricingEngine();
await pricingEngine.loadPricingRules(productId);
const finalPrice = await pricingEngine.calculatePrice(basePrice, selectedOptions, quantity);
```

### Analytics Tracker
Comprehensive user behavior tracking:
```typescript
import { analyticsTracker } from '@/services/analyticsTracker';

const sessionId = analyticsTracker.startSession(productId);
analyticsTracker.trackOptionSelection(productId, optionId, valueId);
analyticsTracker.trackPriceCalculation(productId, finalPrice);
```

## ⚠️ CRITICAL SECURITY WARNING

**DO NOT USE IN PRODUCTION WITHOUT ADDRESSING THESE ISSUES**

### Security Vulnerabilities

The current implementation has critical security issues:

1. **Exposed Business Logic**: `pricing_rules`, `configuration_rules`, and `inventory_levels` tables are publicly readable, exposing competitive pricing strategies and stock information.

2. **Client-Side Security**: All rule validation and pricing calculations are performed client-side and can be bypassed.

3. **No Input Validation**: Missing validation schemas for user inputs.

4. **Weak Session IDs**: Predictable session identifiers allow unauthorized access.

### Required Fixes Before Production

1. **Implement Server-Side Validation**:
   ```typescript
   // Create Supabase Edge Function
   // supabase/functions/validate-configuration/index.ts
   export const validateConfiguration = async (req: Request) => {
     const { productId, selectedOptions, quantity } = await req.json();
     
     // Server-side rule validation
     const ruleEngine = new RuleEngine();
     await ruleEngine.loadRules(productId);
     const validation = await ruleEngine.validateConfiguration(selectedOptions);
     
     if (!validation.isValid) {
       return new Response(JSON.stringify({ error: validation.violations }), {
         status: 400
       });
     }
     
     // Server-side pricing calculation
     const pricingEngine = new PricingEngine();
     const finalPrice = await pricingEngine.calculatePrice(...);
     
     return new Response(JSON.stringify({ valid: true, finalPrice }));
   };
   ```

2. **Restrict RLS Policies**:
   ```sql
   -- Make pricing rules admin-only
   DROP POLICY IF EXISTS "Pricing rules are viewable by everyone" ON pricing_rules;
   
   CREATE POLICY "Pricing rules admin only"
   ON pricing_rules FOR SELECT
   TO authenticated
   USING (auth.jwt() ->> 'role' = 'admin');
   ```

3. **Add Input Validation**:
   ```typescript
   import { z } from 'zod';
   
   const configurationSchema = z.object({
     product_id: z.string().uuid(),
     configuration_name: z.string().min(1).max(100).optional(),
     total_price: z.number().positive(),
     configuration_data: z.record(z.string().uuid(), z.string().uuid()),
     quantity: z.number().int().positive().max(1000)
   });
   ```

## Authentication

Open Configurator supports both authenticated and anonymous operations:
- **Public Operations**: Browse products, configure items (with server-side validation)
- **Admin Operations**: Manage products, pricing rules, inventory (requires authentication)
- **Note**: Currently NO authentication is implemented - this MUST be added for production

## Data Models

### Product
```typescript
interface Product {
  id: string;
  name: string;
  description?: string;
  base_price: number;
  image_url?: string;
  category_id?: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}
```

### Category
```typescript
interface Category {
  id: string;
  name: string;
  description?: string;
  image_url?: string;
  created_at: string;
  updated_at: string;
}
```

### Configuration Option
```typescript
interface ConfigOption {
  id: string;
  product_id: string;
  name: string;
  option_type: 'selection' | 'color' | 'size' | 'feature' | 'quantity';
  is_required: boolean;
  display_order: number;
  created_at: string;
}
```

### Option Value
```typescript
interface OptionValue {
  id: string;
  config_option_id: string;
  name: string;
  price_modifier: number;
  hex_color?: string;
  image_url?: string;
  is_available: boolean;
  display_order: number;
  created_at: string;
}
```

### Product Configuration
```typescript
interface ProductConfiguration {
  id: string;
  product_id: string;
  configuration_name?: string;
  total_price: number;
  configuration_data: Record<string, string>; // optionId -> valueId
  created_at: string;
  updated_at: string;
}
```

### Rule Definition
```typescript
interface RuleDefinition {
  id: string;
  product_id: string;
  rule_type: 'validation' | 'constraint' | 'dependency';
  rule_data: {
    conditions: Array<{
      option_id: string;
      operator: 'equals' | 'not_equals' | 'in' | 'not_in';
      values: string[];
    }>;
    actions: Array<{
      type: 'disable' | 'enable' | 'require' | 'price_override';
      target_option_id?: string;
      target_value_id?: string;
      data?: any;
    }>;
  };
  is_active: boolean;
  created_at: string;
}
```

### Pricing Rule
```typescript
interface PricingRule {
  id: string;
  product_id: string;
  rule_name: string;
  rule_type: 'volume_discount' | 'bundle_discount' | 'conditional_pricing';
  conditions: {
    min_quantity?: number;
    max_quantity?: number;
    required_options?: string[];
    customer_segment?: string;
  };
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  priority: number;
  is_active: boolean;
  created_at: string;
}
```

### Analytics Session
```typescript
interface AnalyticsSession {
  id: string;
  product_id: string;
  session_start: string;
  session_end?: string;
  total_interactions: number;
  final_price?: number;
  configuration_completed: boolean;
  conversion_achieved: boolean;
  session_data: {
    user_agent?: string;
    referrer?: string;
    device_type?: string;
  };
}
```

## API Operations

### Products

#### Get All Products
```typescript
const { data, error } = await supabase
  .from('products')
  .select(`
    *,
    categories (*)
  `)
  .eq('is_active', true);
```

#### Get Products by Category
```typescript
const { data, error } = await supabase
  .from('products')
  .select(`
    *,
    categories (*)
  `)
  .eq('category_id', categoryId)
  .eq('is_active', true);
```

#### Get Product with Configuration Options
```typescript
const { data, error } = await supabase
  .from('products')
  .select(`
    *,
    categories (*),
    config_options (
      *,
      option_values (*)
    )
  `)
  .eq('id', productId)
  .single();
```

### Categories

#### Get All Categories
```typescript
const { data, error } = await supabase
  .from('categories')
  .select('*')
  .order('name');
```

#### Create Category
```typescript
const { data, error } = await supabase
  .from('categories')
  .insert({
    name: 'New Category',
    description: 'Category description'
  })
  .select()
  .single();
```

### Configuration Options

#### Get Options for Product
```typescript
const { data, error } = await supabase
  .from('config_options')
  .select(`
    *,
    option_values (*)
  `)
  .eq('product_id', productId)
  .order('display_order');
```

#### Create Configuration Option
```typescript
const { data, error } = await supabase
  .from('config_options')
  .insert({
    product_id: productId,
    name: 'Color',
    option_type: 'selection',
    is_required: true,
    display_order: 1
  })
  .select()
  .single();
```

### Option Values

#### Create Option Value
```typescript
const { data, error } = await supabase
  .from('option_values')
  .insert({
    config_option_id: optionId,
    name: 'Red',
    price_modifier: 0,
    hex_color: '#ff0000',
    display_order: 1
  })
  .select()
  .single();
```

#### Update Option Availability
```typescript
const { data, error } = await supabase
  .from('option_values')
  .update({ is_available: false })
  .eq('id', valueId);
```

### Product Configurations

### Save Configuration with Analytics
```typescript
const { data, error } = await supabase
  .from('product_configurations')
  .insert({
    product_id: productId,
    configuration_name: 'My Custom Build',
    total_price: calculatedPrice,
    configuration_data: selectedOptions
  })
  .select()
  .single();

// Track the save event
analyticsTracker.trackConfigurationSave(productId, data.id);
```

### Get Saved Configurations with Analytics
```typescript
const { data, error } = await supabase
  .from('product_configurations')
  .select(`
    *,
    products (name, image_url),
    analytics_sessions (
      total_interactions,
      configuration_completed
    )
  `)
  .order('created_at', { ascending: false });
```

## Advanced Features API

### Rule Engine Operations

#### Validate Configuration
```typescript
const ruleEngine = new RuleEngine();
await ruleEngine.loadRules(productId);

const validationResult = await ruleEngine.validateConfiguration(selectedOptions);
if (!validationResult.isValid) {
  console.log('Validation errors:', validationResult.violations);
}
```

#### Get Applied Rules
```typescript
const { data, error } = await supabase
  .from('rule_definitions')
  .select('*')
  .eq('product_id', productId)
  .eq('is_active', true);
```

### Pricing Engine Operations

#### Calculate Dynamic Price
```typescript
const pricingEngine = new PricingEngine();
await pricingEngine.loadPricingRules(productId);

const finalPrice = await pricingEngine.calculatePrice(
  basePrice, 
  selectedOptions, 
  quantity,
  customerSegment
);
```

#### Get Pricing Rules
```typescript
const { data, error } = await supabase
  .from('pricing_rules')
  .select('*')
  .eq('product_id', productId)
  .eq('is_active', true)
  .order('priority', { ascending: false });
```

### 3D Visualization API

#### Load 3D Model Data
```typescript
const { data, error } = await supabase
  .from('product_3d_models')
  .select('*')
  .eq('product_id', productId);
```

### Recommendation Engine

#### Get AI Recommendations
```typescript
const { data, error } = await supabase
  .rpc('get_smart_recommendations', {
    p_product_id: productId,
    p_current_config: selectedOptions,
    p_customer_preferences: preferences
  });
```

### Analytics Operations

#### Track User Interaction
```typescript
analyticsTracker.trackOptionSelection(productId, optionId, valueId);
analyticsTracker.trackPriceCalculation(productId, newPrice);
analyticsTracker.trackRecommendationApplied(productId, source, optionId, valueId);
```

#### Get Analytics Data
```typescript
const { data, error } = await supabase
  .from('analytics_sessions')
  .select(`
    *,
    analytics_events (*)
  `)
  .eq('product_id', productId)
  .gte('session_start', startDate)
  .lte('session_start', endDate);
```

## Real-time Subscriptions

ConfigureMax supports real-time updates using Supabase's real-time features:

### Subscribe to Product Updates
```typescript
const subscription = supabase
  .channel('products')
  .on('postgres_changes', 
    { event: '*', schema: 'public', table: 'products' },
    (payload) => {
      console.log('Product updated:', payload);
    }
  )
  .subscribe();
```

### Subscribe to Configuration Saves
```typescript
const subscription = supabase
  .channel('configurations')
  .on('postgres_changes',
    { event: 'INSERT', schema: 'public', table: 'product_configurations' },
    (payload) => {
      console.log('New configuration saved:', payload);
    }
  )
  .subscribe();
```

## Advanced Price Calculation

The configurator now includes sophisticated pricing logic:

```typescript
const calculateAdvancedPrice = async (
  product: Product, 
  selectedOptions: Record<string, string>,
  quantity: number = 1,
  customerSegment?: string
) => {
  // Load pricing engine
  const pricingEngine = new PricingEngine();
  await pricingEngine.loadPricingRules(product.id);
  
  // Calculate base price with option modifiers
  let baseTotal = product.base_price;
  product.config_options?.forEach(option => {
    const selectedValueId = selectedOptions[option.id];
    const selectedValue = option.option_values?.find(v => v.id === selectedValueId);
    if (selectedValue) {
      baseTotal += selectedValue.price_modifier;
    }
  });
  
  // Apply dynamic pricing rules
  const finalPrice = await pricingEngine.calculatePrice(
    baseTotal,
    selectedOptions,
    quantity,
    customerSegment
  );
  
  return {
    basePrice: baseTotal,
    finalPrice: finalPrice,
    discountApplied: baseTotal - finalPrice,
    appliedRules: pricingEngine.getAppliedRules()
  };
};
```

## Error Handling

All API operations should include proper error handling:

```typescript
try {
  const { data, error } = await supabase
    .from('products')
    .select('*');
    
  if (error) throw error;
  
  // Handle successful response
  return data;
} catch (error) {
  console.error('API Error:', error);
  // Handle error appropriately
  throw error;
}
```

## Rate Limiting

Supabase provides built-in rate limiting. For production applications:
- Implement client-side debouncing for search/filter operations
- Cache frequently accessed data
- Use pagination for large result sets

## Security

Row Level Security (RLS) is enabled on all tables:
- **Public Read**: Products, categories, and options are publicly readable
- **Public Write**: Product configurations can be created by anyone
- **Admin Only**: Product management requires authentication

## Performance Tips

1. **Use Select Projections**: Only fetch the fields you need
2. **Implement Pagination**: Use `range()` for large datasets
3. **Cache Static Data**: Categories and products change infrequently
4. **Optimize Images**: Use appropriate image sizes and formats
5. **Batch Operations**: Group multiple inserts/updates when possible

## Testing

Use Supabase's built-in testing tools:
```bash
# Test your API endpoints
npx supabase test db
```

For integration testing, create a separate test database and use the same client configuration.

## Need Help?

- 📖 [Supabase Documentation](https://supabase.com/docs)
- 🔧 [ConfigureMax GitHub Issues](https://github.com/your-username/configuremax/issues)
- 💬 [Community Support](https://discord.gg/configuremax)