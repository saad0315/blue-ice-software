import { useQuery } from '@tanstack/react-query';

import { client } from '@/lib/hono';

interface useGetUsersProps {
  search?: string | null;
  suspended?: boolean | null;
  role?: string | null;
  page?: number;
  limit?: number;
}

export const useGetUsers = ({ search, suspended, role, page, limit }: useGetUsersProps) => {
  const query = useQuery({
    queryKey: ['users', search, suspended, role, page, limit],
    queryFn: async () => {
      const response = await client.api.auth.users.$get({
        query: {
          search: search ?? undefined,
          suspended: suspended !== null ? String(suspended) : undefined,
          role: role ?? undefined,
          page: page ? String(page) : undefined,
          limit: limit ? String(limit) : undefined,
        },
      });

      if (!response.ok) return null;

      return await response.json();
    },
  });

  return query;
};
