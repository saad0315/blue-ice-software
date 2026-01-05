'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Check, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form } from '@/components/ui/form';
import { useCreateCustomer } from '@/features/customers/api/use-create-customer';
import { DEFAULT_FORM_VALUES, FORM_STEPS } from '@/features/customers/constants';
import { type CreateCustomerInput, createCustomerSchema } from '@/features/customers/schema';
import { cn } from '@/lib/utils';

import { BasicInfoStep } from './basic-info-step';
import { LegacyMigrationStep } from './legacy-migration-step';
import { LocationStep } from './location-step';
import { SchedulePricingStep } from './schedule-pricing-step';

export const CreateCustomerForm = () => {
  const router = useRouter();
  const [currentStep, setCurrentStep] = useState(1);
  const { mutate: createCustomer, isPending } = useCreateCustomer();

  const form = useForm<CreateCustomerInput>({
    resolver: zodResolver(createCustomerSchema),
    defaultValues: DEFAULT_FORM_VALUES,
    mode: 'onChange',
  });

  const onSubmit = (data: CreateCustomerInput) => {
    createCustomer(data, {
      onSuccess: () => {
        form.reset();
        router.push('/customers'); // TODO: Update with your customers list route
      },
    });
  };

  const nextStep = async () => {
    // Validate current step fields before proceeding
    const fieldsToValidate = getStepFields(currentStep);
    const isValid = await form.trigger(fieldsToValidate);

    if (isValid && currentStep < FORM_STEPS.length) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const getStepFields = (step: number): (keyof CreateCustomerInput)[] => {
    switch (step) {
      case 1:
        return ['name', 'phoneNumber', 'email', 'password', 'manualCode'];
      case 2:
        return ['area', 'address', 'landmark', 'floorNumber', 'hasLift', 'geoLat', 'geoLng'];
      case 3:
        return ['type', 'deliveryDays', 'creditLimit'];
      case 4:
        return ['openingCashBalance', 'openingBottleBalance', 'productId'];
      default:
        return [];
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return <BasicInfoStep />;
      case 2:
        return <LocationStep />;
      case 3:
        return <SchedulePricingStep />;
      case 4:
        return <LegacyMigrationStep />;
      default:
        return null;
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Stepper */}
      <Card>
        <CardHeader>
          <CardTitle>Add New Customer</CardTitle>
          <CardDescription>Complete all steps to create a customer account</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="relative">
            {/* Progress Bar */}
            <div className="absolute left-0 top-5 h-0.5 w-full bg-muted">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${((currentStep - 1) / (FORM_STEPS.length - 1)) * 100}%` }}
              />
            </div>

            {/* Steps */}
            <div className="relative flex justify-between">
              {FORM_STEPS.map((step) => {
                const isCompleted = currentStep > step.id;
                const isCurrent = currentStep === step.id;

                return (
                  <div key={step.id} className="flex flex-col items-center">
                    <button
                      type="button"
                      onClick={() => {
                        if (step.id < currentStep) {
                          setCurrentStep(step.id);
                        }
                      }}
                      disabled={step.id > currentStep}
                      className={cn(
                        'flex size-10 items-center justify-center rounded-full border-2 bg-background transition-all',
                        isCurrent && 'border-primary bg-primary text-primary-foreground shadow-lg',
                        isCompleted && 'border-primary bg-primary text-primary-foreground',
                        !isCurrent && !isCompleted && 'border-muted text-muted-foreground',
                        step.id < currentStep && 'cursor-pointer hover:bg-primary/90',
                      )}
                    >
                      {isCompleted ? <Check className="size-5" /> : <span className="text-sm font-semibold">{step.id}</span>}
                    </button>
                    <div className="mt-2 hidden flex-col items-center md:flex">
                      <p className={cn('text-sm font-medium', isCurrent ? 'text-foreground' : 'text-muted-foreground')}>{step.title}</p>
                      <p className="text-xs text-muted-foreground">{step.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Form */}
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          {renderStep()}

          {/* Navigation Buttons */}
          <Card>
            <CardContent className="flex items-center justify-between p-6">
              <Button type="button" variant="outline" onClick={prevStep} disabled={currentStep === 1 || isPending} className="gap-2">
                <ChevronLeft className="size-4" />
                Previous
              </Button>

              <div className="text-sm text-muted-foreground">
                Step {currentStep} of {FORM_STEPS.length}
              </div>

              {currentStep < FORM_STEPS.length ? (
                <Button type="button" onClick={nextStep} disabled={isPending} className="gap-2">
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={isPending} className="gap-2">
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Creating...
                    </>
                  ) : (
                    <>
                      <Check className="size-4" />
                      Create Customer
                    </>
                  )}
                </Button>
              )}
            </CardContent>
          </Card>
        </form>
      </Form>

      {/* Form State Debug (Remove in production) */}
      {/* {process.env.NODE_ENV === 'development' && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="text-sm">Development: Form State</CardTitle>
          </CardHeader>
          <CardContent>
            <pre className="max-h-96 overflow-auto text-xs">
              {JSON.stringify(
                {
                  values: form.getValues(),
                  errors: form.formState.errors,
                },
                null,
                2,
              )}
            </pre>
          </CardContent>
        </Card>
      )} */}
    </div>
  );
};
