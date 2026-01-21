'use client';

import { ArrowDownToLine, ArrowUpFromLine, ClipboardList, History } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function TruckInventoryDashboard() {
  const router = useRouter();

  const actions = [
    {
      title: 'Create Load Sheet',
      description: 'Morning: Record stock moving from Warehouse to Truck.',
      icon: ArrowUpFromLine,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      onClick: () => router.push('/truck-inventory/load'),
    },
    {
      title: 'Create Return Sheet',
      description: 'Evening: Record unsold stock and empties returning to Warehouse.',
      icon: ArrowDownToLine,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      onClick: () => router.push('/truck-inventory/return'),
    },
    // Future enhancement: View History
    /*
    {
      title: 'View History',
      description: 'View past load and return sheets.',
      icon: History,
      color: 'text-gray-600',
      bgColor: 'bg-gray-100',
      onClick: () => router.push('/truck-inventory/history'),
    },
    */
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-2">
        <ClipboardList className="h-8 w-8 text-primary" />
        <h1 className="text-3xl font-bold tracking-tight">Truck Inventory</h1>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {actions.map((action) => (
          <Card
            key={action.title}
            className="cursor-pointer transition-all hover:shadow-md hover:border-primary/50"
            onClick={action.onClick}
          >
            <CardHeader className="pb-4">
              <div className={`w-12 h-12 rounded-lg flex items-center justify-center mb-2 ${action.bgColor}`}>
                <action.icon className={`h-6 w-6 ${action.color}`} />
              </div>
              <CardTitle>{action.title}</CardTitle>
              <CardDescription>{action.description}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      <div className="mt-8 p-4 border rounded-lg bg-muted/30">
        <h2 className="text-lg font-semibold mb-2">How it works</h2>
        <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
          <li><strong>Step 1 (Morning):</strong> Use "Create Load Sheet" to assign stock to a driver. This deducts from Warehouse inventory.</li>
          <li><strong>Step 2 (Day):</strong> Driver delivers orders. This does <strong>not</strong> affect warehouse stock directly anymore.</li>
          <li><strong>Step 3 (Evening):</strong> Use "Create Return Sheet" to log what comes back. This adds stock (Filled or Empty) back to the Warehouse.</li>
        </ul>
      </div>
    </div>
  );
}
