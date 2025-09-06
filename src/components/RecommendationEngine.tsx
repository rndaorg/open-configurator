import { useState, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Lightbulb, TrendingUp, Users, Zap, Star } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface RecommendationEngineProps {
  product: any;
  selectedOptions: { [optionId: string]: string };
  onApplyRecommendation: (optionId: string, valueId: string) => void;
  className?: string;
}

interface Recommendation {
  id: string;
  type: 'popular' | 'compatible' | 'upgrade' | 'value' | 'trending';
  title: string;
  description: string;
  optionId: string;
  valueId: string;
  confidence: number;
  reasoning: string;
  impact: 'price_increase' | 'price_decrease' | 'neutral';
  impactAmount?: number;
}

export const RecommendationEngine = ({
  product,
  selectedOptions,
  onApplyRecommendation,
  className = ""
}: RecommendationEngineProps) => {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    generateRecommendations();
  }, [product, selectedOptions]);

  const generateRecommendations = async () => {
    setIsLoading(true);
    
    try {
      // Fetch user preferences and analytics
      const { data: analytics } = await supabase
        .from('configuration_analytics')
        .select('*')
        .eq('product_id', product.id)
        .limit(100);

      const { data: userPreferences } = await supabase
        .from('user_preferences')
        .select('*')
        .eq('product_id', product.id)
        .order('interaction_score', { ascending: false })
        .limit(50);

      const newRecommendations: Recommendation[] = [];

      // Generate different types of recommendations
      newRecommendations.push(...generatePopularChoices(analytics || []));
      newRecommendations.push(...generateCompatibilityRecommendations());
      newRecommendations.push(...generateUpgradeRecommendations());
      newRecommendations.push(...generateValueRecommendations());
      newRecommendations.push(...generateTrendingRecommendations(userPreferences || []));

      // Sort by confidence and limit
      const sortedRecommendations = newRecommendations
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 6);

      setRecommendations(sortedRecommendations);
    } catch (error) {
      console.error('Error generating recommendations:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generatePopularChoices = (analytics: any[]): Recommendation[] => {
    const recommendations: Recommendation[] = [];
    
    // Analyze most popular combinations
    const optionFrequency: { [key: string]: number } = {};
    
    analytics.forEach(config => {
      if (config.configuration_data) {
        Object.entries(config.configuration_data).forEach(([optionId, valueId]) => {
          const key = `${optionId}:${valueId}`;
          optionFrequency[key] = (optionFrequency[key] || 0) + 1;
        });
      }
    });

    // Find most popular unselected options
    Object.entries(optionFrequency)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 3)
      .forEach(([key, frequency]) => {
        const [optionId, valueId] = key.split(':');
        
        if (!selectedOptions[optionId]) {
          const option = product.config_options?.find((opt: any) => opt.id === optionId);
          const value = option?.option_values?.find((val: any) => val.id === valueId);
          
          if (option && value) {
            recommendations.push({
              id: `popular-${optionId}`,
              type: 'popular',
              title: `Popular Choice: ${value.name}`,
              description: `${frequency} customers chose this option`,
              optionId,
              valueId,
              confidence: Math.min(95, 60 + (frequency / analytics.length) * 100),
              reasoning: `Most popular choice among ${analytics.length} customers`,
              impact: value.price_modifier > 0 ? 'price_increase' : 
                      value.price_modifier < 0 ? 'price_decrease' : 'neutral',
              impactAmount: value.price_modifier
            });
          }
        }
      });

    return recommendations;
  };

  const generateCompatibilityRecommendations = (): Recommendation[] => {
    const recommendations: Recommendation[] = [];
    
    // Find options that work well together
    const selectedValues = Object.values(selectedOptions);
    
    product.config_options?.forEach((option: any) => {
      if (selectedOptions[option.id]) return;
      
      const compatibleValues = option.option_values?.filter((value: any) => {
        // Simple compatibility logic based on naming patterns
        const isCompatible = selectedValues.some(selectedValueId => {
          const selectedValue = product.config_options
            ?.flatMap((opt: any) => opt.option_values)
            ?.find((val: any) => val.id === selectedValueId);
          
          return selectedValue && (
            selectedValue.name.includes('Premium') && value.name.includes('Premium') ||
            selectedValue.name.includes('Sport') && value.name.includes('Sport') ||
            selectedValue.name.includes('Luxury') && value.name.includes('Luxury')
          );
        });
        
        return isCompatible;
      });

      if (compatibleValues?.length > 0) {
        const bestValue = compatibleValues[0];
        recommendations.push({
          id: `compatible-${option.id}`,
          type: 'compatible',
          title: `Perfect Match: ${bestValue.name}`,
          description: `Complements your current selections perfectly`,
          optionId: option.id,
          valueId: bestValue.id,
          confidence: 85,
          reasoning: 'Matches the style and quality of your other choices',
          impact: bestValue.price_modifier > 0 ? 'price_increase' : 
                  bestValue.price_modifier < 0 ? 'price_decrease' : 'neutral',
          impactAmount: bestValue.price_modifier
        });
      }
    });

    return recommendations;
  };

  const generateUpgradeRecommendations = (): Recommendation[] => {
    const recommendations: Recommendation[] = [];
    
    // Suggest premium upgrades
    Object.entries(selectedOptions).forEach(([optionId, currentValueId]) => {
      const option = product.config_options?.find((opt: any) => opt.id === optionId);
      const currentValue = option?.option_values?.find((val: any) => val.id === currentValueId);
      
      if (currentValue) {
        const upgrades = option.option_values
          ?.filter((val: any) => 
            val.price_modifier > currentValue.price_modifier &&
            val.name.toLowerCase().includes('premium') ||
            val.name.toLowerCase().includes('luxury') ||
            val.name.toLowerCase().includes('pro')
          )
          ?.sort((a: any, b: any) => a.price_modifier - b.price_modifier);
        
        if (upgrades?.length > 0) {
          const upgrade = upgrades[0];
          const upgradeValue = upgrade.price_modifier - currentValue.price_modifier;
          
          recommendations.push({
            id: `upgrade-${optionId}`,
            type: 'upgrade',
            title: `Upgrade to ${upgrade.name}`,
            description: `Enhanced features and quality for +$${upgradeValue}`,
            optionId,
            valueId: upgrade.id,
            confidence: 75,
            reasoning: 'Premium option with enhanced features',
            impact: 'price_increase',
            impactAmount: upgradeValue
          });
        }
      }
    });

    return recommendations;
  };

  const generateValueRecommendations = (): Recommendation[] => {
    const recommendations: Recommendation[] = [];
    
    // Find options that offer good value
    product.config_options?.forEach((option: any) => {
      if (selectedOptions[option.id]) return;
      
      const valueOptions = option.option_values
        ?.filter((val: any) => val.price_modifier <= 0 && val.name.toLowerCase().includes('standard'))
        ?.sort((a: any, b: any) => b.price_modifier - a.price_modifier);
      
      if (valueOptions?.length > 0) {
        const valueOption = valueOptions[0];
        
        recommendations.push({
          id: `value-${option.id}`,
          type: 'value',
          title: `Great Value: ${valueOption.name}`,
          description: valueOption.price_modifier < 0 
            ? `Save $${Math.abs(valueOption.price_modifier)} with this choice`
            : 'Excellent quality at no extra cost',
          optionId: option.id,
          valueId: valueOption.id,
          confidence: 70,
          reasoning: 'Best value for money option',
          impact: valueOption.price_modifier < 0 ? 'price_decrease' : 'neutral',
          impactAmount: valueOption.price_modifier
        });
      }
    });

    return recommendations;
  };

  const generateTrendingRecommendations = (preferences: any[]): Recommendation[] => {
    const recommendations: Recommendation[] = [];
    
    // Analyze trending preferences
    const recentPreferences = preferences
      .filter(pref => new Date(pref.created_at) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000))
      .slice(0, 10);
    
    if (recentPreferences.length > 0) {
      const trendingOptions: { [key: string]: number } = {};
      
      recentPreferences.forEach(pref => {
        if (pref.preferences) {
          Object.entries(pref.preferences).forEach(([optionId, valueId]) => {
            const key = `${optionId}:${valueId}`;
            trendingOptions[key] = (trendingOptions[key] || 0) + pref.interaction_score;
          });
        }
      });

      const topTrending = Object.entries(trendingOptions)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 2);

      topTrending.forEach(([key, score]) => {
        const [optionId, valueId] = key.split(':');
        
        if (!selectedOptions[optionId]) {
          const option = product.config_options?.find((opt: any) => opt.id === optionId);
          const value = option?.option_values?.find((val: any) => val.id === valueId);
          
          if (option && value) {
            recommendations.push({
              id: `trending-${optionId}`,
              type: 'trending',
              title: `Trending Now: ${value.name}`,
              description: 'Popular choice this month',
              optionId,
              valueId,
              confidence: 80,
              reasoning: 'Trending among recent customers',
              impact: value.price_modifier > 0 ? 'price_increase' : 
                      value.price_modifier < 0 ? 'price_decrease' : 'neutral',
              impactAmount: value.price_modifier
            });
          }
        }
      });
    }

    return recommendations;
  };

  const getRecommendationIcon = (type: Recommendation['type']) => {
    switch (type) {
      case 'popular': return <Users className="w-4 h-4" />;
      case 'compatible': return <Zap className="w-4 h-4" />;
      case 'upgrade': return <TrendingUp className="w-4 h-4" />;
      case 'value': return <Star className="w-4 h-4" />;
      case 'trending': return <TrendingUp className="w-4 h-4" />;
      default: return <Lightbulb className="w-4 h-4" />;
    }
  };

  const getRecommendationColor = (type: Recommendation['type']) => {
    switch (type) {
      case 'popular': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'compatible': return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'upgrade': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'value': return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      case 'trending': return 'bg-pink-500/10 text-pink-500 border-pink-500/20';
      default: return 'bg-gray-500/10 text-gray-500 border-gray-500/20';
    }
  };

  if (isLoading) {
    return (
      <Card className={`glass-card p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <Lightbulb className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Smart Recommendations</h3>
        </div>
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="h-4 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-muted rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Card className={`glass-card p-6 ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <Lightbulb className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Smart Recommendations</h3>
        </div>
        <p className="text-muted-foreground text-sm">
          Complete your configuration to see personalized recommendations.
        </p>
      </Card>
    );
  }

  return (
    <Card className={`glass-card p-6 ${className}`}>
      <div className="flex items-center gap-3 mb-6">
        <Lightbulb className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">Smart Recommendations</h3>
        <Badge variant="secondary" className="text-xs">
          AI Powered
        </Badge>
      </div>

      <div className="space-y-4">
        {recommendations.map((rec, index) => (
          <div key={rec.id}>
            <div className="flex items-start gap-4 p-4 rounded-lg border border-border hover:bg-muted/50 transition-colors">
              <div className={`p-2 rounded-full ${getRecommendationColor(rec.type)}`}>
                {getRecommendationIcon(rec.type)}
              </div>
              
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium text-sm">{rec.title}</h4>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {rec.confidence}% match
                    </Badge>
                    {rec.impactAmount !== 0 && (
                      <Badge 
                        variant={rec.impact === 'price_increase' ? 'destructive' : 'secondary'}
                        className="text-xs"
                      >
                        {rec.impact === 'price_increase' ? '+' : ''}${Math.abs(rec.impactAmount || 0)}
                      </Badge>
                    )}
                  </div>
                </div>
                
                <p className="text-xs text-muted-foreground">{rec.description}</p>
                <p className="text-xs italic text-muted-foreground/80">{rec.reasoning}</p>
                
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onApplyRecommendation(rec.optionId, rec.valueId)}
                  className="text-xs h-8"
                >
                  Apply Recommendation
                </Button>
              </div>
            </div>
            
            {index < recommendations.length - 1 && <Separator className="my-4" />}
          </div>
        ))}
      </div>
    </Card>
  );
};