import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

export const useSubmitCashHandover = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: {
      date: string;
      actualCash: number;
      driverNotes?: string;
      shiftStart?: string;
      shiftEnd?: string;
      expenseIds?: string[];
    }) => {
      const response = await client.api['cash-management'].driver.submit.$post({
        json: data,
      });

      if (!response.ok) {
        const error = await response.json();
        // @ts-expect-error - Hono client types inference
        throw new Error(error.error || 'Failed to submit cash handover');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      toast.success(data.message || 'Cash handover submitted successfully');
      queryClient.invalidateQueries({ queryKey: ['driver-day-summary'] });
      queryClient.invalidateQueries({ queryKey: ['driver-handover-history'] });
      queryClient.invalidateQueries({ queryKey: ['cash-handovers'] });
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });
};
