import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

interface UseUpdateSpecialPriceProps {
  customerId: string;
}

export const useUpdateSpecialPrice = ({ customerId }: UseUpdateSpecialPriceProps) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (json: { productId: string; price: number }) => {
      const response = await client.api.customers[':id']['special-prices'].$post({
        param: { id: customerId },
        json,
      });

      if (!response.ok) {
        throw new Error('Failed to update special price');
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      toast.success('Special price updated');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
};
