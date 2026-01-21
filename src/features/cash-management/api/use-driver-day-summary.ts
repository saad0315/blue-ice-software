import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';

import { client } from '@/lib/hono';

export const useDriverDaySummary = () => {
  return useQuery({
    queryKey: ['driver-day-summary'],
    queryFn: async () => {
      const response = await client.api['cash-management'].driver['day-summary'].$get({
        query: {
          date: format(new Date(), 'yyyy-MM-dd'),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch day summary');
      }

      const data = await response.json();
      return data.data;
    },
  });
};
