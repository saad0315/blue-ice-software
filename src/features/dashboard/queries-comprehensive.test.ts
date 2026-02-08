import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mockDeep, mockReset } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { getComprehensiveDashboardData } from './queries-comprehensive';

// Mock the db module
vi.mock('@/lib/db', () => {
  const prismaMock = mockDeep<PrismaClient>();
  return { db: prismaMock };
});

import { db } from '@/lib/db';

describe('getComprehensiveDashboardData', () => {
  beforeEach(() => {
    mockReset(db);
  });

  it('should return correct dashboard data and utilize derived values', async () => {
    // --- BEFORE PROMISE.ALL ---

    // 1. Live Trends ($queryRaw)
    (db.$queryRaw as any).mockResolvedValueOnce([
      { date: '2023-10-27', revenue: 4000, orders: 40 },
      { date: '2023-10-28', revenue: 4000, orders: 40 },
    ]);

    // --- INSIDE PROMISE.ALL ---
    // Order matters here (based on array index)

    // 0. Customer Count
    (db.customerProfile.count as any).mockResolvedValueOnce(100);

    // 1. Driver Count
    (db.driverProfile.count as any).mockResolvedValueOnce(10);

    // 2. Prev Revenue (Aggregate)
    (db.order.aggregate as any).mockResolvedValueOnce({ _sum: { totalAmount: 5000 } });

    // 3. Prev Orders (Count)
    (db.order.count as any).mockResolvedValueOnce(50);

    // 4. Orders By Status (GroupBy)
    (db.order.groupBy as any).mockResolvedValueOnce([
      { status: 'COMPLETED', _count: { id: 80 }, _sum: { totalAmount: 8000 } },
      { status: 'PENDING', _count: { id: 20 }, _sum: { totalAmount: 0 } },
    ]);

    // 5. Orders By Payment Method (GroupBy)
    (db.order.groupBy as any).mockResolvedValueOnce([
      { paymentMethod: 'CASH', _count: { id: 60 }, _sum: { cashCollected: 6000 } },
      { paymentMethod: 'ONLINE_TRANSFER', _count: { id: 20 }, _sum: { cashCollected: 2000 } },
    ]);

    // 7. Cash Orders Count (Count)
    (db.order.count as any).mockResolvedValueOnce(60);

    // 8. Pending Handovers ($queryRaw)
    (db.$queryRaw as any).mockResolvedValueOnce([{ count: 5, amount: 500 }]);

    // 9. Verified Handovers (Aggregate)
    (db.cashHandover.aggregate as any).mockResolvedValueOnce({ _sum: { actualCash: 4000 }, _count: { id: 4 } });

    // 10. Live Driver Performance (GroupBy)
    (db.order.groupBy as any).mockResolvedValueOnce([]);

    // 11. Historical Driver Metrics (GroupBy)
    // Skipped because isLiveOnly=true by default

    // 12. Bottle Stats (Aggregate)
    (db.orderItem.aggregate as any).mockResolvedValueOnce({
      _sum: { filledGiven: 100, emptyTaken: 80, damagedReturned: 5, quantity: 100 }
    });

    // 13. Product Inventory (FindMany)
    const mockProducts = [
      { id: '1', name: 'Water', stockFilled: 100, stockEmpty: 50, basePrice: 100 },
      { id: '2', name: 'Bottle', stockFilled: 10, stockEmpty: 5, basePrice: 50 }, // Low stock
    ];
    (db.product.findMany as any).mockResolvedValueOnce(mockProducts);

    // 14. New Customers (Count)
    (db.customerProfile.count as any).mockResolvedValueOnce(5);

    // 15. Customers By Type (GroupBy)
    (db.customerProfile.groupBy as any).mockResolvedValueOnce([]);

    // 16. Top Customers (GroupBy)
    (db.order.groupBy as any).mockResolvedValueOnce([]);
    // Extra mock just in case for groupBy
    (db.order.groupBy as any).mockResolvedValueOnce([]);

    // 17. Route Performance ($queryRaw)
    (db.$queryRaw as any).mockResolvedValueOnce([]);

    // 18. Total Expenses (Aggregate)
    (db.expense.aggregate as any).mockResolvedValueOnce({ _sum: { amount: 1000 } });

    // 19. Total Receivables (Aggregate)
    (db.customerProfile.aggregate as any).mockResolvedValueOnce({ _sum: { cashBalance: -500 } });

    // 20. Failed Orders (FindMany)
    (db.order.findMany as any).mockResolvedValueOnce([]);

    // 22. High Credit Customers (FindMany)
    (db.customerProfile.findMany as any).mockResolvedValueOnce([]);

    // --- AFTER PROMISE.ALL ---

    // 23. Live Order Status Trend ($queryRaw)
    (db.$queryRaw as any).mockResolvedValueOnce([]);

    // Execution
    const result = await getComprehensiveDashboardData();

    // Assertions

    // Check Cash Stats
    // After optimization: uses sum of payment methods (6000+2000=8000).
    expect(result.cashManagement.totalCashCollected).toBe(8000);

    // Check Low Stock
    // After: uses derived (Bottle).
    expect(result.alerts.lowStockProducts).toHaveLength(1);
    expect(result.alerts.lowStockProducts[0].name).toBe('Bottle');

    // Check Revenue
    // After: uses ordersByStatus (8000).
    expect(result.overview.realizedRevenue).toBe(8000);
  });
});
