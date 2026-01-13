import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';

export const useCustomerFilters = () => {
  return useQueryStates({
    search: parseAsString.withDefault(''),
    routeId: parseAsString.withDefault(''),
    type: parseAsString.withDefault(''),
    deliveryDay: parseAsInteger, // Add deliveryDay filter
    page: parseAsInteger.withDefault(1),
    limit: parseAsInteger.withDefault(20),
  });
};
