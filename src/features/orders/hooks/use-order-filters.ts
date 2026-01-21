import { parseAsInteger, parseAsString, useQueryStates } from 'nuqs';

export const useOrderFilters = () => {
  return useQueryStates({
    search: parseAsString.withDefault(''),
    status: parseAsString.withDefault(''),
    date: parseAsString.withDefault(''), // Kept for backward compat or single date
    from: parseAsString.withDefault(''),
    to: parseAsString.withDefault(''),
    routeId: parseAsString.withDefault(''),

    driverId: parseAsString.withDefault(''),
    customerType: parseAsString.withDefault(''),
    page: parseAsInteger.withDefault(1),
    limit: parseAsInteger.withDefault(20),
  });
};
