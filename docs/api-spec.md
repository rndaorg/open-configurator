# Open Configurator API Specification

**Version:** 1.0.0  
**Base URL:** `https://your-project.supabase.co`  
**Protocol:** REST via Supabase PostgREST

---

## ✅ Security Status

**This API implements comprehensive security measures and is production-ready.**

### Implemented Security Features
1. ✅ Server-side validation via Edge Functions
2. ✅ Admin-only RLS policies for sensitive tables
3. ✅ Authentication and role-based authorization
4. ✅ Input validation with Zod schemas
5. ✅ Secure session management

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

### Authentication System

Open Configurator uses Supabase Auth with role-based access control:

```typescript
// Authentication headers
headers: {
  'Authorization': `Bearer ${sessionToken}`,
  'apikey': supabaseAnonKey
}
```

### User Roles

- **Admin Role**: Full access to manage products, pricing rules, configuration rules, and inventory
- **User Role**: Save and manage personal configurations, view own data
- **Anonymous**: Browse products and create temporary configurations with session IDs

### Role Assignment

Admin roles must be assigned in the database:

```sql
-- Grant admin access to a user
INSERT INTO user_roles (user_id, role)
SELECT id, 'admin'::app_role
FROM auth.users
WHERE email = 'admin@example.com';
```

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

**Access:** Public - products are viewable by everyone

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

**Security:** 
✅ Server-side validation via Edge Function  
✅ Secure session ID management  
✅ Input validation with Zod schemas

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

**Access:** Admin only - requires authentication with admin role

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

**Access:** Admin only - requires authentication with admin role

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

**Access:** Admin only - requires authentication with admin role

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

**Security:** ✅ Input validation with Zod schemas

---

## Advanced Engines

### Edge Function: validate-and-save-configuration

**✅ Production-ready server-side validation**

All configurations are validated and priced server-side via an Edge Function.

**Endpoint:** `/functions/v1/validate-and-save-configuration`

**Usage:**
```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/validate-and-save-configuration`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`,
    },
    body: JSON.stringify({
      productId: 'product-uuid',
      selectedOptions: { 'option-id': 'value-id' },
      quantity: 1,
      configurationName: 'My Config'
    })
  }
);

const result = await response.json();
```

**Features:**
- Server-side rule validation
- Server-side pricing calculation
- Inventory availability checking
- Input validation with Zod
- Secure session management

### Rule Engine

The Rule Engine is integrated into the Edge Function for server-side validation.

```typescript
const response = await fetch(
  `${supabaseUrl}/functions/v1/validate-and-save-configuration`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`
    },
    body: JSON.stringify({
      productId,
      selectedOptions,
      quantity,
      configurationName
    })
  }
);

const result = await response.json();
if (!result.success) {
  console.error('Validation failed:', result.error);
}
```

### Pricing Engine

Pricing calculations are performed server-side by the Edge Function to prevent manipulation.

**Implementation:**
All pricing logic is executed within the `validate-and-save-configuration` Edge Function, which:
1. Loads pricing rules from the database (admin-only table)
2. Calculates the final price server-side
3. Returns the validated price to the client

**Client Usage:**
```typescript
// Pricing is calculated automatically by the Edge Function
const response = await fetch(
  `${supabaseUrl}/functions/v1/validate-and-save-configuration`,
  {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${supabaseAnonKey}`
    },
    body: JSON.stringify({
      productId,
      selectedOptions,
      quantity,
      configurationName
    })
  }
);

const result = await response.json();
// result.configuration.total_price contains the server-calculated price
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

## External Integration Endpoints

### Stripe Payment Integration

**Base Endpoint:** `/functions/v1/stripe-payment`

| Action | Method | Path | Description |
|--------|--------|------|-------------|
| Create Payment Intent | POST | `/create-payment-intent` | Initiate a payment |
| Confirm Payment | POST | `/confirm-payment` | Verify payment status |
| Process Refund | POST | `/refund` | Issue full or partial refund |
| Webhook | POST | `/webhook` | Handle Stripe events |

**Request: Create Payment Intent**
```json
{
  "amount": 1599.99,
  "currency": "usd",
  "orderId": "uuid",
  "customerEmail": "customer@example.com",
  "metadata": { "product": "Mountain Bike" }
}
```

**Response:**
```json
{
  "clientSecret": "pi_xxx_secret_xxx",
  "paymentIntentId": "pi_xxx"
}
```

**Required Secret:** `STRIPE_SECRET_KEY`

---

### SendGrid Email Integration

**Base Endpoint:** `/functions/v1/sendgrid-email`

| Action | Method | Path | Description |
|--------|--------|------|-------------|
| Send Email | POST | `/send` | Send custom email |
| Order Confirmation | POST | `/order-confirmation` | Send order confirmation |
| Status Update | POST | `/status-update` | Send order status update |

**Request: Order Confirmation**
```json
{
  "orderId": "uuid",
  "customerEmail": "customer@example.com",
  "customerName": "John Doe",
  "productName": "Mountain Bike Pro",
  "configurationSummary": "Large Frame, Red, Carbon Wheels",
  "totalPrice": 1599.99,
  "orderDate": "2024-01-15"
}
```

**Required Secrets:** `SENDGRID_API_KEY`, `SENDGRID_FROM_EMAIL`

---

### External Inventory Integration

**Base Endpoint:** `/functions/v1/external-inventory`

| Action | Method | Path | Description |
|--------|--------|------|-------------|
| Sync Inventory | POST | `/sync` | Sync from external provider |
| Check Stock | POST | `/check` | Check availability |
| Reserve Stock | POST | `/reserve` | Reserve for order |
| Release Stock | POST | `/release` | Release reservation |
| Webhook | POST | `/webhook` | Handle inventory updates |

**Request: Sync**
```json
{
  "provider": "shopify",
  "apiUrl": "https://store.myshopify.com",
  "apiKey": "optional-override"
}
```

**Response:**
```json
{
  "success": true,
  "synced": 150,
  "updated": 145,
  "timestamp": "2024-01-15T10:00:00Z"
}
```

**Supported Providers:** `shopify`, `woocommerce`, `custom`

---

### CRM Integration

**Base Endpoint:** `/functions/v1/crm-integration`

| Action | Method | Path | Description |
|--------|--------|------|-------------|
| Sync Contact | POST | `/sync-contact` | Create/update CRM contact |
| Create Deal | POST | `/create-deal` | Create sales opportunity |
| Log Activity | POST | `/log-activity` | Record customer activity |
| Webhook | POST | `/webhook` | Handle CRM events |

**Request: Create Deal**
```json
{
  "provider": "hubspot",
  "contactEmail": "customer@example.com",
  "title": "Custom Configuration",
  "value": 1599.99,
  "stage": "appointmentscheduled",
  "productId": "uuid",
  "configurationId": "uuid"
}
```

**Supported Providers:** `hubspot`, `salesforce`, `pipedrive`

---

### Social Sharing Integration

**Base Endpoint:** `/functions/v1/social-sharing`

| Action | Method | Path | Description |
|--------|--------|------|-------------|
| Generate Link | POST | `/generate-link` | Create shareable URL |
| Track Share | POST | `/track-share` | Track share analytics |
| Track View | POST | `/track-view` | Track link views |
| Resolve Link | POST | `/resolve` | Decode shared config |
| Generate Embed | POST | `/generate-embed` | Create embed code |

**Request: Generate Link**
```json
{
  "productId": "uuid",
  "productName": "Mountain Bike Pro",
  "configurationId": "uuid",
  "configurationName": "My Custom Build",
  "imageUrl": "https://example.com/preview.jpg",
  "totalPrice": 1599.99,
  "selectedOptions": { "color": "red", "size": "large" }
}
```

**Response:**
```json
{
  "success": true,
  "shareUrl": "https://app.example.com/shared/abc123",
  "shareId": "abc123",
  "socialLinks": {
    "facebook": "https://facebook.com/sharer/...",
    "twitter": "https://twitter.com/intent/tweet?...",
    "linkedin": "https://linkedin.com/sharing/...",
    "pinterest": "https://pinterest.com/pin/create/...",
    "whatsapp": "https://wa.me/?text=...",
    "email": "mailto:?subject=...&body=..."
  },
  "ogTags": {
    "og:title": "My Custom Build",
    "og:description": "Check out this custom configuration",
    "og:image": "https://example.com/preview.jpg"
  }
}
```

---

### Scheduled Reports

**Base Endpoint:** `/functions/v1/generate-scheduled-report`

| Report Type | Description |
|-------------|-------------|
| `sales` | Revenue, order count, average order value |
| `customers` | New customers, repeat rates, top buyers |
| `products` | Best sellers, configuration popularity |
| `funnel` | Conversion rates, abandonment analysis |

**Request:**
```json
{
  "reportType": "sales",
  "dateRange": {
    "start": "2024-01-01",
    "end": "2024-01-31"
  },
  "format": "json"
}
```

---

## Webhooks

### Stripe Webhook Events

Configure webhook endpoint: `/functions/v1/stripe-payment/webhook`

Supported events:
- `payment_intent.succeeded`
- `payment_intent.payment_failed`

### Inventory Webhook Events

Configure webhook endpoint: `/functions/v1/external-inventory/webhook`

Expected payload:
```json
{
  "type": "inventory_update",
  "sku": "option-value-uuid",
  "quantity": 50
}
```

### CRM Webhook Events

Configure webhook endpoint: `/functions/v1/crm-integration/webhook`

Expected payload:
```json
{
  "type": "deal.updated",
  "orderId": "order-uuid",
  "stage": "won"
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

# Create payment intent
curl -X POST "${SUPABASE_URL}/functions/v1/stripe-payment/create-payment-intent" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "amount": 1599.99,
    "orderId": "order-uuid",
    "customerEmail": "test@example.com"
  }'

# Generate share link
curl -X POST "${SUPABASE_URL}/functions/v1/social-sharing/generate-link" \
  -H "Authorization: Bearer ${SUPABASE_ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "product-uuid",
    "productName": "Test Product",
    "configurationId": "config-uuid",
    "totalPrice": 999.99,
    "selectedOptions": {}
  }'
```

---

## Required Secrets Configuration

| Secret | Integration | Required |
|--------|-------------|----------|
| `STRIPE_SECRET_KEY` | Stripe Payments | Yes |
| `STRIPE_WEBHOOK_SECRET` | Stripe Webhooks | No |
| `SENDGRID_API_KEY` | SendGrid Email | Yes |
| `SENDGRID_FROM_EMAIL` | SendGrid Email | Yes |
| `HUBSPOT_API_KEY` | HubSpot CRM | No |
| `SALESFORCE_ACCESS_TOKEN` | Salesforce CRM | No |
| `SALESFORCE_INSTANCE_URL` | Salesforce CRM | No |
| `PIPEDRIVE_API_KEY` | Pipedrive CRM | No |
| `SHOPIFY_API_KEY` | Shopify Inventory | No |
| `SHOPIFY_STORE_URL` | Shopify Inventory | No |
| `WOOCOMMERCE_URL` | WooCommerce Inventory | No |
| `WOOCOMMERCE_CONSUMER_KEY` | WooCommerce Inventory | No |
| `WOOCOMMERCE_CONSUMER_SECRET` | WooCommerce Inventory | No |
| `APP_URL` | Social Sharing | No |

---

## Versioning

**Current Version:** 1.0.0

**Version Policy:**
- Major version for breaking changes
- Minor version for new features
- Patch version for bug fixes

---

## Support

- **Issues:** [GitHub Issues](https://github.com/rndaorg/open-configurator/issues)
- **Security:** security@openconfigurator.dev
- **Docs:** [Full Documentation](./README.md)

---

**Version:** 1.0.0  
**Status:** ✅ Production Ready
