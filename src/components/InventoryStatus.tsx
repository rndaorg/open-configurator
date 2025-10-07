import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle, Package } from 'lucide-react';

interface InventoryStatusProps {
  optionValueId: string;
}

export const InventoryStatus = ({ optionValueId }: InventoryStatusProps) => {
  const { data: inventory, isLoading } = useQuery({
    queryKey: ['inventory', optionValueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_levels')
        .select('*')
        .eq('option_value_id', optionValueId)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  if (isLoading) return null;
  if (!inventory) return null;

  const availableStock = inventory.available_quantity - inventory.reserved_quantity;
  const isLowStock = availableStock <= inventory.low_stock_threshold;
  const isOutOfStock = availableStock <= 0;

  if (isOutOfStock) {
    return (
      <Badge variant="destructive" className="text-xs flex items-center gap-1">
        <AlertCircle className="w-3 h-3" />
        Out of Stock
      </Badge>
    );
  }

  if (isLowStock) {
    return (
      <Badge variant="outline" className="text-xs flex items-center gap-1 text-amber-500 border-amber-500">
        <Package className="w-3 h-3" />
        Only {availableStock} left
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="text-xs flex items-center gap-1 text-green-500 border-green-500">
      <CheckCircle className="w-3 h-3" />
      In Stock ({availableStock})
    </Badge>
  );
};