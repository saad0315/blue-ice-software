'use client';

import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, Eye, MoreHorizontal, Pencil, Trash } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useConfirm } from '@/hooks/use-confirm';
import { cn, getAvatarColor } from '@/lib/utils';

import { useDeleteDriver } from '../api/use-delete-driver';
import { useDriverModal } from '../hooks/use-driver-modal';

export type Driver = {
  id: string;
  userId: string;
  vehicleNo: string | null;
  licenseNo: string | null;
  cashCollectedToday?: string;
  user: {
    name: string;
    email: string | null;
    phoneNumber: string;
    isActive: boolean;
    suspended: boolean;
  };
};

const ActionCell = ({ driver }: { driver: Driver }) => {
  const router = useRouter();
  const { mutate: deleteDriver, isPending } = useDeleteDriver();
  const { open } = useDriverModal();
  const [ConfirmDialog, confirm] = useConfirm(
    'Delete Driver',
    'Are you sure you want to delete this driver? This action cannot be undone.',
    'destructive',
  );

  const handleDelete = async () => {
    const ok = await confirm();
    if (ok) {
      deleteDriver({ param: { id: driver.id } });
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
          <DropdownMenuItem onClick={() => router.push(`/drivers/${driver.id}`)}>
            <Eye className="mr-2 h-4 w-4" />
            View Details
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => open(driver.id)}>
            <Pencil className="mr-2 h-4 w-4" />
            Edit
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleDelete} disabled={isPending} className="text-red-600 focus:text-red-600">
            <Trash className="mr-2 h-4 w-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
};

export const columns: ColumnDef<Driver>[] = [
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
    cell: ({ row }) => {
      const router = useRouter();
      const name = row.original.user.name;
      return (
        <button
          onClick={() => router.push(`/drivers/${row.original.id}`)}
          className="flex items-center space-x-2 cursor-pointer pl-4 text-left font-medium text-primary hover:underline"
        >
          <Avatar className="size-8 transition hover:opacity-75">
            <AvatarFallback className={cn('flex items-center justify-center font-medium text-white text-sm', getAvatarColor(name))}>
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="line-clamp-1 capitalize">{name}</span>
        </button>
      );
    },
  },
  {
    accessorKey: 'user.phoneNumber',
    header: 'Phone',
  },
  {
    accessorKey: 'vehicleNo',
    header: 'Vehicle No',
    cell: ({ row }) => row.getValue('vehicleNo') || '-',
  },
  {
    accessorKey: 'licenseNo',
    header: 'License No',
    cell: ({ row }) => row.getValue('licenseNo') || '-',
  },
  {
    accessorKey: 'cashCollectedToday',
    header: 'Cash (Today)',
    cell: ({ row }) => {
      const amount = parseFloat(row.original.cashCollectedToday || '0');
      return <div>{new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(amount)}</div>;
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => <ActionCell driver={row.original} />,
  },
];
