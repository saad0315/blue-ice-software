'use client';

import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek, subDays } from 'date-fns';
import { ArrowLeft, Calendar, DollarSign, Loader2, Mail, MapPin, Package, Phone, TrendingUp, Truck } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { Suspense, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { DeliveryStatusFilter, useGetDriverDeliveries } from '@/features/drivers/api/use-get-driver-deliveries';
import { useGetDriverStats } from '@/features/drivers/api/use-get-driver-stats';

function DriverDetailContent() {
  const params = useParams();
  const router = useRouter();
  const driverId = params.driverId as string;

  // Date range state - default to current month
  const [dateRange, setDateRange] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [customStart, setCustomStart] = useState<string>('');
  const [customEnd, setCustomEnd] = useState<string>('');

  // Pagination state for recent orders
  const [ordersPage, setOrdersPage] = useState(1);
  const [ordersLimit, setOrdersLimit] = useState(10);
  const [statusFilter, setStatusFilter] = useState<DeliveryStatusFilter>('ALL');

  // Calculate date range based on selection
  const getDateRange = () => {
    const now = new Date();
    switch (dateRange) {
      case 'today':
        return {
          startDate: format(now, 'yyyy-MM-dd'),
          endDate: format(now, 'yyyy-MM-dd'),
        };
      case 'week':
        return {
          startDate: format(startOfWeek(now), 'yyyy-MM-dd'),
          endDate: format(endOfWeek(now), 'yyyy-MM-dd'),
        };
      case 'month':
        return {
          startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
        };
      case 'custom':
        return {
          startDate: customStart,
          endDate: customEnd,
        };
      default:
        return {
          startDate: format(startOfMonth(now), 'yyyy-MM-dd'),
          endDate: format(endOfMonth(now), 'yyyy-MM-dd'),
        };
    }
  };

  const { startDate, endDate } = getDateRange();
  const { data: stats, isLoading, error, isFetching: isStatsFetching } = useGetDriverStats({ driverId, startDate, endDate });

  const { data: deliveriesData, isLoading: isDeliveriesLoading, isFetching: isDeliveriesFetching } = useGetDriverDeliveries({
    driverId,
    startDate,
    endDate,
    page: ordersPage,
    limit: ordersLimit,
    status: statusFilter,
  });

  const isRefreshing = isStatsFetching || isDeliveriesFetching;

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="flex min-h-[400px] flex-col items-center justify-center">
        <p className="text-lg font-medium text-destructive">Failed to load driver details</p>
        <Button className="mt-4" onClick={() => router.push('/drivers')}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Drivers
        </Button>
      </div>
    );
  }

  const { driver, summary, financial, bottles, today, allTime, recentOrders, expenses } = stats;

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/drivers')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold tracking-tight">{driver.user.name}</h1>
              {isRefreshing && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
            </div>
            <p className="text-muted-foreground">Driver Performance Dashboard</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant={driver.user.isActive ? 'default' : 'secondary'}>{driver.user.isActive ? 'Active' : 'Inactive'}</Badge>
          {driver.user.suspended && <Badge variant="destructive">Suspended</Badge>}
        </div>
      </div>

      <div className={`flex flex-col gap-6 transition-opacity duration-200 ${isRefreshing ? 'opacity-70' : 'opacity-100'}`}>
        {/* Driver Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Driver Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{driver.user.phoneNumber}</p>
                </div>
              </div>
              {driver.user.email && (
                <div className="flex items-center gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{driver.user.email}</p>
                  </div>
                </div>
              )}
              {driver.vehicleNo && (
                <div className="flex items-center gap-3">
                  <Truck className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Vehicle No</p>
                    <p className="font-medium">{driver.vehicleNo}</p>
                  </div>
                </div>
              )}
              {driver.licenseNo && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">License No</p>
                    <p className="font-medium">{driver.licenseNo}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Date Range Filter */}
        <Card>
          <CardHeader>
            <CardTitle>Performance Period</CardTitle>
            <CardDescription>Select a date range to view statistics</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              <Button variant={dateRange === 'today' ? 'primary' : 'outline'} size="sm" onClick={() => setDateRange('today')}>
                Today
              </Button>
              <Button variant={dateRange === 'week' ? 'primary' : 'outline'} size="sm" onClick={() => setDateRange('week')}>
                This Week
              </Button>
              <Button variant={dateRange === 'month' ? 'primary' : 'outline'} size="sm" onClick={() => setDateRange('month')}>
                This Month
              </Button>
              <div className="ml-4 flex items-center gap-2">
                <input
                  type="date"
                  className="rounded-md border px-3 py-1.5 text-sm"
                  value={customStart}
                  onChange={(e) => {
                    setCustomStart(e.target.value);
                    setDateRange('custom');
                  }}
                />
                <span className="text-sm text-muted-foreground">to</span>
                <input
                  type="date"
                  className="rounded-md border px-3 py-1.5 text-sm"
                  value={customEnd}
                  onChange={(e) => {
                    setCustomEnd(e.target.value);
                    setDateRange('custom');
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Today's Quick Stats */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-900 dark:bg-blue-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-blue-900 dark:text-blue-100">Today's Deliveries</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-blue-600 dark:text-blue-400">{today.deliveries}</div>
              <p className="mt-1 text-xs text-muted-foreground">Completed orders today</p>
            </CardContent>
          </Card>
          <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/20">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium text-green-900 dark:text-green-100">Today's Cash</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-600 dark:text-green-400">PKR {today.cashCollected}</div>
              <p className="mt-1 text-xs text-muted-foreground">Cash collected today</p>
            </CardContent>
          </Card>
        </div>

        {/* Period Statistics */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
              <Package className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{summary.totalOrders}</div>
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Completed
                  </span>
                  <span className="font-medium">{summary.completedOrders}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-blue-500" />
                    Pending/In Progress
                  </span>
                  <span className="font-medium">{summary.pendingOrders}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Cancelled
                  </span>
                  <span className="font-medium">{summary.cancelledOrders}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-yellow-500" />
                    Rescheduled
                  </span>
                  <span className="font-medium">{summary.rescheduledOrders}</span>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-secondary">
                    <div className="h-full bg-primary" style={{ width: `${summary.completionRate}%` }} />
                  </div>
                  <span className="text-xs font-medium">{summary.completionRate}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Cash Collected</CardTitle>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">PKR {financial.totalCashCollected}</div>
              <p className="text-xs text-muted-foreground">Avg: PKR {parseFloat(financial.averageCashPerDelivery).toFixed(0)} per delivery</p>
              <div className="mt-3 border-t pt-2">
                <p className="text-xs font-medium text-muted-foreground">Total Revenue</p>
                <p className="text-lg font-bold text-blue-600">PKR {financial.totalRevenue}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Bottles Exchange</CardTitle>
              <Package className="h-4 w-4 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Filled Given</span>
                  <span className="text-xl font-bold text-green-600">{bottles.totalFilledGiven}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Empty Taken</span>
                  <span className="text-xl font-bold text-blue-600">{bottles.totalEmptyTaken}</span>
                </div>
                <div className="flex items-center justify-between border-t pt-2 text-xs">
                  <span className="text-muted-foreground">Exchange Rate</span>
                  <span className="font-medium">{bottles.exchangeRate}%</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Expenses</CardTitle>
              <DollarSign className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">PKR {expenses?.total || '0'}</div>
              <div className="mt-2 space-y-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-green-500" />
                    Approved
                  </span>
                  <span className="font-medium">PKR {expenses?.approved || '0'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-yellow-500" />
                    Pending
                  </span>
                  <span className="font-medium">PKR {expenses?.pending || '0'}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full bg-red-500" />
                    Rejected
                  </span>
                  <span className="font-medium">PKR {expenses?.rejected || '0'}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* All-Time Statistics */}
        <Card>
          <CardHeader>
            <CardTitle>All-Time Performance</CardTitle>
            <CardDescription>Lifetime statistics for this driver</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">Total Deliveries</p>
                <p className="text-2xl font-bold">{allTime.totalDeliveries}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">Total Cash Collected</p>
                <p className="text-2xl font-bold">PKR {allTime.totalCashCollected}</p>
              </div>
              <div className="flex flex-col gap-1">
                <p className="text-sm text-muted-foreground">Total Revenue</p>
                <p className="text-2xl font-bold">PKR {allTime.totalRevenue}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Orders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Orders</CardTitle>
              <CardDescription>
                {deliveriesData?.pagination.total || 0} {statusFilter === 'ALL' ? 'total' : statusFilter.toLowerCase()} orders
              </CardDescription>
            </div>
            <Select
              value={statusFilter}
              onValueChange={(val) => {
                setStatusFilter(val as DeliveryStatusFilter);
                setOrdersPage(1);
              }}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Orders</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="RESCHEDULED">Rescheduled</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {isDeliveriesLoading ? (
                <div className="space-y-4">
                  {[...Array(3)].map((_, i) => (
                    <Skeleton key={i} className="h-24" />
                  ))}
                </div>
              ) : !deliveriesData?.deliveries.length ? (
                <p className="py-8 text-center text-sm text-muted-foreground">
                  No {statusFilter === 'ALL' ? '' : statusFilter.toLowerCase()} orders in this period
                </p>
              ) : (
                <>
                  {deliveriesData.deliveries.map((order: any) => (
                    <div key={order.id} className="rounded-lg border p-4">
                      <div className="mb-2 flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">Order #{order.readableId}</p>
                            <Badge
                              variant={
                                order.status === 'COMPLETED'
                                  ? 'default'
                                  : order.status === 'CANCELLED'
                                    ? 'destructive'
                                    : order.status === 'RESCHEDULED'
                                      ? 'secondary'
                                      : order.status === 'IN_PROGRESS'
                                        ? 'outline'
                                        : 'secondary'
                              }
                              className={
                                order.status === 'COMPLETED'
                                  ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                                  : order.status === 'RESCHEDULED'
                                    ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                                    : order.status === 'IN_PROGRESS'
                                      ? 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200'
                                      : ''
                              }
                            >
                              {order.status.replace('_', ' ')}
                            </Badge>
                          </div>
                          <p className="text-sm text-muted-foreground">{order.customerName}</p>
                          <p className="text-xs text-muted-foreground">{order.customerPhone}</p>
                          {order.cancellationReason && (
                            <p className="mt-1 text-xs text-red-600 dark:text-red-400">
                              Reason: {order.cancellationReason.replace(/_/g, ' ')}
                            </p>
                          )}
                        </div>
                        <div className="text-right">
                          {order.status === 'COMPLETED' && <p className="font-medium">PKR {order.cashCollected}</p>}
                          <p className="text-xs text-muted-foreground">
                            {order.status === 'COMPLETED' && order.deliveredAt
                              ? format(new Date(order.deliveredAt), 'MMM dd, yyyy HH:mm')
                              : format(new Date(order.scheduledDate), 'MMM dd, yyyy')}
                          </p>
                        </div>
                      </div>
                      <Separator className="my-2" />
                      <div className="space-y-1">
                        {order.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span>
                              {item.quantity}x {item.productName}
                            </span>
                            {order.status === 'COMPLETED' && (
                              <span className="text-muted-foreground">
                                Filled: {item.filledGiven} • Empty: {item.emptyTaken}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}

                  {/* Pagination */}
                  <div className="flex items-center justify-end space-x-2 pt-4">
                    <div className="flex-1 text-sm text-muted-foreground">
                      Showing {(ordersPage - 1) * ordersLimit + 1} to {Math.min(ordersPage * ordersLimit, deliveriesData.pagination.total)} of{' '}
                      {deliveriesData.pagination.total} orders
                      <div className="ml-4 inline-block">
                        <Select
                          value={ordersLimit.toString()}
                          onValueChange={(val) => {
                            setOrdersLimit(parseInt(val));
                            setOrdersPage(1);
                          }}
                        >
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
                        Page {ordersPage} of {deliveriesData.pagination.totalPages}
                      </span>
                      <Button variant="outline" size="sm" onClick={() => setOrdersPage(ordersPage - 1)} disabled={ordersPage === 1}>
                        Previous
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setOrdersPage(ordersPage + 1)}
                        disabled={ordersPage === deliveriesData.pagination.totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function DriverDetailPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center">
          <div className="text-center">
            <div className="mx-auto h-12 w-12 animate-spin rounded-full border-b-2 border-primary" />
            <p className="mt-4 text-muted-foreground">Loading driver details...</p>
          </div>
        </div>
      }
    >
      <DriverDetailContent />
    </Suspense>
  );
}
