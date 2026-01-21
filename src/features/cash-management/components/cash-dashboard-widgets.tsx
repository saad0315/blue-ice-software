'use client';

import { AlertCircle, ArrowRight, Clock, DollarSign, TrendingUp } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { format } from 'date-fns';

import { useGetCashStats } from '@/features/cash-management/api/use-get-cash-stats';

export function CashDashboardWidgets() {
  const router = useRouter();
  // Use local date to avoid server UTC mismatch
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: stats, isLoading } = useGetCashStats({ startDate: today, endDate: today });

  if (isLoading) {
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {/* Today's Cash Collection */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Cash Collected Today</CardTitle>
          <DollarSign className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">PKR {stats?.today.totalCashCollected || '0'}</div>
          <p className="mt-1 text-xs text-muted-foreground">From {stats?.today.totalCashOrders || 0} cash orders</p>
        </CardContent>
      </Card>

      {/* Pending Handovers - Alert if > 0 */}
      <Card
        className={
          (stats?.handovers.pending || 0) > 0
            ? 'cursor-pointer border-yellow-200 bg-yellow-50/50 dark:border-yellow-900 dark:bg-yellow-950/20'
            : 'cursor-pointer'
        }
        onClick={() => router.push('/cash-management')}
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className={`text-sm font-medium ${(stats?.handovers.pending || 0) > 0 ? 'text-yellow-900 dark:text-yellow-100' : ''}`}>
            Pending Handovers
          </CardTitle>
          <Clock className={`h-4 w-4 ${(stats?.handovers.pending || 0) > 0 ? 'text-yellow-600' : 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${(stats?.handovers.pending || 0) > 0 ? 'text-yellow-600 dark:text-yellow-400' : ''}`}>
            {stats?.handovers.pending || 0}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">PKR {stats?.handovers.pendingAmount || '0'} awaiting verification</p>
          {(stats?.handovers.pending || 0) > 0 && (
            <Badge variant="outline" className="mt-2">
              <AlertCircle className="mr-1 h-3 w-3" />
              Action Required
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Verified Handovers */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">Verified Today</CardTitle>
          <TrendingUp className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">{stats?.handovers.verified || 0}</div>
          <p className="mt-1 text-xs text-muted-foreground">PKR {stats?.handovers.verifiedAmount || '0'} verified</p>
        </CardContent>
      </Card>

      {/* Total Discrepancy - Alert if > 500 */}
      <Card
        className={
          (stats?.handovers.totalDiscrepancy || 0) > 500 ? 'border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20' : ''
        }
      >
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle
            className={`text-sm font-medium ${(stats?.handovers.totalDiscrepancy || 0) > 500 ? 'text-red-900 dark:text-red-100' : ''}`}
          >
            Total Discrepancy
          </CardTitle>
          <AlertCircle className={`h-4 w-4 ${(stats?.handovers.totalDiscrepancy || 0) > 500 ? 'text-red-600' : 'text-muted-foreground'}`} />
        </CardHeader>
        <CardContent>
          <div className={`text-2xl font-bold ${(stats?.handovers.totalDiscrepancy || 0) > 500 ? 'text-red-600 dark:text-red-400' : ''}`}>
            PKR {stats?.handovers.totalDiscrepancy?.toFixed(2) || '0'}
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{stats?.alerts.largeDiscrepancies || 0} large discrepancies</p>
        </CardContent>
      </Card>
    </div>
  );
}

export function CashQuickActionsWidget() {
  const router = useRouter();
  // Use local date to avoid server UTC mismatch
  const today = format(new Date(), 'yyyy-MM-dd');
  const { data: stats } = useGetCashStats({ startDate: today, endDate: today });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cash Management Quick Actions</CardTitle>
        <CardDescription>Monitor and manage driver cash handovers</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {(stats?.handovers.pending || 0) > 0 && (
          <div className="rounded-lg border border-yellow-200 bg-yellow-50/50 p-4 dark:border-yellow-900 dark:bg-yellow-950/20">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-medium text-yellow-900 dark:text-yellow-100">
                  {stats?.handovers.pending} Pending Handover{stats?.handovers.pending !== 1 ? 's' : ''}
                </p>
                <p className="mt-1 text-sm text-muted-foreground">PKR {stats?.handovers.pendingAmount || '0'} awaiting your verification</p>
              </div>
              <Button size="sm" onClick={() => router.push('/cash-management?status=PENDING')}>
                Review
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        <div className="grid gap-2">
          <Button variant="outline" className="w-full justify-start" onClick={() => router.push('/cash-management')}>
            <DollarSign className="mr-2 h-4 w-4" />
            View All Cash Handovers
          </Button>
        </div>

        <div className="space-y-2 border-t pt-4 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Today's Cash Orders:</span>
            <span className="font-medium">{stats?.today.totalCashOrders || 0}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Total Cash Collected:</span>
            <span className="font-medium">PKR {stats?.today.totalCashCollected || '0'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Verified Handovers:</span>
            <span className="font-medium text-green-600">{stats?.handovers.verified || 0}</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
