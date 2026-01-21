import { parseAsBoolean, parseAsInteger, parseAsString, useQueryStates } from 'nuqs';

export const useUserFilters = () => {
  return useQueryStates({
    search: parseAsString,
    suspended: parseAsBoolean,
    page: parseAsInteger.withDefault(1),
    limit: parseAsInteger.withDefault(10),
  });
};
