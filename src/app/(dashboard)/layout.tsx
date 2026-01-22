import type { PropsWithChildren } from 'react';

import { ModalProvider } from '@/components/modal-provider';
import { Navbar } from '@/components/navbar';
import { Sidebar } from '@/components/sidebar';

const DashboardLayout = ({ children }: PropsWithChildren) => {
  return (
    <div className="relative min-h-screen">
      {/* Background blur effects */}
      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-blue-400/20 blur-3xl dark:bg-blue-600/20" />
        <div className="absolute -right-40 top-1/4 h-96 w-96 rounded-full bg-teal-400/20 blur-3xl dark:bg-teal-600/15" />
        <div className="absolute -bottom-40 left-1/3 h-80 w-80 rounded-full bg-blue-300/15 blur-3xl dark:bg-blue-500/10" />
        <div className="absolute right-1/4 top-2/3 h-64 w-64 rounded-full bg-cyan-400/15 blur-3xl dark:bg-cyan-600/10" />
      </div>

      <ModalProvider />

      <div className="flex size-full">
        <div className="fixed left-0 top-0 hidden h-full overflow-auto lg:block lg:w-[264px]">
          <Sidebar />
        </div>

        <div className="w-full lg:pl-[264px]">
          <div className="mx-auto h-full max-w-screen-xl">
            <Navbar />

            <main className="flex h-full flex-col p-4 lg:px-6 lg:py-8">{children}</main>
          </div>
        </div>
      </div>
    </div>
  );
};
export default DashboardLayout;
