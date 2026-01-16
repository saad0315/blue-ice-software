'use client';

import { format } from 'date-fns';
import { ArrowLeft, Calendar, CreditCard, MapPin, Package, Pencil, Phone, Route as RouteIcon, ShoppingCart, Trash, User, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';

import { PageError } from '@/components/page-error';
import { PageLoader } from '@/components/page-loader';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useDeleteCustomer } from '@/features/customers/api/use-delete-customer';
import { useGetCustomer } from '@/features/customers/api/use-get-customer';
import { useInvoiceModal } from '@/features/orders/hooks/use-invoice-modal';
import { useConfirm } from '@/hooks/use-confirm';

interface CustomerDetailViewProps {
  customerId: string;
}

// Helper function to convert delivery day numbers to day names
const getDayName = (dayNumber: number): string => {
  const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  return days[dayNumber] || 'Unknown';
};

export const CustomerDetailView = ({ customerId }: CustomerDetailViewProps) => {
  const router = useRouter();
  const { data: customer, isLoading } = useGetCustomer(customerId);
  const { mutate: deleteCustomer, isPending: isDeleting } = useDeleteCustomer();
  const { open: openInvoice } = useInvoiceModal();

  const [ConfirmDialog, confirm] = useConfirm(
    'Delete Customer',
    'Are you sure you want to delete this customer? This will remove all their data.',
    'destructive',
  );

  const handleDelete = async () => {
    const ok = await confirm();
    if (ok) {
      deleteCustomer(
        { param: { id: customerId } },
        {
          onSuccess: () => router.push('/customers'),
        },
      );
    }
  };

  if (isLoading) return <PageLoader />;
  if (!customer) return <PageError message="Customer not found" />;

  const cashBalance = Number(customer.cashBalance);
  const creditLimit = Number(customer.creditLimit);

  return (
    <div className="space-y-6">
      <ConfirmDialog />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.push('/customers')}>
            <ArrowLeft className="size-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{customer.user.name}</h1>
            <p className="text-sm text-muted-foreground">{customer.manualCode || 'No Code'}</p>
          </div>
          <Badge variant={customer.user.isActive ? 'default' : 'secondary'}>{customer.user.isActive ? 'Active' : 'Inactive'}</Badge>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/customers/${customerId}/edit`)}>
            <Pencil className="mr-2 size-4" />
            Edit
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isDeleting}>
            <Trash className="mr-2 size-4" />
            Delete
          </Button>
        </div>
      </div>

      {/* Customer Type & Delivery Info */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <User className="size-4" />
              Customer Type
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Badge variant="secondary" className="text-sm">
              {customer.type}
            </Badge>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Calendar className="size-4" />
              Delivery Schedule
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {customer.deliveryDays && customer.deliveryDays.length > 0 ? (
                customer.deliveryDays.map((day: number) => (
                  <Badge key={day} variant="outline" className="text-xs">
                    {getDayName(day)}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Not set</span>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <ShoppingCart className="size-4" />
              Default Order
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Product</p>
              <p className="text-base">{customer.defaultProduct?.name || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Quantity</p>
              <p className="text-base">{customer.defaultQuantity || '-'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <MapPin className="size-4" />
              Delivery Details
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Floor</p>
              <p className="text-base">{customer.floorNumber} {customer.hasLift ? '(Lift Available)' : '(No Lift)'}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Info Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Phone className="size-4" />
              Contact & Location
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Phone</p>
              <p className="text-base">{customer.user.phoneNumber}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Email</p>
              <p className="text-base">{customer.user.email || '-'}</p>
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Address</p>
              <p className="text-base">{customer.address}</p>
              <p className="text-sm text-muted-foreground">
                {customer.area} {customer.landmark && `(${customer.landmark})`}
              </p>
            </div>
            {customer.route && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Route</p>
                <div className="flex items-center gap-2">
                  <RouteIcon className="size-4 text-muted-foreground" />
                  <span>{customer.route.name}</span>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Financial Wallet */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Wallet className="size-4" />
              Financial Wallet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Current Balance</p>
              <p className={`text-3xl font-bold ${cashBalance < 0 ? 'text-red-600' : 'text-green-600'}`}>
                {new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(cashBalance)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{cashBalance < 0 ? 'Customer owes you' : 'Advance payment'}</p>
            </div>
            <Separator />
            <div>
              <p className="text-sm font-medium text-muted-foreground">Credit Limit</p>
              <div className="flex items-center gap-2">
                <CreditCard className="size-4 text-muted-foreground" />
                <span>{new Intl.NumberFormat('en-PK', { style: 'currency', currency: 'PKR' }).format(creditLimit)}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bottle Wallet */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Package className="size-4" />
              Bottle Wallet
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {customer.bottleWallets.length === 0 ? (
              <p className="text-sm text-muted-foreground">No bottles held.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="h-8 py-2">Product</TableHead>
                    <TableHead className="h-8 py-2 text-right">Qty</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.bottleWallets.map((wallet: any) => (
                    <TableRow key={wallet.id}>
                      <TableCell className="py-2 font-medium">{wallet.product.name}</TableCell>
                      <TableCell className="py-2 text-right">{wallet.balance}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Ledger History */}
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {customer.ledgers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No transactions found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Balance</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.ledgers.map((ledger: any) => (
                    <TableRow key={ledger.id}>
                      <TableCell className="text-xs">{format(new Date(ledger.createdAt), 'dd/MM/yy')}</TableCell>
                      <TableCell className="max-w-[150px] truncate text-xs" title={ledger.description}>
                        {ledger.description}
                      </TableCell>
                      <TableCell
                        className={`text-right text-xs font-medium ${Number(ledger.amount) < 0 ? 'text-red-600' : 'text-green-600'}`}
                      >
                        {Number(ledger.amount) < 0 ? '' : '+'}
                        {Number(ledger.amount)}
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {new Intl.NumberFormat('en-PK').format(Number(ledger.balanceAfter))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        {/* Order History */}
        <Card className="md:col-span-2 lg:col-span-1">
          <CardHeader>
            <CardTitle>Recent Orders</CardTitle>
          </CardHeader>
          <CardContent>
            {customer.orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">No orders found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order #</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {customer.orders.map((order: any) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openInvoice(order.id)}
                    >
                      <TableCell className="font-medium">#{order.readableId}</TableCell>
                      <TableCell className="text-xs">{format(new Date(order.scheduledDate), 'dd/MM/yy')}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="h-5 text-[10px]">
                          {order.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {new Intl.NumberFormat('en-PK').format(Number(order.totalAmount))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
