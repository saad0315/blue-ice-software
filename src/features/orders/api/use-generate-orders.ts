import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

import { GenerateOrdersInput } from '../schema';

export const useGenerateOrders = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (json: GenerateOrdersInput) => {
      const response = await client.api.orders.generate.$post({
        json,
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error || 'Failed to generate orders');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      // @ts-ignore
      const { count, message } = data.data;
      if (count > 0) {
        toast.success(message);
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      } else {
        toast.info(message);
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to generate orders', {
        description: error.message,
      });
    },
  });
};
