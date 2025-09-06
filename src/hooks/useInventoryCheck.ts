import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface InventoryLevel {
  id: string;
  option_value_id: string;
  available_quantity: number;
  reserved_quantity: number;
  low_stock_threshold: number;
  updated_at: string;
}

export interface InventoryStatus {
  available: boolean;
  quantity: number;
  isLowStock: boolean;
  estimatedRestockDate?: string;
  alternativeOptions?: string[];
}

export const useInventoryCheck = (productId: string) => {
  return useQuery({
    queryKey: ['inventory', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_levels')
        .select(`
          *,
          option_values!inner(
            id,
            name,
            config_option_id,
            config_options!inner(
              product_id
            )
          )
        `)
        .eq('option_values.config_options.product_id', productId);
      
      if (error) throw error;
      return data as any[];
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });
};

export const useOptionAvailability = (optionValueId: string) => {
  return useQuery({
    queryKey: ['inventory', 'option', optionValueId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('inventory_levels')
        .select('*')
        .eq('option_value_id', optionValueId)
        .single();
      
      if (error) {
        // If no inventory record exists, assume available
        if (error.code === 'PGRST116') {
          return {
            available: true,
            quantity: 999,
            isLowStock: false
          } as InventoryStatus;
        }
        throw error;
      }
      
      const available = data.available_quantity > 0;
      const isLowStock = data.available_quantity <= data.low_stock_threshold;
      
      return {
        available,
        quantity: data.available_quantity,
        isLowStock,
        estimatedRestockDate: available ? undefined : getEstimatedRestockDate(),
      } as InventoryStatus;
    },
    staleTime: 30000,
    refetchInterval: available => available ? 60000 : 30000, // Check unavailable items more frequently
  });
};

export const useBulkInventoryCheck = (optionValueIds: string[]) => {
  return useQuery({
    queryKey: ['inventory', 'bulk', optionValueIds.sort().join(',')],
    queryFn: async () => {
      if (optionValueIds.length === 0) return {};
      
      const { data, error } = await supabase
        .from('inventory_levels')
        .select('*')
        .in('option_value_id', optionValueIds);
      
      if (error) throw error;
      
      const inventoryMap: { [valueId: string]: InventoryStatus } = {};
      
      // Initialize with default availability for all options
      optionValueIds.forEach(valueId => {
        inventoryMap[valueId] = {
          available: true,
          quantity: 999,
          isLowStock: false
        };
      });
      
      // Update with actual inventory data
      data.forEach(inventory => {
        const available = inventory.available_quantity > 0;
        const isLowStock = inventory.available_quantity <= inventory.low_stock_threshold;
        
        inventoryMap[inventory.option_value_id] = {
          available,
          quantity: inventory.available_quantity,
          isLowStock,
          estimatedRestockDate: available ? undefined : getEstimatedRestockDate(),
        };
      });
      
      return inventoryMap;
    },
    staleTime: 30000,
    refetchInterval: 60000,
  });
};

// Real-time inventory updates
export const subscribeToInventoryUpdates = (
  productId: string, 
  onUpdate: (update: any) => void
) => {
  const channel = supabase
    .channel(`inventory-${productId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'inventory_levels',
        filter: `option_values.config_options.product_id=eq.${productId}`
      },
      (payload) => {
        console.log('Inventory update:', payload);
        onUpdate(payload);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
};

// Inventory management utilities
export const reserveInventory = async (optionValueId: string, quantity: number = 1) => {
  // TODO: Implement inventory reservation RPC function
  console.log('Reserving inventory:', optionValueId, quantity);
  return true;
};

export const releaseInventory = async (optionValueId: string, quantity: number = 1) => {
  // TODO: Implement inventory release RPC function
  console.log('Releasing inventory:', optionValueId, quantity);
  return true;
};

// Helper function to estimate restock date
function getEstimatedRestockDate(): string {
  const restockDays = Math.floor(Math.random() * 14) + 7; // 7-21 days
  const restockDate = new Date();
  restockDate.setDate(restockDate.getDate() + restockDays);
  return restockDate.toISOString().split('T')[0]; // YYYY-MM-DD format
}

// Get alternative options when current selection is unavailable
export const getAlternativeOptions = async (
  productId: string, 
  unavailableValueId: string
): Promise<string[]> => {
  try {
    // Get the option type of the unavailable value
    const { data: optionValue, error: optionError } = await supabase
      .from('option_values')
      .select(`
        *,
        config_options!inner(
          id,
          option_type,
          product_id
        )
      `)
      .eq('id', unavailableValueId)
      .single();
    
    if (optionError) throw optionError;
    
    // Find alternative values for the same option type that are available
    const { data: alternatives, error: altError } = await supabase
      .from('option_values')
      .select(`
        id,
        inventory_levels(available_quantity)
      `)
      .eq('config_option_id', optionValue.config_options.id)
      .neq('id', unavailableValueId);
    
    if (altError) throw altError;
    
    return alternatives
      .filter(alt => {
        const inventory = alt.inventory_levels?.[0];
        return !inventory || inventory.available_quantity > 0;
      })
      .map(alt => alt.id);
  } catch (error) {
    console.error('Error getting alternatives:', error);
    return [];
  }
};