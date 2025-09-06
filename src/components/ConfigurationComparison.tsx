import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { GitCompare, Plus, X, CheckCircle, XCircle } from 'lucide-react';

interface Configuration {
  id: string;
  name: string;
  selectedOptions: { [optionId: string]: string };
  totalPrice: number;
}

interface ConfigurationComparisonProps {
  product: any;
  currentConfiguration: {
    selectedOptions: { [optionId: string]: string };
    totalPrice: number;
  };
  className?: string;
}

export const ConfigurationComparison = ({
  product,
  currentConfiguration,
  className = ""
}: ConfigurationComparisonProps) => {
  const [savedConfigurations, setSavedConfigurations] = useState<Configuration[]>([
    // Mock saved configurations for demo
    {
      id: '1',
      name: 'Basic Configuration',
      selectedOptions: {},
      totalPrice: product.base_price
    },
    {
      id: '2',
      name: 'Premium Setup',
      selectedOptions: {},
      totalPrice: product.base_price * 1.5
    }
  ]);
  
  const [compareList, setCompareList] = useState<Configuration[]>([]);
  const [isCompareDialogOpen, setIsCompareDialogOpen] = useState(false);

  const addToCompare = (config: Configuration) => {
    if (compareList.length < 3 && !compareList.find(c => c.id === config.id)) {
      setCompareList([...compareList, config]);
    }
  };

  const removeFromCompare = (configId: string) => {
    setCompareList(compareList.filter(c => c.id !== configId));
  };

  const addCurrentToCompare = () => {
    const currentConfig: Configuration = {
      id: 'current',
      name: 'Current Configuration',
      selectedOptions: currentConfiguration.selectedOptions,
      totalPrice: currentConfiguration.totalPrice
    };
    
    if (!compareList.find(c => c.id === 'current')) {
      setCompareList([...compareList, currentConfig]);
    }
  };

  const getOptionValue = (config: Configuration, optionId: string) => {
    const valueId = config.selectedOptions[optionId];
    if (!valueId) return null;
    
    const option = product.config_options?.find((opt: any) => opt.id === optionId);
    return option?.option_values?.find((val: any) => val.id === valueId);
  };

  const ComparisonTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            <th className="text-left p-4 font-medium">Feature</th>
            {compareList.map(config => (
              <th key={config.id} className="text-center p-4 font-medium min-w-48">
                <div className="space-y-2">
                  <div>{config.name}</div>
                  <Badge variant="outline" className="text-xs">
                    ${config.totalPrice.toLocaleString()}
                  </Badge>
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Price comparison */}
          <tr className="border-b border-border">
            <td className="p-4 font-medium">Total Price</td>
            {compareList.map(config => (
              <td key={config.id} className="text-center p-4">
                <div className="text-xl font-bold bg-gradient-primary bg-clip-text text-transparent">
                  ${config.totalPrice.toLocaleString()}
                </div>
              </td>
            ))}
          </tr>
          
          {/* Base price */}
          <tr className="border-b border-border">
            <td className="p-4">Base Price</td>
            {compareList.map(config => (
              <td key={config.id} className="text-center p-4">
                ${product.base_price.toLocaleString()}
              </td>
            ))}
          </tr>

          {/* Configuration options */}
          {product.config_options?.map((option: any) => (
            <tr key={option.id} className="border-b border-border">
              <td className="p-4 font-medium">{option.name}</td>
              {compareList.map(config => {
                const value = getOptionValue(config, option.id);
                return (
                  <td key={config.id} className="text-center p-4">
                    {value ? (
                      <div className="space-y-1">
                        <div className="flex items-center justify-center gap-2">
                          {value.hex_color && (
                            <div 
                              className="w-4 h-4 rounded-full border border-border"
                              style={{ backgroundColor: value.hex_color }}
                            />
                          )}
                          <span className="font-medium">{value.name}</span>
                        </div>
                        {value.price_modifier !== 0 && (
                          <Badge 
                            variant={value.price_modifier > 0 ? "destructive" : "secondary"}
                            className="text-xs"
                          >
                            {value.price_modifier > 0 ? '+' : ''}${value.price_modifier}
                          </Badge>
                        )}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic">Not selected</span>
                    )}
                  </td>
                );
              })}
            </tr>
          ))}

          {/* Feature comparison */}
          <tr className="border-b border-border">
            <td className="p-4 font-medium">Premium Features</td>
            {compareList.map(config => {
              const hasPremiumFeatures = Object.values(config.selectedOptions).some(valueId => {
                const value = product.config_options
                  ?.flatMap((opt: any) => opt.option_values)
                  ?.find((val: any) => val.id === valueId);
                return value?.name.toLowerCase().includes('premium') || 
                       value?.name.toLowerCase().includes('luxury');
              });
              
              return (
                <td key={config.id} className="text-center p-4">
                  {hasPremiumFeatures ? (
                    <CheckCircle className="w-5 h-5 text-green-500 mx-auto" />
                  ) : (
                    <XCircle className="w-5 h-5 text-muted-foreground mx-auto" />
                  )}
                </td>
              );
            })}
          </tr>
          
          {/* Value score */}
          <tr className="border-b border-border">
            <td className="p-4 font-medium">Value Score</td>
            {compareList.map(config => {
              const optionCount = Object.keys(config.selectedOptions).length;
              const priceRatio = config.totalPrice / product.base_price;
              const valueScore = Math.round((optionCount / priceRatio) * 50);
              
              return (
                <td key={config.id} className="text-center p-4">
                  <div className="flex items-center justify-center gap-2">
                    <div className="text-2xl font-bold">{Math.min(100, Math.max(0, valueScore))}</div>
                    <div className="text-xs text-muted-foreground">/100</div>
                  </div>
                </td>
              );
            })}
          </tr>
        </tbody>
      </table>
    </div>
  );

  return (
    <Card className={`glass-card p-6 ${className}`}>
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <GitCompare className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Configuration Comparison</h3>
        </div>
        
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={addCurrentToCompare}
            disabled={compareList.find(c => c.id === 'current') !== undefined}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Current
          </Button>
          
          <Dialog open={isCompareDialogOpen} onOpenChange={setIsCompareDialogOpen}>
            <DialogTrigger asChild>
              <Button
                size="sm"
                disabled={compareList.length < 2}
                className="bg-gradient-primary hover:shadow-glow transition-all duration-300"
              >
                Compare ({compareList.length})
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Configuration Comparison</DialogTitle>
              </DialogHeader>
              {compareList.length >= 2 ? (
                <ComparisonTable />
              ) : (
                <p className="text-muted-foreground text-center py-8">
                  Add at least 2 configurations to compare
                </p>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Quick compare list */}
      {compareList.length > 0 && (
        <div className="space-y-4 mb-6">
          <h4 className="font-medium text-sm">Comparing:</h4>
          <div className="flex flex-wrap gap-2">
            {compareList.map(config => (
              <div key={config.id} className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2">
                <span className="text-sm font-medium">{config.name}</span>
                <Badge variant="outline" className="text-xs">
                  ${config.totalPrice.toLocaleString()}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFromCompare(config.id)}
                  className="h-auto p-1"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      <Separator className="my-4" />

      {/* Saved configurations */}
      <div className="space-y-4">
        <h4 className="font-medium text-sm">Saved Configurations:</h4>
        
        {savedConfigurations.length === 0 ? (
          <p className="text-muted-foreground text-sm italic">
            No saved configurations yet. Save your current configuration to compare later.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedConfigurations.map(config => (
              <div key={config.id} className="border border-border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h5 className="font-medium">{config.name}</h5>
                  <Badge variant="outline" className="text-xs">
                    ${config.totalPrice.toLocaleString()}
                  </Badge>
                </div>
                
                <div className="space-y-2 mb-3">
                  <div className="text-xs text-muted-foreground">
                    {Object.keys(config.selectedOptions).length} options selected
                  </div>
                  
                  {/* Show first few options */}
                  <div className="space-y-1">
                    {Object.entries(config.selectedOptions).slice(0, 2).map(([optionId, valueId]) => {
                      const value = getOptionValue(config, optionId);
                      const option = product.config_options?.find((opt: any) => opt.id === optionId);
                      
                      return value && option ? (
                        <div key={optionId} className="text-xs flex items-center gap-2">
                          {value.hex_color && (
                            <div 
                              className="w-3 h-3 rounded-full border border-border"
                              style={{ backgroundColor: value.hex_color }}
                            />
                          )}
                          <span>{option.name}: {value.name}</span>
                        </div>
                      ) : null;
                    })}
                    
                    {Object.keys(config.selectedOptions).length > 2 && (
                      <div className="text-xs text-muted-foreground italic">
                        +{Object.keys(config.selectedOptions).length - 2} more options
                      </div>
                    )}
                  </div>
                </div>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addToCompare(config)}
                  disabled={compareList.find(c => c.id === config.id) !== undefined}
                  className="w-full text-xs"
                >
                  {compareList.find(c => c.id === config.id) ? 'Added to Compare' : 'Add to Compare'}
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
};