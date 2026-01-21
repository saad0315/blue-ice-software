import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

import { client } from '@/lib/hono';

export const useGetStats = () => {
  return useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async () => {
      const response = await client.api.dashboard.$get({
        query: {
          date: format(new Date(), 'yyyy-MM-dd'),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch dashboard stats');
      }

      const { data } = await response.json();
      return data;
    },
  });
};
