'use client';

import { ResponsiveModal } from '@/components/responsive-modal';

import { useCompleteDeliveryModal } from '../hooks/use-complete-delivery-modal';
import { CompleteDeliveryForm } from './complete-delivery-form';

export const CompleteDeliveryModal = () => {
  const { isOpen, orderId, close } = useCompleteDeliveryModal();

  return (
    <ResponsiveModal
      title="Complete Delivery"
      description="Enter payment and bottle details."
      open={isOpen}
      onOpenChange={(open) => !open && close()}
    >
      {orderId && <CompleteDeliveryForm orderId={orderId} onSuccess={close} />}
    </ResponsiveModal>
  );
};
