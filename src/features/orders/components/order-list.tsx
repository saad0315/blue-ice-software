'use client';

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { format } from 'date-fns';
import { ChevronDown, Loader2 } from 'lucide-react';
import { Calendar as CalendarIcon } from 'lucide-react';
import * as React from 'react';
import { DateRange } from 'react-day-picker';

import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGetDrivers } from '@/features/drivers/api/use-get-drivers';
import { useGetRoutes } from '@/features/routes/api/use-get-routes';
import { useDebounce } from '@/hooks/use-debounce';
import { cn } from '@/lib/utils';

import { useOrderFilters } from '../hooks/use-order-filters';
import { AssignDriverModal } from './assign-driver-modal';
import { GenerateOrdersModal } from './generate-orders-modal';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  isLoading?: boolean;
  pagination?: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export function OrderTable<TData extends { id: string }, TValue>({ columns, data, isLoading, pagination }: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});
  const [isAssignOpen, setIsAssignOpen] = React.useState(false);
  const [isGenerateOpen, setIsGenerateOpen] = React.useState(false);

  const [filters, setFilters] = useOrderFilters();
  const [searchValue, setSearchValue] = React.useState(filters.search || '');
  const debouncedSearch = useDebounce(searchValue, 500);

  const { data: routesData, isLoading: isLoadingRoutes } = useGetRoutes();
  const routes = routesData?.routes || [];

  const { data: driversData, isLoading: isLoadingDrivers } = useGetDrivers({ limit: 100 });
  // @ts-ignore
  const drivers = driversData?.drivers || [];

  // Local state for calendar selection to handle intermediate "from-only" state
  const [localDateRange, setLocalDateRange] = React.useState<DateRange | undefined>(
    filters.from && filters.to
      ? {
        from: new Date(filters.from),
        to: new Date(filters.to),
      }
      : undefined,
  );

  React.useEffect(() => {
    if (debouncedSearch !== filters.search) {
      setFilters({ search: debouncedSearch || null, page: 1 });
    }
  }, [debouncedSearch, filters.search, setFilters]);

  const setDateRange = (range: DateRange | undefined) => {
    setLocalDateRange(range); // Update UI immediately showing selection

    if (range?.from && range?.to) {
      setFilters({
        from: format(range.from, 'yyyy-MM-dd'),
        to: format(range.to, 'yyyy-MM-dd'),
        page: 1,
      });
    } else if (!range) {
      setFilters({ from: null, to: null, page: 1 });
    }
  };

  const table = useReactTable({
    data,
    columns,
    getRowId: (row) => row.id,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    onColumnVisibilityChange: setColumnVisibility,
    onRowSelectionChange: setRowSelection,
    state: {
      sorting,
      columnFilters,
      columnVisibility,
      rowSelection,
    },
  });

  const selectedIds = Object.keys(rowSelection);

  return (
    <div className="w-full">
      <GenerateOrdersModal open={isGenerateOpen} onOpenChange={setIsGenerateOpen} />
      <AssignDriverModal open={isAssignOpen} onOpenChange={setIsAssignOpen} orderIds={selectedIds} onSuccess={() => setRowSelection({})} />
      {selectedIds.length > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-md bg-muted p-2">
          <span className="text-sm font-medium">{selectedIds.length} orders selected</span>
          <Button size="sm" onClick={() => setIsAssignOpen(true)}>
            Assign Driver
          </Button>
        </div>
      )}
      <div className="flex flex-col gap-2 py-4 lg:flex-row lg:flex-wrap lg:items-center">
        {/* Filters - Horizontal scrolling on mobile */}
        <div className="flex flex-row overflow-x-auto gap-2 w-full lg:w-auto lg:overflow-visible pb-2 lg:pb-0 items-center">
          <Input
            placeholder="Search orders..."
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            className="min-w-[200px] lg:max-w-[200px]"
          />
          <div className="min-w-[180px] lg:w-[180px]">
            <Select
              value={filters.routeId || 'all'}
              onValueChange={(val) => setFilters({ routeId: val === 'all' ? null : val, page: 1 })}
              disabled={isLoadingRoutes}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by Route" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Routes</SelectItem>
                {routes.map((route: any) => (
                  <SelectItem key={route.id} value={route.id}>
                    {route.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[180px] lg:w-[180px]">
            <Select
              value={filters.status || 'all'}
              onValueChange={(val) =>
                setFilters({
                  status: val === 'all' ? null : val === 'UNASSIGNED' ? null : val,
                  driverId: val === 'UNASSIGNED' ? 'unassigned' : filters.driverId, // Keep existing driver if not unassigned
                  page: 1,
                })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="SCHEDULED">Scheduled</SelectItem>
                <SelectItem value="PENDING">Pending</SelectItem>
                <SelectItem value="COMPLETED">Completed</SelectItem>
                <SelectItem value="CANCELLED">Cancelled</SelectItem>
                <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[180px] lg:w-[180px]">
            <Select
              value={filters.driverId || 'all'}
              onValueChange={(val) => setFilters({ driverId: val === 'all' ? null : val, page: 1 })}
              disabled={isLoadingDrivers}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by Driver" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Drivers</SelectItem>
                <SelectItem value="unassigned">Unassigned</SelectItem>
                {drivers.map((driver: any) => (
                  <SelectItem key={driver.id} value={driver.id}>
                    {driver.user.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[180px] lg:w-[180px]">
            <Select
              value={filters.customerType || 'all'}
              onValueChange={(val) => setFilters({ customerType: val === 'all' ? null : val, page: 1 })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Customer Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="RESIDENTIAL">Residential</SelectItem>
                <SelectItem value="COMMERCIAL">Commercial</SelectItem>
                <SelectItem value="CORPORATE">Corporate</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="min-w-[260px] lg:w-auto">
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  id="date"
                  variant={'outline'}
                  className={cn('w-full justify-start text-left font-normal', !localDateRange && 'text-muted-foreground')}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {localDateRange?.from ? (
                    localDateRange.to ? (
                      <>
                        {format(localDateRange.from, 'LLL dd, y')} - {format(localDateRange.to, 'LLL dd, y')}
                      </>
                    ) : (
                      format(localDateRange.from, 'LLL dd, y')
                    )
                  ) : (
                    <span>Pick a date range</span>
                  )}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  initialFocus
                  mode="range"
                  defaultMonth={localDateRange?.from}
                  selected={localDateRange}
                  onSelect={setDateRange}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        {/* Action Buttons - Flex row justify between on mobile */}
        <div className="flex flex-row justify-between items-center w-full lg:w-auto lg:ml-auto gap-2">
          <Button variant="outline" className="flex-1 lg:flex-none lg:w-auto" onClick={() => setIsGenerateOpen(true)}>
            Generate Orders
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex-1 lg:flex-none lg:ml-auto lg:w-auto">
                Columns <ChevronDown className="ml-2 h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {table
                .getAllColumns()
                .filter((column) => column.getCanHide())
                .map((column) => {
                  return (
                    <DropdownMenuCheckboxItem
                      key={column.id}
                      className="capitalize"
                      checked={column.getIsVisible()}
                      onCheckedChange={(value) => column.toggleVisibility(!!value)}
                    >
                      {column.id}
                    </DropdownMenuCheckboxItem>
                  );
                })}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isSticky = header.column.columnDef.meta?.sticky;
                  return (
                    <TableHead key={header.id} className={isSticky ? 'sticky right-0 bg-background shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)] z-10' : ''}>
                      {header.isPlaceholder ? null : flexRender(header.column.columnDef.header, header.getContext())}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  <div className="flex items-center justify-center">
                    <Loader2 className="mr-2 h-6 w-6 animate-spin" />
                    Loading...
                  </div>
                </TableCell>
              </TableRow>
            ) : table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id} data-state={row.getIsSelected() && 'selected'}>
                  {/* {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</TableCell>
                  ))} */}
                  {row.getVisibleCells().map((cell) => {
                    const isSticky = cell.column.columnDef.meta?.sticky;
                    return (
                      <TableCell
                        key={cell.id}
                        className={isSticky ? 'sticky right-0 bg-background shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)] z-10' : ''}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    );
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell colSpan={columns.length} className="h-24 text-center">
                  No results.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="glass-card sticky bottom-4 z-20 border-white/40 flex flex-col sm:flex-row items-center justify-between gap-4 px-4 py-2 mt-2">
        <div className="flex-1 text-sm text-muted-foreground w-full text-center sm:text-left">
          {selectedIds.length > 0 && (
            <span>
              {selectedIds.length} of {data.length} row(s) selected.
            </span>
          )}
          {pagination && (
            // <span className="ml-4">
            //   Page {pagination.page} of {pagination.totalPages} ({pagination.total} total orders)
            // </span>
            <>
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} Orders
              <div className="inline-block ml-4">
                <Select
                  value={filters.limit?.toString() || '20'}
                  onValueChange={(val) => setFilters({ limit: parseInt(val), page: 1 })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Per page" />
                  </SelectTrigger>
                  <SelectContent>
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
            onClick={() => setFilters({ page: filters.page - 1 })}
            disabled={!pagination || pagination.page <= 1}
          >
            Previous
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFilters({ page: filters.page + 1 })}
            disabled={!pagination || pagination.page >= pagination.totalPages}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
}
