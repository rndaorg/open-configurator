import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { TrendingDown, Sparkles, Clock, Package } from 'lucide-react';
import { PricingResult } from '@/services/pricingEngine';

interface PricingBreakdownProps {
  pricingResult: PricingResult;
  quantity: number;
}

export const PricingBreakdown = ({ pricingResult, quantity }: PricingBreakdownProps) => {
  const totalSavings = pricingResult.originalPrice - pricingResult.finalPrice;
  const savingsPercentage = totalSavings > 0 
    ? ((totalSavings / pricingResult.originalPrice) * 100).toFixed(1)
    : 0;

  const getDiscountIcon = (type: string) => {
    switch (type) {
      case 'volume_discount':
        return <Package className="w-4 h-4" />;
      case 'time_based':
        return <Clock className="w-4 h-4" />;
      case 'bundle':
        return <Sparkles className="w-4 h-4" />;
      default:
        return <TrendingDown className="w-4 h-4" />;
    }
  };

  return (
    <Card className="glass-card p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Pricing Breakdown</h3>
        {quantity > 1 && (
          <Badge variant="secondary" className="text-xs">
            Qty: {quantity}
          </Badge>
        )}
      </div>

      <div className="space-y-2">
        {pricingResult.breakdown.map((item, index) => (
          <div key={index} className="flex justify-between text-sm">
            <span className="text-muted-foreground">{item.item}</span>
            <span className="font-medium">
              ${item.price.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          </div>
        ))}
      </div>

      {pricingResult.discounts.length > 0 && (
        <>
          <Separator />
          <div className="space-y-3">
            <p className="text-sm font-semibold text-accent flex items-center gap-2">
              <TrendingDown className="w-4 h-4" />
              Applied Discounts
            </p>
            {pricingResult.discounts.map((discount, index) => (
              <div 
                key={index}
                className="flex items-start justify-between gap-2 p-3 rounded-lg bg-accent/10 border border-accent/20"
              >
                <div className="flex items-start gap-2 flex-1">
                  <div className="text-accent mt-0.5">
                    {getDiscountIcon(discount.type)}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{discount.rule}</p>
                    <p className="text-xs text-muted-foreground">{discount.description}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-accent whitespace-nowrap">
                  -${discount.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <Separator />

      <div className="space-y-2">
        <div className="flex justify-between text-sm text-muted-foreground">
          <span>Subtotal</span>
          <span className={totalSavings > 0 ? 'line-through' : ''}>
            ${pricingResult.originalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
        
        {totalSavings > 0 && (
          <div className="flex justify-between items-center p-2 rounded bg-accent/10">
            <span className="text-sm font-semibold text-accent">Total Savings</span>
            <div className="text-right">
              <span className="text-sm font-bold text-accent">
                -${totalSavings.toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <span className="text-xs text-accent ml-2">({savingsPercentage}%)</span>
            </div>
          </div>
        )}

        <div className="flex justify-between items-center pt-2">
          <span className="text-lg font-bold">Final Price</span>
          <span className="text-2xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            ${pricingResult.finalPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}
          </span>
        </div>
      </div>

      {quantity > 1 && (
        <div className="text-center p-2 rounded bg-muted/50">
          <p className="text-xs text-muted-foreground">
            ${(pricingResult.finalPrice / quantity).toLocaleString('en-US', { minimumFractionDigits: 2 })} per unit
          </p>
        </div>
      )}
    </Card>
  );
};