import { Trash, Shield } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import { UserRole } from '@prisma/client';

import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useConfirm } from '@/hooks/use-confirm';

import { useUpdateStatus } from '../api/use-update-status';
import { useUpdateRole } from '../api/use-update-role';

interface UserActionsProps {
  id: string;
  suspended: boolean;
  currentRole?: UserRole;
}

export const UserActions = ({ id, suspended, currentRole, children }: PropsWithChildren<UserActionsProps>) => {
  const [isRoleDialogOpen, setIsRoleDialogOpen] = useState(false);
  const [selectedRole, setSelectedRole] = useState<UserRole | undefined>(currentRole);

  const [ConfirmDialog, confirm] = useConfirm(
    suspended ? 'Activate User' : 'Suspend User',
    suspended ? 'This will activate the user.' : 'This action will suspend the user and cannot be undone.',
    'destructive',
  );

  const { mutate: updateStatus, isPending: isStatusPending } = useUpdateStatus();
  const { mutate: updateRole, isPending: isRolePending } = useUpdateRole();

  const isPending = isStatusPending || isRolePending;

  const onUpdateStatus = async () => {
    const ok = await confirm();
    if (!ok) return;

    updateStatus({ param: { userId: id }, json: { suspended: !suspended } });
  };

  const onUpdateRole = () => {
    if (!selectedRole) return;

    updateRole(
      { param: { userId: id }, json: { role: selectedRole } },
      {
        onSuccess: () => {
          setIsRoleDialogOpen(false);
        }
      }
    );
  };

  // Filter out SUPER_ADMIN from selection to prevent accidental elevation
  const roles = Object.values(UserRole).filter((role) => role !== UserRole.SUPER_ADMIN);

  return (
    <div className="flex justify-end">
      <ConfirmDialog />

      <Dialog open={isRoleDialogOpen} onOpenChange={setIsRoleDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Change User Role</DialogTitle>
            <DialogDescription>
              Select a new role for this user. This will update their permissions immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
             <Select
                value={selectedRole}
                onValueChange={(value) => setSelectedRole(value as UserRole)}
                disabled={isPending}
              >
              <SelectTrigger>
                <SelectValue placeholder="Select a role" />
              </SelectTrigger>
              <SelectContent>
                {roles.map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setIsRoleDialogOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={onUpdateRole} disabled={isPending || selectedRole === currentRole}>
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <DropdownMenu modal={false}>
        <DropdownMenuTrigger asChild disabled={isPending}>
          {children}
        </DropdownMenuTrigger>

        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem
            onClick={() => setIsRoleDialogOpen(true)}
            disabled={isPending}
            className="p-[10px] font-medium"
          >
            <Shield className="mr-2 size-4 stroke-2" />
            Change Role
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={onUpdateStatus}
            disabled={isPending}
            className="p-[10px] font-medium text-amber-700 focus:text-amber-700"
          >
            <Trash className="mr-2 size-4 stroke-2" />
            {suspended ? 'Activate User' : 'Suspend User'}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
};
