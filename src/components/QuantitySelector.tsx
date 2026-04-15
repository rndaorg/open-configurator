import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Minus, Plus, Package } from 'lucide-react';

interface QuantitySelectorProps {
  quantity: number;
  onQuantityChange: (quantity: number) => void;
  minQuantity?: number;
  maxQuantity?: number;
}

export const QuantitySelector = ({ 
  quantity, 
  onQuantityChange, 
  minQuantity = 1, 
  maxQuantity = 100 
}: QuantitySelectorProps) => {
  const handleIncrease = () => {
    if (quantity < maxQuantity) {
      onQuantityChange(quantity + 1);
    }
  };

  const handleDecrease = () => {
    if (quantity > minQuantity) {
      onQuantityChange(quantity - 1);
    }
  };

  const volumeTiers = [
    { min: 5, discount: '10% off' },
    { min: 10, discount: '15% off' },
    { min: 20, discount: '20% off' }
  ];

  const nextTier = volumeTiers.find(tier => tier.min > quantity);

  return (
    <Card className="glass-card p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Package className="w-4 h-4 text-primary" />
        <h4 className="text-sm font-semibold">Quantity</h4>
      </div>

      <div className="flex items-center gap-3">
        <Button
          variant="outline"
          size="icon"
          onClick={handleDecrease}
          disabled={quantity <= minQuantity}
          className="h-10 w-10"
        >
          <Minus className="w-4 h-4" />
        </Button>

        <div className="flex-1 text-center">
          <input
            type="number"
            value={quantity}
            onChange={(e) => {
              const value = parseInt(e.target.value);
              if (!isNaN(value) && value >= minQuantity && value <= maxQuantity) {
                onQuantityChange(value);
              }
            }}
            className="w-full text-center text-2xl font-bold bg-transparent border-none focus:outline-none"
            min={minQuantity}
            max={maxQuantity}
          />
        </div>

        <Button
          variant="outline"
          size="icon"
          onClick={handleIncrease}
          disabled={quantity >= maxQuantity}
          className="h-10 w-10"
        >
          <Plus className="w-4 h-4" />
        </Button>
      </div>

      {nextTier && (
        <div className="text-center p-2 rounded bg-accent/10 border border-accent/20">
          <p className="text-xs text-accent font-medium">
            Order {nextTier.min - quantity} more to unlock {nextTier.discount}
          </p>
        </div>
      )}

      {quantity >= 5 && (
        <div className="text-center p-2 rounded bg-green-500/10 border border-green-500/20">
          <p className="text-xs text-green-600 font-medium">
            🎉 Volume discount applied!
          </p>
        </div>
      )}
    </Card>
  );
};