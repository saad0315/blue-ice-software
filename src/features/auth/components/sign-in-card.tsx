'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { DottedSeparator } from '@/components/dotted-separator';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormField, FormItem, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { useLogin } from '@/features/auth/api/use-login';
import { signInFormSchema } from '@/features/auth/schema';

export const SignInCard = () => {
  const { mutate: login, isPending } = useLogin();
  const signInForm = useForm<z.infer<typeof signInFormSchema>>({
    resolver: zodResolver(signInFormSchema),
    defaultValues: {
      emailOrPhone: '',
      password: '',
    },
  });

  const onSubmit = (values: z.infer<typeof signInFormSchema>) => {
    login(
      {
        json: values,
      },
      {
        onSuccess: () => {
          signInForm.reset();
        },
        onError: () => {
          signInForm.resetField('password');
        },
      },
    );
  };

  return (
    <Card className="size-full border-none shadow-none md:w-[487px]">
      <CardHeader className="flex items-center justify-center p-7 text-center">
        <CardTitle className="text-2xl">Welcome back!</CardTitle>
      </CardHeader>

      <div className="px-7">
        <DottedSeparator />
      </div>

      <CardContent className="p-7">
        <Form {...signInForm}>
          <form onSubmit={signInForm.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              disabled={isPending}
              name="emailOrPhone"
              control={signInForm.control}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Input {...field} type="text" placeholder="Email or Phone Number" />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              disabled={isPending}
              name="password"
              control={signInForm.control}
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <PasswordInput {...field} placeholder="Password" />
                  </FormControl>

                  <FormMessage />
                </FormItem>
              )}
            />

            <Button type="submit" disabled={isPending} size="lg" className="w-full">
              Login
            </Button>
          </form>
        </Form>
      </CardContent>
      <Link href="/password/forgot" className="float-end px-7 text-right">
        <span className="text-blue-700 dark:text-blue-500">Forgot Password</span>
      </Link>

      <div className="px-7">
        <DottedSeparator />
      </div>

      <CardContent className="flex items-center justify-center p-7">
        <p>
          Don&apos;t have an account?{' '}
          <Link href="/sign-up">
            <span className="text-blue-700 dark:text-blue-500">Register</span>
          </Link>
        </p>
      </CardContent>
    </Card>
  );
};
