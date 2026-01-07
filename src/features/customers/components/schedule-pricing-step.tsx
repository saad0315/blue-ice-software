'use client';

import { Calendar, DollarSign, Package, Truck } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { useFormContext } from 'react-hook-form';

import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CUSTOMER_TYPES, DELIVERY_DAYS } from '@/features/customers/constants';
import type { CreateCustomerInput } from '@/features/customers/schema';
import { useGetProducts } from '@/features/products/api/use-get-products';
import { cn } from '@/lib/utils';
import { useEffect } from 'react';

export const SchedulePricingStep = () => {
  const form = useFormContext<CreateCustomerInput>();
  const selectedDays = form.watch('deliveryDays') || [];
  const { data: productsData, isLoading: isLoadingProducts } = useGetProducts();
  const products = productsData || [];

  useEffect(() => {
    if (products.length > 0) {
      if (form.getValues('defaultProductId') === null) {
        form.setValue('defaultProductId', products[0].id);
      }

      if (form.getValues('defaultQuantity') === 1) {
        form.setValue('defaultQuantity', 2);
      }
    }
  }, [products, form]);

  const toggleDay = (dayValue: number) => {
    const currentDays = form.getValues('deliveryDays') || [];
    if (currentDays.includes(dayValue)) {
      form.setValue(
        'deliveryDays',
        currentDays.filter((d) => d !== dayValue),
      );
    } else {
      form.setValue('deliveryDays', [...currentDays, dayValue].sort());
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="size-5" />
            Automatic Ordering
          </CardTitle>
          <CardDescription>Configure what product is ordered automatically on delivery days</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <FormField
              control={form.control}
              name="defaultProductId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Product</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value || undefined} disabled={isLoadingProducts}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select product" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {isLoadingProducts ? (
                        <div className="flex items-center justify-center p-2">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      ) : (
                        products.map((product: any) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.sku})
                          </SelectItem>
                        ))
                      )}
                    </SelectContent>
                  </Select>
                  <FormDescription>This product will be added to generated orders.</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="defaultQuantity"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Default Quantity</FormLabel>
                  <FormControl>
                    <Input type="number" min="1" {...field} onChange={(e) => field.onChange(parseInt(e.target.value) || 1)} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="size-5" />
            Customer Type
          </CardTitle>
          <CardDescription>Select the category for this customer</CardDescription>
        </CardHeader>
        <CardContent>
          <FormField
            control={form.control}
            name="type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer Category *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {CUSTOMER_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div className="flex items-center gap-2">
                          <span>{type.icon}</span>
                          <div>
                            <div className="font-medium">{type.label}</div>
                            <div className="text-xs text-muted-foreground">{type.description}</div>
                          </div>
                        </div>
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
          <CardTitle className="flex items-center gap-2">
            <Calendar className="size-5" />
            Delivery Schedule
          </CardTitle>
          <CardDescription>Select the days when customer receives deliveries</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="deliveryDays"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Delivery Days * (Select at least one)</FormLabel>
                <div className="grid grid-cols-7 gap-2 pt-2">
                  {DELIVERY_DAYS.map((day) => {
                    const isSelected = selectedDays.includes(day.value);
                    return (
                      <button
                        key={day.value}
                        type="button"
                        onClick={() => toggleDay(day.value)}
                        className={cn(
                          'flex flex-col items-center rounded-lg border-2 p-3 transition-all hover:border-primary',
                          isSelected ? 'border-primary bg-primary text-primary-foreground shadow-md' : 'border-muted bg-background',
                        )}
                      >
                        <span className="text-xs font-medium">{day.short}</span>
                        <span className={cn('mt-1 text-[10px]', isSelected ? 'opacity-90' : 'text-muted-foreground')}>{day.label}</span>
                      </button>
                    );
                  })}
                </div>
                {selectedDays.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedDays.map((dayValue) => {
                      const day = DELIVERY_DAYS.find((d) => d.value === dayValue);
                      return (
                        <Badge key={dayValue} variant="secondary">
                          {day?.label}
                        </Badge>
                      );
                    })}
                  </div>
                )}
                <FormDescription>Customer will receive deliveries on selected days</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="size-5" />
            Financial Settings
          </CardTitle>
          <CardDescription>Set credit limit and pricing for this customer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="creditLimit"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Credit Limit (PKR)</FormLabel>
                <FormControl>
                  <Input type="number" min="0" step="100" placeholder="2000" {...field} />
                </FormControl>
                <FormDescription>Maximum allowed debt. Customer cannot order if balance exceeds this limit.</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 dark:border-amber-900 dark:bg-amber-950/20">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              <span className="font-semibold">💡 Note:</span> Custom pricing per product can be configured after customer creation in the
              customer profile settings.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
