'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { PageError } from '@/components/page-error';
import { PageLoader } from '@/components/page-loader';
import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

import { useCreateRoute } from '../api/use-create-route';
import { useGetRoute } from '../api/use-get-route';
import { useUpdateRoute } from '../api/use-update-route';
import { type CreateRouteInput, createRouteSchema } from '../schema';

interface RouteFormProps {
  routeId?: string;
  onCancel?: () => void;
}

export const RouteForm = ({ routeId, onCancel }: RouteFormProps) => {
  const isEdit = !!routeId;

  const { data: route, isLoading: isLoadingRoute } = useGetRoute(routeId || '');
  const { mutate: createRoute, isPending: isCreating } = useCreateRoute();
  const { mutate: updateRoute, isPending: isUpdating } = useUpdateRoute();

  const isPending = isCreating || isUpdating;

  const form = useForm<CreateRouteInput>({
    resolver: zodResolver(createRouteSchema),
    defaultValues: {
      name: '',
      description: '',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (route) {
      form.reset({
        name: route.name,
        description: route.description || '',
      });
    }
  }, [route, form]);

  const onSubmit = (data: CreateRouteInput) => {
    if (isEdit && routeId) {
      updateRoute(
        { param: { id: routeId }, json: data },
        {
          onSuccess: () => {
            if (onCancel) onCancel();
          },
        },
      );
    } else {
      createRoute(data, {
        onSuccess: () => {
          if (onCancel) onCancel();
        },
      });
    }
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
  };

  if (isEdit && isLoadingRoute) return <PageLoader />;
  if (isEdit && !route) return <PageError message="Route not found" />;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Route Name</FormLabel>
              <FormControl>
                <Input placeholder="e.g. Morning - DHA Phase 6" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description (Optional)</FormLabel>
              <FormControl>
                <Textarea placeholder="Details about the route..." className="resize-none" {...field} value={field.value || ''} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="ghost" onClick={handleCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {isEdit ? 'Save Changes' : 'Create Route'}
          </Button>
        </div>
      </form>
    </Form>
  );
};
