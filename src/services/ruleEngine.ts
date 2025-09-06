import { supabase } from '@/integrations/supabase/client';

export interface ConfigurationRule {
  id: string;
  product_id: string;
  rule_name: string;
  rule_type: 'dependency' | 'restriction' | 'auto_select' | 'pricing';
  conditions: any;
  actions: any;
  priority: number;
  is_active: boolean;
}

export interface SelectedOptions {
  [optionId: string]: string;
}

export class RuleEngine {
  private rules: ConfigurationRule[] = [];
  
  async loadRules(productId: string) {
    const { data, error } = await supabase
      .from('configuration_rules')
      .select('*')
      .eq('product_id', productId)
      .eq('is_active', true)
      .order('priority', { ascending: false });
    
      if (error) throw error;
      this.rules = (data || []) as ConfigurationRule[];
  }

  applyRules(selectedOptions: SelectedOptions, product: any): {
    validatedOptions: SelectedOptions;
    restrictions: string[];
    autoSelections: SelectedOptions;
    priceModifiers: number;
  } {
    let validatedOptions = { ...selectedOptions };
    const restrictions: string[] = [];
    const autoSelections: SelectedOptions = {};
    let priceModifiers = 0;

    // Sort rules by priority
    const sortedRules = [...this.rules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      if (!this.evaluateConditions(rule.conditions, validatedOptions, product)) {
        continue;
      }

      switch (rule.rule_type) {
        case 'dependency':
          this.applyDependencyRule(rule, validatedOptions, restrictions);
          break;
        case 'restriction':
          this.applyRestrictionRule(rule, validatedOptions, restrictions);
          break;
        case 'auto_select':
          this.applyAutoSelectRule(rule, validatedOptions, autoSelections);
          break;
        case 'pricing':
          priceModifiers += this.applyPricingRule(rule, validatedOptions);
          break;
      }
    }

    return {
      validatedOptions,
      restrictions,
      autoSelections,
      priceModifiers
    };
  }

  private evaluateConditions(conditions: any, selectedOptions: SelectedOptions, product: any): boolean {
    if (!conditions || typeof conditions !== 'object') return true;

    // Simple condition evaluation
    if (conditions.selectedOptions) {
      for (const [optionId, valueId] of Object.entries(conditions.selectedOptions)) {
        if (selectedOptions[optionId] !== valueId) return false;
      }
    }

    if (conditions.productType && product.categories?.name !== conditions.productType) {
      return false;
    }

    return true;
  }

  private applyDependencyRule(rule: ConfigurationRule, options: SelectedOptions, restrictions: string[]) {
    const { required_option, required_value } = rule.actions;
    if (required_option && !options[required_option]) {
      restrictions.push(`${rule.rule_name}: Please select ${required_option}`);
    }
  }

  private applyRestrictionRule(rule: ConfigurationRule, options: SelectedOptions, restrictions: string[]) {
    const { restricted_options } = rule.actions;
    if (restricted_options) {
      for (const optionId of restricted_options) {
        if (options[optionId]) {
          restrictions.push(`${rule.rule_name}: ${optionId} is not available with current selection`);
          delete options[optionId];
        }
      }
    }
  }

  private applyAutoSelectRule(rule: ConfigurationRule, options: SelectedOptions, autoSelections: SelectedOptions) {
    const { auto_select_option, auto_select_value } = rule.actions;
    if (auto_select_option && auto_select_value && !options[auto_select_option]) {
      autoSelections[auto_select_option] = auto_select_value;
    }
  }

  private applyPricingRule(rule: ConfigurationRule, options: SelectedOptions): number {
    const { price_modifier } = rule.actions;
    return price_modifier || 0;
  }

  getAvailableOptions(selectedOptions: SelectedOptions, product: any, optionId: string): string[] {
    const availableValues: string[] = [];
    const option = product.config_options?.find((opt: any) => opt.id === optionId);
    
    if (!option) return availableValues;

    for (const value of option.option_values || []) {
      if (!value.is_available) continue;

      const testOptions = { ...selectedOptions, [optionId]: value.id };
      const result = this.applyRules(testOptions, product);
      
      if (result.restrictions.length === 0) {
        availableValues.push(value.id);
      }
    }

    return availableValues;
  }
}