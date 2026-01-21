'use client';

import { UserRole } from '@prisma/client';
import { Box, DollarSign, LayoutDashboard, Map, MapPin, Package, Receipt, Settings, ShoppingCart, Truck, Users } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { useCurrent } from '@/features/auth/api/use-current';
import { cn } from '@/lib/utils';

const routes = [
  {
    label: 'Dashboard',
    href: '',
    icon: LayoutDashboard,
    activeIcon: LayoutDashboard,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INVENTORY_MGR],
  },
  {
    label: 'Customers',
    href: 'customers',
    icon: Users,
    activeIcon: Users,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INVENTORY_MGR],
  },
  {
    label: 'Orders',
    href: 'orders',
    icon: ShoppingCart,
    activeIcon: ShoppingCart,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INVENTORY_MGR],
  },
  {
    label: 'Products',
    href: 'products',
    icon: Package,
    activeIcon: Package,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INVENTORY_MGR],
  },
  {
    label: 'Inventory',
    href: 'inventory',
    icon: Box,
    activeIcon: Box,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INVENTORY_MGR],
  },
  {
    label: 'Expenses',
    href: 'expenses',
    icon: Receipt,
    activeIcon: Receipt,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN, UserRole.INVENTORY_MGR],
  },
  {
    label: 'Cash Management',
    href: 'cash-management',
    icon: DollarSign,
    activeIcon: DollarSign,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    label: 'Drivers',
    href: 'drivers',
    icon: Truck,
    activeIcon: Truck,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    label: 'Routes',
    href: 'routes',
    icon: Map,
    activeIcon: Map,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    label: 'Live Tracking',
    href: 'tracking',
    icon: MapPin,
    activeIcon: MapPin,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
  {
    label: 'Team',
    href: 'team',
    icon: Users,
    activeIcon: Users,
    roles: [UserRole.SUPER_ADMIN, UserRole.ADMIN],
  },
];

export const Navigation = () => {
  const pathname = usePathname();
  const { data: user } = useCurrent();

  if (!user) return null;

  return (
    <ul className="flex flex-col">
      {routes.map((route) => {
        const allowedRoles: UserRole[] = route.roles;
        if (!allowedRoles.includes(user.role)) return null;

        const fullHref = `/${route.href}`;
        const isActive = pathname === fullHref;
        const Icon = isActive ? route.activeIcon : route.icon;

        return (
          <li key={fullHref}>
            <Link
              href={fullHref}
              className={cn(
                'flex items-center gap-2.5 rounded-md p-2.5 font-medium text-muted-foreground transition hover:text-primary',
                isActive && 'bg-background text-primary shadow-sm hover:opacity-100',
              )}
            >
              <Icon className="size-5 text-muted-foreground" />
              {route.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
};
