'use client';

import { AlertTriangle, ArrowRightLeft, Box, Package, Plus, Users } from 'lucide-react';

import { PageError } from '@/components/page-error';
import { PageLoader } from '@/components/page-loader';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

import { useGetInventoryStats } from '../api/use-get-inventory-stats';
import { useDamageModal } from '../hooks/use-damage-modal';
import { useRefillModal } from '../hooks/use-refill-modal';
import { useRestockModal } from '../hooks/use-restock-modal';
import { DamageFormModal } from './damage-form-modal';
import { RefillFormModal } from './refill-form-modal';
import { RestockFormModal } from './restock-form-modal';

interface ProductStats {
  id: string;
  name: string;
  sku: string;
  stockFilled: number;
  stockEmpty: number;
  stockDamaged: number;
  bottlesWithCustomers: number;
  totalBottles: number;
}

export const InventoryDashboard = () => {
  const { data, isLoading, error } = useGetInventoryStats();
  const { open: openRestockModal } = useRestockModal();
  const { open: openRefillModal } = useRefillModal();
  const { open: openDamageModal } = useDamageModal();

  if (isLoading) return <PageLoader />;
  if (error) return <PageError message="Failed to load inventory data" />;
  if (!data) return <PageError message="No inventory data available" />;

  const { products, totals } = data;

  return (
    <>
      <RestockFormModal />
      <RefillFormModal />
      <DamageFormModal />
      <div className="space-y-6">
        {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Filled Bottles</CardTitle>
            <Package className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.filled}</div>
            <p className="text-xs text-muted-foreground">Ready for delivery</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Empty Bottles</CardTitle>
            <Box className="h-4 w-4 text-slate-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.empty}</div>
            <p className="text-xs text-muted-foreground">Returned by customers</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">With Customers</CardTitle>
            <Users className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.withCustomers}</div>
            <p className="text-xs text-muted-foreground">Currently in circulation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Damaged Bottles</CardTitle>
            <AlertTriangle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totals.damaged}</div>
            <p className="text-xs text-muted-foreground">Requires attention</p>
          </CardContent>
        </Card>
      </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Common inventory operations</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <Button onClick={openRestockModal}>
              <Plus className="mr-2 h-4 w-4" />
              Record Restock
            </Button>
            <Button variant="secondary" onClick={openRefillModal}>
              <ArrowRightLeft className="mr-2 h-4 w-4" />
              Refill Bottles
            </Button>
            <Button variant="destructive" onClick={openDamageModal}>
              <AlertTriangle className="mr-2 h-4 w-4" />
              Report Damage/Loss
            </Button>
          </CardContent>
        </Card>

      {/* Product-wise Inventory Table */}
      <Card>
        <CardHeader>
          <CardTitle>Product Inventory</CardTitle>
          <CardDescription>Current stock levels for each product</CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Product</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead className="text-right">Filled</TableHead>
                <TableHead className="text-right">Empty</TableHead>
                <TableHead className="text-right">Damaged</TableHead>
                <TableHead className="text-right">With Customers</TableHead>
                <TableHead className="text-right">Total</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {products.map((product: ProductStats) => (
                <TableRow key={product.id}>
                  <TableCell className="font-medium">{product.name}</TableCell>
                  <TableCell className="text-muted-foreground">{product.sku}</TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold text-blue-600">{product.stockFilled}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold text-slate-600">{product.stockEmpty}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold text-destructive">{product.stockDamaged}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-semibold text-green-600">{product.bottlesWithCustomers}</span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-bold">{product.totalBottles}</span>
                  </TableCell>
                </TableRow>
              ))}
              {products.length === 0 && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center text-muted-foreground">
                    No products found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
        </Card>
      </div>
    </>
  );
};
