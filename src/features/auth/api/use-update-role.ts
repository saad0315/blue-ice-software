import { useMutation, useQueryClient } from '@tanstack/react-query';
import { InferRequestType, InferResponseType } from 'hono';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

type ResponseType = InferResponseType<(typeof client.api.auth)[':userId']['$patch'], 200>;
type RequestType = InferRequestType<(typeof client.api.auth)[':userId']['$patch']>;

export const useUpdateRole = () => {
  const queryClient = useQueryClient();

  const mutation = useMutation<ResponseType, Error, RequestType>({
    mutationFn: async ({ param, json }) => {
      const response = await client.api.auth[':userId']['$patch']({ param, json });

      if (!response.ok) throw new Error('Failed to update role.');

      return await response.json();
    },
    onSuccess: ({ data }) => {
      toast.success('Role updated.');

      queryClient.invalidateQueries({
        queryKey: ['users'],
      });
    },
    onError: (error) => {
      console.error('[UPDATE_ROLE]: ', error);

      toast.error('Failed to update role.');
    },
  });

  return mutation;
};
