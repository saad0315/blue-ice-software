'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { OrderStatus } from '@prisma/client';
import { Loader2, Plus, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useFieldArray, useForm } from 'react-hook-form';

import { PageError } from '@/components/page-error';
import { PageLoader } from '@/components/page-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGetCustomers } from '@/features/customers/api/use-get-customers';
import { Customer } from '@/features/customers/components/columns';
import { useGetDrivers } from '@/features/drivers/api/use-get-drivers';
import { Driver } from '@/features/drivers/components/columns';
import { useGetProducts } from '@/features/products/api/use-get-products';
import { Product } from '@/features/products/components/columns';

import { useCreateOrder } from '../api/use-create-order';
import { useGetOrder } from '../api/use-get-order';
import { useUpdateOrder } from '../api/use-update-order';
import { type CreateOrderInput, createOrderSchema } from '../schema';

interface OrderFormProps {
  orderId?: string;
  onCancel?: () => void;
}

export const OrderForm = ({ orderId, onCancel }: OrderFormProps) => {
  const router = useRouter();
  const isEdit = !!orderId;

  const { data: order, isLoading: isLoadingOrder } = useGetOrder(orderId || '');
  // Fetch ALL customers and drivers for the dropdowns to ensure we can map IDs correctly
  // Note: For large datasets, this should be an async search select, but for now we increase the limit
  const { data: customersData, isLoading: isLoadingCustomers } = useGetCustomers();
  const { data: productsData, isLoading: isLoadingProducts } = useGetProducts();
  const { data: driversData, isLoading: isLoadingDrivers } = useGetDrivers();

  const rawCustomers = (customersData?.data as Customer[]) || [];
  // @ts-ignore
  const products = (productsData as unknown as Product[]) || [];
  // @ts-ignore
  const rawDrivers = (driversData?.drivers as Driver[]) || [];

  // Ensure the current order's customer/driver is in the list (for Edit mode)
  // This handles pagination where the current entity might not be in the first page
  const customers = [...rawCustomers];
  if (order?.customer && !customers.find((c) => c.id === order.customerId)) {
    // @ts-ignore - Constructing a minimal Customer object for the dropdown
    customers.push(order.customer as Customer);
  }

  const drivers = [...rawDrivers];
  if (order?.driver && !drivers.find((d) => d.id === order.driverId)) {
    // @ts-ignore - Constructing a minimal Driver object for the dropdown
    drivers.push(order.driver as Driver);
  }

  const { mutate: createOrder, isPending: isCreating } = useCreateOrder();
  const { mutate: updateOrder, isPending: isUpdating } = useUpdateOrder();

  const isPending = isCreating || isUpdating;

  const form = useForm<CreateOrderInput>({
    resolver: zodResolver(createOrderSchema),
    defaultValues: {
      customerId: '',
      driverId: undefined,
      scheduledDate: new Date(),
      status: OrderStatus.SCHEDULED,
      deliveryCharge: 0,
      discount: 0,
      items: [],
    },
    mode: 'onChange',
  });

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  useEffect(() => {
    if (order) {
      form.reset({
        customerId: order.customerId,
        driverId: order.driverId || undefined,
        scheduledDate: new Date(order.scheduledDate),
        status: order.status,
        deliveryCharge: Number(order.deliveryCharge),
        discount: Number(order.discount),
        items: order.orderItems.map((item: any) => ({
          productId: item.productId,
          quantity: item.quantity,
          price: Number(item.priceAtTime),
        })),
      });
    }
  }, [order, form]);

  useEffect(() => {
    if (!isEdit && products.length > 0 && fields.length === 0) {
      append({
        productId: products[0].id,
        quantity: 2,
        price: undefined,
      });
    }
  }, [isEdit, products, fields, append]);

  const onSubmit = (data: CreateOrderInput) => {
    if (isEdit && orderId) {
      // @ts-ignore
      updateOrder(
        { param: { id: orderId }, json: data },
        {
          onSuccess: () => {
            if (onCancel) {
              onCancel();
            } else {
              router.push('/orders');
            }
          },
        },
      );
    } else {
      createOrder(data, {
        onSuccess: () => {
          if (onCancel) {
            onCancel();
          } else {
            router.push('/orders');
          }
        },
      });
    }
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
    else router.push('/orders');
  };

  if (isEdit && isLoadingOrder) return <PageLoader />;
  if (isEdit && !order) return <PageError message="Order not found" />;

  return (
    <Card className="mx-auto max-w-4xl">
      <CardHeader>
        <CardTitle>{isEdit ? 'Edit Order' : 'Create New Order'}</CardTitle>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="customerId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Customer</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select Customer" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {customers.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.user.name} ({c.area})
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
                name="scheduledDate"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Scheduled Date</FormLabel>
                    <FormControl>
                      <Input
                        type="date"
                        value={field.value ? new Date(field.value).toISOString().split('T')[0] : ''}
                        onChange={(e) => field.onChange(e.target.value ? new Date(e.target.value) : new Date())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="driverId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Driver (Optional)</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value || undefined} value={field.value || undefined}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Assign Driver" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {drivers.map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.user.name} ({d.vehicleNo})
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
                name="status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Status" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(OrderStatus).map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Items Table */}
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="w-[100px]">Qty</TableHead>
                    <TableHead className="w-[150px]">Price (Override)</TableHead>
                    <TableHead className="w-[50px]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.productId`}
                          render={({ field }) => (
                            <FormItem>
                              <Select onValueChange={field.onChange} defaultValue={field.value} value={field.value}>
                                <FormControl>
                                  <SelectTrigger>
                                    <SelectValue placeholder="Select Product" />
                                  </SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {products.map((p) => (
                                    <SelectItem key={p.id} value={p.id}>
                                      {p.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.quantity`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input type="number" min="1" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 1)} />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.price`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  placeholder="Auto"
                                  {...field}
                                  onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : undefined)}
                                  value={field.value ?? ''}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Button type="button" variant="ghost" size="sm" onClick={() => remove(index)}>
                          <Trash className="size-4 text-red-500" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="p-4">
                <Button type="button" variant="outline" size="sm" onClick={() => append({ productId: '', quantity: 1 })} className="gap-2">
                  <Plus className="size-4" /> Add Item
                </Button>
                {form.formState.errors.items && (
                  <p className="mt-2 text-sm font-medium text-destructive">{form.formState.errors.items.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <FormField
                control={form.control}
                name="deliveryCharge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Delivery Charge</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="discount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Discount</FormLabel>
                    <FormControl>
                      <Input type="number" min="0" {...field} onChange={(e) => field.onChange(parseFloat(e.target.value) || 0)} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end space-x-2">
              <Button type="button" variant="ghost" onClick={handleCancel}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                {isEdit ? 'Save Changes' : 'Create Order'}
              </Button>
            </div>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
