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
import { PasswordInput } from '@/components/ui/password-input';

import { useCreateDriver } from '../api/use-create-driver';
import { useGetDriver } from '../api/use-get-driver';
import { useUpdateDriver } from '../api/use-update-driver';
import { type CreateDriverInput, createDriverSchema } from '../schema';

interface DriverFormProps {
  driverId?: string;
  onCancel?: () => void;
}

export const DriverForm = ({ driverId, onCancel }: DriverFormProps) => {
  const isEdit = !!driverId;

  const { data: driver, isLoading: isLoadingDriver } = useGetDriver(driverId || '');
  const { mutate: createDriver, isPending: isCreating } = useCreateDriver();
  const { mutate: updateDriver, isPending: isUpdating } = useUpdateDriver();

  const isPending = isCreating || isUpdating;

  const form = useForm<CreateDriverInput>({
    resolver: zodResolver(createDriverSchema),
    defaultValues: {
      name: '',
      phoneNumber: '',
      email: '',
      password: '',
      vehicleNo: '',
      licenseNo: '',
    },
    mode: 'onChange',
  });

  useEffect(() => {
    if (driver) {
      form.reset({
        name: driver.user.name,
        phoneNumber: driver.user.phoneNumber,
        email: driver.user.email || '',
        password: 'dummy-password',
        vehicleNo: driver.vehicleNo || '',
        licenseNo: driver.licenseNo || '',
      });
    }
  }, [driver, form]);

  const onSubmit = (data: CreateDriverInput) => {
    if (isEdit && driverId) {
      const { password, ...updateData } = data;
      updateDriver(
        { param: { id: driverId }, json: updateData },
        {
          onSuccess: () => {
            if (onCancel) onCancel();
          },
        },
      );
    } else {
      createDriver(data, {
        onSuccess: () => {
          if (onCancel) onCancel();
        },
      });
    }
  };

  const handleCancel = () => {
    if (onCancel) onCancel();
  };

  if (isEdit && isLoadingDriver) return <PageLoader />;
  if (isEdit && !driver) return <PageError message="Driver not found" />;

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Full Name</FormLabel>
              <FormControl>
                <Input placeholder="Ali Ahmed" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="phoneNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Phone Number</FormLabel>
                <FormControl>
                  <Input placeholder="03001234567" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email (Optional)</FormLabel>
                <FormControl>
                  <Input type="email" placeholder="ali@example.com" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {!isEdit && (
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password</FormLabel>
                <FormControl>
                  <PasswordInput placeholder="Min 8 characters" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="vehicleNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Vehicle No</FormLabel>
                <FormControl>
                  <Input placeholder="LEA-1234" {...field} value={field.value || ''} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="licenseNo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>License No</FormLabel>
                <FormControl>
                  <Input placeholder="CNIC or License" {...field} value={field.value || ''} />
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
            {isEdit ? 'Save Changes' : 'Create Driver'}
          </Button>
        </div>
      </form>
    </Form>
  );
};
