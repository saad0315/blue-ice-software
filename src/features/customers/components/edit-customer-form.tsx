'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { PageError } from '@/components/page-error';
import { PageLoader } from '@/components/page-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGetCustomer } from '@/features/customers/api/use-get-customer';
import { useUpdateCustomer } from '@/features/customers/api/use-update-customer';
import { type CreateCustomerInput, type UpdateCustomerInput, updateCustomerSchema } from '@/features/customers/schema';

import { BasicInfoStep } from './basic-info-step';
import { LocationStep } from './location-step';
import { SchedulePricingStep } from './schedule-pricing-step';

interface EditCustomerFormProps {
  customerId: string;
}

export const EditCustomerForm = ({ customerId }: EditCustomerFormProps) => {
  const router = useRouter();
  const { data: customer, isLoading: isLoadingCustomer } = useGetCustomer(customerId);
  const { mutate: updateCustomer, isPending } = useUpdateCustomer();

  // We cast the schema to match the form context expectations of the reusable steps
  // The reusable steps expect CreateCustomerInput, but we are using UpdateCustomerInput logic
  // This is acceptable as long as the field names match.
  const form = useForm<CreateCustomerInput>({
    resolver: zodResolver(updateCustomerSchema),
    mode: 'onChange',
  });

  useEffect(() => {
    if (customer) {
      // Flatten the data structure to match the form
      form.reset({
        name: customer.user.name,
        phoneNumber: customer.user.phoneNumber,
        email: customer.user.email || '',
        // password: '', // Password not populated
        manualCode: customer.manualCode || '',

        area: customer.area,
        address: customer.address,
        landmark: customer.landmark || '',
        floorNumber: customer.floorNumber,
        hasLift: customer.hasLift,
        geoLat: customer.geoLat,
        geoLng: customer.geoLng,

        type: customer.type,
        deliveryDays: customer.deliveryDays,
        creditLimit: customer.creditLimit.toString(),

        routeId: customer.routeId,
        sequenceOrder: customer.sequenceOrder,

        // Set default product and quantity from fetched customer data
        defaultProductId: customer.defaultProductId,
        defaultQuantity: customer.defaultQuantity,

        // These are not editable or relevant here usually, but required by type
        openingCashBalance: '0',
        openingBottleBalance: 0,
        // `productId` is for opening bottle balance, not default product for ordering
        productId: null,
      } as unknown as CreateCustomerInput);
    }
  }, [customer, form]);

  const onSubmit = (data: CreateCustomerInput) => {
    // We treat 'data' as UpdateCustomerInput here (partial)
    const updateData: UpdateCustomerInput = {
      ...data,
      // Handle empty strings/nulls logic if needed, but schema handles mostly
      email: data.email || null,
      manualCode: data.manualCode || null,
      landmark: data.landmark || null,
    };

    updateCustomer(
      {
        param: { id: customerId },
        json: updateData,
      },
      {
        onSuccess: () => {
          router.push('/customers');
        },
      },
    );
  };

  if (isLoadingCustomer) return <PageLoader />;
  if (!customer) return <PageError message="Customer not found" />;

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold tracking-tight">Edit Customer</h2>
        <Button variant="outline" onClick={() => router.push('/customers')}>
          Cancel
        </Button>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="basic">Basic Info</TabsTrigger>
              <TabsTrigger value="location">Location</TabsTrigger>
              <TabsTrigger value="schedule">Schedule & Pricing</TabsTrigger>
            </TabsList>

            <div className="mt-4 space-y-4">
              <TabsContent value="basic">
                <BasicInfoStep />
              </TabsContent>
              <TabsContent value="location">
                <LocationStep />
              </TabsContent>
              <TabsContent value="schedule">
                <SchedulePricingStep />
              </TabsContent>
            </div>
          </Tabs>

          <Card>
            <CardContent className="flex justify-end gap-4 p-6">
              <Button type="button" variant="ghost" onClick={() => router.push('/customers')}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
                Save Changes
              </Button>
            </CardContent>
          </Card>
        </form>
      </Form>
    </div>
  );
};
