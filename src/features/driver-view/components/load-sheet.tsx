import { Package } from 'lucide-react';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface LoadSheetProps {
  orders: any[];
}

export const LoadSheet = ({ orders }: LoadSheetProps) => {
  const [open, setOpen] = useState(false);
  const pendingOrders = orders.filter((o) => o.status !== 'COMPLETED' && o.status !== 'CANCELLED');

  const totals = pendingOrders.reduce((acc: any, order) => {
    order.orderItems.forEach((item: any) => {
      const productName = item.product.name;
      if (!acc[productName]) {
        acc[productName] = { quantity: 0 };
      }
      acc[productName].quantity += item.quantity;
    });
    return acc;
  }, {});

  if (pendingOrders.length === 0) return null;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <Package className="mr-2 h-4 w-4" />
          Load Sheet
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Load Sheet</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <Card className="border-blue-200 bg-blue-50 dark:border-blue-900 dark:bg-blue-950/20">
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-lg">
                <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {Object.entries(totals).map(([name, stats]: [string, any]) => (
                  <div
                    key={name}
                    className="flex items-center justify-between border-b border-blue-200 pb-1 last:border-0 dark:border-blue-800"
                  >
                    <span className="text-sm font-medium dark:text-gray-200">{name}</span>
                    <span className="text-lg font-bold dark:text-white">{stats.quantity}</span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-xs text-muted-foreground">Total {pendingOrders.length} stops remaining.</p>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};
