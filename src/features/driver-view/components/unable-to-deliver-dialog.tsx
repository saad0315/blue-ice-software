'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { AlertCircle, Calendar, Camera, Loader2, XCircle } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Calendar as CalendarComponent } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Textarea } from '@/components/ui/textarea';

// Cancellation reasons with Urdu/Roman labels
const CANCELLATION_REASONS = [
  { value: 'CUSTOMER_NOT_HOME', label: 'Customer Ghar Pe Nahi' },
  { value: 'HOUSE_LOCKED', label: 'Ghar Band Hai / Lock Hai' },
  { value: 'CUSTOMER_REFUSED', label: 'Customer Ne Mana Kar Diya' },
  { value: 'WRONG_ADDRESS', label: 'Galat Address Hai' },
  { value: 'PAYMENT_ISSUE', label: 'Payment Ka Masla' },
  { value: 'SECURITY_ISSUE', label: 'Security Ne Entry Nahi Di' },
  { value: 'CUSTOMER_NOT_REACHABLE', label: 'Phone Nahi Utha Raha' },
  { value: 'WEATHER_CONDITION', label: 'Barish / Mausam Kharab' },
  { value: 'VEHICLE_BREAKDOWN', label: 'Gaadi Kharab Ho Gayi' },
  { value: 'OTHER', label: 'Koi Aur Waja' },
] as const;

const unableToDeliverSchema = z.object({
  reason: z.enum(
    [
      'CUSTOMER_NOT_HOME',
      'HOUSE_LOCKED',
      'CUSTOMER_REFUSED',
      'WRONG_ADDRESS',
      'PAYMENT_ISSUE',
      'SECURITY_ISSUE',
      'CUSTOMER_NOT_REACHABLE',
      'WEATHER_CONDITION',
      'VEHICLE_BREAKDOWN',
      'OTHER',
    ],
    { required_error: 'Please select a reason' },
  ),
  notes: z.string().min(5, 'Please provide details (at least 5 characters)'),
  action: z.enum(['CANCEL', 'RESCHEDULE'], { required_error: 'Choose cancel or reschedule' }),
  rescheduleDate: z.date().optional(),
});

type UnableToDeliverFormValues = z.infer<typeof unableToDeliverSchema>;

interface UnableToDeliverDialogProps {
  orderId: string;
  customerName: string;
  scheduledDate: Date;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: UnableToDeliverFormValues & { proofPhoto?: File }) => Promise<void>;
}

export function UnableToDeliverDialog({ orderId, customerName, scheduledDate, open, onOpenChange, onSubmit }: UnableToDeliverDialogProps) {
  const [proofPhoto, setProofPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const form = useForm<UnableToDeliverFormValues>({
    resolver: zodResolver(unableToDeliverSchema),
    defaultValues: {
      action: 'RESCHEDULE', // Default to reschedule (less harsh)
    },
  });

  const selectedAction = form.watch('action');

  const handlePhotoCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setProofPhoto(file);

      // Create preview
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (values: UnableToDeliverFormValues) => {
    // Validate reschedule date if rescheduling
    if (values.action === 'RESCHEDULE' && !values.rescheduleDate) {
      form.setError('rescheduleDate', { message: 'Please select a reschedule date' });
      return;
    }

    setIsSubmitting(true);

    try {
      await onSubmit({
        ...values,
        proofPhoto: proofPhoto || undefined,
      });

      // Reset form
      form.reset();
      setProofPhoto(null);
      setPhotoPreview(null);
      onOpenChange(false);
    } catch (error) {
      // Error handled by hook
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Unable to Deliver
          </DialogTitle>
          <DialogDescription>
            Report issue for <span className="font-semibold">{customerName}</span>
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Reason Selection */}
            <FormField
              control={form.control}
              name="reason"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-semibold">Why can't you deliver?</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="space-y-2">
                      {CANCELLATION_REASONS.map((reason) => (
                        <div key={reason.value} className="flex items-center space-x-3 rounded-lg border p-3 hover:bg-accent">
                          <RadioGroupItem value={reason.value} id={reason.value} />
                          <Label htmlFor={reason.value} className="flex-1 cursor-pointer text-sm">
                            {reason.label}
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Notes */}
            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-base font-semibold">Details / تفصیل</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="مثال: Customer ne phone pe kaha k wo ghar pe nahi hai, 2 ghante baad delivery chahiye..."
                      rows={4}
                      className="resize-none text-base"
                    />
                  </FormControl>
                  <FormDescription className="text-xs">Please explain the situation in detail</FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Photo Proof */}
            <div className="space-y-2">
              <Label className="text-base font-semibold">Photo Proof (Optional)</Label>
              <div className="flex flex-col gap-3">
                <Input type="file" accept="image/*" capture="environment" onChange={handlePhotoCapture} className="h-12 cursor-pointer" />
                {photoPreview && (
                  <div className="relative">
                    <img src={photoPreview} alt="Proof" className="h-40 w-full rounded-lg border object-cover" />
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      className="absolute right-2 top-2"
                      onClick={() => {
                        setProofPhoto(null);
                        setPhotoPreview(null);
                      }}
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">📸 Take a photo (locked house, wrong address, etc.)</p>
              </div>
            </div>

            {/* Action Selection */}
            <FormField
              control={form.control}
              name="action"
              render={({ field }) => (
                <FormItem className="space-y-3">
                  <FormLabel className="text-base font-semibold">What do you want to do?</FormLabel>
                  <FormControl>
                    <RadioGroup onValueChange={field.onChange} value={field.value} className="grid grid-cols-2 gap-4">
                      <div className="relative">
                        <RadioGroupItem value="RESCHEDULE" id="reschedule" className="peer sr-only" />
                        <Label
                          htmlFor="reschedule"
                          className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-4 hover:bg-accent peer-data-[state=checked]:border-blue-600 peer-data-[state=checked]:bg-blue-50"
                        >
                          <Calendar className="h-8 w-8 text-blue-600" />
                          <span className="text-sm font-semibold">Reschedule</span>
                          <span className="text-xs text-muted-foreground">Dobara deliver karunga</span>
                        </Label>
                      </div>

                      <div className="relative">
                        <RadioGroupItem value="CANCEL" id="cancel" className="peer sr-only" />
                        <Label
                          htmlFor="cancel"
                          className="flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-4 hover:bg-accent peer-data-[state=checked]:border-red-600 peer-data-[state=checked]:bg-red-50"
                        >
                          <XCircle className="h-8 w-8 text-red-600" />
                          <span className="text-sm font-semibold">Cancel</span>
                          <span className="text-xs text-muted-foreground">Deliver nahi ho sakta</span>
                        </Label>
                      </div>
                    </RadioGroup>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Reschedule Date Picker */}
            {selectedAction === 'RESCHEDULE' && (
              <FormField
                control={form.control}
                name="rescheduleDate"
                render={({ field }) => (
                  <FormItem className="flex flex-col">
                    <FormLabel className="text-base font-semibold">Reschedule Date</FormLabel>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={`h-14 justify-start text-left font-normal ${!field.value && 'text-muted-foreground'}`}
                        >
                          <Calendar className="mr-2 h-5 w-5" />
                          {field.value ? format(field.value, 'PPP') : 'Select date'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0">
                        <CalendarComponent
                          mode="single"
                          selected={field.value}
                          onSelect={field.onChange}
                          disabled={(date) => date < new Date() || date.getTime() === new Date(scheduledDate).getTime()}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                    <FormDescription className="text-xs">کس دن دوبارہ deliver کریں؟</FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            {/* Submit Buttons */}
            <div className="flex gap-3 pt-4">
              <Button type="button" variant="outline" className="flex-1" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
                Cancel / منسوخ
              </Button>
              <Button
                type="submit"
                variant={selectedAction === 'CANCEL' ? 'destructive' : 'primary'}
                className="h-14 flex-1 text-base font-semibold"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                ) : selectedAction === 'CANCEL' ? (
                  <>
                    <XCircle className="mr-2 h-5 w-5" />
                    Cancel Order
                  </>
                ) : (
                  <>
                    <Calendar className="mr-2 h-5 w-5" />
                    Reschedule
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
