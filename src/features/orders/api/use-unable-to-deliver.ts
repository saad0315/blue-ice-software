import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

// We need to import Order type or define a compatible shape
interface Order {
  id: string;
  status: string;
  [key: string]: any;
}

type ResponseType = InferResponseType<(typeof client.api.orders)[':id']['unable-to-deliver']['$post']>;
type RequestType = InferRequestType<(typeof client.api.orders)[':id']['unable-to-deliver']['$post']>['json'];

export const useUnableToDeliver = (orderId: string) => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async (json) => {
      const response = await client.api.orders[':id']['unable-to-deliver'].$post({
        param: { id: orderId },
        json,
      });

      if (!response.ok) {
        const errorData: any = await response.json();
        throw new Error(errorData?.error || 'Failed to process request');
      }

      return await response.json();
    },
    // OPTIMISTIC UPDATE
    onMutate: async (variables) => {
      // 1. Cancel ongoing queries
      await queryClient.cancelQueries({ queryKey: ['orders'] });
      await queryClient.cancelQueries({ queryKey: ['driver-stats'] });

      // 2. Snapshot previous state
      const previousOrders = queryClient.getQueryData(['orders']);
      const previousStats = queryClient.getQueryData(['driver-stats']);

      // 3. Optimistically update Orders cache
      queryClient.setQueryData(['orders'], (old: any) => {
        if (!old || !old.orders) return old;
        return {
          ...old,
          orders: old.orders.map((order: Order) =>
            order.id === orderId
              ? {
                  ...order,
                  status: variables.action === 'RESCHEDULE' ? 'RESCHEDULED' : 'CANCELLED',
                  cancellationReason: variables.reason,
                  driverNotes: variables.notes,
                  rescheduledToDate: variables.rescheduleDate,
                  updatedAt: new Date().toISOString(),
                }
              : order
          ),
        };
      });

      // 4. Optimistically update Driver Stats
      queryClient.setQueryData(['driver-stats'], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          pendingOrders: Math.max(0, (old.pendingOrders || 0) - 1),
          cancelledOrders: variables.action === 'CANCEL'
            ? (old.cancelledOrders || 0) + 1
            : old.cancelledOrders,
          rescheduledOrders: variables.action === 'RESCHEDULE'
            ? (old.rescheduledOrders || 0) + 1
            : old.rescheduledOrders,
        };
      });

      return { previousOrders, previousStats };
    },

    // Error: Rollback
    onError: (err, variables, context) => {
      if (context?.previousOrders) {
        queryClient.setQueryData(['orders'], context.previousOrders);
      }
      if (context?.previousStats) {
        queryClient.setQueryData(['driver-stats'], context.previousStats);
      }
      toast.error(err.message || 'Failed to update order');
    },

    // Success: Refetch for consistency
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['driver-stats'] });
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    },
    onSuccess: () => {
        toast.success('Order updated successfully');
    }
  });

  return mutation;
};
