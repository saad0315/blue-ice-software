'use client';

import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, Eye, MoreHorizontal, Pencil, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useDeleteCustomer } from '@/features/customers/api/use-delete-customer';
import { DELIVERY_DAYS } from '@/features/customers/constants';
import { useConfirm } from '@/hooks/use-confirm';

// Define the shape of your data based on the API response
// This should match the return type of getCustomers in queries.ts
export type Customer = {
  id: string;
  userId: string;
  manualCode: string | null;
  area: string;
  address: string;
  type: string;
  creditLimit: string;
  cashBalance: string;
  deliveryDays: number[];
  user: {
    name: string;
    email: string | null;
    phoneNumber: string;
    isActive: boolean;
    suspended: boolean;
  };
  route: {
    name: string;
  } | null;
};

const ActionCell = ({ customer }: { customer: Customer }) => {
  const router = useRouter();
  const { mutate: deleteCustomer, isPending } = useDeleteCustomer();
  const [ConfirmDialog, confirm] = useConfirm(
    'Delete Customer',
    'Are you sure you want to delete this customer? This action cannot be undone.',
    'destructive',
  );

  const handleDelete = async () => {
    const ok = await confirm();
    if (ok) {
      deleteCustomer({ param: { id: customer.id } });
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
          <DropdownMenuItem onClick={() => navigator.clipboard.writeText(customer.id)}>Copy customer ID</DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push(`/customers/${customer.id}`)}>
            <Eye className="mr-2 h-4 w-4" />
            View details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.push(`/customers/${customer.id}/edit`)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit customer
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDelete} disabled={isPending} className="text-red-600 focus:text-red-600">
            <Trash className="mr-2 h-4 w-4" />
            Delete customer
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

export const columns: ColumnDef<Customer>[] = [
  {
    accessorKey: 'manualCode',
    header: 'Code',
    cell: ({ row }) => <div className="font-medium">{row.getValue('manualCode') || '-'}</div>,
  },
  {
    accessorKey: 'user.name',
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => <div className="pl-4">{row.original.user.name}</div>,
  },
  {
    accessorKey: 'user.phoneNumber',
    header: 'Phone',
  },
  {
    accessorKey: 'area',
    header: 'Area',
  },
  {
    accessorKey: 'address',
    header: 'Address',
    cell: ({ row }) => (
      <div className="max-w-[200px] truncate" title={row.getValue('address')}>
        {row.getValue('address')}
      </div>
    ),
  },
  {
    accessorKey: 'type',
    header: 'Type',
    cell: ({ row }) => {
      const type = row.getValue('type') as string;
      return <Badge variant="secondary">{type}</Badge>;
    },
  },
  {
    accessorKey: 'deliveryDays',
    header: 'Delivery Days',
    cell: ({ row }) => {
      const days = row.original.deliveryDays || [];
      if (days.length === 0) return '-';

      const dayLabels = days
        .sort((a, b) => a - b)
        .map((day) => DELIVERY_DAYS.find((d) => d.value === day)?.short || day)
        .join(', ');

      return <div className="max-w-[150px] truncate" title={dayLabels}>{dayLabels}</div>;
    },
  },
  {
    accessorKey: 'route.name',
    header: 'Route',
    cell: ({ row }) => row.original.route?.name || '-',
  },
  {
    accessorKey: 'cashBalance',
    header: 'Balance',
    cell: ({ row }) => {
      const balance = parseFloat(row.getValue('cashBalance'));
      const formatted = new Intl.NumberFormat('en-PK', {
        style: 'currency',
        currency: 'PKR',
      }).format(balance);

      return <div className={balance < 0 ? 'font-medium text-red-500' : 'font-medium text-green-600'}>{formatted}</div>;
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <ActionCell customer={row.original} />,
    meta: {
      sticky: true,
    },
  },
];
