'use client';

import { format } from 'date-fns';
import { AlertCircle, AlertTriangle, Calendar, CheckCircle, Clock, DollarSign, FileText, Package, TrendingUp } from 'lucide-react';
import { Suspense, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { useDriverDaySummary } from '@/features/cash-management/api/use-driver-day-summary';
import { useSubmitCashHandover } from '@/features/cash-management/api/use-submit-cash-handover';
import { useGetExpenses } from '@/features/expenses/api/use-expenses';
import { ExpenseStatus } from '@prisma/client';
import { Checkbox } from '@/components/ui/checkbox';

function CashHandoverContent() {
  const { data: summary, isLoading, error } = useDriverDaySummary();
  const { data: expensesData } = useGetExpenses({ status: ExpenseStatus.PENDING });
  const { mutate: submitHandover, isPending } = useSubmitCashHandover();

  const [actualCash, setActualCash] = useState('');
  const [driverNotes, setDriverNotes] = useState('');
  const [shiftStart, setShiftStart] = useState('');
  const [shiftEnd, setShiftEnd] = useState('');
  const [selectedExpenseIds, setSelectedExpenseIds] = useState<string[]>([]);

  // Toggle expense selection
  const toggleExpense = (id: string) => {
    setSelectedExpenseIds((prev) => (prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!actualCash || parseFloat(actualCash) < 0) {
      return;
    }

    submitHandover({
      date: format(new Date(), 'yyyy-MM-dd'),
      actualCash: parseFloat(actualCash),
      driverNotes: driverNotes || undefined,
      shiftStart: shiftStart || undefined,
      shiftEnd: shiftEnd || undefined,
      expenseIds: selectedExpenseIds,
    });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 md:grid-cols-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
        <p className="text-lg font-medium text-destructive">Failed to load day summary</p>
        <p className="mt-2 text-sm text-muted-foreground">Please try again later</p>
      </div>
    );
  }

  // Today's expected cash
  const todayExpectedCash = parseFloat(summary?.expectedCash || '0');

  // Pending cash from previous days
  const pendingFromPreviousDays = summary?.pendingFromPreviousDays;
  const hasPendingCash = pendingFromPreviousDays?.hasPendingCash || false;
  const pendingCashAmount = parseFloat(pendingFromPreviousDays?.netPendingCash || '0');

  // Total expected cash (today + previous days)
  const totalExpectedCash = parseFloat(summary?.totalExpectedCash || '0');

  // Use total expected cash for discrepancy calculation
  const enteredCash = parseFloat(actualCash || '0');
  const discrepancy = totalExpectedCash - enteredCash;
  const hasDiscrepancy = Math.abs(discrepancy) > 0.01;

  // Active Handover State
  const isPending = summary?.isHandoverPending;
  const pendingHandover = summary?.todayHandover;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">End of Day - Cash Handover</h1>
          <p className="text-muted-foreground">Submit your daily cash collection</p>
        </div>
        <Button variant="outline" onClick={() => window.location.reload()} size="sm">
          <Clock className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Pending Handover Alert */}
      {isPending && pendingHandover && (
        <Card className="border-blue-500 bg-blue-50 dark:bg-blue-950/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-blue-700 dark:text-blue-400">
              <Clock className="h-5 w-5" />
              Handover Submitted & Pending Verification
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex justify-between items-center">
              <div>
                <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">
                  PKR {parseFloat(pendingHandover.actualCash).toLocaleString()}
                </p>
                <p className="text-xs text-blue-600 dark:text-blue-500 mt-1">
                  Submitted at {format(new Date(pendingHandover.submittedAt), 'hh:mm a')}
                </p>
              </div>

              {/* Cancel Button */}
              {/* Note: In a real app, bind this to the cancel API. For now, simple refresh instructions. */}
              {/* <Button variant="destructive" size="sm">Cancel Handover</Button> */}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Summary Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <Card className="col-span-1 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Total Deliveries</CardTitle>
            <Package className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0 ml-1" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{summary?.completedOrders || 0}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight mt-1">
              out of {summary?.totalOrders || 0} assigned (today)
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-1 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium leading-tight">Cash Orders</CardTitle>
            <DollarSign className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground shrink-0 ml-1" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold">{Array.isArray(summary?.ordersPaidInCash) ? summary.ordersPaidInCash.length : 0}</div>
            <p className="text-[10px] sm:text-xs text-muted-foreground leading-tight mt-1">
              paid in cash (today)
            </p>
          </CardContent>
        </Card>

        <Card className="col-span-2 md:col-span-1 border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20 shadow-sm">
          <CardHeader className="flex flex-row items-start justify-between space-y-0 p-3 sm:p-4 pb-1 sm:pb-2">
            <CardTitle className="text-xs sm:text-sm font-medium text-green-900 dark:text-green-100 leading-tight">
              Total Pending Cash
            </CardTitle>
            <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-600 shrink-0 ml-1" />
          </CardHeader>
          <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
            <div className="text-xl sm:text-2xl font-bold text-green-600 dark:text-green-400">
              {/* If pending handover exists, show 0 to submit, otherwise show total pending */}
              PKR {isPending ? '0.00' : totalExpectedCash.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </div>
            <div className="flex flex-col gap-y-1 mt-1">
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                Gross Collected: {summary?.grossCash || '0'}
              </p>
              {parseFloat(summary?.expensesAmount || '0') > 0 && (
                <p className="text-[10px] sm:text-xs text-red-600 font-medium">
                  - Approved Expenses: {summary?.expensesAmount}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bottle Exchange Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Bottle Exchange Summary</CardTitle>
          <CardDescription>Today's bottle delivery and collection</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm text-muted-foreground">Filled Bottles Given</p>
                <p className="text-2xl font-bold text-green-600">{summary?.bottlesGiven || 0}</p>
              </div>
              <Package className="h-8 w-8 text-green-600" />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm text-muted-foreground">Empty Bottles Taken</p>
                <p className="text-2xl font-bold text-blue-600">{summary?.bottlesTaken || 0}</p>
              </div>
              <Package className="h-8 w-8 text-blue-600" />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Cash Orders Breakdown */}
      {summary?.ordersPaidInCash && summary.ordersPaidInCash.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Cash Orders Breakdown</CardTitle>
            <CardDescription>All orders paid in cash today</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="max-h-64 space-y-2 overflow-y-auto">
              {summary.ordersPaidInCash.map((order: any) => (
                <div key={order.id} className="flex items-center justify-between rounded-lg border p-3">
                  <div>
                    <p className="font-medium">Order #{order.readableId}</p>
                    <p className="text-sm text-muted-foreground">{order.customerName}</p>
                  </div>
                  <Badge variant="secondary">PKR {order.amount}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Expenses Selection */}
      {expensesData?.expenses && expensesData.expenses.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Include Pending Expenses</CardTitle>
            <CardDescription>Select pending expenses to include in this handover calculation</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {expensesData.expenses.map((expense: any) => (
                <div key={expense.id} className="flex items-center space-x-3 rounded-lg border p-3">
                  <Checkbox
                    id={expense.id}
                    checked={selectedExpenseIds.includes(expense.id)}
                    onCheckedChange={() => toggleExpense(expense.id)}
                  />
                  <div className="flex-1">
                    <label
                      htmlFor={expense.id}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                      {expense.category} - {expense.description || 'No description'}
                    </label>
                    <p className="text-xs text-muted-foreground mt-1">
                      {format(new Date(expense.date), 'dd MMM')}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-red-600 border-red-200 bg-red-50">
                    - PKR {expense.amount}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cash Handover Form */}
      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Submit Cash Handover</CardTitle>
            <CardDescription>Enter the actual cash amount you are handing over</CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Shift Times */}
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="shiftStart">Shift Start Time (Optional)</Label>
                <Input id="shiftStart" type="time" value={shiftStart} onChange={(e) => setShiftStart(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="shiftEnd">Shift End Time (Optional)</Label>
                <Input id="shiftEnd" type="time" value={shiftEnd} onChange={(e) => setShiftEnd(e.target.value)} />
              </div>
            </div>

            <Separator />

            {/* Actual Cash Amount */}
            <div className="space-y-2">
              <Label htmlFor="actualCash">
                Actual Cash Amount <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-lg font-medium">PKR</span>
                <Input
                  id="actualCash"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={actualCash}
                  onChange={(e) => setActualCash(e.target.value)}
                  required
                  className="text-lg font-medium"
                />
              </div>
            </div>

            {/* Discrepancy Warning */}
            {actualCash && hasDiscrepancy && (
              <div
                className={`rounded-lg border p-4 ${discrepancy > 0
                  ? 'border-yellow-200 bg-yellow-50 dark:border-yellow-900 dark:bg-yellow-950/20'
                  : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/20'
                  }`}
              >
                <div className="flex items-start gap-3">
                  <AlertCircle className={`mt-0.5 h-5 w-5 ${discrepancy > 0 ? 'text-yellow-600' : 'text-red-600'}`} />
                  <div>
                    <p className="font-medium">{discrepancy > 0 ? 'Cash Shortage Detected' : 'Cash Excess Detected'}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Discrepancy: PKR {Math.abs(discrepancy).toFixed(2)} {discrepancy > 0 ? 'short' : 'excess'}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">Please explain the discrepancy in the notes below.</p>
                  </div>
                </div>
              </div>
            )}

            {/* Driver Notes */}
            <div className="space-y-2">
              <Label htmlFor="driverNotes">Notes {hasDiscrepancy && <span className="text-destructive">*</span>}</Label>
              <Textarea
                id="driverNotes"
                placeholder="Add any notes or explanations (required if there's a discrepancy)"
                value={driverNotes}
                onChange={(e) => setDriverNotes(e.target.value)}
                rows={4}
                required={hasDiscrepancy}
              />
            </div>

            {/* Summary Before Submit */}
            <div className="space-y-2 rounded-lg bg-muted p-4">
              {hasPendingCash && (
                <>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Today's Cash:</span>
                    <span>PKR {todayExpectedCash.toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-amber-600">+ Previous Days:</span>
                    <span className="text-amber-600">PKR {pendingCashAmount.toFixed(2)}</span>
                  </div>
                  <Separator />
                </>
              )}
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Total Expected Cash:</span>
                <span className="font-bold">PKR {totalExpectedCash.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Actual Cash:</span>
                <span className="font-bold">PKR {enteredCash.toFixed(2)}</span>
              </div>
              <Separator />
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Discrepancy:</span>
                <span className={`font-bold ${hasDiscrepancy ? (discrepancy > 0 ? 'text-yellow-600' : 'text-red-600') : 'text-green-600'}`}>
                  {hasDiscrepancy ? `PKR ${Math.abs(discrepancy).toFixed(2)} ${discrepancy > 0 ? 'short' : 'excess'}` : 'Perfect Match'}
                </span>
              </div>
            </div>

            {/* Submit Button */}
            <Button type="submit" size="lg" className="w-full" disabled={isPending || !actualCash}>
              {isPending ? (
                <>
                  <Clock className="mr-2 h-4 w-4 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Submit Cash Handover
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </form>

      {/* Information Card */}
      <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
        <CardHeader>
          <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">
            <FileText className="mr-2 inline-block h-4 w-4" />
            Important Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-blue-900 dark:text-blue-100">
          <p>• Count your cash carefully before submitting</p>
          <p>• Once submitted, it will be sent to admin for verification</p>
          <p>• You can resubmit if still pending verification</p>
          <p>• Always explain any discrepancies in the notes</p>
          <p>• Keep your cash secure until handover is verified</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function CashHandoverPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
            <p className="mt-4 text-muted-foreground">Loading cash handover...</p>
          </div>
        </div>
      }
    >
      <CashHandoverContent />
    </Suspense>
  );
}
