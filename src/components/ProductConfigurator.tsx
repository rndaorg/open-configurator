import { useState, useEffect } from 'react';
import { useProductById } from '@/hooks/useProducts';
import { RuleEngine } from '@/services/ruleEngine';
import { PricingEngine, PricingResult } from '@/services/pricingEngine';
import { Product3DVisualization } from '@/components/Product3DVisualization';
import { RecommendationEngine } from '@/components/RecommendationEngine';
import { ConfigurationComparison } from '@/components/ConfigurationComparison';
import { PricingBreakdown } from '@/components/PricingBreakdown';
import { InventoryStatus } from '@/components/InventoryStatus';
import { RuleNotifications } from '@/components/RuleNotifications';
import { QuantitySelector } from '@/components/QuantitySelector';
import { analyticsTracker } from '@/services/analyticsTracker';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { ArrowLeft, ShoppingCart, Save, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface ProductConfiguratorProps {
  productId: string;
  onBack: () => void;
}

interface SelectedOptions {
  [optionId: string]: string; // optionId -> valueId
}

export const ProductConfigurator = ({ productId, onBack }: ProductConfiguratorProps) => {
  const { data: product, isLoading } = useProductById(productId);
  const [selectedOptions, setSelectedOptions] = useState<SelectedOptions>({});
  const [quantity, setQuantity] = useState(1);
  const [pricingResult, setPricingResult] = useState<PricingResult | null>(null);
  const [ruleNotifications, setRuleNotifications] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [ruleEngine] = useState(() => new RuleEngine());
  const [pricingEngine] = useState(() => new PricingEngine());
  const [sessionId, setSessionId] = useState<string | null>(null);

  // Initialize engines and analytics
  useEffect(() => {
    if (product) {
      ruleEngine.loadRules(productId);
      pricingEngine.loadPricingRules(productId);
      const id = analyticsTracker.startSession(productId);
      setSessionId(id);
    }
  }, [product, productId]);

  // Calculate pricing and apply rules when selections or quantity change
  useEffect(() => {
    if (!product) return;
    
    // Apply configuration rules
    const ruleResult = ruleEngine.applyRules(selectedOptions, product);
    
    // Generate rule notifications
    const notifications: any[] = [];
    
    if (ruleResult.restrictions.length > 0) {
      ruleResult.restrictions.forEach(restriction => {
        notifications.push({
          type: 'restriction',
          message: restriction
        });
      });
    }
    
    if (Object.keys(ruleResult.autoSelections).length > 0) {
      Object.entries(ruleResult.autoSelections).forEach(([optionId, valueId]) => {
        notifications.push({
          type: 'auto_select',
          message: 'Smart recommendation available based on your selections',
          optionId,
          valueId
        });
      });
    }
    
    setRuleNotifications(notifications);
    
    // Calculate pricing with all discounts and rules
    const pricing = pricingEngine.calculatePrice({
      basePrice: product.base_price,
      selectedOptions,
      quantity,
      product
    });
    
    // Add rule-based price modifiers
    if (ruleResult.priceModifiers !== 0) {
      pricing.finalPrice += ruleResult.priceModifiers;
      pricing.breakdown.push({
        item: 'Configuration Rules Adjustment',
        price: ruleResult.priceModifiers
      });
    }
    
    setPricingResult(pricing);
  }, [selectedOptions, quantity, product, ruleEngine, pricingEngine]);

  const handleOptionSelect = (optionId: string, valueId: string) => {
    setSelectedOptions(prev => ({
      ...prev,
      [optionId]: valueId
    }));
  };

  const handleSaveConfiguration = async () => {
    if (!product) return;
    
    setIsSaving(true);
    try {
      // Get current user session
      const { data: { user } } = await supabase.auth.getUser();
      
      // Prepare configuration data with proper security columns
      const configData: any = {
        product_id: productId,
        configuration_name: `${product.name} Configuration`,
        total_price: pricingResult?.finalPrice || 0,
        configuration_data: {
          ...selectedOptions,
          quantity,
          pricing: pricingResult
        }
      };
      
      // Add user_id if authenticated, otherwise use session_id
      if (user) {
        configData.user_id = user.id;
      } else {
        configData.session_id = sessionId;
      }
      
      const { error } = await supabase
        .from('product_configurations')
        .insert(configData);
      
      if (error) throw error;
      
      toast.success('Configuration saved successfully!');
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="w-12 h-12 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">Loading configurator...</p>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-2xl font-bold text-muted-foreground">Product not found</p>
          <Button onClick={onBack}>Back to Catalog</Button>
        </div>
      </div>
    );
  }

  const configOptions = product.config_options || [];
  const isConfigurationComplete = configOptions
    .filter(option => option.is_required)
    .every(option => selectedOptions[option.id]);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-background/95 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                onClick={onBack}
                className="hover:bg-muted"
              >
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to Catalog
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h1 className="text-2xl font-bold">{product.name}</h1>
                <p className="text-muted-foreground">Configure your product</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Final Price</p>
                <p className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  ${pricingResult?.finalPrice.toLocaleString() || '0'}
                </p>
                {pricingResult && pricingResult.discounts.length > 0 && (
                  <p className="text-xs text-accent">
                    Save ${(pricingResult.originalPrice - pricingResult.finalPrice).toLocaleString()}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Product Visualization */}
          <div className="space-y-6">
            <Product3DVisualization 
              product={product}
              selectedOptions={selectedOptions}
            />
            
            <Card className="glass-card p-6">
              <h3 className="text-lg font-semibold mb-4">Product Details</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Base Price</span>
                  <span className="font-semibold">${product.base_price.toLocaleString()}</span>
                </div>
                <Separator />
                <p className="text-sm text-muted-foreground">{product.description}</p>
              </div>
            </Card>
          </div>

          {/* Configuration Options */}
          <div className="space-y-6">
            {/* Rule Notifications */}
            {ruleNotifications.length > 0 && (
              <RuleNotifications
                notifications={ruleNotifications}
                onApplyAutoSelection={handleOptionSelect}
              />
            )}

            {/* Quantity Selector */}
            <QuantitySelector
              quantity={quantity}
              onQuantityChange={setQuantity}
            />

            {configOptions.length === 0 ? (
              <Card className="glass-card p-8 text-center">
                <p className="text-muted-foreground">No configuration options available for this product.</p>
              </Card>
            ) : (
              configOptions
                .sort((a, b) => a.display_order - b.display_order)
                .map((option) => {
                  const availableValues = ruleEngine.getAvailableOptions(selectedOptions, product, option.id);
                  
                  return (
                    <Card key={option.id} className="glass-card p-6">
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <h3 className="text-lg font-semibold">{option.name}</h3>
                          {option.is_required && (
                            <Badge variant="destructive" className="text-xs">
                              Required
                            </Badge>
                          )}
                        </div>
                        
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                          {option.option_values
                            ?.filter(value => value.is_available)
                            ?.sort((a, b) => a.display_order - b.display_order)
                            ?.map((value) => {
                              const isSelected = selectedOptions[option.id] === value.id;
                              const hasUpcharge = value.price_modifier > 0;
                              const isRestricted = availableValues.length > 0 && !availableValues.includes(value.id);
                              
                              return (
                                <button
                                  key={value.id}
                                  onClick={() => !isRestricted && handleOptionSelect(option.id, value.id)}
                                  disabled={isRestricted}
                                  className={`p-4 rounded-lg border-2 transition-all duration-300 text-left ${
                                    isSelected
                                      ? 'border-primary bg-gradient-glass shadow-glow'
                                      : isRestricted
                                      ? 'border-border bg-muted/20 opacity-50 cursor-not-allowed'
                                      : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                  }`}
                                >
                                  {value.hex_color && (
                                    <div
                                      className="w-6 h-6 rounded-full mb-2 border border-border"
                                      style={{ backgroundColor: value.hex_color }}
                                    />
                                  )}
                                  {value.image_url && (
                                    <img
                                      src={value.image_url}
                                      alt={value.name}
                                      className="w-full h-16 object-cover rounded mb-2"
                                    />
                                  )}
                                  <div className="space-y-1">
                                    <p className="font-medium text-sm">{value.name}</p>
                                    {hasUpcharge && !isRestricted && (
                                      <p className="text-xs text-accent">
                                        +${value.price_modifier.toLocaleString()}
                                      </p>
                                    )}
                                    {isRestricted && (
                                      <p className="text-xs text-destructive">Not available</p>
                                    )}
                                  </div>
                                  {!isRestricted && <InventoryStatus optionValueId={value.id} />}
                                </button>
                              );
                            })}
                        </div>
                      </div>
                    </Card>
                  );
                })
            )}
            
            {/* Pricing Breakdown */}
            {pricingResult && (
              <PricingBreakdown
                pricingResult={pricingResult}
                quantity={quantity}
              />
            )}
            
            {/* Action Buttons */}
            <div className="space-y-4">
              <div className="flex gap-3">
                <Button
                  onClick={handleSaveConfiguration}
                  disabled={isSaving}
                  variant="outline"
                  className="flex-1"
                >
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4 mr-2" />
                  )}
                  Save Config
                </Button>
                
                <Button
                  disabled={!isConfigurationComplete}
                  className="flex-1 bg-gradient-primary hover:shadow-glow transition-all duration-300"
                >
                  <ShoppingCart className="w-4 h-4 mr-2" />
                  Add to Cart
                </Button>
              </div>
              
              {!isConfigurationComplete && (
                <p className="text-sm text-muted-foreground text-center">
                  Please complete all required options to proceed
                </p>
              )}
            </div>
          </div>

          {/* Advanced Features Sidebar */}
          <div className="space-y-6">
            <RecommendationEngine
              product={product}
              selectedOptions={selectedOptions}
              onApplyRecommendation={(optionId, valueId) => {
                handleOptionSelect(optionId, valueId);
                analyticsTracker.trackRecommendationApplied(productId, 'ai_suggestion', optionId, valueId);
              }}
            />
            
            <ConfigurationComparison
              product={product}
              currentConfiguration={{
                selectedOptions,
                totalPrice: pricingResult?.finalPrice || 0
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};