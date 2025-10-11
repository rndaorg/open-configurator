# Security Guide - Open Configurator

**Status:** ⚠️ **CRITICAL SECURITY ISSUES PRESENT**  
**Production Ready:** ❌ **NO**

---

## Executive Summary

Open Configurator in its current state has **critical security vulnerabilities** that make it unsuitable for production deployment. This document outlines the security issues, their impact, and required remediation steps.

### 🔴 Critical Issues Summary

| Issue | Severity | Impact | Status |
|-------|----------|--------|--------|
| Exposed Business Logic | **CRITICAL** | IP theft, competitive disadvantage | ❌ Not Fixed |
| Client-Side Security | **CRITICAL** | Revenue loss, order manipulation | ❌ Not Fixed |
| Missing Input Validation | **HIGH** | Data corruption, injection attacks | ❌ Not Fixed |
| Weak Session Management | **MEDIUM** | Privacy violation, unauthorized access | ❌ Not Fixed |
| No Authentication System | **HIGH** | No access control | ❌ Not Implemented |

---

## Detailed Security Analysis

### 1. Exposed Business Intelligence (CRITICAL)

#### Problem

The following tables are publicly readable without authentication:

```sql
-- Anyone can query these tables
SELECT * FROM pricing_rules;        -- Your entire pricing strategy
SELECT * FROM configuration_rules;  -- Your business logic
SELECT * FROM inventory_levels;     -- Your stock levels
```

#### Current RLS Policies

```sql
-- pricing_rules
CREATE POLICY "Pricing rules are viewable by everyone" 
ON pricing_rules FOR SELECT 
USING (true);  -- ⚠️ ANYONE can read

-- configuration_rules
CREATE POLICY "Configuration rules are viewable by everyone"
ON configuration_rules FOR SELECT
USING (true);  -- ⚠️ ANYONE can read

-- inventory_levels
CREATE POLICY "Inventory levels are viewable by everyone"
ON inventory_levels FOR SELECT
USING (true);  -- ⚠️ ANYONE can read
```

#### Impact

1. **Competitive Intelligence Loss**
   - Competitors can scrape your pricing strategy
   - Business rules reveal your product relationships
   - Inventory levels show product popularity and supply chain

2. **Financial Risk**
   - Pricing discounts revealed before negotiation
   - Volume discount thresholds exposed
   - Bundle pricing strategies copied

3. **Operational Risk**
   - Stock levels enable inventory arbitrage
   - Low stock alerts reveal supply issues
   - Product launch timing leaked

#### Attack Scenario

```javascript
// Attacker script - requires just your Supabase URL
const supabase = createClient('https://YOUR_PROJECT.supabase.co', 'PUBLIC_ANON_KEY');

// Steal all pricing rules
const { data: pricingRules } = await supabase
  .from('pricing_rules')
  .select('*')
  .eq('is_active', true);

console.log('Volume discounts:', pricingRules.filter(r => r.rule_type === 'volume'));
console.log('Bundle deals:', pricingRules.filter(r => r.rule_type === 'bundle'));

// Scrape inventory levels
const { data: inventory } = await supabase
  .from('inventory_levels')
  .select('*, option_values(*)')
  .lt('available_quantity', 'low_stock_threshold');

console.log('Low stock items:', inventory);  // Perfect for competitors
```

#### Required Fix

```sql
-- Drop public policies
DROP POLICY IF EXISTS "Pricing rules are viewable by everyone" ON pricing_rules;
DROP POLICY IF EXISTS "Configuration rules are viewable by everyone" ON configuration_rules;
DROP POLICY IF EXISTS "Inventory levels are viewable by everyone" ON inventory_levels;

-- Create admin-only policies
CREATE POLICY "Admin can view pricing rules"
ON pricing_rules FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'admin' OR
  auth.jwt() ->> 'user_role' = 'admin'
);

CREATE POLICY "Admin can view configuration rules"
ON configuration_rules FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'admin' OR
  auth.jwt() ->> 'user_role' = 'admin'
);

CREATE POLICY "Admin can view inventory"
ON inventory_levels FOR SELECT
TO authenticated
USING (
  auth.jwt() ->> 'role' = 'admin' OR
  auth.jwt() ->> 'user_role' = 'admin'
);
```

---

### 2. Client-Side Security Enforcement (CRITICAL)

#### Problem

All business logic executes in the browser:

```typescript
// src/services/ruleEngine.ts
// ⚠️ Runs in browser - user can modify or bypass
export class RuleEngine {
  async validateConfiguration(selectedOptions: Record<string, string>) {
    // Validation happens client-side
    // User can bypass via DevTools
  }
}

// src/services/pricingEngine.ts
// ⚠️ Price calculation in browser - user can manipulate
export class PricingEngine {
  async calculatePrice(basePrice: number, options: Record<string, string>, quantity: number) {
    // User can intercept and change finalPrice
    return finalPrice;  // ⚠️ Not validated server-side
  }
}
```

#### Impact

1. **Revenue Loss**
   - Users can manipulate prices before checkout
   - Discount rules bypassed
   - Volume pricing ignored

2. **Invalid Orders**
   - Incompatible configurations saved
   - Required validations skipped
   - Business rules violated

3. **Data Integrity**
   - Corrupted configurations in database
   - Analytics poisoned with fake data
   - Inventory not properly reserved

#### Attack Scenario

```javascript
// Open browser DevTools console on configurator page
// Intercept the save function

// Method 1: Modify price before save
const originalSave = window.saveConfiguration;
window.saveConfiguration = async (config) => {
  config.total_price = 1.00;  // $1 for a $2000 bike!
  return originalSave(config);
};

// Method 2: Bypass rules entirely
// Create configuration directly via Supabase
const { data } = await supabase
  .from('product_configurations')
  .insert({
    product_id: 'expensive_product',
    total_price: 1.00,  // ⚠️ No server validation
    configuration_data: {
      // Incompatible options that should be blocked
      'frame_size': 'small',
      'wheel_size': '29_inch'  // Should be impossible combo
    }
  });
```

#### Required Fix

**Create Supabase Edge Functions:**

```typescript
// supabase/functions/validate-and-save-configuration/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

serve(async (req) => {
  const { productId, selectedOptions, quantity, configurationName } = await req.json();
  
  // Initialize Supabase with service role (bypasses RLS)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );
  
  // 1. Load rules from database
  const { data: rules } = await supabase
    .from('configuration_rules')
    .select('*')
    .eq('product_id', productId)
    .eq('is_active', true);
  
  // 2. Validate configuration server-side
  const violations = validateRules(rules, selectedOptions);
  if (violations.length > 0) {
    return new Response(
      JSON.stringify({ error: 'Configuration invalid', violations }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // 3. Calculate price server-side
  const { data: pricingRules } = await supabase
    .from('pricing_rules')
    .select('*')
    .eq('product_id', productId)
    .eq('is_active', true);
  
  const finalPrice = calculatePriceServerSide(pricingRules, selectedOptions, quantity);
  
  // 4. Check inventory
  const inventoryValid = await checkInventory(supabase, selectedOptions);
  if (!inventoryValid) {
    return new Response(
      JSON.stringify({ error: 'Insufficient inventory' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  // 5. Save configuration with validated price
  const { data: config, error } = await supabase
    .from('product_configurations')
    .insert({
      product_id: productId,
      user_id: req.headers.get('user-id') || null,
      configuration_name: configurationName,
      total_price: finalPrice,  // ✅ Server-calculated, trusted
      configuration_data: selectedOptions
    })
    .select()
    .single();
  
  if (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
  
  return new Response(
    JSON.stringify({ success: true, configuration: config }),
    { status: 200, headers: { 'Content-Type': 'application/json' } }
  );
});

// Helper functions
function validateRules(rules: any[], options: Record<string, string>): string[] {
  // Server-side rule validation logic
  const violations = [];
  // ... implementation
  return violations;
}

function calculatePriceServerSide(rules: any[], options: Record<string, string>, qty: number): number {
  // Server-side pricing calculation
  let price = 0;
  // ... implementation
  return price;
}

async function checkInventory(supabase: any, options: Record<string, string>): Promise<boolean> {
  // Check inventory availability
  // ... implementation
  return true;
}
```

**Client-side changes:**

```typescript
// src/components/ProductConfigurator.tsx
const handleSaveConfiguration = async () => {
  try {
    // Call Edge Function instead of direct insert
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
    
    if (!response.ok) {
      toast.error(result.error);
      return;
    }
    
    toast.success('Configuration saved!');
    // Use server-validated configuration
    console.log('Saved config:', result.configuration);
    
  } catch (error) {
    toast.error('Failed to save configuration');
  }
};
```

---

### 3. Missing Input Validation (HIGH)

#### Problem

No validation schemas for user inputs:

```typescript
// No validation before insert
const { data, error } = await supabase
  .from('product_configurations')
  .insert({
    product_id: userInput.productId,        // ⚠️ Not validated
    configuration_name: userInput.name,     // ⚠️ Could be malicious
    total_price: userInput.price,           // ⚠️ User-provided!
    configuration_data: userInput.options   // ⚠️ Unvalidated JSON
  });
```

#### Impact

1. **Data Corruption**
   - Invalid UUIDs crash queries
   - Malformed JSON breaks application
   - Negative prices in database

2. **Database Bloat**
   - Extremely long strings
   - Huge JSON objects
   - Wasted storage

3. **Potential XSS**
   - Malicious strings in configuration names
   - Script tags in descriptions
   - HTML injection in options

#### Required Fix

**Install Zod:**

```bash
npm install zod
```

**Create validation schemas:**

```typescript
// src/lib/validation.ts
import { z } from 'zod';

export const configurationSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  
  configuration_name: z
    .string()
    .min(1, 'Name required')
    .max(100, 'Name too long')
    .optional(),
  
  total_price: z
    .number()
    .positive('Price must be positive')
    .max(1000000, 'Price too high')
    .multipleOf(0.01, 'Invalid price format'),
  
  quantity: z
    .number()
    .int('Quantity must be integer')
    .positive('Quantity must be positive')
    .max(1000, 'Quantity too high')
    .default(1),
  
  configuration_data: z.record(
    z.string().uuid('Invalid option ID'),
    z.string().uuid('Invalid value ID')
  ),
  
  session_id: z
    .string()
    .min(10)
    .max(100)
    .optional(),
  
  user_id: z
    .string()
    .uuid()
    .optional()
});

export type ConfigurationInput = z.infer<typeof configurationSchema>;

// Validate before save
export function validateConfiguration(input: unknown): ConfigurationInput {
  return configurationSchema.parse(input);
}

// Validate with error handling
export function safeValidateConfiguration(input: unknown) {
  const result = configurationSchema.safeParse(input);
  
  if (!result.success) {
    return {
      success: false,
      errors: result.error.flatten().fieldErrors
    };
  }
  
  return {
    success: true,
    data: result.data
  };
}
```

**Use in components:**

```typescript
// src/components/ProductConfigurator.tsx
import { safeValidateConfiguration } from '@/lib/validation';

const handleSave = async () => {
  const input = {
    product_id: product.id,
    configuration_name: configName,
    total_price: totalPrice,
    quantity,
    configuration_data: selectedOptions,
    session_id: sessionId
  };
  
  // Validate before sending
  const validation = safeValidateConfiguration(input);
  
  if (!validation.success) {
    Object.entries(validation.errors).forEach(([field, messages]) => {
      toast.error(`${field}: ${messages.join(', ')}`);
    });
    return;
  }
  
  // Now safe to save
  const { data, error } = await supabase
    .from('product_configurations')
    .insert(validation.data);
    
  // ... rest of code
};
```

---

### 4. Weak Session Management (MEDIUM)

#### Problem

Predictable session ID generation:

```typescript
// src/services/analyticsTracker.ts
startSession(productId: string): string {
  const sessionId = `session_${Date.now()}_${Math.random()}`;  // ⚠️ Predictable
  // ...
  return sessionId;
}
```

#### Impact

1. **Privacy Violation**
   - Attacker can guess other users' session IDs
   - Access configurations from other anonymous users
   - Track user behavior across sessions

2. **Data Leakage**
   - Anonymous configurations not truly anonymous
   - Session hijacking possible
   - Cross-user data access

#### Attack Scenario

```javascript
// Attacker can enumerate sessions
const baseTimestamp = Date.now();

for (let i = 0; i < 1000; i++) {
  const guessedId = `session_${baseTimestamp - i}_${Math.random()}`;
  
  // Try to access configuration
  const { data } = await supabase
    .from('product_configurations')
    .select('*')
    .eq('session_id', guessedId);
  
  if (data && data.length > 0) {
    console.log('Found session:', data);  // ⚠️ Privacy breach
  }
}
```

#### Required Fix

```typescript
// src/services/analyticsTracker.ts
startSession(productId: string): string {
  // Use crypto-secure UUID
  const sessionId = crypto.randomUUID();  // ✅ Cryptographically secure
  
  this.currentSession = {
    sessionId,
    productId,
    startTime: Date.now(),
    interactions: []
  };
  
  return sessionId;
}
```

**Additional improvements:**

```typescript
// Add session expiration
const SESSION_EXPIRATION = 24 * 60 * 60 * 1000; // 24 hours

isSessionValid(sessionId: string): boolean {
  const session = this.sessions.get(sessionId);
  if (!session) return false;
  
  const age = Date.now() - session.startTime;
  return age < SESSION_EXPIRATION;
}

// Rotate session IDs periodically
rotateSession(oldSessionId: string): string {
  const oldSession = this.sessions.get(oldSessionId);
  if (!oldSession) return this.startSession(oldSession.productId);
  
  const newSessionId = crypto.randomUUID();
  this.sessions.set(newSessionId, {
    ...oldSession,
    sessionId: newSessionId,
    previousSessionId: oldSessionId
  });
  
  return newSessionId;
}
```

---

### 5. No Authentication System (HIGH)

#### Problem

No authentication implemented:

- No user signup/login
- No admin panel
- No role-based access control
- No audit logging

#### Impact

1. **No Access Control**
   - Anyone can modify products (if RLS not properly set)
   - No admin vs. user distinction
   - No audit trail

2. **No User Management**
   - Can't track user configurations
   - No personalization
   - No order history

3. **No Accountability**
   - Can't identify who made changes
   - No audit logs
   - No compliance with regulations

#### Required Fix

**Implement Supabase Auth:**

```typescript
// src/lib/auth.ts
import { supabase } from '@/integrations/supabase/client';

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        role: 'user'  // Default role
      }
    }
  });
  
  return { data, error };
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  
  return { data, error };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  return { error };
}

export async function getCurrentUser() {
  const { data: { user } } = await supabase.auth.getUser();
  return user;
}

export async function isAdmin() {
  const user = await getCurrentUser();
  return user?.user_metadata?.role === 'admin';
}
```

**Create admin role system:**

```sql
-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_role CHECK (role IN ('user', 'admin'))
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile"
ON public.profiles FOR SELECT
USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id AND role = 'user');  -- Can't promote self

CREATE POLICY "Admins can view all profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  )
);

-- Function to create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'role', 'user'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## Security Checklist

Before deploying to production, ensure all items are checked:

### Critical (Must Fix)

- [ ] **Restrict RLS policies** for pricing_rules, configuration_rules, inventory_levels to admin-only
- [ ] **Implement server-side validation** via Supabase Edge Functions
- [ ] **Implement server-side pricing** calculation
- [ ] **Add input validation** with Zod schemas
- [ ] **Implement authentication** with Supabase Auth
- [ ] **Create admin role system** with proper RBAC
- [ ] **Use crypto.randomUUID()** for session IDs
- [ ] **Add rate limiting** to prevent abuse

### High Priority (Should Fix)

- [ ] Add request validation middleware
- [ ] Implement audit logging
- [ ] Add CSRF protection
- [ ] Implement session expiration
- [ ] Add SQL injection prevention (use parameterized queries)
- [ ] Sanitize all user inputs
- [ ] Add Content Security Policy headers
- [ ] Enable CORS properly

### Medium Priority (Good to Have)

- [ ] Implement rate limiting per endpoint
- [ ] Add request signing for API calls
- [ ] Implement webhook verification
- [ ] Add monitoring and alerting
- [ ] Implement automated security testing
- [ ] Add penetration testing
- [ ] Create security incident response plan

### Best Practices

- [ ] Use HTTPS everywhere
- [ ] Implement proper error handling (don't leak info)
- [ ] Use environment variables for secrets
- [ ] Implement proper logging (but not sensitive data)
- [ ] Regular security audits
- [ ] Keep dependencies updated
- [ ] Implement proper backup strategy
- [ ] Use principle of least privilege
- [ ] Implement defense in depth

---

## Testing Security

### Test RLS Policies

```sql
-- Test as anonymous user
SET ROLE anon;
SELECT * FROM pricing_rules;  -- Should return nothing

-- Test as authenticated user
SET ROLE authenticated;
SET request.jwt.claim.role = 'user';
SELECT * FROM pricing_rules;  -- Should return nothing

-- Test as admin
SET ROLE authenticated;
SET request.jwt.claim.role = 'admin';
SELECT * FROM pricing_rules;  -- Should return data
```

### Test Edge Functions

```bash
# Test validation endpoint
curl -X POST https://your-project.supabase.co/functions/v1/validate-configuration \
  -H "Authorization: Bearer YOUR_ANON_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "productId": "invalid-uuid",
    "selectedOptions": {},
    "quantity": -5
  }'

# Should return 400 with validation errors
```

### Security Scanning

```bash
# Install OWASP ZAP or similar
# Run automated security scan
zap-cli quick-scan https://your-app-url.com

# Check for common vulnerabilities
npm audit
npm audit fix
```

---

## Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Supabase Security Best Practices](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Zod Documentation](https://zod.dev/)

---

## Reporting Security Issues

If you discover a security vulnerability, please email:

**security@your-domain.com**

Do NOT open a public issue for security vulnerabilities.

---

**Last Updated:** 2024-01-15  
**Status:** ⚠️ Critical security issues present - NOT production ready
