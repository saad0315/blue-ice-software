'use client';

import { OrderStatus } from '@prisma/client';
import { format } from 'date-fns';
import {
  Calendar,
  CreditCard,
  Edit,
  FileText,
  MapPin,
  Package,
  Phone,
  Truck,
  User,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Clock,
  Calendar
} from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { PageError } from '@/components/page-error';
import { useGetOrder } from '@/features/orders/api/use-get-order';

function OrderDetailContent() {
  const params = useParams();
  const orderId = params.orderId as string;
  const { data: order, isLoading } = useGetOrder(orderId);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="grid gap-6 md:grid-cols-3">
          <div className="md:col-span-2 space-y-6">
            <Skeleton className="h-64" />
            <Skeleton className="h-48" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-40" />
            <Skeleton className="h-40" />
          </div>
        </div>
      </div>
    );
  }

  if (!order) return <PageError message="Order not found" />;

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'COMPLETED': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'CANCELLED': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300';
      case 'IN_PROGRESS': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const getStatusIcon = (status: OrderStatus) => {
    switch (status) {
      case 'COMPLETED': return <CheckCircle className="h-4 w-4 mr-1" />;
      case 'CANCELLED': return <XCircle className="h-4 w-4 mr-1" />;
      case 'IN_PROGRESS': return <Truck className="h-4 w-4 mr-1" />;
      default: return <Clock className="h-4 w-4 mr-1" />;
    }
  };

  return (
    <div className="flex flex-col gap-6 pb-20">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight">Order #{order.readableId}</h1>
            <Badge className={getStatusColor(order.status)} variant="outline">
              {getStatusIcon(order.status)}
              {order.status}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1">
            Placed on {format(new Date(order.createdAt), 'MMMM dd, yyyy at h:mm a')}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href={`/orders/${order.id}/invoice`}>
              <FileText className="mr-2 h-4 w-4" />
              Invoice
            </Link>
          </Button>
          <Button asChild>
            <Link href={`/orders/${order.id}/edit`}>
              <Edit className="mr-2 h-4 w-4" />
              Edit Order
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left Column - Main Info */}
        <div className="md:col-span-2 space-y-6">

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5 text-muted-foreground" />
                Order Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.orderItems.map((item: any) => (
                  <div key={item.id} className="flex items-center justify-between border-b pb-4 last:border-0 last:pb-0">
                    <div>
                      <p className="font-medium">{item.product.name}</p>
                      <p className="text-sm text-muted-foreground">SKU: {item.product.sku}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium">
                        {item.quantity} x {Number(item.priceAtTime).toLocaleString()} PKR
                      </p>
                      <p className="text-sm font-bold">
                        {(item.quantity * Number(item.priceAtTime)).toLocaleString()} PKR
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <Separator className="my-4" />

              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>
                    {order.orderItems.reduce((acc: number, item: any) => acc + (item.quantity * Number(item.priceAtTime)), 0).toLocaleString()} PKR
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Charge</span>
                  <span>{Number(order.deliveryCharge).toLocaleString()} PKR</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Discount</span>
                  <span className="text-red-600">-{Number(order.discount).toLocaleString()} PKR</span>
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between text-lg font-bold">
                  <span>Total</span>
                  <span>{Number(order.totalAmount).toLocaleString()} PKR</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Activity / Status Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-muted-foreground" />
                Timeline & Status
              </CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Scheduled Date</p>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4" />
                  <span>{format(new Date(order.scheduledDate), 'EEEE, MMMM dd, yyyy')}</span>
                </div>
              </div>

              {order.deliveredAt && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">Delivered At</p>
                  <div className="flex items-center gap-2 text-green-600">
                    <CheckCircle className="h-4 w-4" />
                    <span>{format(new Date(order.deliveredAt), 'MMM dd, yyyy at h:mm a')}</span>
                  </div>
                </div>
              )}

              {order.cancelledAt && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">
                    {order.status === 'RESCHEDULED' ? 'Rescheduled At' : 'Cancelled At'}
                  </p>
                  <div className={`flex items-center gap-2 ${order.status === 'RESCHEDULED' ? 'text-amber-600' : 'text-red-600'}`}>
                    {order.status === 'RESCHEDULED' ? <Clock className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                    <span>{format(new Date(order.cancelledAt), 'MMM dd, yyyy at h:mm a')}</span>
                  </div>
                </div>
              )}

              {order.rescheduledToDate && (
                <div className="space-y-1">
                  <p className="text-sm font-medium text-muted-foreground">New Date</p>
                  <div className="flex items-center gap-2 text-blue-600">
                    <Calendar className="h-4 w-4" />
                    <span className="font-bold">{format(new Date(order.rescheduledToDate), 'MMM dd, yyyy')}</span>
                  </div>
                </div>
              )}

              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Payment Status</p>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  <span>{order.paymentMethod.replace('_', ' ')}</span>
                  {Number(order.cashCollected) > 0 && (
                    <Badge variant="outline" className="ml-2 text-green-600 border-green-200 bg-green-50">
                      Paid {Number(order.cashCollected)}
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Cancellation / Reschedule Info */}
          {(order.status === 'CANCELLED' || order.status === 'RESCHEDULED') && (
            <Card
              className={
                order.status === 'RESCHEDULED'
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-900/10'
                  : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-900/10'
              }
            >
              <CardHeader>
                <CardTitle
                  className={`flex items-center gap-2 ${
                    order.status === 'RESCHEDULED' ? 'text-amber-700 dark:text-amber-400' : 'text-red-700 dark:text-red-400'
                  }`}
                >
                  <AlertCircle className="h-5 w-5" />
                  {order.status === 'RESCHEDULED' ? 'Reschedule Details' : 'Cancellation Details'}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="grid grid-cols-[100px_1fr] gap-2 text-sm">
                  <span className="font-medium text-muted-foreground">Reason:</span>
                  <span>{order.cancellationReason?.replace(/_/g, ' ') || 'N/A'}</span>

                  <span className="font-medium text-muted-foreground">Notes:</span>
                  <span>{order.driverNotes || 'No notes provided'}</span>

                  <span className="font-medium text-muted-foreground">By:</span>
                  <span>{order.cancelledBy ? 'Driver/Admin' : 'System'}</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">

          {/* Customer Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5 text-muted-foreground" />
                Customer Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                  {order.customer.user.name.charAt(0)}
                </div>
                <div>
                  <p className="font-medium">{order.customer.user.name}</p>
                  <p className="text-sm text-muted-foreground">Customer</p>
                </div>
              </div>

              <Separator />

              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2">
                  <Phone className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <a href={`tel:${order.customer.user.phoneNumber}`} className="hover:underline text-blue-600">
                    {order.customer.user.phoneNumber}
                  </a>
                </div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-0.5 text-muted-foreground" />
                  <div>
                    <p>{order.customer.address}</p>
                    <p className="text-muted-foreground text-xs mt-1">{order.customer.area}</p>
                    {order.customer.route && (
                      <Badge variant="secondary" className="mt-2">
                        {order.customer.route.name}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              <Button variant="outline" className="w-full" onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(order.customer.address)}`, '_blank')}>
                <MapPin className="mr-2 h-4 w-4" />
                View on Map
              </Button>
            </CardContent>
          </Card>

          {/* Driver Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-muted-foreground" />
                Delivery Driver
              </CardTitle>
            </CardHeader>
            <CardContent>
              {order.driver ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-orange-100 text-orange-700 font-bold">
                      {order.driver.user.name.charAt(0)}
                    </div>
                    <div>
                      <p className="font-medium">{order.driver.user.name}</p>
                      <p className="text-sm text-muted-foreground">Assigned Driver</p>
                    </div>
                  </div>
                  {order.driver.user.phoneNumber && (
                    <div className="flex items-center gap-2 text-sm">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span>{order.driver.user.phoneNumber}</span>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-muted-foreground text-sm">No driver assigned</p>
                  <Button variant="secondary" className="mt-4 w-full" asChild>
                    <Link href={`/orders`}>Assign Driver</Link>
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Instructions */}
          {(order.customer.deliveryInstructions || order.customer.specialNotes) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Instructions & Notes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                {order.customer.deliveryInstructions && (
                  <div>
                    <span className="font-semibold text-muted-foreground">Delivery Instructions:</span>
                    <p className="mt-1 bg-muted p-2 rounded-md">{order.customer.deliveryInstructions}</p>
                  </div>
                )}
                {order.customer.specialNotes && (
                  <div>
                    <span className="font-semibold text-muted-foreground">Special Notes:</span>
                    <p className="mt-1 bg-yellow-50 text-yellow-900 border border-yellow-200 p-2 rounded-md">
                      {order.customer.specialNotes}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

        </div>
      </div>
    </div>
  );
}

export default function OrderDetailPage() {
  return <OrderDetailContent />;
}
