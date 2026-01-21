import type { ColumnDef } from '@tanstack/react-table';
import { ArrowUpDown, MoreVertical } from 'lucide-react';

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn, getAvatarColor, getImageUrl } from '@/lib/utils';

import { UserActions } from './user-actiion';

export const columns: ColumnDef<any>[] = [
  {
    accessorKey: 'name',
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Name
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const name = row.original.name;
      const imageUrl = row.original.imageUrl; // Fetching the image URL if available
      return (
        <div className="flex items-center space-x-2">
          {/* Display Avatar if imageUrl is present, otherwise show default avatar */}
          {/* <Avatar className="h-10 w-10">
            <AvatarImage src={getImageUrl(imageUrl)} alt={''} />
            <AvatarFallback>{name}</AvatarFallback>
          </Avatar> */}
          <Avatar className="size-10 border border-neutral-300 transition hover:opacity-75">
            <AvatarImage src={getImageUrl(imageUrl)} alt={''} className="object-cover" />
            <AvatarFallback className={cn(`flex items-center justify-center font-medium`, getAvatarColor(name))}>
              {name.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <p className="line-clamp-1 capitalize">{name}</p>
        </div>
      );
    },
  },
  {
    accessorKey: 'email',
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Email
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const email = row.original.email;
      return <p className="line-clamp-1">{email}</p>;
    },
  },
  {
    accessorKey: 'gender',
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Phone Number
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const phoneNumber = row.original.phoneNumber;
      return <p className="line-clamp-1">{phoneNumber}</p>;
    },
  },
  {
    accessorKey: 'role',
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Role
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const role = row.original.role;
      return <Badge variant="outline">{role}</Badge>;
    },
  },
  {
    accessorKey: 'suspended',
    header: ({ column }) => {
      return (
        <Button variant="ghost" onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}>
          Status
          <ArrowUpDown className="ml-2 h-4 w-4" />
        </Button>
      );
    },
    cell: ({ row }) => {
      const isActive = row.original.suspended;
      return <Badge variant={isActive ? 'destructive' : 'default'}>{isActive ? 'Suspended' : 'Active'}</Badge>;
    },
  },
  {
    id: 'actions',
    cell: ({ row }) => {
      const { id, suspended, role } = row.original;

      return (
        <UserActions id={id} suspended={suspended} currentRole={role}>
          <Button variant="ghost" className="size-8 p-0">
            <MoreVertical className="size-4" />
          </Button>
        </UserActions>
      );
    },
  },
];
