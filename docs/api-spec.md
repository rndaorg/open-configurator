# Open Configurator API Specification

**Version:** 1.0.0  
**Base URL:** `https://your-project.supabase.co`  
**Protocol:** REST via Supabase PostgREST

---

## ⚠️ Security Warning

**This API specification documents the current implementation, which has critical security vulnerabilities.**

**DO NOT use in production without:**
1. Implementing server-side validation via Edge Functions
2. Restricting RLS policies for sensitive tables
3. Adding authentication and authorization
4. Implementing input validation

See [Security Guide](./security.md) for details.

---

## Table of Contents

1. [Authentication](#authentication)
2. [Data Models](#data-models)
3. [Endpoints](#endpoints)
4. [Advanced Engines](#advanced-engines)
5. [Error Responses](#error-responses)
6. [Rate Limiting](#rate-limiting)

---

## Authentication

### Current State (Insecure)
- Most endpoints are publicly accessible
- No authentication required for sensitive operations
- RLS policies allow public read access to business-critical data

### Required for Production
```typescript
// Add authentication header
headers: {
  'Authorization': `Bearer ${supabaseAnonKey}`,
  'apikey': supabaseAnonKey
}
```

### Future Implementation
- **Admin Role**: Manage products, pricing, rules, inventory
- **User Role**: Save configurations, view own data
- **Anonymous**: Browse products only (with rate limiting)

---

## Data Models

### Product

```typescript
interface Product {
  id: string;                    // UUID
  name: string;                  // Max 255 chars
  description?: string;          // Text
  base_price: number;            // Decimal(10,2)
  image_url?: string;            // Valid URL
  category_id?: string;          // UUID, foreign key
  is_active: boolean;            // Default: true
  created_at: string;            // ISO 8601 timestamp
  updated_at: string;            // ISO 8601 timestamp
  
  // Relations
  categories?: Category;
  config_options?: ConfigOption[];
}
```

### Category

```typescript
interface Category {
  id: string;                    // UUID
  name: string;                  // Max 255 chars
  description?: string;          // Text
  image_url?: string;            // Valid URL
  created_at: string;            // ISO 8601 timestamp
  updated_at: string;            // ISO 8601 timestamp
}
```

### ConfigOption

```typescript
interface ConfigOption {
  id: string;                    // UUID
  product_id: string;            // UUID, foreign key
  name: string;                  // Max 255 chars
  option_type: OptionType;       // Enum
  is_required: boolean;          // Default: false
  display_order: number;         // Integer
  created_at: string;            // ISO 8601 timestamp
  
  // Relations
  option_values?: OptionValue[];
}

type OptionType = 'selection' | 'color' | 'size' | 'feature' | 'quantity';
```

### OptionValue

```typescript
interface OptionValue {
  id: string;                    // UUID
  config_option_id: string;      // UUID, foreign key
  name: string;                  // Max 255 chars
  price_modifier: number;        // Decimal(10,2)
  hex_color?: string;            // Hex color code
  image_url?: string;            // Valid URL
  is_available: boolean;         // Default: true
  display_order: number;         // Integer
  created_at: string;            // ISO 8601 timestamp
}
```

### ProductConfiguration

```typescript
interface ProductConfiguration {
  id: string;                    // UUID
  product_id: string;            // UUID, foreign key
  user_id?: string;              // UUID, optional
  session_id?: string;           // String, for anonymous
  configuration_name?: string;   // Max 255 chars
  total_price: number;           // Decimal(10,2)
  configuration_data: Record<string, string>;  // JSON object
  created_at: string;            // ISO 8601 timestamp
  updated_at: string;            // ISO 8601 timestamp
}
```

### ConfigurationRule

```typescript
interface ConfigurationRule {
  id: string;                    // UUID
  product_id: string;            // UUID, foreign key
  rule_name: string;             // Max 255 chars
  rule_type: RuleType;           // Enum
  conditions: RuleCondition[];   // JSON array
  actions: RuleAction[];         // JSON array
  priority: number;              // Integer
  is_active: boolean;            // Default: true
  created_at: string;            // ISO 8601 timestamp
  updated_at: string;            // ISO 8601 timestamp
}

type RuleType = 'validation' | 'restriction' | 'dependency' | 'auto_select';

interface RuleCondition {
  option_id: string;
  operator: 'equals' | 'not_equals' | 'in' | 'not_in';
  values: string[];
}

interface RuleAction {
  type: 'disable' | 'enable' | 'require' | 'auto_select' | 'show_warning';
  target_option_id?: string;
  target_value_ids?: string[];
  message?: string;
}
```

### PricingRule

```typescript
interface PricingRule {
  id: string;                    // UUID
  product_id: string;            // UUID, foreign key
  rule_name: string;             // Max 255 chars
  rule_type: PricingRuleType;    // Enum
  discount_type: DiscountType;   // Enum
  discount_value: number;        // Decimal(10,2)
  conditions: PricingCondition;  // JSON object
  min_quantity?: number;         // Integer
  valid_from?: string;           // ISO 8601 timestamp
  valid_until?: string;          // ISO 8601 timestamp
  is_active: boolean;            // Default: true
  priority: number;              // Integer
  created_at: string;            // ISO 8601 timestamp
  updated_at: string;            // ISO 8601 timestamp
}

type PricingRuleType = 'volume' | 'bundle' | 'conditional' | 'seasonal';
type DiscountType = 'percentage' | 'fixed_amount';

interface PricingCondition {
  min_quantity?: number;
  max_quantity?: number;
  required_options?: string[];
  customer_segment?: string;
}
```

### InventoryLevel

```typescript
interface InventoryLevel {
  id: string;                    // UUID
  option_value_id: string;       // UUID, foreign key
  available_quantity: number;    // Integer
  reserved_quantity: number;     // Integer
  low_stock_threshold: number;   // Integer, default: 10
  updated_at: string;            // ISO 8601 timestamp
}
```

### ConfigurationAnalytics

```typescript
interface ConfigurationAnalytics {
  id: string;                    // UUID
  product_id: string;            // UUID, foreign key
  session_id?: string;           // String
  user_agent?: string;           // String
  configuration_data: Record<string, string>;  // JSON
  completion_rate: number;       // Decimal(3,2)
  abandonment_point?: string;    // String
  created_at: string;            // ISO 8601 timestamp
}
```

---

## Endpoints

### Products

#### GET `/rest/v1/products`

Get all active products.

**Query Parameters:**
- `is_active` (boolean): Filter by active status (default: true)
- `category_id` (string): Filter by category UUID
- `select` (string): Specify fields and relations to return

**Example Request:**
```bash
curl -X GET 'https://your-project.supabase.co/rest/v1/products?is_active=eq.true&select=*,categories(*),config_options(*)' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Example Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Mountain Bike Pro",
    "description": "Professional mountain bike with customizable options",
    "base_price": 1299.99,
    "image_url": "https://example.com/bike.jpg",
    "category_id": "660e8400-e29b-41d4-a716-446655440000",
    "is_active": true,
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z",
    "categories": {
      "id": "660e8400-e29b-41d4-a716-446655440000",
      "name": "Bicycles",
      "description": "High-performance bicycles"
    }
  }
]
```

**Security Issue:** ⚠️ Exposes all product data publicly

---

#### GET `/rest/v1/products?id=eq.{product_id}`

Get a specific product with configuration options.

**Query Parameters:**
- `id` (string, required): Product UUID
- `select` (string): Specify relations

**Example Request:**
```bash
curl -X GET 'https://your-project.supabase.co/rest/v1/products?id=eq.550e8400-e29b-41d4-a716-446655440000&select=*,config_options(*,option_values(*))' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY"
```

**Example Response:**
```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "Mountain Bike Pro",
    "base_price": 1299.99,
    "config_options": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440000",
        "name": "Frame Size",
        "option_type": "selection",
        "is_required": true,
        "display_order": 1,
        "option_values": [
          {
            "id": "880e8400-e29b-41d4-a716-446655440000",
            "name": "Small (15\")",
            "price_modifier": 0.00,
            "is_available": true,
            "display_order": 1
          }
        ]
      }
    ]
  }
]
```

---

### Categories

#### GET `/rest/v1/categories`

Get all categories.

**Example Request:**
```bash
curl -X GET 'https://your-project.supabase.co/rest/v1/categories?select=*' \
  -H "apikey: YOUR_ANON_KEY"
```

**Example Response:**
```json
[
  {
    "id": "660e8400-e29b-41d4-a716-446655440000",
    "name": "Bicycles",
    "description": "High-performance bicycles",
    "image_url": "https://example.com/category.jpg",
    "created_at": "2024-01-15T10:00:00Z",
    "updated_at": "2024-01-15T10:00:00Z"
  }
]
```

---

### Configuration Options

#### GET `/rest/v1/config_options`

Get configuration options for a product.

**Query Parameters:**
- `product_id` (string, required): Product UUID
- `select` (string): Specify fields and relations

**Example Request:**
```bash
curl -X GET 'https://your-project.supabase.co/rest/v1/config_options?product_id=eq.550e8400-e29b-41d4-a716-446655440000&select=*,option_values(*)' \
  -H "apikey: YOUR_ANON_KEY"
```

---

### Product Configurations

#### POST `/rest/v1/product_configurations`

Save a product configuration.

**Request Body:**
```json
{
  "product_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": "anonymous_session_123",
  "configuration_name": "My Custom Bike",
  "total_price": 1599.99,
  "configuration_data": {
    "770e8400-e29b-41d4-a716-446655440000": "880e8400-e29b-41d4-a716-446655440000",
    "990e8400-e29b-41d4-a716-446655440000": "aa0e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Example Request:**
```bash
curl -X POST 'https://your-project.supabase.co/rest/v1/product_configurations' \
  -H "apikey: YOUR_ANON_KEY" \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "product_id": "550e8400-e29b-41d4-a716-446655440000",
    "session_id": "anonymous_session_123",
    "total_price": 1599.99,
    "configuration_data": {}
  }'
```

**Security Issues:** 
⚠️ No server-side price validation  
⚠️ Weak session ID management  
⚠️ Missing input validation  

---

#### GET `/rest/v1/product_configurations`

Get saved configurations (authenticated users or by session).

**Query Parameters:**
- `user_id` (string): Filter by user UUID
- `session_id` (string): Filter by session ID

**Example Request:**
```bash
curl -X GET 'https://your-project.supabase.co/rest/v1/product_configurations?session_id=eq.anonymous_session_123&select=*' \
  -H "apikey: YOUR_ANON_KEY"
```

---

### Configuration Rules

#### GET `/rest/v1/configuration_rules`

Get configuration rules for a product.

**Query Parameters:**
- `product_id` (string, required): Product UUID
- `is_active` (boolean): Filter by active status

**Example Request:**
```bash
curl -X GET 'https://your-project.supabase.co/rest/v1/configuration_rules?product_id=eq.550e8400-e29b-41d4-a716-446655440000&is_active=eq.true&select=*' \
  -H "apikey: YOUR_ANON_KEY"
```

**Example Response:**
```json
[
  {
    "id": "bb0e8400-e29b-41d4-a716-446655440000",
    "product_id": "550e8400-e29b-41d4-a716-446655440000",
    "rule_name": "Carbon frame requires premium components",
    "rule_type": "dependency",
    "conditions": [
      {
        "option_id": "frame_material_id",
        "operator": "equals",
        "values": ["carbon_fiber_value_id"]
      }
    ],
    "actions": [
      {
        "type": "require",
        "target_option_id": "components_id",
        "message": "Carbon frames require premium components"
      }
    ],
    "priority": 10,
    "is_active": true
  }
]
```

**Security Issue:** ⚠️ **CRITICAL** - Exposes all business rules publicly

---

### Pricing Rules

#### GET `/rest/v1/pricing_rules`

Get pricing rules for a product.

**Query Parameters:**
- `product_id` (string, required): Product UUID
- `is_active` (boolean): Filter by active status

**Example Request:**
```bash
curl -X GET 'https://your-project.supabase.co/rest/v1/pricing_rules?product_id=eq.550e8400-e29b-41d4-a716-446655440000&is_active=eq.true&select=*' \
  -H "apikey: YOUR_ANON_KEY"
```

**Example Response:**
```json
[
  {
    "id": "cc0e8400-e29b-41d4-a716-446655440000",
    "product_id": "550e8400-e29b-41d4-a716-446655440000",
    "rule_name": "Volume Discount 5-10 units",
    "rule_type": "volume",
    "discount_type": "percentage",
    "discount_value": 10.00,
    "conditions": {
      "min_quantity": 5,
      "max_quantity": 10
    },
    "priority": 5,
    "is_active": true
  }
]
```

**Security Issue:** ⚠️ **CRITICAL** - Exposes entire pricing strategy publicly

---

### Inventory Levels

#### GET `/rest/v1/inventory_levels`

Get inventory levels for option values.

**Query Parameters:**
- `option_value_id` (string, required): Option value UUID

**Example Request:**
```bash
curl -X GET 'https://your-project.supabase.co/rest/v1/inventory_levels?option_value_id=eq.880e8400-e29b-41d4-a716-446655440000&select=*' \
  -H "apikey: YOUR_ANON_KEY"
```

**Example Response:**
```json
[
  {
    "id": "dd0e8400-e29b-41d4-a716-446655440000",
    "option_value_id": "880e8400-e29b-41d4-a716-446655440000",
    "available_quantity": 15,
    "reserved_quantity": 3,
    "low_stock_threshold": 10,
    "updated_at": "2024-01-15T14:30:00Z"
  }
]
```

**Security Issue:** ⚠️ **CRITICAL** - Exposes inventory levels publicly

---

### Configuration Analytics

#### POST `/rest/v1/configuration_analytics`

Track configuration analytics.

**Request Body:**
```json
{
  "product_id": "550e8400-e29b-41d4-a716-446655440000",
  "session_id": "anonymous_session_123",
  "user_agent": "Mozilla/5.0...",
  "configuration_data": {
    "option1": "value1"
  },
  "completion_rate": 0.75,
  "abandonment_point": "pricing_step"
}
```

**Security Issue:** ⚠️ Missing validation, allows data poisoning

---

## Advanced Engines

### Rule Engine (Client-Side)

**⚠️ Security Warning:** Currently runs client-side and can be bypassed.

**Usage:**
```typescript
import { RuleEngine } from '@/services/ruleEngine';

const ruleEngine = new RuleEngine();
await ruleEngine.loadRules(productId);

// Validate configuration
const result = await ruleEngine.validateConfiguration(selectedOptions);

if (!result.isValid) {
  console.error('Violations:', result.violations);
}
```

**Should Be:**
```typescript
// Call server-side Edge Function
const response = await fetch('/functions/v1/validate-configuration', {
  method: 'POST',
  body: JSON.stringify({ productId, selectedOptions })
});

const { valid, violations } = await response.json();
```

---

### Pricing Engine (Client-Side)

**⚠️ Security Warning:** Prices calculated client-side can be manipulated.

**Current Usage:**
```typescript
import { PricingEngine } from '@/services/pricingEngine';

const pricingEngine = new PricingEngine();
await pricingEngine.loadPricingRules(productId);

const finalPrice = await pricingEngine.calculatePrice(
  basePrice,
  selectedOptions,
  quantity
);
```

**Should Be:**
```typescript
// Call server-side Edge Function
const response = await fetch('/functions/v1/calculate-price', {
  method: 'POST',
  body: JSON.stringify({ productId, selectedOptions, quantity })
});

const { finalPrice, breakdown } = await response.json();
```

---

## Error Responses

### Standard Error Format

```json
{
  "error": "Error message",
  "details": "Detailed error information",
  "hint": "Suggestion for fixing the error",
  "code": "PGRST116"
}
```

### Common HTTP Status Codes

- **200 OK**: Request successful
- **201 Created**: Resource created successfully
- **400 Bad Request**: Invalid request parameters
- **401 Unauthorized**: Missing or invalid authentication
- **403 Forbidden**: Insufficient permissions
- **404 Not Found**: Resource not found
- **409 Conflict**: Resource conflict (e.g., duplicate)
- **422 Unprocessable Entity**: Validation error
- **429 Too Many Requests**: Rate limit exceeded
- **500 Internal Server Error**: Server error

### Example Error Response

```json
{
  "code": "PGRST116",
  "details": "Results contain 0 rows, application/vnd.pgrst.object+json requires 1 row",
  "hint": null,
  "message": "JSON object requested, multiple (or no) rows returned"
}
```

---

## Rate Limiting

### Current State
⚠️ **No rate limiting implemented** - vulnerable to abuse

### Recommended Implementation

**Per IP Address:**
- Anonymous requests: 100 requests per minute
- Authenticated requests: 1000 requests per minute
- Configuration saves: 10 per minute

**Response Headers:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 87
X-RateLimit-Reset: 1642345678
```

**Rate Limit Error:**
```json
{
  "error": "Rate limit exceeded",
  "retry_after": 42
}
```

---

## Webhooks (Future)

### Configuration Saved
```json
{
  "event": "configuration.saved",
  "data": {
    "id": "config_id",
    "product_id": "product_id",
    "total_price": 1599.99
  },
  "timestamp": "2024-01-15T10:00:00Z"
}
```

---

## SDK Examples

### JavaScript/TypeScript

```typescript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://your-project.supabase.co',
  'your-anon-key'
);

// Get products
const { data: products, error } = await supabase
  .from('products')
  .select('*, categories(*)')
  .eq('is_active', true);

// Save configuration
const { data: config, error: saveError } = await supabase
  .from('product_configurations')
  .insert({
    product_id: 'product_id',
    total_price: 1599.99,
    configuration_data: {}
  })
  .select()
  .single();
```

---

## Testing

### Test with cURL

```bash
# Set your credentials
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your-anon-key"

# Get products
curl -X GET "${SUPABASE_URL}/rest/v1/products?select=*" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}"

# Save configuration
curl -X POST "${SUPABASE_URL}/rest/v1/product_configurations" \
  -H "apikey: ${SUPABASE_ANON_KEY}" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=representation" \
  -d '{
    "product_id": "550e8400-e29b-41d4-a716-446655440000",
    "total_price": 1599.99,
    "configuration_data": {}
  }'
```

---

## Versioning

**Current Version:** 1.0.0 (Alpha - Not Production Ready)

**Version Policy:**
- Major version for breaking changes
- Minor version for new features
- Patch version for bug fixes

---

## Support

- **Issues:** [GitHub Issues](https://github.com/your-org/open-configurator/issues)
- **Security:** security@your-domain.com
- **Docs:** [Full Documentation](./README.md)

---

**Last Updated:** 2024-01-15  
**Status:** ⚠️ Alpha - Not Production Ready
