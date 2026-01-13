import { parseAsString, useQueryState } from 'nuqs';

export const useCompleteDeliveryModal = () => {
  const [orderId, setOrderId] = useQueryState('complete-delivery', parseAsString);

  const open = (id: string) => setOrderId(id);
  const close = () => setOrderId(null);

  return {
    orderId,
    isOpen: !!orderId,
    setOrderId,
    open,
    close,
  };
};
