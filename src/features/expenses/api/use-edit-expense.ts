'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { client } from '@/lib/hono';
import { CreateExpenseInput } from '../schema';

export const useGetExpense = (id?: string) => {
  return useQuery({
    queryKey: ['expense', { id }],
    queryFn: async () => {
      const response = await client.api.expenses[':id'].$get({
        param: { id: id! },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch expense');
      }

      const { data } from await response.json();
      return data;
    },
    enabled: !!id,
  });
};

export const useEditExpense = (id?: string) => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (json: CreateExpenseInput) => {
      const response = await client.api.expenses[':id'].$patch({
        param: { id: id! },
        json,
      });

      if (!response.ok) {
        throw new Error('Failed to update expense');
      }

      return await response.json();
    },
    onSuccess: () => {
      toast.success('Expense updated successfully');
      queryClient.invalidateQueries({ queryKey: ['expense', { id }] });
      queryClient.invalidateQueries({ queryKey: ['expenses'] });
    },
    onError: (error) => {
      toast.error('Failed to update expense');
      console.error(error);
    },
  });
};
