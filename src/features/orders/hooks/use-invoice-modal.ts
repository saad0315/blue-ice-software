import { parseAsString, useQueryState } from 'nuqs';

export const useInvoiceModal = () => {
  const [orderId, setOrderId] = useQueryState('invoice-order', parseAsString);

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
