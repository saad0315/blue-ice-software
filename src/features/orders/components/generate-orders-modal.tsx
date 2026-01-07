'use client';

import { format } from 'date-fns';
import { CalendarIcon, Loader2 } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useGenerateOrders } from '@/features/orders/api/use-generate-orders';
import { useGetRoutes } from '@/features/routes/api/use-get-routes';
import { cn } from '@/lib/utils';

interface GenerateOrdersModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export const GenerateOrdersModal = ({ open, onOpenChange }: GenerateOrdersModalProps) => {
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [routeId, setRouteId] = useState<string>('all');

  const { mutate: generateOrders, isPending } = useGenerateOrders();
  const { data: routesData, isLoading: isLoadingRoutes } = useGetRoutes();
  const routes = routesData?.routes || [];

  const handleGenerate = () => {
    if (!date) return;

    generateOrders(
      {
        date: format(date, 'yyyy-MM-dd'),
        routeId: routeId === 'all' ? undefined : routeId,
      },
      {
        onSuccess: () => {
          onOpenChange(false);
        },
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generate Daily Orders</DialogTitle>
          <DialogDescription>Create orders for all customers scheduled for the selected date.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">Delivery Date</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant={'outline'} className={cn('w-full justify-start text-left font-normal', !date && 'text-muted-foreground')}>
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {date ? format(date, 'PPP') : <span>Pick a date</span>}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0">
                <Calendar
                  mode="single"
                  selected={date}
                  onSelect={setDate}
                  disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  initialFocus
                />
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
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleGenerate} disabled={!date || isPending}>
            {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Generate Orders
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
