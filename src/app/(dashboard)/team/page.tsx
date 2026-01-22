import { UserRole } from '@prisma/client';
import { redirect } from 'next/navigation';

import { getCurrent } from '@/features/auth/queries';
import { UserView } from '@/features/auth/components/user-views';

const TeamPage = async () => {
  const user = await getCurrent();

  if (!user) redirect('/sign-in');

  if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.ADMIN) {
    redirect('/');
  }

  return (
    <div className="flex w-full flex-col gap-y-4">
      <div className="flex items-center justify-between">
        <h1 className="main-heading">Team Management</h1>
      </div>
      <UserView />
    </div>
  );
};

export default TeamPage;
