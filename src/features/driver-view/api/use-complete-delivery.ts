import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { client } from '@/lib/hono';
import { queueDeliveryCompletion } from '@/lib/offline-storage';
import { OrderStatus } from '@prisma/client';

export const useCompleteDelivery = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ param, json }: { param: { id: string }; json: any }) => {
      try {
        const response = await client.api.orders[':id'].$patch({
          param,
          json,
        });

        if (!response.ok) {
          const error = (await response.json()) as { error?: string };
          throw new Error(error.error || 'Failed to update order');
        }

        return await response.json();
      } catch (error: any) {
        // Offline handling
        if (
          !navigator.onLine ||
          error.message.includes('Failed to fetch') ||
          error.message.includes('Network request failed')
        ) {
          console.log('Network error, saving to sync queue...');
          await queueDeliveryCompletion(param.id, json);
          return { data: { id: param.id, ...json }, offline: true };
        }
        throw error;
      }
    },

    // OPTIMISTIC UPDATE
    onMutate: async (variables) => {
      // 1. Cancel queries
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      await queryClient.cancelQueries({ queryKey: ['driver-stats'] });

      // 2. Snapshot
      const previousOrders = queryClient.getQueryData(['orders']);
      const previousStats = queryClient.getQueryData(['driver-stats']);

      // 3. Update Orders list
      queryClient.setQueryData(['orders'], (old: any) => {
        if (!old || !old.orders) return old;
        return {
          ...old,
          orders: old.orders.map((order: any) =>
            order.id === variables.param.id
              ? {
                  ...order,
                  status: OrderStatus.COMPLETED,
                  completedAt: new Date().toISOString(),
                  cashCollected: variables.json.cashCollected
                }
              : order
          ),
        };
      });

      // 4. Update Driver Stats
      queryClient.setQueryData(['driver-stats'], (old: any) => {
        if (!old) return old;

        // This assumes the order was previously PENDING/SCHEDULED
        return {
          ...old,
          pendingOrders: Math.max(0, (old.pendingOrders || 0) - 1),
          completedOrders: (old.completedOrders || 0) + 1,
          cashCollected: (parseFloat(old.cashCollected || '0') + (variables.json.cashCollected || 0)).toFixed(2),
        };
      });

      return { previousOrders, previousStats };
    },

    // Error: Rollback
    onError: (err, newTodo, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
      if (context?.previousStats) {
        queryClient.setQueryData(['driver-stats'], context.previousStats);
      }

      toast.error('Failed to complete delivery', {
        description: err.message,
      });
    },

    // Success
    onSuccess: (data: any) => {
      if (data.offline) {
        toast.info('Delivery saved offline. Will sync when online.');
      } else {
        toast.success('Delivery completed successfully');
      }

      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['driver-stats'] });
      queryClient.invalidateQueries({ queryKey: ['order', data.data.id] });
    },
  });
};
