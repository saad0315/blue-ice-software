import { OrderStatus } from '@prisma/client';
import { format } from 'date-fns';

import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

// We need to define a type compatible with what's passed from the page
interface IssueOrder {
  id: string;
  status: OrderStatus | string;
  cancellationReason?: string | null;
  driverNotes?: string | null;
  rescheduledToDate?: string | Date | null;
  updatedAt: string | Date;
  customer: {
    user: {
      name: string;
    };
    address: string;
  };
}

interface IssueOrderCardProps {
  order: IssueOrder;
}

export const IssueOrderCard = ({ order }: IssueOrderCardProps) => {
  const isCancelled = order.status === OrderStatus.CANCELLED;
  const isRescheduled = order.status === OrderStatus.RESCHEDULED;

  return (
    <Card
      className={cn(
        'p-4 space-y-3',
        isCancelled && 'border-red-500/50 bg-red-500/5 dark:bg-red-500/10',
        isRescheduled && 'border-purple-500/50 bg-purple-500/5 dark:bg-purple-500/10'
      )}
    >
      {/* Header: Badge + Timestamp */}
      <div className="flex items-center justify-between">
        <Badge
          variant={isCancelled ? 'destructive' : 'secondary'}
          className={cn(isRescheduled && 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300 hover:bg-purple-200')}
        >
          {isCancelled ? 'Cancelled' : 'Rescheduled'}
        </Badge>
        <span className="text-xs text-muted-foreground">
          {format(new Date(order.updatedAt), 'h:mm a')}
        </span>
      </div>

      {/* Customer Info */}
      <div>
        <h3 className="font-semibold">{order.customer.user.name}</h3>
        <p className="text-sm text-muted-foreground line-clamp-2">{order.customer.address}</p>
      </div>

      {/* Reason */}
      {order.cancellationReason && (
        <div className="rounded bg-muted/50 p-2 text-sm border border-muted">
          <span className="font-medium text-muted-foreground mr-1">Reason:</span>
          <span className="capitalize">{order.cancellationReason.replace(/_/g, ' ').toLowerCase()}</span>
        </div>
      )}

      {/* Driver Notes */}
      {order.driverNotes && (
        <div className="text-sm">
          <span className="font-medium text-muted-foreground mr-1">Notes:</span>
          <span className="italic text-muted-foreground">{order.driverNotes}</span>
        </div>
      )}

      {/* Reschedule Date - Highlighted */}
      {isRescheduled && order.rescheduledToDate && (
        <div className="flex items-center gap-2 rounded-md bg-purple-100 p-2 text-sm font-medium text-purple-900 dark:bg-purple-900/40 dark:text-purple-100">
          <span>📅 New Date:</span>
          <span>{format(new Date(order.rescheduledToDate), 'dd MMM yyyy')}</span>
        </div>
      )}
    </Card>
  );
};
