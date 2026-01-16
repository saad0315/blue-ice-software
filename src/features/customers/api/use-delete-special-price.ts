import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

interface UseDeleteSpecialPriceProps {
  customerId: string;
}

export const useDeleteSpecialPrice = ({ customerId }: UseDeleteSpecialPriceProps) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (productId: string) => {
      const response = await client.api.customers[':id']['special-prices'][':productId'].$delete({
        param: { id: customerId, productId },
      });

      if (!response.ok) {
        throw new Error('Failed to delete special price');
      }

      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer', customerId] });
      toast.success('Special price removed');
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });
};
