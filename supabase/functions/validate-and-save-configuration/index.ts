import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ConfigurationRequest {
  productId: string;
  selectedOptions: Record<string, string>;
  quantity: number;
  configurationName?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Get user from request
    const authHeader = req.headers.get('Authorization');
    let userId: string | null = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      userId = user?.id ?? null;
    }

    const { productId, selectedOptions, quantity, configurationName }: ConfigurationRequest = await req.json();

    console.log('Validating configuration for product:', productId);

    // 1. Load configuration rules from database
    const { data: rules, error: rulesError } = await supabaseClient
      .from('configuration_rules')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('priority', { ascending: false });

    if (rulesError) {
      console.error('Error loading rules:', rulesError);
      throw new Error('Failed to load configuration rules');
    }

    console.log(`Loaded ${rules?.length || 0} configuration rules`);

    // 2. Validate configuration against rules
    const violations = validateRules(rules || [], selectedOptions);
    if (violations.length > 0) {
      console.log('Configuration violations:', violations);
      return new Response(
        JSON.stringify({ error: 'Configuration invalid', violations }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 3. Load pricing rules
    const { data: pricingRules, error: pricingError } = await supabaseClient
      .from('pricing_rules')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true);

    if (pricingError) {
      console.error('Error loading pricing rules:', pricingError);
      throw new Error('Failed to load pricing rules');
    }

    // 4. Calculate server-side price
    const { data: product } = await supabaseClient
      .from('products')
      .select('base_price')
      .eq('id', productId)
      .single();

    if (!product) {
      throw new Error('Product not found');
    }

    const finalPrice = calculatePrice(
      product.base_price,
      selectedOptions,
      quantity,
      pricingRules || []
    );

    console.log('Calculated price:', finalPrice);

    // 5. Check inventory availability
    const inventoryValid = await checkInventory(supabaseClient, selectedOptions);
    if (!inventoryValid) {
      return new Response(
        JSON.stringify({ error: 'Insufficient inventory for selected options' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Save configuration with validated price
    const { data: config, error: saveError } = await supabaseClient
      .from('product_configurations')
      .insert({
        product_id: productId,
        user_id: userId,
        configuration_name: configurationName || null,
        total_price: finalPrice,
        configuration_data: selectedOptions
      })
      .select()
      .single();

    if (saveError) {
      console.error('Error saving configuration:', saveError);
      throw new Error('Failed to save configuration');
    }

    console.log('Configuration saved successfully:', config.id);

    return new Response(
      JSON.stringify({ success: true, configuration: config }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('Error in validate-and-save-configuration:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function validateRules(rules: any[], options: Record<string, string>): string[] {
  const violations: string[] = [];

  for (const rule of rules) {
    if (!evaluateConditions(rule.conditions, options)) {
      continue;
    }

    switch (rule.rule_type) {
      case 'dependency':
        if (rule.actions.required_option && !options[rule.actions.required_option]) {
          violations.push(`${rule.rule_name}: Required option missing`);
        }
        break;
      
      case 'restriction':
        if (rule.actions.restricted_options) {
          for (const optionId of rule.actions.restricted_options) {
            if (options[optionId]) {
              violations.push(`${rule.rule_name}: Invalid option combination`);
            }
          }
        }
        break;
    }
  }

  return violations;
}

function evaluateConditions(conditions: any, options: Record<string, string>): boolean {
  if (!conditions || typeof conditions !== 'object') return true;

  if (conditions.selectedOptions) {
    for (const [optionId, valueId] of Object.entries(conditions.selectedOptions)) {
      if (options[optionId] !== valueId) return false;
    }
  }

  return true;
}

function calculatePrice(
  basePrice: number,
  options: Record<string, string>,
  quantity: number,
  pricingRules: any[]
): number {
  let price = Number(basePrice);

  // Apply pricing rules
  for (const rule of pricingRules) {
    if (!evaluateConditions(rule.conditions, options)) {
      continue;
    }

    if (quantity < (rule.min_quantity || 1)) {
      continue;
    }

    // Check time validity
    const now = new Date();
    if (rule.valid_from && new Date(rule.valid_from) > now) continue;
    if (rule.valid_until && new Date(rule.valid_until) < now) continue;

    // Apply discount
    if (rule.discount_type === 'percentage') {
      price -= price * (Number(rule.discount_value) / 100);
    } else if (rule.discount_type === 'fixed') {
      price -= Number(rule.discount_value);
    }
  }

  return Math.max(0, price * quantity);
}

async function checkInventory(
  supabaseClient: any,
  options: Record<string, string>
): Promise<boolean> {
  for (const valueId of Object.values(options)) {
    const { data: inventory } = await supabaseClient
      .from('inventory_levels')
      .select('available_quantity, reserved_quantity')
      .eq('option_value_id', valueId)
      .single();

    if (inventory) {
      const availableStock = inventory.available_quantity - inventory.reserved_quantity;
      if (availableStock <= 0) {
        return false;
      }
    }
  }

  return true;
}
