'use client';

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

export const UserView = () => {
  const [view, setView] = useQueryState('task-view', {
    defaultValue: 'table',
  });
  const [{ search, suspended, page, limit }, setFilters] = useUserFilters();
  const { data, isLoading: isLoadingTasks } = useGetUsers({
    search,
    suspended,
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
  const pagination = data?.pagination;

  return (
    <Tabs defaultValue={view} onValueChange={setView} className="w-full flex-1 rounded-lg border">
      <div className="flex h-full flex-col overflow-auto p-4">
        {/* <div className="flex flex-col items-center justify-between gap-y-2 lg:flex-row">
          <TabsList className="w-full lg:w-auto">
            <TabsTrigger className="h-8 w-full lg:w-auto" value="table">
              Table
            </TabsTrigger>

            <TabsTrigger className="h-8 w-full lg:w-auto" value="kanban">
              Kanban
            </TabsTrigger>

            <TabsTrigger className="h-8 w-full lg:w-auto" value="calendar">
              Calendar
            </TabsTrigger>
          </TabsList>

          <Button onClick={() => open()} size="sm" className="w-full lg:w-auto">
            <PlusIcon className="size-4" />
            New
          </Button>
        </div> */}
        {/* <DottedSeparator className="my-4" /> */}

        <div className="flex flex-col justify-end gap-2 xl:flex-row xl:items-center">
          <Select
            defaultValue="all"
            onValueChange={onStatusChange}
            value={suspended === null ? 'all' : suspended ? 'suspended' : 'active'}
          >
            <SelectTrigger className="w-full lg:w-[200px]">
              <SelectValue placeholder="Filter by status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Users</SelectItem>
              <SelectItem value="active">Active Only</SelectItem>
              <SelectItem value="suspended">Suspended Only</SelectItem>
            </SelectContent>
          </Select>

          <DataSearch />
        </div>

        <DottedSeparator className="my-4" />
        {isLoadingTasks ? (
          <div className="flex h-[200px] w-full flex-col items-center justify-center rounded-lg border">
            <Loader2 className="size-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <TabsContent value="table" className="mt-0">
              <DataTable columns={columns} data={users} />

              {pagination && (
                <div className="flex items-center justify-end gap-x-2 py-4">
                  <div className="text-sm text-muted-foreground">
                    Page {pagination.page} of {pagination.totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters({ page: (page || 1) - 1 })}
                    disabled={(page || 1) <= 1}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setFilters({ page: (page || 1) + 1 })}
                    disabled={(page || 1) >= pagination.totalPages}
                  >
                    Next
                  </Button>
                </div>
              )}
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
