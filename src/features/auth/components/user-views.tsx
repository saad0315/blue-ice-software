'use client';

import { UserRole } from '@prisma/client';
import { Loader2 } from 'lucide-react';
import { useQueryState } from 'nuqs';

import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DottedSeparator } from '@/components/dotted-separator';
import { Tabs, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';

import { useGetUsers } from '../api/use-getUsers';
import { useUserFilters } from '../hooks/user-filters';
import { columns } from './columns';
import { DataSearch } from './data-search';
import { DataTable } from './data-table';

type PaginationType = {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
};

export const UserView = () => {
  const [view, setView] = useQueryState('task-view', {
    defaultValue: 'table',
  });
  const [{ search, suspended, role, page, limit }, setFilters] = useUserFilters();
  const { data, isLoading: isLoadingTasks } = useGetUsers({
    search,
    suspended,
    role,
    page,
    limit,
  });

  const onStatusChange = (value: string) => {
    if (value === 'all') {
      setFilters({ suspended: null, page: 1 });
    } else if (value === 'active') {
      setFilters({ suspended: false, page: 1 });
    } else if (value === 'suspended') {
      setFilters({ suspended: true, page: 1 });
    }
  };

  const users = data?.data ?? [];
  const pagination = data?.pagination as PaginationType | undefined;

  return (
    <Tabs defaultValue={view} onValueChange={setView} className="w-full ">
      <div className="flex h-full flex-col p-4">
        <div className="flex flex-col gap-2 py-4 lg:flex-row lg:flex-wrap lg:items-center">
          <div className="flex flex-row overflow-x-auto gap-2 w-full lg:w-auto lg:overflow-visible pb-2 lg:pb-0 items-center">
            <DataSearch />
            <div className="min-w-[180px] lg:w-[180px]">
              <Select
                defaultValue="all"
                onValueChange={onStatusChange}
                value={suspended === null ? 'all' : suspended ? 'suspended' : 'active'}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Users</SelectItem>
                  <SelectItem value="active">Active Only</SelectItem>
                  <SelectItem value="suspended">Suspended Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="min-w-[180px] lg:w-[180px]">
              <Select
                value={role || 'all'}
                onValueChange={(value) => setFilters({ role: value === 'all' ? null : value, page: 1 })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Filter by role" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Roles</SelectItem>
                  <SelectItem value={UserRole.DRIVER}>Driver</SelectItem>
                  <SelectItem value={UserRole.CUSTOMER}>Customer</SelectItem>
                  <SelectItem value={UserRole.INVENTORY_MGR}>Inventory Manager</SelectItem>
                  <SelectItem value={UserRole.ADMIN}>Admin</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* <DottedSeparator className="my-4" /> */}
        {isLoadingTasks ? (
          <div className="flex h-[200px] w-full flex-col items-center justify-center rounded-lg border">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <TabsContent value="table" className="mt-0">
              <DataTable columns={columns} data={users} />

              <div className="glass-card sticky bottom-4 z-20 border-white/40 flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-2 mt-2">
                <div className="flex-1 text-sm text-muted-foreground w-full text-center sm:text-left">
                  {pagination && (
                    <>
                      Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} Users
                      <div className="inline-block ml-4">
                        <Select
                          value={limit?.toString() || '10'}
                          onValueChange={(val) => setFilters({ limit: parseInt(val), page: 1 })}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Per page" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="10">10 per page</SelectItem>
                            <SelectItem value="20">20 per page</SelectItem>
                            <SelectItem value="50">50 per page</SelectItem>
                            <SelectItem value="100">100 per page</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex items-center gap-2 w-full sm:w-auto justify-center sm:justify-end">
                  {pagination && (
                    <span className="text-sm text-muted-foreground">
                      Page {pagination.page} of {pagination.totalPages}
                    </span>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters({ page: (page || 1) - 1 })}
                    disabled={!pagination || pagination.page <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters({ page: (page || 1) + 1 })}
                    disabled={!pagination || pagination.page >= pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </TabsContent>

            {/* <TabsContent value="kanban" className="mt-0">
              <DataKanban data={tasks?.documents ?? []} onChange={onKanbanChange} />
            </TabsContent>

            <TabsContent value="calendar" className="mt-0 h-full pb-4">
              <DataCalendar data={tasks?.documents ?? []} />
            </TabsContent> */}
          </>
        )}
      </div>
    </Tabs>
  );
};
