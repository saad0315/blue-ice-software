'use client';

import { ResponsiveModal } from '@/components/responsive-modal';

import { useDriverModal } from '../hooks/use-driver-modal';
import { DriverForm } from './driver-form';

export const DriverFormModal = () => {
  const { isOpen, isEdit, driverId, close } = useDriverModal();

  return (
    <ResponsiveModal
      title={isEdit ? 'Edit Driver' : 'Create Driver'}
      description={isEdit ? 'Update driver details.' : 'Add a new driver to the system.'}
      open={isOpen}
      onOpenChange={(open) => !open && close()}
    >
      <DriverForm driverId={isEdit ? driverId! : undefined} onCancel={close} />
    </ResponsiveModal>
  );
};
