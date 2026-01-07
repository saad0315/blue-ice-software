'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Form } from '@/components/ui/form';
import { useEditExpense, useGetExpense } from '../api/use-edit-expense';
import { CreateExpenseInput, createExpenseSchema } from '../schema';
import { ExpenseFormFields } from './expense-form-fields';

interface EditExpenseModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expenseId?: string;
}

export const EditExpenseModal = ({
  open,
  onOpenChange,
  expenseId,
}: EditExpenseModalProps) => {
  const { data: expense, isLoading } = useGetExpense(expenseId);
  const { mutate: editExpense, isPending } = useEditExpense(expenseId);

  const form = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema),
  });

  useEffect(() => {
    if (expense) {
      form.reset(expense);
    }
  }, [expense, form]);

  const onSubmit = (data: CreateExpenseInput) => {
    editExpense(data, {
      onSuccess: () => {
        onOpenChange(false);
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Expense</DialogTitle>
          <DialogDescription>Update the details of the expense.</DialogDescription>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <ExpenseFormFields form={form} />
              <DialogFooter>
                <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPending}>
                  {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save Changes'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
};
