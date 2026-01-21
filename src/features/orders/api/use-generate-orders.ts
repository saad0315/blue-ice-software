import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { client } from '@/lib/hono';

import { GenerateOrdersInput } from '../schema';

export type GenerateOrdersProgress = {
  type: 'progress' | 'complete' | 'error';
  current?: number;
  total?: number;
  created?: number;
  message?: string;
  skippedDueToCredit?: number;
};

export const useGenerateOrders = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (json: GenerateOrdersInput) => {
      const response = await client.api.orders.generate.$post({
        json,
      });

      if (!response.ok) {
        const error = (await response.json()) as { error?: string };
        throw new Error(error.error || 'Failed to generate orders');
      }

      return await response.json();
    },
    onSuccess: (data) => {
      // @ts-ignore
      const { count, message } = data.data;
      if (count > 0) {
        toast.success(message);
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      } else {
        toast.info(message);
      }
    },
    onError: (error: Error) => {
      toast.error('Failed to generate orders', {
        description: error.message,
      });
    },
  });
};

// Streaming version with real-time progress
export const useGenerateOrdersStream = () => {
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<GenerateOrdersProgress | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generate = useCallback(
    async (data: GenerateOrdersInput) => {
      setIsGenerating(true);
      setProgress({ type: 'progress', current: 0, total: 0, created: 0 });

      try {
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_BASE_URL}/api/orders/generate-stream`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify(data),
        });

        if (!response.ok) {
          throw new Error('Failed to start order generation');
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error('No response body');
        }

        const decoder = new TextDecoder();
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) break;

          buffer += decoder.decode(value, { stream: true });

          // Parse SSE events from buffer
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6)) as GenerateOrdersProgress;
                setProgress(data);

                if (data.type === 'complete') {
                  if (data.created && data.created > 0) {
                    toast.success(data.message);
                    queryClient.invalidateQueries({ queryKey: ['orders'] });
                  } else {
                    toast.info(data.message);
                  }
                } else if (data.type === 'error') {
                  toast.error('Failed to generate orders', {
                    description: data.message,
                  });
                }
              } catch {
                // Ignore parse errors for incomplete data
              }
            }
          }
        }
      } catch (error) {
        console.error('Generation error:', error);
        setProgress({
          type: 'error',
          message: error instanceof Error ? error.message : 'Unknown error',
        });
        toast.error('Failed to generate orders', {
          description: error instanceof Error ? error.message : 'Unknown error',
        });
      } finally {
        setIsGenerating(false);
      }
    },
    [queryClient],
  );

  const reset = useCallback(() => {
    setProgress(null);
  }, []);

  return {
    generate,
    progress,
    isGenerating,
    reset,
  };
};

export const useGenerateOrdersPreview = (data: GenerateOrdersInput) => {
  return useQuery({
    queryKey: ['generate-orders-preview', data],
    queryFn: async () => {
      const response = await client.api.orders.generate.preview.$post({
        json: data,
      });

      if (!response.ok) {
        throw new Error('Failed to fetch preview');
      }

      const result = await response.json();
      return result.data;
    },
    enabled: !!data.date, // Only fetch if date is present
  });
};
