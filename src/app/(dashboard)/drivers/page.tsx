'use client';

import { Plus } from 'lucide-react';
import { Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { useGetDrivers } from '@/features/drivers/api/use-get-drivers';
import { Driver, columns } from '@/features/drivers/components/columns';
import { DriverTable } from '@/features/drivers/components/driver-list';
import { useDriverModal } from '@/features/drivers/hooks/use-driver-modal';

function DriversContent() {
  const { data, isLoading } = useGetDrivers();
  const { open } = useDriverModal();
  // @ts-ignore
  const drivers: Driver[] = (data?.drivers as Driver[]) || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Drivers</h1>
        <Button onClick={() => open()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Driver
        </Button>
      </div>
      <DriverTable columns={columns} data={drivers} isLoading={isLoading} />
    </div>
  );
}

export default function DriversPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DriversContent />
    </Suspense>
  );
}
