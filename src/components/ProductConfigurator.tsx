import { useState, useEffect } from 'react';
import { useProductById } from '@/hooks/useProducts';
import { RuleEngine } from '@/services/ruleEngine';
import { PricingEngine } from '@/services/pricingEngine';
import { Product3DVisualization } from '@/components/Product3DVisualization';
import { RecommendationEngine } from '@/components/RecommendationEngine';
import { ConfigurationComparison } from '@/components/ConfigurationComparison';
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
  const [totalPrice, setTotalPrice] = useState(0);
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

  // Calculate total price when selections change
  useEffect(() => {
    if (!product) return;
    
    let price = product.base_price;
    
    // Add price modifiers from selected options
    Object.values(selectedOptions).forEach(valueId => {
      const optionValue = product.config_options
        ?.flatMap(option => option.option_values)
        ?.find(value => value.id === valueId);
      
      if (optionValue) {
        price += optionValue.price_modifier;
      }
    });
    
    setTotalPrice(price);
  }, [selectedOptions, product]);

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
      const { error } = await supabase
        .from('product_configurations')
        .insert({
          product_id: productId,
          configuration_name: `${product.name} Configuration`,
          total_price: totalPrice,
          configuration_data: selectedOptions
        });
      
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
                <p className="text-sm text-muted-foreground">Total Price</p>
                <p className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  ${totalPrice.toLocaleString()}
                </p>
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
            {configOptions.length === 0 ? (
              <Card className="glass-card p-8 text-center">
                <p className="text-muted-foreground">No configuration options available for this product.</p>
              </Card>
            ) : (
              configOptions
                .sort((a, b) => a.display_order - b.display_order)
                .map((option) => (
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
                            
                            return (
                              <button
                                key={value.id}
                                onClick={() => handleOptionSelect(option.id, value.id)}
                                className={`p-4 rounded-lg border-2 transition-all duration-300 text-left ${
                                  isSelected
                                    ? 'border-primary bg-gradient-glass shadow-glow'
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
                                  {hasUpcharge && (
                                    <p className="text-xs text-accent">
                                      +${value.price_modifier.toLocaleString()}
                                    </p>
                                  )}
                                </div>
                              </button>
                            );
                          })}
                      </div>
                    </div>
                  </Card>
                ))
            )}
            
            {/* Action Buttons */}
            <div className="space-y-4">
              <Card className="glass-card p-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-semibold">Configuration Total</span>
                    <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                      ${totalPrice.toLocaleString()}
                    </span>
                  </div>
                  
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
              </Card>
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
                totalPrice
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};