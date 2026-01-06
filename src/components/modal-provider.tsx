'use client';

import { useEffect, useState } from 'react';

import { OrderFormModal } from '@/features/orders/components/order-form-modal';

export const ModalProvider = () => {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) return null;

  return (
    <>
      <OrderFormModal />
      {/* <CreateProductModal /> */}
    </>
  );
};
