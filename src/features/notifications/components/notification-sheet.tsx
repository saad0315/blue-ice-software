'use client';

import {
  Bell,
  CheckCheck,
  Package,
  Truck,
  Users,
  DollarSign,
  AlertCircle,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useGetNotifications, useGetUnreadCount, useMarkAsRead, useMarkAllAsRead } from '@/features/notifications/api/use-notifications';
import { Badge } from '@/components/ui/badge';

type NotificationType =
  | 'ORDER_ASSIGNED'
  | 'ORDER_COMPLETED'
  | 'ORDER_CANCELLED'
  | 'EXPENSE_APPROVED'
  | 'EXPENSE_REJECTED'
  | 'NEW_CUSTOMER'
  | 'NEW_DRIVER'
  | 'PAYMENT_RECEIVED'
  | 'LOW_INVENTORY'
  | string;

const getNotificationIcon = (type: NotificationType) => {
  switch (type) {
    case 'ORDER_ASSIGNED':
    case 'ORDER_COMPLETED':
    case 'ORDER_CANCELLED':
    case 'ORDER_RESCHEDULED':
      return Package;
    case 'NEW_DRIVER':
    case 'DRIVER_ASSIGNED':
      return Truck;
    case 'NEW_CUSTOMER':
      return Users;
    case 'EXPENSE_APPROVED':
    case 'EXPENSE_REJECTED':
    case 'PAYMENT_RECEIVED':
      return DollarSign;
    case 'LOW_INVENTORY':
      return AlertCircle;
    default:
      return Bell;
  }
};

const getNotificationColor = (type: NotificationType) => {
  switch (type) {
    case 'ORDER_COMPLETED':
    case 'EXPENSE_APPROVED':
    case 'PAYMENT_RECEIVED':
      return 'bg-green-500';
    case 'ORDER_CANCELLED':
    case 'EXPENSE_REJECTED':
    case 'LOW_INVENTORY':
      return 'bg-red-500';
    case 'ORDER_ASSIGNED':
    case 'NEW_DRIVER':
    case 'NEW_CUSTOMER':
      return 'bg-blue-500';
    case 'ORDER_RESCHEDULED':
      return 'bg-yellow-500';
    default:
      return 'bg-gray-500';
  }
};

const getNotificationLink = (type: NotificationType, data: any): string | null => {
  if (!data) return null;

  switch (type) {
    case 'ORDER_ASSIGNED':
    case 'ORDER_COMPLETED':
    case 'ORDER_CANCELLED':
    case 'ORDER_RESCHEDULED':
      return data.orderId ? `/orders/${data.orderId}` : '/orders';
    case 'NEW_CUSTOMER':
      return data.customerId ? `/customers/${data.customerId}` : '/customers';
    case 'NEW_DRIVER':
    case 'DRIVER_ASSIGNED':
      return data.driverId ? `/drivers/${data.driverId}` : '/drivers';
    case 'EXPENSE_APPROVED':
    case 'EXPENSE_REJECTED':
      return data.expenseId ? `/expenses/${data.expenseId}` : '/expenses';
    case 'LOW_INVENTORY':
      return '/inventory';
    default:
      return null;
  }
};

export const NotificationSheet = () => {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { data: notificationsData, isLoading } = useGetNotifications();
  const { data: unreadData } = useGetUnreadCount();
  const markAsRead = useMarkAsRead();
  const markAllAsRead = useMarkAllAsRead();

  const notifications = notificationsData?.notifications || [];
  const unreadCount = unreadData?.count || 0;

  const handleNotificationClick = (notification: any) => {
    // Mark as read only when clicked
    if (!notification.read) {
      markAsRead.mutate(notification.id);
    }

    // Navigate to relevant page
    const link = getNotificationLink(notification.type, notification.data);
    if (link) {
      setIsOpen(false);
      router.push(link);
    }
  };

  return (
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -right-1 -top-1 h-5 w-5 items-center justify-center rounded-full p-0 text-[10px]"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
          <span className="sr-only">Notifications</span>
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:max-w-md">
        <SheetHeader className="flex flex-row items-center justify-between space-y-0 pb-4 border-b">
          <div className="flex items-center gap-2">
            <SheetTitle className="text-xl">Notifications</SheetTitle>
            {unreadCount > 0 && (
              <Badge variant="secondary" className="rounded-full">
                {unreadCount} new
              </Badge>
            )}
          </div>
          {unreadCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="text-xs text-primary hover:text-primary"
              onClick={() => markAllAsRead.mutate()}
              disabled={markAllAsRead.isPending}
            >
              <CheckCheck className="mr-1 h-4 w-4" />
              Mark all read
            </Button>
          )}
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-120px)] mt-4">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <p className="mt-2 text-sm text-muted-foreground">Loading notifications...</p>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="rounded-full bg-muted p-4">
                <Bell className="h-8 w-8 text-muted-foreground" />
              </div>
              <p className="mt-4 font-medium">No notifications yet</p>
              <p className="text-sm text-muted-foreground">We'll notify you when something arrives</p>
            </div>
          ) : (
            <div className="space-y-2 pr-4">
              {notifications.map((notification: any) => {
                const IconComponent = getNotificationIcon(notification.type);
                const iconColor = getNotificationColor(notification.type);
                const link = getNotificationLink(notification.type, notification.data);

                return (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={cn(
                      'group relative flex gap-3 rounded-xl p-3 transition-all duration-200 cursor-pointer',
                      !notification.read
                        ? 'bg-primary/5 hover:bg-primary/10 border border-primary/20'
                        : 'hover:bg-muted/50 border border-transparent',
                    )}
                  >
                    {/* Icon */}
                    <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white', iconColor)}>
                      <IconComponent className="h-5 w-5" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className={cn('font-semibold text-sm line-clamp-1', !notification.read && 'text-primary')}>
                          {notification.title}
                        </p>
                        {!notification.read && (
                          <span className="h-2 w-2 shrink-0 rounded-full bg-primary mt-1.5" />
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                        {notification.body}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <Clock className="h-3 w-3 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.createdAt), { addSuffix: true })}
                        </span>
                      </div>
                    </div>

                    {/* Arrow for clickable notifications */}
                    {link && (
                      <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <ChevronRight className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
};
