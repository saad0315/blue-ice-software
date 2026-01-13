'use client';

import type { Decimal } from '@prisma/client/runtime/library';
import { format } from 'date-fns';
import { AlertCircle, Building2, Clock, Landmark, MapPin, Navigation, Package, Phone, TrendingUp, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { FaWhatsapp } from 'react-icons/fa';
import { toast } from 'sonner';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { useUnableToDeliver } from '@/features/orders/api/use-unable-to-deliver';

import { UnableToDeliverDialog } from './unable-to-deliver-dialog';

interface EnhancedOrderCardProps {
  order: {
    id: string;
    readableId: number;
    totalAmount: Decimal;
    status: string;
    scheduledDate: Date;
    customer: {
      user: {
        name: string;
        phoneNumber: string | null;
      };
      route?: {
        name: string;
      } | null;
      address: string;
      area: string;
      landmark: string | null;
      floorNumber: number;
      hasLift: boolean;
      geoLat: number | null;
      geoLng: number | null;
      sequenceOrder: number | null;
      cashBalance: Decimal;
      creditLimit: Decimal;
      deliveryInstructions: string | null;
      preferredDeliveryTime: string | null;
      specialNotes: string | null;
    };
    orderItems: Array<{
      quantity: number;
      product: {
        name: string;
      };
    }>;
  };
  index?: number; // Position in list for sequence numbering
}

export const EnhancedOrderCard = ({ order, index }: EnhancedOrderCardProps) => {
  const [unableToDeliverOpen, setUnableToDeliverOpen] = useState(false);
  const { mutateAsync: unableToDeliver, isPending } = useUnableToDeliver(order.id);

  const totalBottles = order.orderItems.reduce((sum, item) => sum + item.quantity, 0);
  const customerBalance = Number(order.customer.cashBalance);
  const hasDebt = customerBalance < 0;

  // Calculate if customer will exceed credit limit after this order
  const totalDue = Math.abs(customerBalance) + Number(order.totalAmount);
  const creditLimitNum = Number(order.customer.creditLimit);
  const exceedsCreditLimit = hasDebt && totalDue > creditLimitNum;

  // Use sequence order from customer if available, otherwise use index
  const sequenceNumber = order.customer.sequenceOrder || (index !== undefined ? index + 1 : null);

  const handleCall = () => {
    if (order.customer.user.phoneNumber) {
      window.location.href = `tel:${order.customer.user.phoneNumber}`;
    }
  };

  const handleWhatsApp = () => {
    if (order.customer.user.phoneNumber) {
      // Remove non-digits and ensure format
      const phone = order.customer.user.phoneNumber.replace(/\D/g, '').replace(/^0/, '92');
      const message = encodeURIComponent(`Salam ${order.customer.user.name}, Blue Ice delivery is arriving soon.`);
      window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
    }
  };

  const handleNavigate = () => {
    const { geoLat, geoLng, address } = order.customer;

    // Prefer coordinates for precision
    if (geoLat && geoLng) {
      window.open(`https://www.google.com/maps/dir/?api=1&destination=${geoLat},${geoLng}`, '_blank');
    } else {
      // Fallback to address search
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`, '_blank');
    }
  };

  const handleUnableToDeliver = async (data: any) => {
    try {
      // TODO: If photo provided, upload to cloud storage first
      let proofPhotoUrl: string | undefined;

      if (data.proofPhoto) {
        // For now, skip photo upload - will implement in next iteration
        toast.info('Photo proof feature coming soon');
      }

      await unableToDeliver({
        reason: data.reason,
        notes: data.notes,
        action: data.action,
        rescheduleDate: data.rescheduleDate,
        proofPhotoUrl,
      });

      setUnableToDeliverOpen(false);
    } catch (error) {
      // Error already handled by mutation
      console.error('Unable to deliver error:', error);
    }
  };

  return (
    <Card className="overflow-hidden">
      {/* Header with Sequence Number */}
      <div className="flex items-center gap-3 border-b bg-gradient-to-r from-blue-50 to-white dark:from-blue-950/40 dark:to-background p-4">
        {sequenceNumber && (
          <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full bg-blue-600 text-xl font-bold text-white shadow-lg">
            {sequenceNumber}
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{order.customer.user.name}</h3>
            <Badge variant={order.status === 'COMPLETED' ? 'default' : 'secondary'} className="text-xs">
              #{order.readableId}
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            <p className="text-sm text-muted-foreground">{order.customer.area}</p>
            {order.customer.route && <span className="text-xs text-muted-foreground">• {order.customer.route.name}</span>}
          </div>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">₨{Number(order.totalAmount).toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">{totalBottles} bottles</p>
        </div>
      </div>

      {/* Address & Delivery Details */}
      <div className="space-y-3 p-4">
        {/* Address */}
        <div className="flex items-start gap-2">
          <MapPin className="mt-1 h-4 w-4 flex-shrink-0 text-gray-500 dark:text-gray-400" />
          <p className="text-sm leading-tight">{order.customer.address}</p>
        </div>

        {/* Landmark - Prominent Display */}
        {order.customer.landmark && (
          <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/50 dark:bg-amber-950/20 px-3 py-2">
            <Landmark className="h-4 w-4 flex-shrink-0 text-amber-600 dark:text-amber-500" />
            <p className="text-sm font-medium text-amber-900 dark:text-amber-100">Near: {order.customer.landmark}</p>
          </div>
        )}

        {/* Floor & Lift Info - Critical for Driver */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-500 dark:text-gray-400" />
            <span className="text-sm font-medium">
              {order.customer.floorNumber === 0 ? 'Ground Floor' : `Floor ${order.customer.floorNumber}`}
            </span>
          </div>
          {order.customer.floorNumber > 0 && !order.customer.hasLift && (
            <Badge variant="destructive" className="gap-1 text-xs">
              <TrendingUp className="h-3 w-3" />
              Stairs Only
            </Badge>
          )}
          {order.customer.hasLift && order.customer.floorNumber > 0 && (
            <Badge variant="secondary" className="gap-1 bg-green-100 text-xs text-green-800 dark:bg-green-900/30 dark:text-green-300">
              Lift Available
            </Badge>
          )}
        </div>

        {/* Delivery Instructions - Most Important! */}
        {order.customer.deliveryInstructions && (
          <div className="rounded-md border-2 border-blue-300 bg-blue-50 dark:border-blue-800 dark:bg-blue-950/20 p-3">
            <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">📝 {order.customer.deliveryInstructions}</p>
          </div>
        )}

        {/* Preferred Delivery Time */}
        {order.customer.preferredDeliveryTime && (
          <div className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
            <Clock className="h-4 w-4" />
            <span>Best time: {order.customer.preferredDeliveryTime}</span>
          </div>
        )}

        {/* Special Notes */}
        {order.customer.specialNotes && (
          <div className="rounded-md border border-gray-200 bg-gray-50 dark:border-gray-800 dark:bg-gray-900/50 p-3">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300">⚠️ {order.customer.specialNotes}</p>
          </div>
        )}

        {/* Customer Balance Warning */}
        {hasDebt && (
          <div className="rounded-md border-2 border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-950/20 p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-red-600 dark:text-red-400" />
              <div className="flex-1">
                <p className="text-sm font-bold text-red-900 dark:text-red-100">Outstanding Balance: ₨{Math.abs(customerBalance).toFixed(0)}</p>
                <p className="mt-1 text-xs text-red-700 dark:text-red-300">
                  After this delivery: ₨{totalDue.toFixed(0)}
                  {exceedsCreditLimit && <span className="ml-1 font-semibold">(⚠️ Exceeds credit limit!)</span>}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Items Summary */}
        <div className="rounded-md bg-gray-50 dark:bg-gray-900/50 p-2">
          <p className="text-xs text-gray-600 dark:text-gray-300">
            {order.orderItems.map((item, idx) => (
              <span key={idx}>
                {item.quantity}x {item.product.name}
                {idx < order.orderItems.length - 1 && ', '}
              </span>
            ))}
          </p>
        </div>
      </div>

      {/* Unable to Deliver Button - Only for pending orders */}
      {order.status !== 'COMPLETED' && order.status !== 'CANCELLED' && (
        <div className="border-t bg-gray-50 dark:bg-gray-900/30 px-4 pb-2 pt-3">
          <Button
            onClick={() => setUnableToDeliverOpen(true)}
            variant="outline"
            size="lg"
            className="h-12 w-full border-red-200 bg-white text-red-600 hover:border-red-300 hover:bg-red-50 hover:text-red-700 dark:border-red-900/30 dark:bg-background dark:text-red-400 dark:hover:bg-red-950/30"
          >
            <XCircle className="mr-2 h-5 w-5" />
            <span className="font-semibold">Unable to Deliver</span>
          </Button>
        </div>
      )}

      {/* Action Buttons - Adjusted grid and sizing for responsiveness */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 border-t bg-gray-50 dark:bg-gray-900/30 p-4">
        {/* Call Button */}
        <Button
          onClick={handleCall}
          disabled={!order.customer.user.phoneNumber}
          size="lg"
          variant="outline"
          className="h-14 flex-col gap-1 hover:border-green-300 hover:bg-green-50 px-0 dark:hover:border-green-800 dark:hover:bg-green-950/30"
        >
          <Phone className="h-5 w-5 text-green-600 dark:text-green-400" />
          <span className="text-[10px] font-medium">Call</span>
        </Button>

        {/* WhatsApp Button (New) */}
        <Button
          onClick={handleWhatsApp}
          disabled={!order.customer.user.phoneNumber}
          size="lg"
          variant="outline"
          className="h-14 flex-col gap-1 hover:border-green-300 hover:bg-green-50 px-0 dark:hover:border-green-800 dark:hover:bg-green-950/30"
        >
          <FaWhatsapp className="h-5 w-5 text-[#25D366]" />
          <span className="text-[10px] font-medium">WhatsApp</span>
        </Button>

        {/* Navigate Button */}
        <Button onClick={handleNavigate} size="lg" variant="outline" className="h-14 flex-col gap-1 hover:border-blue-300 hover:bg-blue-50 px-0 dark:hover:border-blue-800 dark:hover:bg-blue-950/30">
          <Navigation className="h-5 w-5 text-blue-600 dark:text-blue-400" />
          <span className="text-[10px] font-medium">Map</span>
        </Button>

        {/* Complete/View Button */}
        <Link href={`/deliveries/${order.id}`} className="block col-span-1">
          <Button size="lg" variant={order.status === 'COMPLETED' ? 'secondary' : 'primary'} className="h-14 w-full flex-col gap-1 px-0">
            <Package className="h-5 w-5" />
            <span className="text-[10px] font-medium">{order.status === 'COMPLETED' ? 'View' : 'Deliver'}</span>
          </Button>
        </Link>
      </div>

      {/* Unable to Deliver Dialog */}
      <UnableToDeliverDialog
        orderId={order.id}
        customerName={order.customer.user.name}
        scheduledDate={order.scheduledDate}
        open={unableToDeliverOpen}
        onOpenChange={setUnableToDeliverOpen}
        onSubmit={handleUnableToDeliver}
      />
    </Card>
  );
};
