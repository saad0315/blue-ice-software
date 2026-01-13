import { Wallet } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';

import { OfflineIndicator } from '@/components/offline-indicator';
import { ServiceWorkerRegister } from '@/components/service-worker-register';
import { Button } from '@/components/ui/button';
import { UserButton } from '@/features/auth/components/user-button';
import { CompleteDeliveryModal } from '@/features/driver-view/components/complete-delivery-modal';
import { NotificationSheet } from '@/features/notifications/components/notification-sheet';
import { InvoiceModal } from '@/features/orders/components/invoice-modal';

interface DriverLayoutProps {
  children: React.ReactNode;
}

export default function DriverLayout({ children }: DriverLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-100 dark:bg-neutral-900">
      <ServiceWorkerRegister />
      <OfflineIndicator />

      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-14 items-center justify-between px-4">
          <div className="flex items-center gap-2">
            <Link href="/deliveries" className="flex items-center gap-2 font-semibold">
              <Image src="/icon1.png" alt="Logo" width={24} height={24} />
              <span>Driver App</span>
            </Link>
          </div>
          <div className="flex items-center gap-1">
            <NotificationSheet />
            <Button variant="ghost" size="icon" asChild>
              <Link href="/ledger">
                <Wallet className="h-5 w-5" />
                <span className="sr-only">Wallet</span>
              </Link>
            </Button>
            <UserButton />
          </div>
        </div>
      </header>
      <main className="container mx-auto max-w-md px-4 py-6 pb-20">
        {children}
        <CompleteDeliveryModal />
        <InvoiceModal />
      </main>
    </div>
  );
}
