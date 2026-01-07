'use client';

import { ResponsiveModal } from '@/components/responsive-modal';

import { useRouteModal } from '../hooks/use-route-modal';
import { RouteForm } from './route-form';

export const RouteFormModal = () => {
  const { isOpen, isEdit, routeId, close } = useRouteModal();

  return (
    <ResponsiveModal
      title={isEdit ? 'Edit Route' : 'Create Route'}
      description={isEdit ? 'Update route details.' : 'Add a new route to the system.'}
      open={isOpen}
      onOpenChange={(open) => !open && close()}
    >
      <RouteForm routeId={isEdit ? routeId! : undefined} onCancel={close} />
    </ResponsiveModal>
  );
};
