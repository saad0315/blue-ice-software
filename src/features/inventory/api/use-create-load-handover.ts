import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<(typeof client.api.inventory.handover.load)['$post']>;
type RequestType = InferRequestType<(typeof client.api.inventory.handover.load)['$post']>;

export const useCreateLoadHandover = () => {
  const queryClient = useQueryClient();

  return useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ json }) => {
      const response = await client.api.inventory.handover.load.$post({ json });
      if (!response.ok) {
        throw new Error('Failed to create load handover');
      }
      return await response.json();
    },
    onSuccess: () => {
      toast.success('Load sheet created successfully');
      queryClient.invalidateQueries({ queryKey: ['inventory-stats'] });
      queryClient.invalidateQueries({ queryKey: ['stock-transactions'] });
    },
    onError: () => {
      toast.error('Failed to create load sheet');
    },
  });
};
