'use client';

import { ArrowRight } from 'lucide-react';
import Link from 'next/link';

import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import { useGetDriverStats } from '../api/use-get-driver-stats';

export const DriverStats = () => {
  const { data: stats, isLoading } = useGetDriverStats();

  if (isLoading) return <StatsSkeleton />;
  if (!stats) return null;

  return (
    <div className="grid grid-cols-2 gap-4">
      <Card className="dark:bg-background/60">
        <CardContent className="flex flex-col items-center justify-center p-4 text-center">
          <span className="text-2xl font-bold">{stats.pendingOrders}</span>
          <span className="text-xs text-muted-foreground">Pending</span>
        </CardContent>
      </Card>
      <Card className="dark:bg-background/60">
        <CardContent className="flex flex-col items-center justify-center p-4 text-center">
          <span className="text-2xl font-bold">{stats.completedOrders}</span>
          <span className="text-xs text-muted-foreground">Completed</span>
        </CardContent>
      </Card>

      <Link href="/cash-handover" className="col-span-2">
        <Card className="border-blue-200 bg-blue-50 transition-colors hover:bg-blue-100 dark:border-blue-900 dark:bg-blue-950/20 dark:hover:bg-blue-950/40">
          <CardContent className="flex items-center justify-between p-4">
            <div className="flex flex-col">
              <span className="text-sm font-medium text-blue-700 dark:text-blue-300">Cash Collected (Tap to Handover)</span>
              <span className="text-xl font-bold text-blue-700 dark:text-blue-300">
                {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(Number(stats.cashCollected))}
              </span>
            </div>
            <ArrowRight className="h-5 w-5 text-blue-700 dark:text-blue-300" />
          </CardContent>
        </Card>
      </Link>
    </div>
  );
};

function StatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-4">
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="col-span-2 h-16 w-full" />
    </div>
  );
}
