'use client';

import { FileText, Printer, Receipt } from 'lucide-react';
import { useState } from 'react';

import { PageError } from '@/components/page-error';
import { PageLoader } from '@/components/page-loader';
import { ResponsiveModal } from '@/components/responsive-modal';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useGetInvoiceData } from '@/features/orders/api/use-get-invoice-data';
import { InvoiceA4 } from '@/features/orders/components/invoice-a4';
import { InvoiceThermal } from '@/features/orders/components/invoice-thermal';

import { useInvoiceModal } from '../hooks/use-invoice-modal';

export const InvoiceModal = () => {
  const { isOpen, orderId, close } = useInvoiceModal();
  const { data: invoiceData, isLoading } = useGetInvoiceData(orderId || '');
  const [format, setFormat] = useState<'a4' | 'thermal'>('a4');

  const handlePrint = () => {
    window.print();
  };

  const handleOpenChange = (open: boolean) => {
    if (!open) {
      close();
    }
  };

  if (!isOpen) return null;

  return (
    <ResponsiveModal title="Order Invoice" description="View and print invoice" open={isOpen} onOpenChange={handleOpenChange}>
      {isLoading ? (
        <PageLoader />
      ) : !invoiceData ? (
        <PageError message="Order not found" />
      ) : (
        <div className="flex flex-col gap-6">
          {/* Header with Print Button */}
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between print:hidden">
            <div>
              <p className="text-sm text-muted-foreground">
                Invoice #{invoiceData.order.readableId} - {invoiceData.order.customer.user.name}
              </p>
            </div>
            <div className="flex gap-2">
              <Button onClick={handlePrint} size="sm">
                <Printer className="mr-2 h-4 w-4" />
                Print
              </Button>
            </div>
          </div>

          {/* Format Switcher */}
          <Tabs value={format} onValueChange={(v) => setFormat(v as 'a4' | 'thermal')} className="print:hidden">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="a4" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                A4 Invoice
              </TabsTrigger>
              <TabsTrigger value="thermal" className="flex items-center gap-2">
                <Receipt className="h-4 w-4" />
                Thermal Receipt
              </TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Invoice Display */}
          <div className="overflow-x-auto">
            <div className={`${format === 'thermal' ? 'flex justify-center' : ''}`}>
              <div className="rounded-lg border bg-white shadow-sm print:border-none print:shadow-none">
                {format === 'a4' ? <InvoiceA4 data={invoiceData} /> : <InvoiceThermal data={invoiceData} />}
              </div>
            </div>
          </div>
        </div>
      )}
    </ResponsiveModal>
  );
};
