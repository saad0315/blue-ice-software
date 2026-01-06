'use client';

import { Dialog, DialogContent } from '@/components/ui/dialog';

import { useOrderModal } from '../hooks/use-order-modal';
import { OrderForm } from './order-form';
import { ResponsiveModal } from '@/components/responsive-modal';

export const OrderFormModal = () => {
  const { isOpen, isEdit, orderId, close } = useOrderModal();

  return (
    <ResponsiveModal title="Create Order" description="Get started by creating a new project." open={isOpen} onOpenChange={(open) => !open && close()}>
      <OrderForm orderId={isEdit ? orderId! : undefined} onCancel={close} />
      {/* <Dialog open={isOpen} onOpenChange={(open) => !open && close()}>
         <DialogContent className="overflow-y-auto">
          <OrderForm orderId={isEdit ? orderId! : undefined} onCancel={close} />
         </DialogContent>
       </Dialog> */}
    </ResponsiveModal>
  );
};
