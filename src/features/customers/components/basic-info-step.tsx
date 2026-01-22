'use client';

import { CheckCircle2, Info, RefreshCw, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { PasswordInput } from '@/components/ui/password-input';
import { useCheckCode, useGenerateCode } from '@/features/customers/api/use-generate-code';
import type { CreateCustomerInput } from '@/features/customers/schema';

export const BasicInfoStep = () => {
  const form = useFormContext<CreateCustomerInput>();
  const [isManualOverride, setIsManualOverride] = useState(false);

  const { data: generatedCode, isLoading: isGenerating } = useGenerateCode();
  const manualCodeValue = form.watch('manualCode');
  const { data: codeCheck, isLoading: isChecking } = useCheckCode(manualCodeValue || '');

  // Auto-set generated code when loaded
  useEffect(() => {
    if (generatedCode?.code && !manualCodeValue && !isManualOverride) {
      form.setValue('manualCode', generatedCode.code);
    }
  }, [generatedCode, form, manualCodeValue, isManualOverride]);

  const handleManualOverride = () => {
    setIsManualOverride(true);
    form.setValue('manualCode', '');
  };

  const handleResetToAuto = () => {
    setIsManualOverride(false);
    if (generatedCode?.code) {
      form.setValue('manualCode', generatedCode.code);
    }
  };

  const showCodeValidation = manualCodeValue && isManualOverride && codeCheck;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Customer Information</CardTitle>
          <CardDescription>Enter the basic details of the new customer</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Full Name *</FormLabel>
                <FormControl>
                  <Input placeholder="Ahmed Khan" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="phoneNumber"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Phone Number *</FormLabel>
                  <FormControl>
                    <Input placeholder="03001234567" {...field} />
                  </FormControl>
                  <FormDescription>Primary contact number</FormDescription>
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
                    <Input type="email" placeholder="ahmed@example.com" {...field} value={field.value || ''} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Password *</FormLabel>
                <FormControl>
                  <PasswordInput placeholder="Minimum 8 characters" {...field} />
                </FormControl>
                <FormDescription>Customer login password</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>

      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2 text-blue-900 dark:text-blue-100">
                <Info className="size-5" />
                Customer Code
              </CardTitle>
              <CardDescription className="text-blue-700 dark:text-blue-300">
                {isManualOverride ? 'Enter legacy customer code manually' : 'Auto-generated customer code'}
              </CardDescription>
            </div>
            <div className="flex gap-2">
              {!isManualOverride && (
                <Button type="button" variant="outline" size="sm" onClick={handleManualOverride}>
                  Override for Legacy
                </Button>
              )}
              {isManualOverride && (
                <Button type="button" variant="outline" size="sm" onClick={handleResetToAuto}>
                  <RefreshCw className="mr-1 size-3" />
                  Reset to Auto
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <FormField
            control={form.control}
            name="manualCode"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Customer Code *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      placeholder={isManualOverride ? 'L-3442' : 'Generating...'}
                      {...field}
                      value={field.value || ''}
                      className="pr-10 font-mono"
                      readOnly={!isManualOverride}
                      disabled={isGenerating && !isManualOverride}
                    />
                    {showCodeValidation && (
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {isChecking ? (
                          <RefreshCw className="size-4 animate-spin text-gray-400" />
                        ) : codeCheck.exists ? (
                          <XCircle className="size-4 text-red-500" />
                        ) : (
                          <CheckCircle2 className="size-4 text-green-500" />
                        )}
                      </div>
                    )}
                  </div>
                </FormControl>
                <FormDescription>
                  {isManualOverride
                    ? 'Format: [A-Z]-XXXX (e.g., L-3442 for legacy customers)'
                    : 'Auto-generated format: C-1001, C-1002, etc.'}
                </FormDescription>
                {showCodeValidation && codeCheck.exists && (
                  <p className="text-sm text-red-500">This customer code already exists. Please use a different code.</p>
                )}
                <FormMessage />
              </FormItem>
            )}
          />
        </CardContent>
      </Card>
    </div>
  );
};
