'use client';

import { ColumnDef } from '@tanstack/react-table';
import { format } from 'date-fns';

import { MoreHorizontal, Pencil, Trash } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type Expense = {
  id: string;
  date: string;
  category: string;
  description: string | null;
  amount: number;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  spentByUser: {
    name: string;
  };
};

export const columns: ColumnDef<Expense>[] = [
  {
    accessorKey: 'date',
    header: 'Date',
    cell: ({ row }) => format(new Date(row.getValue('date')), 'MMM dd, yyyy'),
  },
  {
    accessorKey: 'category',
    header: 'Category',
    cell: ({ row }) => <Badge variant="outline">{row.getValue('category')}</Badge>,
  },
  {
    accessorKey: 'description',
    header: 'Description',
    cell: ({ row }) => (
      <div className="max-w-[200px] truncate" title={row.getValue('description')}>
        {row.getValue('description')}
      </div>
    ),
  },
  {
    accessorKey: 'amount',
    header: 'Amount',
    cell: ({ row }) => `PKR ${row.getValue('amount')}`,
  },
  {
    accessorKey: 'status',
    header: 'Status',
    cell: ({ row }) => {
      const status = row.getValue('status') as Expense['status'];
      return (
        <Badge
          variant={
            status === 'APPROVED' ? 'default' : status === 'REJECTED' ? 'destructive' : 'secondary'
          }
        >
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: 'spentByUser.name',
    header: 'Spent By',
  },
  {
    id: 'actions',
    cell: ({ row }) => <ActionCell expense={row.original} />,
  },
];

import { useConfirm } from '@/hooks/use-confirm';

import { useDeleteExpense } from '../api/use-delete-expense';

const ActionCell = ({ expense, onEdit }: { expense: Expense; onEdit: (id: string) => void }) => {
  const { mutate: deleteExpense, isPending } = useDeleteExpense();
  const [ConfirmDialog, confirm] = useConfirm(
    'Delete Expense',
    'Are you sure you want to delete this expense? This action cannot be undone.',
    'destructive',
  );

  const handleEdit = () => {
    onEdit(expense.id);
  };

  const handleDelete = async () => {
    const ok = await confirm();
    if (ok) {
      deleteExpense(expense.id);
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
        <DropdownMenuItem onClick={handleEdit}>
          <Pencil className="mr-2 h-4 w-4" />
          Edit
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleDelete} className="text-red-600 focus:text-red-600">
          <Trash className="mr-2 h-4 w-4" />
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
