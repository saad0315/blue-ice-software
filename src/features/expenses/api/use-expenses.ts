'use client';

import { ExpenseCategory, ExpenseStatus } from '@prisma/client';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';

import { client } from '@/lib/hono';

export const useGetExpenses = () => {
  const searchParams = useSearchParams();
  const page = searchParams.get('page') ? parseInt(searchParams.get('page')!, 10) : 1;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!, 10) : 10;

  return useQuery({
    queryKey: ['expenses', { page, limit }],
    queryFn: async () => {
      const response = await client.api.expenses.$get({
        query: {
          page: page.toString(),
          limit: limit.toString(),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch expenses');
      }

      const data = await response.json();
      return data;
    },
  });
};

export const useCreateExpense = () => {
  return {
    mutate: async (data: any) => {
      const response = await client.api.expenses.$post({
        json: data,
      });
      if (!response.ok) {
        throw new Error('Failed to create expense');
      }
      return await response.json();
    },
  };
};
