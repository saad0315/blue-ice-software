'use client';

import { format } from 'date-fns';
import { CalendarIcon, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGenerateOrdersStream } from '@/features/orders/api/use-generate-orders';
import { useGetRoutes } from '@/features/routes/api/use-get-routes';
import { cn } from '@/lib/utils';

interface GenerateOrdersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GenerateOrdersModal = ({ open, onOpenChange }: GenerateOrdersModalProps) => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [routeId, setRouteId] = useState<string>('all');

  const { generate, progress, isGenerating, reset } = useGenerateOrdersStream();
  const { data: routesData, isLoading: isLoadingRoutes } = useGetRoutes();
  const routes = routesData?.routes || [];

  // Reset progress when modal closes
  useEffect(() => {
    if (!open) {
      reset();
    }
  }, [open, reset]);

  const handleGenerate = () => {
    if (!date) return;

    generate({
      date: format(date, 'yyyy-MM-dd'),
      routeId: routeId === 'all' ? undefined : routeId,
    });
  };

  const handleClose = () => {
    if (!isGenerating) {
      onOpenChange(false);
    }
  };

  const progressPercent = progress?.total && progress.total > 0 ? Math.round(((progress.current || 0) / progress.total) * 100) : 0;

  const isComplete = progress?.type === 'complete';
  const isError = progress?.type === 'error';
  const showProgress = isGenerating || isComplete || isError;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generate Daily Orders</DialogTitle>
          <DialogDescription>Create orders for all customers scheduled for the selected date.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          {!showProgress ? (
            <>
              <div className="space-y-2">
                <label className="text-sm font-medium">Delivery Date</label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant={'outline'}
                      className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {date ? format(date, 'PPP') : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar mode="single" selected={date} onSelect={setDate} initialFocus />
                  </PopoverContent>
                </Popover>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Route (Optional)</label>
                <Select value={routeId} onValueChange={setRouteId} disabled={isLoadingRoutes}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Routes" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Routes</SelectItem>
                    {routes.map((route: any) => (
                      <SelectItem key={route.id} value={route.id}>
                        {route.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[0.8rem] text-muted-foreground">Leave as "All Routes" to generate for everyone.</p>
              </div>
            </>
          ) : (
            <div className="space-y-4">
              {isGenerating && (
                <>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Generating orders...</span>
                  </div>
                  <Progress value={progressPercent} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>
                      Processing {progress?.current || 0} of {progress?.total || 0} customers
                    </span>
                    <span>{progress?.created || 0} orders created</span>
                  </div>
                </>
              )}

              {isComplete && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <CheckCircle2 className="h-12 w-12 text-green-500" />
                  <p className="text-center text-sm font-medium">{progress?.message}</p>
                  {progress?.created !== undefined && progress.created > 0 && (
                    <p className="text-center text-xs text-muted-foreground">{progress.created} orders have been created</p>
                  )}
                </div>
              )}

              {isError && (
                <div className="flex flex-col items-center gap-3 py-4">
                  <XCircle className="h-12 w-12 text-red-500" />
                  <p className="text-center text-sm font-medium text-red-500">Generation Failed</p>
                  <p className="text-center text-xs text-muted-foreground">{progress?.message}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {!showProgress ? (
            <>
              <Button variant="outline" onClick={handleClose} disabled={isGenerating}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={!date || isGenerating}>
                {isGenerating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Generate Orders
              </Button>
            </>
          ) : isComplete || isError ? (
            <Button onClick={handleClose} className="w-full">
              Close
            </Button>
          ) : (
            <p className="w-full text-center text-xs text-muted-foreground">Please wait while orders are being generated...</p>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
