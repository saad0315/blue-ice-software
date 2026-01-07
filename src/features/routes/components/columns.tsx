'use client';

import { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, MoreHorizontal, Pencil, Trash, UserCircle } from 'lucide-react';
// import { useRouter } from 'next/navigation';
// import { ArrowUpDown, MoreHorizontal, Pencil, Trash } from 'lucide-react';
// import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { useConfirm } from '@/hooks/use-confirm';

import { useDeleteRoute } from '../api/use-delete-route';
import { useRouteModal } from '../hooks/use-route-modal';

export type Route = {
  id: string;
  name: string;
  description: string | null;
  defaultDriverId: string | null;
  defaultDriver?: {
    id: string;
    user: {
      id: string;
      name: string;
      email: string;
    };
  } | null;
  _count: {
    customers: number;
  };
};

const ActionCell = ({ route }: { route: Route }) => {
  // const router = useRouter();
  const { open } = useRouteModal();
  const { mutate: deleteRoute, isPending } = useDeleteRoute();
  const [ConfirmDialog, confirm] = useConfirm(
    'Delete Route',
    `Are you sure you want to delete route "${route.name}"? This action cannot be undone.`,
    'destructive',
  );

  const handleDelete = async () => {
    const ok = await confirm();
    if (ok) {
      deleteRoute({ param: { id: route.id } });
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
          {/* <DropdownMenuItem onClick={() => router.push(`/routes/${route.id}/edit`)}> */}
          <DropdownMenuItem onClick={() => open(route.id)}>
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

export const columns: ColumnDef<Route>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => <div className="max-w-[300px] truncate">{row.getValue('description') || '-'}</div>,
  },
  {
    id: 'defaultDriver',
    header: 'Default Driver',
    cell: ({ row }) => {
      const driver = row.original.defaultDriver;
      if (!driver) {
        return <span className="text-muted-foreground">-</span>;
      }
      return (
        <Badge variant="secondary" className="gap-1">
          <UserCircle className="h-3 w-3" />
          {driver.user.name}
        </Badge>
      );
    },
  },
  {
    accessorKey: '_count.customers',
    header: 'Customers',
    cell: ({ row }) => <div className="pl-4">{row.original._count.customers}</div>,
  },
  {
    id: 'actions',
    cell: ({ row }) => <ActionCell route={row.original} />,
  },
];
