import { parseAsString, useQueryState } from 'nuqs';

export const useRouteModal = () => {
  const [routeId, setRouteId] = useQueryState('route-form', parseAsString);

  const open = (id?: string) => setRouteId(id || 'new');
  const close = () => setRouteId(null);

  return {
    routeId,
    isOpen: !!routeId,
    isEdit: routeId !== null && routeId !== 'new',
    setRouteId,
    open,
    close,
  };
};
