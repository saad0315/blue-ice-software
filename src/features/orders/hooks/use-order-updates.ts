'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect } from 'react';
import { toast } from 'sonner';

import { useOrderStatusUpdates, useSocketStatus } from '@/hooks/use-socket';
import { OrderStatusEvent } from '@/lib/socket-events';

interface UseOrderUpdatesOptions {
  showToasts?: boolean;
  onStatusChange?: (event: OrderStatusEvent) => void;
}

export function useOrderUpdates(options: UseOrderUpdatesOptions = {}) {
  const { showToasts = true, onStatusChange } = options;
  const queryClient = useQueryClient();
  const { isConnected, status } = useSocketStatus();

  const handleOrderStatusUpdate = useCallback(
    (event: OrderStatusEvent) => {
      // Invalidate order queries to refetch latest data
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['order', event.orderId] });

      // Show toast notification if enabled
      if (showToasts) {
        const statusMessages: Record<string, string> = {
          SCHEDULED: 'scheduled',
          PENDING: 'assigned to driver',
          IN_PROGRESS: 'being delivered',
          COMPLETED: 'delivered',
          CANCELLED: 'cancelled',
          RESCHEDULED: 'rescheduled',
        };

        const statusMessage = statusMessages[event.status] || event.status.toLowerCase();

        toast.info(`Order #${event.readableId} is now ${statusMessage}`, {
          description: event.customerName ? `Customer: ${event.customerName}` : undefined,
        });
      }

      // Call custom callback if provided
      if (onStatusChange) {
        onStatusChange(event);
      }
    },
    [queryClient, showToasts, onStatusChange],
  );

  // Subscribe to order status updates
  useOrderStatusUpdates(handleOrderStatusUpdate);

  return {
    isConnected,
    connectionStatus: status,
  };
}

// Hook specifically for a single order's real-time updates
export function useOrderRealtime(orderId: string) {
  const queryClient = useQueryClient();
  const { isConnected } = useSocketStatus();

  const handleOrderStatusUpdate = useCallback(
    (event: OrderStatusEvent) => {
      if (event.orderId === orderId) {
        // Invalidate this specific order's query
        queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      }
    },
    [queryClient, orderId],
  );

  useOrderStatusUpdates(handleOrderStatusUpdate);

  return {
    isConnected,
  };
}
