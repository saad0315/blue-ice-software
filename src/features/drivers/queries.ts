import { ExpenseStatus, OrderStatus, Prisma, UserRole } from '@prisma/client';

import { hashPassword } from '@/lib/authenticate';
import { db } from '@/lib/db';

export async function createDriver(data: {
  name: string;
  phoneNumber: string;
  email: string | null;
  password: string;
  vehicleNo?: string | null;
  licenseNo?: string | null;
}) {
  const { name, phoneNumber, email, password, vehicleNo, licenseNo } = data;
  const hashedPassword = await hashPassword(password);

  return await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        name,
        phoneNumber,
        email,
        password: hashedPassword,
        role: UserRole.DRIVER,
      },
    });

    const driverProfile = await tx.driverProfile.create({
      data: {
        userId: user.id,
        vehicleNo,
        licenseNo,
      },
      include: {
        user: true,
      },
    });

    return driverProfile;
  });
}

export async function getDrivers(params: { search?: string; page: number; limit: number; date?: Date }) {
  const { search, page, limit, date } = params;
  const skip = (page - 1) * limit;

  const where: Prisma.DriverProfileWhereInput = search
    ? {
      OR: [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { phoneNumber: { contains: search } } },
        { vehicleNo: { contains: search, mode: 'insensitive' } },
      ],
    }
    : {};

  const startOfDay = date ? new Date(date) : new Date();
  startOfDay.setUTCHours(0, 0, 0, 0);
  const endOfDay = date ? new Date(date) : new Date();
  endOfDay.setUTCHours(23, 59, 59, 999);

  const [drivers, total, cashCollectedStats] = await Promise.all([
    db.driverProfile.findMany({
      where,
      skip,
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            isActive: true,
            suspended: true,
          },
        },
      },
      orderBy: {
        user: {
          name: 'asc',
        },
      },
    }),
    db.driverProfile.count({ where }),
    // Single query to get cash collected for all drivers at once
    db.order.groupBy({
      by: ['driverId'],
      where: {
        scheduledDate: { gte: startOfDay, lte: endOfDay },
        status: OrderStatus.COMPLETED,
        driverId: { not: null },
      },
      _sum: {
        cashCollected: true,
      },
    }),
  ]);

  // Create a map of driverId -> cashCollected for O(1) lookup
  const cashCollectedMap = new Map(cashCollectedStats.map((stat) => [stat.driverId, stat._sum.cashCollected?.toString() || '0']));

  // Merge the stats with driver data
  const driversWithStats = drivers.map((driver) => ({
    ...driver,
    cashCollectedToday: cashCollectedMap.get(driver.id) || '0',
  }));

  return {
    drivers: driversWithStats,
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}

// --------------------------------------------------------
// LEDGER FUNCTIONS (Added for Driver Wallet)
// --------------------------------------------------------

export async function getDriverLedger(driverId: string) {
  const [ledgerEntries, balance] = await Promise.all([
    // Fetch recent ledger transactions
    db.driverLedger.findMany({
      where: { driverId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),

    // Calculate current running balance (sum of all amounts)
    // A negative sum means Debit (Driver owes company)
    // A positive sum means Credit (Company owes driver)
    db.driverLedger.aggregate({
      where: { driverId },
      _sum: { amount: true },
    }),
  ]);

  return {
    transactions: ledgerEntries.map((entry) => ({
      ...entry,
      amount: entry.amount.toString(),
      balanceAfter: entry.balanceAfter.toString(),
    })),
    currentBalance: balance._sum.amount?.toString() || '0',
  };
}

export async function getDriver(id: string) {
  return await db.driverProfile.findUnique({
    where: { id },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          isActive: true,
          suspended: true,
        },
      },
    },
  });
}

export async function getDriverByUserId(userId: string) {
  return await db.driverProfile.findUnique({
    where: { userId },
    include: {
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          isActive: true,
          suspended: true,
        },
      },
    },
  });
}

export async function updateDriver(
  id: string,
  data: Partial<{
    name: string;
    phoneNumber: string;
    email: string | null;
    vehicleNo: string | null;
    licenseNo: string | null;
  }>,
) {
  const { name, phoneNumber, email, ...profileData } = data;

  return await db.$transaction(async (tx) => {
    const profile = await tx.driverProfile.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!profile) throw new Error('Driver not found');

    // Update User
    if (name || phoneNumber || email !== undefined) {
      await tx.user.update({
        where: { id: profile.userId },
        data: {
          ...(name && { name }),
          ...(phoneNumber && { phoneNumber }),
          ...(email !== undefined && { email }),
        },
      });
    }

    // Update Profile
    const updatedProfile = await tx.driverProfile.update({
      where: { id },
      data: profileData,
      include: {
        user: true,
      },
    });

    return updatedProfile;
  });
}

export async function deleteDriver(id: string) {
  return await db.$transaction(async (tx) => {
    const profile = await tx.driverProfile.findUnique({
      where: { id },
      select: { userId: true },
    });

    if (!profile) throw new Error('Driver not found');

    await tx.driverProfile.delete({
      where: { id },
    });

    await tx.user.delete({
      where: { id: profile.userId },
    });

    return true;
  });
}

export async function getDriverDetailStats(driverId: string, params?: { startDate?: Date; endDate?: Date; date?: Date }) {
  const { startDate, endDate, date } = params || {};

  // Default to current month if no dates provided
  const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate || new Date();
  end.setUTCHours(23, 59, 59, 999);

  const whereCondition: Prisma.OrderWhereInput = {
    driverId,
    scheduledDate: { gte: start, lte: end },
  };

  const completedWhereCondition: Prisma.OrderWhereInput = {
    ...whereCondition,
    status: OrderStatus.COMPLETED,
  };

  // Fetch all statistics in parallel
  const [
    driver,
    totalOrders,
    completedOrders,
    pendingOrders,
    cancelledOrders,
    rescheduledOrders,
    financialStats,
    bottleStats,
    recentOrders,
    allTimeStats,
    todayStats,
    expenseStats,
  ] = await Promise.all([
    // Driver basic info
    db.driverProfile.findUnique({
      where: { id: driverId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            phoneNumber: true,
            isActive: true,
            suspended: true,
            createdAt: true,
          },
        },
      },
    }),

    // Order counts for selected period
    db.order.count({ where: whereCondition }),
    db.order.count({ where: completedWhereCondition }),
    db.order.count({ where: { ...whereCondition, status: { in: [OrderStatus.SCHEDULED, OrderStatus.IN_PROGRESS] } } }),
    db.order.count({ where: { ...whereCondition, status: OrderStatus.CANCELLED } }),
    db.order.count({ where: { ...whereCondition, status: OrderStatus.RESCHEDULED } }),

    // Financial statistics
    db.order.aggregate({
      where: completedWhereCondition,
      _sum: {
        cashCollected: true,
        totalAmount: true,
      },
      _avg: {
        cashCollected: true,
      },
    }),

    // Bottle exchange statistics
    db.orderItem.aggregate({
      where: {
        order: completedWhereCondition,
      },
      _sum: {
        filledGiven: true,
        emptyTaken: true,
        quantity: true,
      },
    }),

    // Recent completed orders
    db.order.findMany({
      where: completedWhereCondition,
      include: {
        customer: {
          include: {
            user: {
              select: {
                name: true,
                phoneNumber: true,
              },
            },
          },
        },
        orderItems: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: { deliveredAt: 'desc' },
      take: 10,
    }),

    // All-time statistics
    db.order.aggregate({
      where: { driverId, status: OrderStatus.COMPLETED },
      _count: { id: true },
      _sum: {
        cashCollected: true,
        totalAmount: true,
      },
    }),

    // Today's statistics
    db.order.aggregate({
      where: {
        driverId,
        status: OrderStatus.COMPLETED,
        scheduledDate: {
          gte: date ? new Date(new Date(date).setUTCHours(0, 0, 0, 0)) : new Date(new Date().setUTCHours(0, 0, 0, 0)),
          lte: date ? new Date(new Date(date).setUTCHours(23, 59, 59, 999)) : new Date(new Date().setUTCHours(23, 59, 59, 999)),
        },
      },
      _count: { id: true },
      _sum: {
        cashCollected: true,
      },
    }),

    // Expense Statistics
    db.expense.groupBy({
      by: ['status'],
      where: {
        driverId,
        date: { gte: start, lte: end },
      },
      _sum: {
        amount: true,
      },
      _count: {
        id: true,
      },
    }),
  ]);

  if (!driver) {
    throw new Error('Driver not found');
  }

  return {
    driver,
    period: {
      startDate: start,
      endDate: end,
    },
    summary: {
      totalOrders,
      completedOrders,
      pendingOrders,
      cancelledOrders,
      rescheduledOrders,
      completionRate: totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0,
    },
    financial: {
      totalCashCollected: financialStats._sum.cashCollected?.toString() || '0',
      totalRevenue: financialStats._sum.totalAmount?.toString() || '0',
      averageCashPerDelivery: financialStats._avg.cashCollected?.toString() || '0',
    },
    bottles: {
      totalFilledGiven: bottleStats._sum.filledGiven || 0,
      totalEmptyTaken: bottleStats._sum.emptyTaken || 0,
      totalQuantityOrdered: bottleStats._sum.quantity || 0,
      exchangeRate:
        bottleStats._sum.filledGiven && bottleStats._sum.emptyTaken
          ? Math.round((bottleStats._sum.emptyTaken / bottleStats._sum.filledGiven) * 100)
          : 0,
    },
    recentOrders: recentOrders.map((order) => ({
      id: order.id,
      readableId: order.readableId,
      customerName: order.customer.user.name,
      customerPhone: order.customer.user.phoneNumber,
      totalAmount: order.totalAmount.toString(),
      cashCollected: order.cashCollected.toString(),
      deliveredAt: order.deliveredAt,
      items: order.orderItems.map((item) => ({
        productName: item.product.name,
        quantity: item.quantity,
        filledGiven: item.filledGiven,
        emptyTaken: item.emptyTaken,
      })),
    })),
    allTime: {
      totalDeliveries: allTimeStats._count.id,
      totalCashCollected: allTimeStats._sum.cashCollected?.toString() || '0',
      totalRevenue: allTimeStats._sum.totalAmount?.toString() || '0',
    },
    today: {
      deliveries: todayStats._count.id,
      cashCollected: todayStats._sum.cashCollected?.toString() || '0',
    },
    expenses: {
      total: expenseStats.reduce((acc, curr) => acc + (curr._sum.amount?.toNumber() || 0), 0).toString(),
      breakdown: expenseStats.map((stat) => ({
        status: stat.status,
        count: stat._count.id,
        amount: stat._sum.amount?.toString() || '0',
      })),
      approved: expenseStats.find((s) => s.status === 'APPROVED')?._sum.amount?.toString() || '0',
      pending: expenseStats.find((s) => s.status === 'PENDING')?._sum.amount?.toString() || '0',
      rejected: expenseStats.find((s) => s.status === 'REJECTED')?._sum.amount?.toString() || '0',
    },
  };
}

export async function getDriverDeliveries(
  driverId: string,
  params: {
    page: number;
    limit: number;
    startDate?: Date;
    endDate?: Date;
    status?: OrderStatus | 'ALL';
  }
) {
  const { page, limit, startDate, endDate, status = OrderStatus.COMPLETED } = params;
  const skip = (page - 1) * limit;

  // Default to current month if no dates provided
  const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1);
  const end = endDate || new Date();
  end.setUTCHours(23, 59, 59, 999);

  const where: Prisma.OrderWhereInput = {
    driverId,
    ...(status !== 'ALL' && { status }),
    scheduledDate: { gte: start, lte: end },
  };

  const [orders, total] = await Promise.all([
    db.order.findMany({
      where,
      skip,
      take: limit,
      include: {
        customer: {
          include: {
            user: {
              select: {
                name: true,
                phoneNumber: true,
              },
            },
          },
        },
        orderItems: {
          include: {
            product: {
              select: {
                name: true,
              },
            },
          },
        },
      },
      orderBy: [{ scheduledDate: 'desc' }, { deliveredAt: 'desc' }],
    }),
    db.order.count({ where }),
  ]);

  return {
    deliveries: orders.map((order) => ({
      id: order.id,
      readableId: order.readableId,
      status: order.status,
      customerName: order.customer.user.name,
      customerPhone: order.customer.user.phoneNumber,
      totalAmount: order.totalAmount.toString(),
      cashCollected: order.cashCollected.toString(),
      scheduledDate: order.scheduledDate,
      deliveredAt: order.deliveredAt,
      cancellationReason: order.cancellationReason,
      items: order.orderItems.map((item) => ({
        productName: item.product.name,
        quantity: item.quantity,
        filledGiven: item.filledGiven,
        emptyTaken: item.emptyTaken,
      })),
    })),
    pagination: {
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    },
  };
}
