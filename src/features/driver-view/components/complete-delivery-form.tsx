'use client';

import { OrderStatus, PaymentMethod } from '@prisma/client';
import { Check, FileText, Loader2, MapPin } from 'lucide-react';
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
import { useCompleteDelivery } from '@/features/driver-view/api/use-complete-delivery';
import { useGetOrder } from '@/features/orders/api/use-get-order';
import { useInvoiceModal } from '@/features/orders/hooks/use-invoice-modal';

interface CompleteDeliveryFormProps {
  orderId: string;
  onSuccess?: () => void;
}

export const CompleteDeliveryForm = ({ orderId, onSuccess }: CompleteDeliveryFormProps) => {
  const router = useRouter();
  const { data: order, isLoading: isLoadingOrder } = useGetOrder(orderId);
  const { mutate: completeDelivery, isPending } = useCompleteDelivery();
  const { open: openInvoice } = useInvoiceModal();

  const form = useForm({
    defaultValues: {
      cashCollected: 0,
      paymentMethod: PaymentMethod.CASH,
      items: [] as any[],
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: 'items',
  });

  useEffect(() => {
    if (order) {
      form.reset({
        cashCollected: Number(order.totalAmount),
        paymentMethod: PaymentMethod.CASH,
        items: order.orderItems.map((item: any) => ({
          productId: item.productId,
          productName: item.product.name, // For display
          quantity: item.quantity,
          filledGiven: item.quantity, // Default to ordered qty
          emptyTaken: item.quantity, // Default to ordered qty (assumption: replacement)
        })),
      });
    }
  }, [order, form]);

  const onSubmit = (data: any) => {
    completeDelivery(
      {
        param: { id: orderId },
        json: {
          status: OrderStatus.COMPLETED,
          cashCollected: data.cashCollected,
          paymentMethod: data.paymentMethod,
          items: data.items.map((item: any) => ({
            productId: item.productId,
            quantity: item.quantity,
            filledGiven: item.filledGiven,
            emptyTaken: item.emptyTaken,
            damagedReturned: item.damagedReturned,
          })),
        },
      },
      {
        onSuccess: () => {
          if (onSuccess) {
            onSuccess();
          } else {
            router.push('/deliveries');
          }
        },
      },
    );
  };

  if (isLoadingOrder) return <PageLoader />;
  if (!order) return <PageError message="Order not found" />;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Complete Delivery #{order.readableId}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="font-semibold">{order.customer.user.name}</p>
            <p className="text-sm text-muted-foreground">{order.customer.address}</p>
            <a href={`tel:${order.customer.user.phoneNumber}`} className="mt-1 block text-sm text-blue-600">
              {order.customer.user.phoneNumber}
            </a>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" size="lg" className="h-14 flex-1" onClick={() => openInvoice(orderId)}>
              <FileText className="mr-2 h-5 w-5" />
              Invoice
            </Button>
            <Button
              variant="outline"
              size="lg"
              className="h-14 flex-1"
              onClick={() =>
                window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer.address)}`, '_blank')
              }
            >
              <MapPin className="mr-2 h-5 w-5" />
              Map
            </Button>
          </div>

          <div className="flex items-center justify-between border-t pt-4">
            <span className="font-medium">Total to Collect:</span>
            <span className="text-xl font-bold">
              {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(Number(order.totalAmount))}
            </span>
          </div>
        </CardContent>
      </Card>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Card>
            <CardContent className="space-y-4 pt-6">
              <FormField
                control={form.control}
                name="cashCollected"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base">Actual Cash Collected</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min="0"
                        {...field}
                        onChange={(e) => field.onChange(e.target.value ? parseFloat(e.target.value) : 0)}
                        className="h-14 text-lg"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="paymentMethod"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Payment Method</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {Object.values(PaymentMethod).map((method) => (
                          <SelectItem key={method} value={method}>
                            {method.replace('_', ' ')}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Bottle Exchange</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Item</TableHead>
                    <TableHead className="w-[80px]">Filled</TableHead>
                    <TableHead className="w-[80px]">Empty</TableHead>
                    <TableHead className="w-[80px] text-red-500">Damaged</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {fields.map((field, index) => (
                    <TableRow key={field.id}>
                      <TableCell className="font-medium">
                        {field.productName}
                        <div className="text-xs text-muted-foreground">Qty: {field.quantity}</div>
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.filledGiven`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  className="h-12 text-center text-lg font-semibold"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.emptyTaken`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  className="h-12 text-center text-lg font-semibold"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <FormField
                          control={form.control}
                          name={`items.${index}.damagedReturned`}
                          render={({ field }) => (
                            <FormItem>
                              <FormControl>
                                <Input
                                  type="number"
                                  min="0"
                                  {...field}
                                  onChange={(e) => field.onChange(parseInt(e.target.value) || 0)}
                                  className="h-12 border-red-200 text-center text-lg font-semibold text-red-600 focus-visible:ring-red-500"
                                />
                              </FormControl>
                            </FormItem>
                          )}
                        />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Button
            type="submit"
            size="lg"
            className="h-16 w-full text-lg font-semibold"
            disabled={isPending || order.status === 'COMPLETED'}
          >
            {isPending ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Check className="mr-2 h-5 w-5" />}
            {order.status === 'COMPLETED' ? 'Already Completed' : 'Confirm Delivery'}
          </Button>
        </form>
      </Form>
    </div>
  );
};
