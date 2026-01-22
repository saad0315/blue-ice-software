'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { DottedSeparator } from '@/components/dotted-separator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { resetPasswordSchema } from '@/features/auth/schema';

import { useReset } from '../api/use-resetPassword';
import { useResetPassToken } from '../hooks/use-reset-token';

export const ResetPassCard = () => {
  const resetToken = useResetPassToken();
  const { mutate: reset, isPending } = useReset();
  const resetForm = useForm<z.infer<typeof resetPasswordSchema>>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      password: '',
      confirmPassword: '',
    },
  });

  const onSubmit = (values: z.infer<typeof resetPasswordSchema>) => {
    reset(
      {
        json: values,
        param: { resetToken },
      },
      {
        onSuccess: () => {
          resetForm.reset();
        },
        onError: () => {
          resetForm.resetField('password');
          resetForm.resetField('confirmPassword');
        },
      },
    );
  };

  return (
    <Card className="size-full border-none shadow-none md:w-[487px]">
      <CardHeader className="flex items-center justify-center p-7 text-center">
        <CardTitle className="text-2xl">Create a New Password</CardTitle>
      </CardHeader>

      <div className="px-7">
        <DottedSeparator />
      </div>

      <CardContent className="p-7">
        <Form {...resetForm}>
          <form onSubmit={resetForm.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              disabled={isPending}
              name="password"
              control={resetForm.control}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <PasswordInput {...field} placeholder="Password" />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              disabled={isPending}
              name="confirmPassword"
              control={resetForm.control}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <PasswordInput {...field} placeholder="Confirm Password" />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="px-7">
              <DottedSeparator />
            </div>

            <Button type="submit" disabled={isPending} size="lg" className="w-full">
              Submit
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
};
