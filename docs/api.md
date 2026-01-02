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

## 🔒 Security Features

Open Configurator implements comprehensive security measures:

### ✅ Implemented Security

1. **Server-Side Validation**: All configurations are validated via Edge Function before saving
2. **Role-Based Access Control**: Admin-only access to sensitive business data
3. **Input Validation**: Zod schemas protect against injection and corruption
4. **Secure Sessions**: Cryptographically secure session IDs
5. **Row Level Security**: Database-level access control on all tables

### Server-Side Validation

Configuration validation and pricing calculation is handled by the Edge Function:

```typescript
// Call the Edge Function to validate and save
const response = await fetch(
  `${supabaseUrl}/functions/v1/validate-and-save-configuration`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      productId: product.id,
      selectedOptions,
      quantity,
      configurationName
    })
  }
);

const result = await response.json();
```

### Input Validation

All user inputs are validated using Zod schemas:

```typescript
import { configurationSchema, safeValidateConfiguration } from '@/lib/validation';

// Validate configuration before saving
const validation = safeValidateConfiguration({
  product_id: productId,
  configuration_name: name,
  total_price: price,
  configuration_data: options,
  quantity: qty
});

if (!validation.success) {
  // Handle validation errors
  console.error(validation.errors);
  return;
}
```

## Authentication

Open Configurator implements Supabase Auth with role-based access control:

### User Roles
- **Admin**: Full access to products, pricing rules, configuration rules, and inventory management
- **User**: Can save and manage their own configurations
- **Anonymous**: Browse products and create temporary configurations with session IDs

### Authentication Flow

```typescript
import { useAuth } from '@/hooks/useAuth';

const { user, session, signIn, signUp, signOut } = useAuth();

// Sign up new user
await signUp(email, password);

// Sign in existing user
await signIn(email, password);

// Check if user is authenticated
if (user) {
  console.log('User authenticated:', user.email);
}
```

### Creating Admin Users

To grant admin access to a user:

```sql
-- Replace with the user's email
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'admin@example.com';
```

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

## External Integrations

Open Configurator provides comprehensive integrations with popular services via Edge Functions.

### Stripe Payments

Full payment processing with Stripe including payment intents, confirmations, refunds, and webhooks.

**Edge Function:** `/functions/v1/stripe-payment`

#### Create Payment Intent
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/stripe-payment/create-payment-intent`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      amount: 1599.99,
      currency: 'usd',
      orderId: 'order-uuid',
      customerEmail: 'customer@example.com',
      metadata: { product_name: 'Custom Bike' }
    })
  }
);

const { clientSecret, paymentIntentId } = await response.json();
```

#### Confirm Payment
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/stripe-payment/confirm-payment`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      paymentIntentId: 'pi_xxx',
      orderId: 'order-uuid'
    })
  }
);
```

#### Process Refund
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/stripe-payment/refund`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      paymentIntentId: 'pi_xxx',
      amount: 500.00, // Optional partial refund
      reason: 'customer_request'
    })
  }
);
```

**Required Secret:** `STRIPE_SECRET_KEY`

---

### SendGrid Email

Transactional email support for order confirmations, status updates, and custom emails.

**Edge Function:** `/functions/v1/sendgrid-email`

#### Send Custom Email
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/sendgrid-email/send`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      to: 'customer@example.com',
      subject: 'Your Configuration is Ready',
      html: '<h1>Hello!</h1><p>Your custom configuration is ready.</p>',
      from: 'notifications@yourstore.com'
    })
  }
);
```

#### Send Order Confirmation
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/sendgrid-email/order-confirmation`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      orderId: 'order-uuid',
      customerEmail: 'customer@example.com',
      customerName: 'John Doe',
      productName: 'Mountain Bike Pro',
      configurationSummary: 'Large Frame, Red Color, Carbon Wheels',
      totalPrice: 1599.99,
      orderDate: '2024-01-15'
    })
  }
);
```

#### Send Status Update
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/sendgrid-email/status-update`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      customerEmail: 'customer@example.com',
      customerName: 'John Doe',
      orderId: 'order-uuid',
      newStatus: 'shipped',
      trackingNumber: '1Z999AA10123456784'
    })
  }
);
```

**Required Secrets:** `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`

---

### External Inventory Systems

Sync inventory with Shopify, WooCommerce, or custom inventory APIs.

**Edge Function:** `/functions/v1/external-inventory`

#### Sync from Provider
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/external-inventory/sync`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      provider: 'shopify', // or 'woocommerce', 'custom'
      apiUrl: 'https://your-store.myshopify.com', // for custom
      apiKey: 'optional-override-key'
    })
  }
);

const { synced, updated, timestamp } = await response.json();
```

#### Check Inventory
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/external-inventory/check`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      skus: ['sku-001', 'sku-002', 'sku-003']
    })
  }
);

const { inventory } = await response.json();
// [{ sku: 'sku-001', available: 15, isLowStock: false }, ...]
```

#### Reserve Inventory
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/external-inventory/reserve`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      sku: 'sku-001',
      quantity: 2,
      orderId: 'order-uuid'
    })
  }
);
```

**Optional Secrets:** `SHOPIFY_API_KEY`, `SHOPIFY_STORE_URL`, `WOOCOMMERCE_URL`, `WOOCOMMERCE_CONSUMER_KEY`, `WOOCOMMERCE_CONSUMER_SECRET`

---

### CRM Integration

Sync contacts, create deals, and log activities in HubSpot, Salesforce, or Pipedrive.

**Edge Function:** `/functions/v1/crm-integration`

#### Sync Contact
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/crm-integration/sync-contact`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      provider: 'hubspot', // or 'salesforce', 'pipedrive'
      email: 'customer@example.com',
      firstName: 'John',
      lastName: 'Doe',
      phone: '+1234567890',
      company: 'Acme Inc',
      customFields: {
        last_product_viewed: 'Mountain Bike Pro',
        total_configurations: 5
      }
    })
  }
);
```

#### Create Deal
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/crm-integration/create-deal`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      provider: 'hubspot',
      contactEmail: 'customer@example.com',
      title: 'Mountain Bike Pro - Custom Configuration',
      value: 1599.99,
      stage: 'appointmentscheduled',
      productId: 'product-uuid',
      configurationId: 'config-uuid'
    })
  }
);
```

#### Log Activity
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/crm-integration/log-activity`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      provider: 'hubspot',
      contactEmail: 'customer@example.com',
      activityType: 'Configuration Saved',
      description: 'Customer saved a custom Mountain Bike configuration',
      productId: 'product-uuid'
    })
  }
);
```

**Optional Secrets:** `HUBSPOT_API_KEY`, `SALESFORCE_ACCESS_TOKEN`, `SALESFORCE_INSTANCE_URL`, `PIPEDRIVE_API_KEY`

---

### Social Media Sharing

Generate shareable links and embed codes for configurations.

**Edge Function:** `/functions/v1/social-sharing`

#### Generate Share Link
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/social-sharing/generate-link`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      productId: 'product-uuid',
      productName: 'Mountain Bike Pro',
      configurationId: 'config-uuid',
      configurationName: 'My Custom Build',
      imageUrl: 'https://example.com/config-preview.jpg',
      totalPrice: 1599.99,
      selectedOptions: { 'frame-size': 'large', 'color': 'red' }
    })
  }
);

const { shareUrl, shareId, socialLinks, ogTags } = await response.json();
// socialLinks includes: facebook, twitter, linkedin, pinterest, whatsapp, email
```

#### Generate Embed Code
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/social-sharing/generate-embed`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      configurationId: 'config-uuid',
      width: 400,
      height: 500,
      theme: 'dark'
    })
  }
);

const { embedUrl, embedCode } = await response.json();
// embedCode contains ready-to-use <iframe> HTML
```

#### Resolve Shared Link
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/social-sharing/resolve`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      shareId: 'abc12345',
      data: 'base64-encoded-data-from-url'
    })
  }
);

const { product, selectedOptions, configurationDetails } = await response.json();
```

---

### Scheduled Reports

Generate and export reports on a schedule.

**Edge Function:** `/functions/v1/generate-scheduled-report`

#### Generate Report
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/generate-scheduled-report`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      reportType: 'sales', // or 'customers', 'products', 'funnel'
      dateRange: {
        start: '2024-01-01',
        end: '2024-01-31'
      },
      format: 'json' // or 'csv'
    })
  }
);

const report = await response.json();
```

---

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
- 🔧 [Open Configurator GitHub Issues](https://github.com/your-username/open-configurator/issues)
- 💬 [Community Support](https://discord.gg/open-configurator)