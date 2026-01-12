import { parseAsString, useQueryState } from 'nuqs';

export const useDriverModal = () => {
  const [driverId, setDriverId] = useQueryState('driver-form', parseAsString);

  const open = (id?: string) => setDriverId(id || 'new');
  const close = () => setDriverId(null);

  return {
    driverId,
    isOpen: !!driverId,
    isEdit: driverId !== null && driverId !== 'new',
    setDriverId,
    open,
    close,
  };
};
