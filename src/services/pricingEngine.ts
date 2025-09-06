import { supabase } from '@/integrations/supabase/client';

export interface PricingRule {
  id: string;
  product_id: string;
  rule_name: string;
  rule_type: 'volume_discount' | 'time_based' | 'bundle' | 'conditional';
  conditions: any;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  min_quantity: number;
  valid_from?: string;
  valid_until?: string;
  is_active: boolean;
}

export interface PricingContext {
  basePrice: number;
  selectedOptions: { [optionId: string]: string };
  quantity: number;
  product: any;
  customerSegment?: string;
}

export interface PricingResult {
  originalPrice: number;
  finalPrice: number;
  discounts: Array<{
    rule: string;
    type: string;
    amount: number;
    description: string;
  }>;
  breakdown: Array<{
    item: string;
    price: number;
  }>;
}

export class PricingEngine {
  private rules: PricingRule[] = [];

  async loadPricingRules(productId: string) {
    const { data, error } = await supabase
      .from('pricing_rules')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true);
    
      if (error) throw error;
      this.rules = (data || []) as PricingRule[];
  }

  calculatePrice(context: PricingContext): PricingResult {
    const { basePrice, selectedOptions, quantity, product } = context;
    
    // Start with base price calculation
    let price = basePrice * quantity;
    const breakdown = [{ item: 'Base Price', price: basePrice * quantity }];
    const discounts: PricingResult['discounts'] = [];

    // Add option modifiers
    let optionTotal = 0;
    Object.values(selectedOptions).forEach(valueId => {
      const optionValue = product.config_options
        ?.flatMap((option: any) => option.option_values)
        ?.find((value: any) => value.id === valueId);
      
      if (optionValue && optionValue.price_modifier !== 0) {
        const modifier = optionValue.price_modifier * quantity;
        optionTotal += modifier;
        breakdown.push({
          item: optionValue.name,
          price: modifier
        });
      }
    });

    price += optionTotal;

    // Apply pricing rules
    const applicableRules = this.getApplicableRules(context);
    
    for (const rule of applicableRules) {
      const discount = this.applyPricingRule(rule, price, context);
      if (discount.amount > 0) {
        discounts.push(discount);
        price -= discount.amount;
      }
    }

    // Apply dynamic pricing based on demand/inventory
    const dynamicPricing = this.calculateDynamicPricing(context);
    if (dynamicPricing !== 0) {
      const dynamicDiscount = {
        rule: 'Dynamic Pricing',
        type: dynamicPricing > 0 ? 'surcharge' : 'discount',
        amount: Math.abs(dynamicPricing),
        description: dynamicPricing > 0 
          ? 'High demand surcharge' 
          : 'Low inventory discount'
      };
      discounts.push(dynamicDiscount);
      price += dynamicPricing;
    }

    return {
      originalPrice: basePrice * quantity + optionTotal,
      finalPrice: Math.max(0, price),
      discounts,
      breakdown
    };
  }

  private getApplicableRules(context: PricingContext): PricingRule[] {
    const now = new Date();
    
    return this.rules.filter(rule => {
      // Check time validity
      if (rule.valid_from && new Date(rule.valid_from) > now) return false;
      if (rule.valid_until && new Date(rule.valid_until) < now) return false;
      
      // Check minimum quantity
      if (context.quantity < rule.min_quantity) return false;
      
      // Check conditions
      return this.evaluateRuleConditions(rule, context);
    });
  }

  private evaluateRuleConditions(rule: PricingRule, context: PricingContext): boolean {
    const { conditions } = rule;
    if (!conditions) return true;

    // Volume discount conditions
    if (rule.rule_type === 'volume_discount') {
      return context.quantity >= (conditions.min_quantity || rule.min_quantity);
    }

    // Bundle conditions
    if (rule.rule_type === 'bundle') {
      const requiredOptions = conditions.required_options || [];
      return requiredOptions.every((optionId: string) => 
        context.selectedOptions[optionId]
      );
    }

    // Conditional pricing
    if (rule.rule_type === 'conditional') {
      if (conditions.customer_segment && 
          context.customerSegment !== conditions.customer_segment) {
        return false;
      }
      
      if (conditions.selected_options) {
        return Object.entries(conditions.selected_options).every(([optionId, valueId]) =>
          context.selectedOptions[optionId] === valueId
        );
      }
    }

    return true;
  }

  private applyPricingRule(rule: PricingRule, currentPrice: number, context: PricingContext) {
    let discountAmount = 0;
    let description = rule.rule_name;

    switch (rule.rule_type) {
      case 'volume_discount':
        if (rule.discount_type === 'percentage') {
          discountAmount = currentPrice * (rule.discount_value / 100);
          description = `${rule.discount_value}% volume discount`;
        } else {
          discountAmount = rule.discount_value;
          description = `$${rule.discount_value} volume discount`;
        }
        break;
        
      case 'bundle':
        if (rule.discount_type === 'percentage') {
          discountAmount = currentPrice * (rule.discount_value / 100);
          description = `${rule.discount_value}% bundle discount`;
        } else {
          discountAmount = rule.discount_value;
          description = `$${rule.discount_value} bundle savings`;
        }
        break;
        
      case 'time_based':
        if (rule.discount_type === 'percentage') {
          discountAmount = currentPrice * (rule.discount_value / 100);
          description = `${rule.discount_value}% limited time offer`;
        } else {
          discountAmount = rule.discount_value;
          description = `$${rule.discount_value} limited time savings`;
        }
        break;
        
      case 'conditional':
        if (rule.discount_type === 'percentage') {
          discountAmount = currentPrice * (rule.discount_value / 100);
          description = `${rule.discount_value}% special pricing`;
        } else {
          discountAmount = rule.discount_value;
          description = `$${rule.discount_value} special offer`;
        }
        break;
    }

    return {
      rule: rule.rule_name,
      type: rule.discount_type,
      amount: discountAmount,
      description
    };
  }

  private calculateDynamicPricing(context: PricingContext): number {
    // Simulate dynamic pricing based on various factors
    const basePrice = context.basePrice;
    
    // Time-based pricing (higher during peak hours)
    const hour = new Date().getHours();
    const isPeakHour = hour >= 9 && hour <= 17;
    const timeModifier = isPeakHour ? 0.05 : -0.02;
    
    // Demand-based pricing (simulate with random factor)
    const demandFactor = Math.random() * 0.1 - 0.05;
    
    // Apply modifiers
    const totalModifier = timeModifier + demandFactor;
    return basePrice * totalModifier * context.quantity;
  }

  // Get pricing insights for analytics
  getPricingInsights(context: PricingContext): {
    competitivePosition: 'low' | 'medium' | 'high';
    valueScore: number;
    recommendedActions: string[];
  } {
    const result = this.calculatePrice(context);
    const savingsPercentage = ((result.originalPrice - result.finalPrice) / result.originalPrice) * 100;
    
    return {
      competitivePosition: result.finalPrice < 1000 ? 'low' : result.finalPrice > 5000 ? 'high' : 'medium',
      valueScore: Math.min(100, Math.max(0, 80 + savingsPercentage)),
      recommendedActions: savingsPercentage > 10 
        ? ['Highlight significant savings', 'Consider upselling premium options']
        : ['Add value proposition', 'Consider bundle offers']
    };
  }
}