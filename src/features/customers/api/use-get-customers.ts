import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';

import { client } from '@/lib/hono';

export const useGetCustomers = () => {
  const searchParams = useSearchParams();
  const search = searchParams.get('search') || undefined;
  const routeId = searchParams.get('routeId') || undefined;
  const type = searchParams.get('type') || undefined;
  const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;

  return useQuery({
    queryKey: ['customers', { search, routeId, type, page, limit }],
    queryFn: async () => {
      const response = await client.api.customers.$get({
        query: {
          search,
          routeId,
          type,
          page: page.toString(),
          limit: limit.toString(),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch customers');
      }

      return await response.json();
    },
  });
};
