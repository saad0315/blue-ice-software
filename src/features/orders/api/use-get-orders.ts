import { CustomerType, OrderStatus } from '@prisma/client';
import { useQuery } from '@tanstack/react-query';
import { useSearchParams } from 'next/navigation';

import { client } from '@/lib/hono';

interface UseGetOrdersProps {
  driverId?: string;
  status?: OrderStatus;
  customerType?: CustomerType;
  date?: string;
  from?: string;
  to?: string;
}

export const useGetOrders = (props?: UseGetOrdersProps) => {
  const searchParams = useSearchParams();
  const search = searchParams.get('search') || undefined;
  const routeId = searchParams.get('routeId') || undefined;
  const status = props?.status || (searchParams.get('status') as OrderStatus) || undefined;
  const date = props?.date || searchParams.get('date') || undefined;
  const from = props?.from || searchParams.get('from') || undefined;
  const to = props?.to || searchParams.get('to') || undefined;
  const driverId = props?.driverId || searchParams.get('driverId') || undefined;
  const rawCustomerType = props?.customerType || searchParams.get('customerType');
  const customerType =
    rawCustomerType && rawCustomerType !== 'null' && rawCustomerType !== '' ? (rawCustomerType as CustomerType) : undefined;
  const page = searchParams.get('page') ? parseInt(searchParams.get('page')!) : 1;
  const limit = searchParams.get('limit') ? parseInt(searchParams.get('limit')!) : 20;

  return useQuery({
    queryKey: ['orders', { search, routeId, status, date, from, to, driverId, customerType, page, limit }],
    queryFn: async () => {
      const response = await client.api.orders.$get({
        query: {
          search,
          routeId,
          status,
          date,
          from,
          to,
          driverId,
          customerType,
          page: page.toString(),
          limit: limit.toString(),
        },
      });

      if (!response.ok) {
        throw new Error('Failed to fetch orders');
      }

      return await response.json();
    },
  });
};
