'use client';

import { Suspense, useState } from 'react';

import { useGetExpenses } from '@/features/expenses/api/use-expenses';
import { columns, Expense } from '@/features/expenses/components/columns';
import { ExpenseForm } from '@/features/expenses/components/expense-form';
import { ExpensesTable } from '@/features/expenses/components/expenses-table';

import { EditExpenseModal } from '@/features/expenses/components/edit-expense-modal';

function ExpensesContent() {
  const [isEditModalOpen, setEditModalOpen] = useState(false);
  const [selectedExpenseId, setSelectedExpenseId] = useState<string | undefined>();

  const { data, isLoading } = useGetExpenses();
  const expenses = (data?.expenses as Expense[]) || [];

  const handleOpenEditModal = (id: string) => {
    setSelectedExpenseId(id);
    setEditModalOpen(true);
  };

  const handleCloseEditModal = () => {
    setSelectedExpenseId(undefined);
    setEditModalOpen(false);
  };

  const extendedColumns = columns.map((col) => {
    if (col.id === 'actions') {
      return {
        ...col,
        cell: ({ row }: any) => {
          const originalCell = col.cell as Function;
          return originalCell({ row, onEdit: handleOpenEditModal });
        },
      };
    }
    return col;
  });

  return (
    <>
      <EditExpenseModal
        open={isEditModalOpen}
        onOpenChange={handleCloseEditModal}
        expenseId={selectedExpenseId}
      />
      <div className="flex flex-col gap-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Expenses</h1>
            <p className="text-muted-foreground">Manage and track company expenses</p>
          </div>
          <ExpenseForm />
        </div>

        <ExpensesTable columns={extendedColumns} data={expenses} isLoading={isLoading} />
      </div>
    </>
  );
}

export default function ExpensesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <ExpensesContent />
    </Suspense>
  );
}
