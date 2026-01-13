'use client';

import {
  ColumnDef,
  ColumnFiltersState,
  SortingState,
  VisibilityState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table';
import { ChevronDown, Loader2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuCheckboxItem, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useGetRoutes } from '@/features/routes/api/use-get-routes';
import { useDebounce } from '@/hooks/use-debounce';

import { DELIVERY_DAYS } from '../constants';
import { useCustomerFilters } from '../hooks/use-customer-filters';

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

export function CustomerTable<TData, TValue>({ columns, data, isLoading, pagination }: DataTableProps<TData, TValue>) {
  const [sorting, setSorting] = React.useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([]);
  const [columnVisibility, setColumnVisibility] = React.useState<VisibilityState>({});
  const [rowSelection, setRowSelection] = React.useState({});

  // Server-side search state
  const [filters, setFilters] = useCustomerFilters();
  const [searchValue, setSearchValue] = React.useState(filters.search || '');
  const debouncedSearch = useDebounce(searchValue, 500);

  const { data: routesData, isLoading: isLoadingRoutes } = useGetRoutes();
  const routes = routesData?.routes || [];

  React.useEffect(() => {
    // Only update if the value actually changed to avoid infinite loops or unnecessary updates
    if (debouncedSearch !== filters.search) {
      setFilters({ search: debouncedSearch || null, page: 1 });
    }
  }, [debouncedSearch, filters.search, setFilters]);

  const table = useReactTable({
    data,
    columns,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
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
    manualPagination: true, // We are doing server-side pagination essentially by fetching data matching params
    // But table.getPaginationRowModel() handles client side pagination of the *fetched* data.
    // If we want true server side pagination logic in the table component (next/prev buttons affecting URL),
    // we need to override the pagination state and onPaginationChange.
    // For now, let's keep it simple: we search via URL, we display what we got.
    // Ideally we should pass 'pageCount' and 'onPaginationChange' to the table.
  });

  return (
    <div className="w-full">
      <div className="flex flex-col lg:flex-row items-start lg:items-center gap-2 py-4">
        <Input
          placeholder="Search customers..."
          value={searchValue}
          onChange={(event) => setSearchValue(event.target.value)}
          className="w-full lg:max-w-sm"
        />
        <div className="flex w-full lg:w-auto gap-2">
          <div className="flex-1 min-w-[130px]">
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
          <div className="flex-1 min-w-[130px]">
            <Select
              value={filters.type || 'all'}
              onValueChange={(val) => setFilters({ type: val === 'all' ? null : val, page: 1 })}
              disabled={isLoadingRoutes}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {/* {routes.map((route: any) => ( */}
                <SelectItem key={"RESIDENTIAL"} value={"RESIDENTIAL"}>
                  RESIDENTIAL
                </SelectItem>
                <SelectItem key={"COMMERCIAL"} value={"COMMERCIAL"}>
                  COMMERCIAL
                </SelectItem>
                <SelectItem key={"CORPORATE"} value={"CORPORATE"}>
                  CORPORATE
                </SelectItem>
                {/* ))} */}
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[130px]">
            <Select
              value={filters.deliveryDay?.toString() || 'all'}
              onValueChange={(val) => setFilters({ deliveryDay: val === 'all' ? null : parseInt(val), page: 1 })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Filter by Day" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Days</SelectItem>
                {DELIVERY_DAYS.map((day) => (
                  <SelectItem key={day.value} value={day.value.toString()}>
                    {day.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" className="ml-auto w-full lg:w-auto mt-2 lg:mt-0">
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
      <div className="rounded-md border overflow-x-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const isSticky = header.column.columnDef.meta?.sticky;
                  return (
                    <TableHead
                      key={header.id}
                      className={isSticky ? 'sticky right-0 bg-background shadow-[-4px_0_8px_-2px_rgba(0,0,0,0.1)] z-10' : ''}
                    >
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
      <div className="glass-card sticky bottom-4 z-20 border-white/40 flex flex-col sm:flex-row items-center justify-end gap-2 px-2 py-1 mt-2">
        <div className="flex-1 text-sm text-muted-foreground w-full text-center sm:text-left">
          {pagination ? (
            <>
              Showing {((pagination.page - 1) * pagination.limit) + 1} to {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} customers
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
          ) : (
            <>
              {table.getFilteredSelectedRowModel().rows.length} of {table.getFilteredRowModel().rows.length} row(s) selected.
            </>
          )}
        </div>
        <div className="flex items-center space-x-2">
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
