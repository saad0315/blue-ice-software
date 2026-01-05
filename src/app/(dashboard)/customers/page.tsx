'use client';

import { Plus } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { useGetCustomers } from '@/features/customers/api/use-get-customers';
import { Customer, columns } from '@/features/customers/components/columns';
import { CustomerTable } from '@/features/customers/components/customer-list';

function CustomersContent() {
  const { data, isLoading } = useGetCustomers();

  // Handle the case where data might be undefined during loading or error
  const customers: Customer[] = (data?.data as Customer[]) || [];
  const pagination = data?.pagination;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Customers</h1>
        <Button asChild>
          <Link href="/customers/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Customer
          </Link>
        </Button>
      </div>
      <CustomerTable columns={columns} data={customers} isLoading={isLoading} pagination={pagination} />
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <CustomersContent />
    </Suspense>
  );
}
