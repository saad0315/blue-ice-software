import { parseAsString, useQueryState } from 'nuqs';

export const useOrderModal = () => {
  const [orderId, setOrderId] = useQueryState('order-form', parseAsString);

  const open = (id?: string) => setOrderId(id || 'new');
  const close = () => setOrderId(null);

  return {
    orderId,
    isOpen: !!orderId,
    isEdit: orderId !== null && orderId !== 'new',
    setOrderId,
    open,
    close,
  };
};
