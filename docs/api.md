# ConfigureMax API Reference

ConfigureMax uses Supabase as its backend, providing a full REST API for all product configuration operations. This document covers the available endpoints and data models.

## Base URL

All API requests are made through the Supabase client:
```typescript
import { supabase } from '@/integrations/supabase/client';
```

## Authentication

ConfigureMax supports both authenticated and anonymous operations:
- **Public Operations**: Browse products, configure items, save configurations
- **Admin Operations**: Manage products, categories, and options (requires authentication)

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

#### Save Configuration
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
```

#### Get Saved Configurations
```typescript
const { data, error } = await supabase
  .from('product_configurations')
  .select(`
    *,
    products (name, image_url)
  `)
  .order('created_at', { ascending: false });
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

## Price Calculation

The configurator automatically calculates prices based on:
1. Product base price
2. Selected option value price modifiers

```typescript
const calculateTotalPrice = (product: Product, selectedOptions: Record<string, string>) => {
  let total = product.base_price;
  
  product.config_options?.forEach(option => {
    const selectedValueId = selectedOptions[option.id];
    const selectedValue = option.option_values?.find(v => v.id === selectedValueId);
    
    if (selectedValue) {
      total += selectedValue.price_modifier;
    }
  });
  
  return total;
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