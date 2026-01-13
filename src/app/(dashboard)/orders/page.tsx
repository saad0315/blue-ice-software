'use client';

import { Plus } from 'lucide-react';
import { Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { useGetOrders } from '@/features/orders/api/use-get-orders';
import { Order, columns } from '@/features/orders/components/columns';
import { InvoiceModal } from '@/features/orders/components/invoice-modal';
import { OrderTable } from '@/features/orders/components/order-list';
import { useOrderModal } from '@/features/orders/hooks/use-order-modal';

function OrdersContent() {
  const { data, isLoading } = useGetOrders();
  const { open } = useOrderModal();

  // @ts-ignore
  const orders: Order[] = (data?.orders as Order[]) || [];
  // @ts-ignore
  const pagination = data?.pagination;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Orders</h1>
        <Button onClick={() => open()}>
          <Plus className="mr-2 h-4 w-4" />
          Create Order
        </Button>
      </div>
      <OrderTable columns={columns} data={orders} isLoading={isLoading} pagination={pagination} />
      <InvoiceModal />
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <OrdersContent />
    </Suspense>
  );
}
