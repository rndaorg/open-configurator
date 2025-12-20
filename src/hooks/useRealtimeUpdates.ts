import { useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAuth } from './useAuth';

interface RealtimeOptions {
  onOrderUpdate?: (order: any) => void;
  onInventoryUpdate?: (inventory: any) => void;
  showToasts?: boolean;
}

export const useRealtimeUpdates = (options: RealtimeOptions = {}) => {
  const { user } = useAuth();
  const { onOrderUpdate, onInventoryUpdate, showToasts = true } = options;

  const handleOrderUpdate = useCallback((payload: any) => {
    const order = payload.new;
    const oldOrder = payload.old;

    if (showToasts && order.user_id === user?.id) {
      if (oldOrder?.status !== order.status) {
        const statusMessages: Record<string, string> = {
          'processing': 'Your order is now being processed!',
          'shipped': 'Your order has been shipped!',
          'delivered': 'Your order has been delivered!',
          'cancelled': 'Your order has been cancelled.',
        };

        const message = statusMessages[order.status] || `Order status: ${order.status}`;
        
        if (order.status === 'cancelled') {
          toast.error('Order Cancelled', { description: message });
        } else {
          toast.success('Order Update', { description: message });
        }
      }
    }

    onOrderUpdate?.(order);
  }, [user, showToasts, onOrderUpdate]);

  const handleInventoryUpdate = useCallback((payload: any) => {
    const inventory = payload.new;
    
    onInventoryUpdate?.(inventory);
  }, [onInventoryUpdate]);

  useEffect(() => {
    const channels: ReturnType<typeof supabase.channel>[] = [];

    // Subscribe to order updates for the current user
    if (user) {
      const orderChannel = supabase
        .channel('order-updates')
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'orders',
            filter: `user_id=eq.${user.id}`
          },
          handleOrderUpdate
        )
        .subscribe();

      channels.push(orderChannel);
    }

    // Subscribe to inventory updates (for all authenticated users)
    if (user) {
      const inventoryChannel = supabase
        .channel('inventory-updates')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'inventory_levels'
          },
          handleInventoryUpdate
        )
        .subscribe();

      channels.push(inventoryChannel);
    }

    return () => {
      channels.forEach(channel => supabase.removeChannel(channel));
    };
  }, [user, handleOrderUpdate, handleInventoryUpdate]);
};
