'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2, Plus, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useFieldArray, useForm } from 'react-hook-form';
import { z } from 'zod';

import { PageError } from '@/components/page-error';
import { PageLoader } from '@/components/page-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGetDrivers } from '@/features/drivers/api/use-get-drivers';
import { useCreateReturnHandover } from '@/features/inventory/api/use-create-return-handover';
import { returnHandoverSchema } from '@/features/inventory/schema';
import { useGetProducts } from '@/features/products/api/use-get-products';

// Extend schema for form usage
const formSchema = returnHandoverSchema;

type FormValues = z.infer<typeof formSchema>;

export const ReturnSheetForm = () => {
  const router = useRouter();
  const { mutate, isPending } = useCreateReturnHandover();
  const { data: drivers, isLoading: isLoadingDrivers } = useGetDrivers();
  const { data: products, isLoading: isLoadingProducts } = useGetProducts();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      driverId: '',
      date: new Date().toISOString().split('T')[0],
      items: [{ productId: '', quantity: 0, condition: 'FILLED' }],
    },
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  const onSubmit = (values: FormValues) => {
    mutate(
      { json: values },
      {
        onSuccess: () => {
          router.push('/truck-inventory');
        },
      }
    );
  };

  if (isLoadingDrivers || isLoadingProducts) return <PageLoader />;
  if (!drivers || !products) return <PageError message="Failed to load data" />;

  return (
    <Card className="w-full max-w-3xl mx-auto">
      <CardHeader>
        <CardTitle>Create Return Sheet (Evening)</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="driverId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Driver</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a driver" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {drivers.data.map((driver: any) => (
                          <SelectItem key={driver.id} value={driver.id}>
                            {driver.user.name} ({driver.vehicleNo})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Date</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <FormLabel className="text-base font-semibold">Returned Items</FormLabel>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ productId: '', quantity: 0, condition: 'FILLED' })}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Item
                </Button>
              </div>

              {fields.map((field, index) => (
                <div key={field.id} className="flex gap-4 items-end flex-wrap md:flex-nowrap">
                  <FormField
                    control={form.control}
                    name={`items.${index}.productId`}
                    render={({ field }) => (
                      <FormItem className="w-full md:flex-1">
                        <FormLabel className={index !== 0 ? 'sr-only' : ''}>Product</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Select product" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {products.data.map((product: any) => (
                              <SelectItem key={product.id} value={product.id}>
                                {product.name}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`items.${index}.condition`}
                    render={({ field }) => (
                      <FormItem className="w-full md:w-40">
                        <FormLabel className={index !== 0 ? 'sr-only' : ''}>Condition</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Condition" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="FILLED">Filled (Unsold)</SelectItem>
                            <SelectItem value="EMPTY">Empty (Collected)</SelectItem>
                            <SelectItem value="DAMAGED">Damaged</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name={`items.${index}.quantity`}
                    render={({ field }) => (
                      <FormItem className="w-full md:w-32">
                        <FormLabel className={index !== 0 ? 'sr-only' : ''}>Quantity</FormLabel>
                        <FormControl>
                          <Input
                            type="number"
                            min="0"
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="mb-[2px]"
                    onClick={() => remove(index)}
                    disabled={fields.length === 1}
                  >
                    <Trash className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-4">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Confirm Return
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
