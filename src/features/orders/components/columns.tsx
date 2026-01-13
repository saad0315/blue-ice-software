'use client';

import { OrderStatus } from '@prisma/client';
import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';
import { ArrowUpDown, FileText, Info, MoreHorizontal, Pencil, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useConfirm } from '@/hooks/use-confirm';

import { useDeleteOrder } from '../api/use-delete-order';
import { useInvoiceModal } from '../hooks/use-invoice-modal';
import { useOrderModal } from '../hooks/use-order-modal';

export type Order = {
  id: string;
  readableId: number;
  scheduledDate: string;
  status: OrderStatus;
  totalAmount: string;
  cashCollected: string;
  cancellationReason?: string | null;
  driverNotes?: string | null;
  customer: {
    user: { name: string; phoneNumber: string };
  };
  driver?: {
    user: { name: string };
  } | null;
  orderItems?: {
    product: { name: string };
    quantity: number;
  }[];
};

const ActionCell = ({ order }: { order: Order }) => {
  const router = useRouter();
  const { open } = useOrderModal();
  const { open: openInvoice } = useInvoiceModal();
  const { mutate: deleteOrder, isPending } = useDeleteOrder();
  const [ConfirmDialog, confirm] = useConfirm('Delete Order', `Are you sure you want to delete order #${order.readableId}?`, 'destructive');

  const handleDelete = async () => {
    const ok = await confirm();
    if (ok) {
      deleteOrder({ param: { id: order.id } });
    }
  };

  return (
    <>
      <ConfirmDialog />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" className="h-8 w-8 p-0">
            <span className="sr-only">Open menu</span>
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuLabel>Actions</DropdownMenuLabel>
          <DropdownMenuItem onClick={() => router.push(`/orders/${order.id}`)}>
            <Info className="mr-2 h-4 w-4" />
            Order Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => open(order.id)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit Order
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => openInvoice(order.id)}>
            <FileText className="mr-2 h-4 w-4" />
            Print Invoice
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleDelete} disabled={isPending} className="text-red-600 focus:text-red-600">
            <Trash className="mr-2 h-4 w-4" />
            Delete Order
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

export const columns: ColumnDef<Order>[] = [
  {
    id: 'select',
    header: ({ table }) => (
      <Checkbox
        checked={table.getIsAllPageRowsSelected() || (table.getIsSomePageRowsSelected() && 'indeterminate')}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        aria-label="Select all"
        className="translate-y-[2px]"
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        checked={row.getIsSelected()}
        onCheckedChange={(value) => row.toggleSelected(!!value)}
        aria-label="Select row"
        className="translate-y-[2px]"
      />
    ),
    enableSorting: false,
    enableHiding: false,
  },
  {
    accessorKey: 'readableId',
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Order #
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => <div className="font-mono font-medium">#{row.getValue('readableId')}</div>,
  },
  {
    accessorKey: 'scheduledDate',
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Date
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => <div>{format(new Date(row.getValue('scheduledDate')), 'PPP')}</div>,
  },
  {
    accessorKey: 'customer.user.name',
    header: 'Customer',
  },
  {
    accessorKey: 'customer.route.name',
    header: 'Route',
  },
  {
    accessorKey: 'driver.user.name',
    header: 'Driver',
    cell: ({ row }) => row.original.driver?.user.name || '-',
  },
  {
    id: 'items',
    header: 'Items',
    cell: ({ row }) => {
      const items = row.original.orderItems || [];
      if (items.length === 0) return '-';

      const itemsSummary = items.map((item) => `${item.product.name} (${item.quantity})`).join(', ');
      const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger className="cursor-help text-left">
              <div className="max-w-[200px] truncate">
                {items.length > 1 ? `${totalQuantity} items` : itemsSummary}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1">
                {items.map((item, idx) => (
                  <div key={idx}>
                    {item.product.name} × {item.quantity}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as OrderStatus;
      let variant: 'default' | 'secondary' | 'destructive' | 'outline' = 'default';

      switch (status) {
        case 'COMPLETED':
          variant = 'default';
          break; // Greenish usually default/success
        case 'CANCELLED':
          variant = 'destructive';
          break;
        case 'PENDING':
          variant = 'secondary';
          break;
        case 'SCHEDULED':
          variant = 'outline';
          break;
        default:
          variant = 'secondary';
      }

      const reason = row.original.cancellationReason;
      const notes = row.original.driverNotes;

      const badge = <Badge variant={variant}>{status}</Badge>;

      if ((status === 'CANCELLED' || status === 'RESCHEDULED') && (reason || notes)) {
        return (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger className="flex items-center gap-1 cursor-help">
                {badge}
                <Info className="h-4 w-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent className="max-w-xs">
                <div className="flex flex-col gap-1">
                  {reason && (
                    <p>
                      <strong>Reason:</strong> {reason.replace(/_/g, ' ')}
                    </p>
                  )}
                  {notes && (
                    <p>
                      <strong>Notes:</strong> {notes}
                    </p>
                  )}
                </div>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        );
      }

      return badge;
    },
  },
  {
    accessorKey: 'totalAmount',
    header: 'Total',
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('totalAmount'));
      return <div>{new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(amount)}</div>;
    },
  },
  {
    accessorKey: 'cashCollected',
    header: 'Cash Collected',
    cell: ({ row }) => {
      const amount = parseFloat(row.getValue('cashCollected') || '0');
      return <div>{new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(amount)}</div>;
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <ActionCell order={row.original} />,
    meta: {
      sticky: true,
    },
  },
];
