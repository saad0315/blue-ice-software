'use client';

import { CashHandoverStatus } from '@prisma/client';
import { format } from 'date-fns';
import { AlertCircle, CheckCircle, Clock, DollarSign, Eye, Filter, Receipt, TrendingUp, XCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useGetCashHandovers } from '@/features/cash-management/api/use-get-cash-handovers';
import { useGetCashStats } from '@/features/cash-management/api/use-get-cash-stats';

function CashManagementContent() {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState<CashHandoverStatus | undefined>();
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data: stats, isLoading: statsLoading } = useGetCashStats({
    startDate,
    endDate,
  });
  const { data: handovers, isLoading: handoversLoading } = useGetCashHandovers({
    status: statusFilter,
    startDate,
    endDate,
    page,
    limit,
  });

  const getStatusBadge = (status: CashHandoverStatus) => {
    switch (status) {
      case CashHandoverStatus.PENDING:
        return (
          <Badge variant="secondary">
            <Clock className="mr-1 h-3 w-3" />
            Pending
          </Badge>
        );
      case CashHandoverStatus.VERIFIED:
        return (
          <Badge className="bg-green-600">
            <CheckCircle className="mr-1 h-3 w-3" />
            Verified
          </Badge>
        );
      case CashHandoverStatus.REJECTED:
        return (
          <Badge variant="destructive">
            <XCircle className="mr-1 h-3 w-3" />
            Rejected
          </Badge>
        );
      case CashHandoverStatus.ADJUSTED:
        return (
          <Badge variant="outline">
            <AlertCircle className="mr-1 h-3 w-3" />
            Adjusted
          </Badge>
        );
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div>
        <h1 className="main-heading">Cash Handover Logs</h1>
        <p className="text-muted-foreground">Monitor and verify driver cash handovers</p>
      </div>

      {/* Statistics Cards */}
      {statsLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(8)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      ) : (
        <>
          {/* Cash & Handover Stats */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{startDate && endDate ? 'Cash Collected' : 'Cash Collected Today'}</CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">PKR {stats?.today.totalCashCollected || '0'}</div>
                <p className="text-xs text-muted-foreground">{stats?.today.totalCashOrders || 0} cash orders</p>
              </CardContent>
            </Card>

            <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-yellow-900 dark:text-yellow-100">Pending Handovers</CardTitle>
                <Clock className="h-4 w-4 text-yellow-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{stats?.handovers.pending || 0}</div>
                <p className="text-xs text-muted-foreground">PKR {stats?.handovers.pendingAmount || '0'} pending</p>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100">
                  {startDate && endDate ? 'Verified Handovers' : 'Verified Today'}
                </CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats?.handovers.verified || 0}</div>
                <p className="text-xs text-muted-foreground">PKR {stats?.handovers.verifiedAmount || '0'} verified</p>
              </CardContent>
            </Card>

            {(() => {
              const discrepancy = stats?.handovers.totalDiscrepancy || 0;
              const isShortage = discrepancy > 0;
              const isExcess = discrepancy < 0;

              let borderColor = 'border-slate-200 dark:border-slate-800';
              let bgColor = 'bg-slate-50/50 dark:bg-slate-950/20';
              let textColor = 'text-slate-900 dark:text-slate-100';
              let iconColor = 'text-slate-600';

              if (isShortage) {
                borderColor = 'border-red-200 dark:border-red-900';
                bgColor = 'bg-red-50/50 dark:bg-red-950/20';
                textColor = 'text-red-600 dark:text-red-400';
                iconColor = 'text-red-600';
              } else if (isExcess) {
                borderColor = 'border-blue-200 dark:border-blue-900';
                bgColor = 'bg-blue-50/50 dark:bg-blue-950/20';
                textColor = 'text-blue-600 dark:text-blue-400';
                iconColor = 'text-blue-600';
              } else {
                borderColor = 'border-green-200 dark:border-green-900';
                bgColor = 'bg-green-50/50 dark:bg-green-950/20';
                textColor = 'text-green-600 dark:text-green-400';
                iconColor = 'text-green-600';
              }

              return (
                <Card className={`${borderColor} ${bgColor}`}>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className={`text-sm font-medium ${textColor.replace('600', '900').replace('400', '100')}`}>
                      Total Discrepancy
                    </CardTitle>
                    <TrendingUp className={`h-4 w-4 ${iconColor}`} />
                  </CardHeader>
                  <CardContent>
                    <div className={`text-2xl font-bold ${textColor}`}>
                      PKR {discrepancy.toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {isShortage ? 'Shortage (Driver owes)' : isExcess ? 'Excess (Company owes)' : 'No discrepancy'}
                    </p>
                  </CardContent>
                </Card>
              );
            })()}
          </div>

          {/* Expense Stats */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-900 dark:bg-amber-950/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-amber-900 dark:text-amber-100">Pending Expenses</CardTitle>
                <Receipt className="h-4 w-4 text-amber-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">{stats?.expenses?.pending || 0}</div>
                <p className="text-xs text-muted-foreground">PKR {stats?.expenses?.pendingAmount || '0'} awaiting approval</p>
              </CardContent>
            </Card>

            <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100">Approved Expenses</CardTitle>
                <CheckCircle className="h-4 w-4 text-green-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600 dark:text-green-400">{stats?.expenses?.approved || 0}</div>
                <p className="text-xs text-muted-foreground">PKR {stats?.expenses?.approvedAmount || '0'} approved</p>
              </CardContent>
            </Card>

            <Card className="border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-red-900 dark:text-red-100">Rejected Expenses</CardTitle>
                <XCircle className="h-4 w-4 text-red-600" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-red-600 dark:text-red-400">{stats?.expenses?.rejected || 0}</div>
                <p className="text-xs text-muted-foreground">PKR {stats?.expenses?.rejectedAmount || '0'} rejected</p>
              </CardContent>
            </Card>
          </div>
        </>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            <Filter className="mr-2 inline-block h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="mb-6 flex flex-wrap gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                setStartDate(format(today, 'yyyy-MM-dd'));
                setEndDate(format(today, 'yyyy-MM-dd'));
              }}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                const firstDay = new Date(today.setDate(today.getDate() - today.getDay() + 1)); // Monday
                const lastDay = new Date(today.setDate(today.getDate() - today.getDay() + 7)); // Sunday
                setStartDate(format(firstDay, 'yyyy-MM-dd'));
                setEndDate(format(lastDay, 'yyyy-MM-dd'));
              }}
            >
              This Week
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const today = new Date();
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
                const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
                setStartDate(format(firstDay, 'yyyy-MM-dd'));
                setEndDate(format(lastDay, 'yyyy-MM-dd'));
              }}
            >
              This Month
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
            >
              All Time
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-4">
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={statusFilter || 'all'}
                onValueChange={(value) => setStatusFilter(value === 'all' ? undefined : (value as CashHandoverStatus))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value={CashHandoverStatus.PENDING}>Pending</SelectItem>
                  <SelectItem value={CashHandoverStatus.VERIFIED}>Verified</SelectItem>
                  <SelectItem value={CashHandoverStatus.REJECTED}>Rejected</SelectItem>
                  <SelectItem value={CashHandoverStatus.ADJUSTED}>Adjusted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>End Date</Label>
              <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
            </div>

            <div className="space-y-2">
              <Label>&nbsp;</Label>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  setStatusFilter(undefined);
                  setStartDate('');
                  setEndDate('');
                }}
              >
                Clear Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Handovers List */}
      <Card>
        <CardHeader>
          <CardTitle>Cash Handovers</CardTitle>
          <CardDescription>{handovers?.pagination.total || 0} total handovers found</CardDescription>
        </CardHeader>
        <CardContent>
          {handoversLoading ? (
            <div className="space-y-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-24" />
              ))}
            </div>
          ) : !handovers || handovers.handovers.length === 0 ? (
            <div className="py-12 text-center">
              <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
              <p className="text-lg font-medium">No handovers found</p>
              <p className="mt-2 text-sm text-muted-foreground">Try adjusting your filters or wait for drivers to submit their cash</p>
            </div>
          ) : (
            <>
              <div className="space-y-4">
                {handovers?.handovers.map((handover: any) => {
                  const discrepancy = parseFloat(handover.discrepancy.toString());
                  const hasDiscrepancy = Math.abs(discrepancy) > 0.01;

                  return (
                    <div key={handover.id} className="rounded-lg border p-4 transition-colors hover:bg-muted/50">
                      <div className="mb-3 flex items-start justify-between">
                        <div>
                          <div className="mb-1 flex items-center gap-2">
                            <h3 className="text-lg font-semibold">{handover.driver.user.name}</h3>
                            {getStatusBadge(handover.status)}
                          </div>
                          <p className="text-sm text-muted-foreground">{handover.driver.user.phoneNumber}</p>
                          <p className="text-sm text-muted-foreground">Date: {format(new Date(handover.date), 'MMM dd, yyyy')}</p>
                        </div>
                        <Button size="sm" onClick={() => router.push(`/cash-management/${handover.id}`)}>
                          <Eye className="mr-2 h-4 w-4" />
                          View Details
                        </Button>
                      </div>

                      <div className="grid gap-3 text-sm md:grid-cols-4">
                        <div>
                          <p className="text-muted-foreground">Expected Cash</p>
                          <p className="font-medium">PKR {handover.expectedCash.toString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Actual Cash</p>
                          <p className="font-medium">PKR {handover.actualCash.toString()}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Discrepancy</p>
                          <p
                            className={`font-medium ${hasDiscrepancy ? (discrepancy > 0 ? 'text-yellow-600' : 'text-red-600') : 'text-green-600'
                              }`}
                          >
                            {hasDiscrepancy ? `PKR ${Math.abs(discrepancy).toFixed(2)} ${discrepancy > 0 ? 'short' : 'excess'}` : 'Perfect'}
                          </p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">Orders</p>
                          <p className="font-medium">
                            {handover.completedOrders} / {handover.totalOrders}
                          </p>
                        </div>
                      </div>

                      {handover.driverNotes && (
                        <div className="mt-3 rounded bg-muted p-2 text-sm">
                          <p className="mb-1 font-medium">Driver Notes:</p>
                          <p className="text-muted-foreground">{handover.driverNotes}</p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="flex items-center justify-end space-x-2 py-4">
                <div className="flex-1 text-sm text-muted-foreground">
                  Showing {(page - 1) * limit + 1} to {Math.min(page * limit, handovers.pagination.total)} of{' '}
                  {handovers.pagination.total} handovers
                  <div className="inline-block ml-4">
                    <Select value={limit.toString()} onValueChange={(val) => {
                      setLimit(parseInt(val));
                      setPage(1);
                    }}>
                      <SelectTrigger className="h-8 w-[130px]">
                        <SelectValue placeholder="Per page" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="10">10 per page</SelectItem>
                        <SelectItem value="20">20 per page</SelectItem>
                        <SelectItem value="50">50 per page</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-muted-foreground">
                    Page {page} of {handovers.pagination.totalPages}
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setPage(page - 1)} disabled={page === 1}>
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setPage(page + 1)}
                    disabled={page === handovers.pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default function CashManagementPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
            <p className="mt-4 text-muted-foreground">Loading cash management...</p>
          </div>
        </div>
      }
    >
      <CashManagementContent />
    </Suspense>
  );
}
