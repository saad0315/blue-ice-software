'use client';

import { Plus } from 'lucide-react';
// import Link from 'next/link';
import { Suspense } from 'react';

import { Button } from '@/components/ui/button';
import { useGetRoutes } from '@/features/routes/api/use-get-routes';
import { Route, columns } from '@/features/routes/components/columns';
import { RouteFormModal } from '@/features/routes/components/route-form-modal';
import { RouteTable } from '@/features/routes/components/route-list';
import { useRouteModal } from '@/features/routes/hooks/use-route-modal';

function RoutesContent() {
  const { data, isLoading } = useGetRoutes();
  const { open } = useRouteModal();
  // @ts-ignore
  const routes: Route[] = (data?.routes as Route[]) || [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Routes</h1>
        {/* <Button asChild>
          <Link href="/routes/new">
            <Plus className="mr-2 h-4 w-4" />
            Add Route
          </Link>
        </Button> */}
        <Button onClick={() => open()}>
          <Plus className="mr-2 h-4 w-4" />
          Add Route
        </Button>
      </div>
      <RouteTable columns={columns} data={routes} isLoading={isLoading} />
      <RouteFormModal />
    </div>
  );
}

export default function RoutesPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <RoutesContent />
    </Suspense>
  );
}
