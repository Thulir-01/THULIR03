import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DashboardService {
  constructor(private prisma: PrismaService) {}

  /** All stats as COUNT/aggregate queries — no full-table fetches. */
  async getStats(tenantId: string) {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      totalPatients,
      totalReferrers,
      totalOrders,
      pendingTests,
      todayRevenue,
      recentOrders,
    ] = await Promise.all([
      this.prisma.client.patient.count({
        where: { tenantId, deletedAt: null },
      }),
      this.prisma.client.party.count({
        where: { tenantId, partyType: 'doctor', deletedAt: null },
      }),
      this.prisma.client.order.count({
        where: { tenantId, deletedAt: null },
      }),
      // OrderTest is not tenant-scoped, so scope through its order relation.
      this.prisma.client.orderTest.count({
        where: { status: 'pending', order: { tenantId } },
      }),
      this.prisma.client.order.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          createdAt: { gte: startOfToday },
        },
        _sum: { totalAmount: true },
      }),
      this.prisma.client.order.findMany({
        where: { tenantId, deletedAt: null },
        select: {
          id: true,
          orderNumber: true,
          status: true,
          emergency: true,
          totalAmount: true,
          balanceAmount: true,
          createdAt: true,
          patient: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
              phone: true,
            },
          },
          tests: {
            select: { id: true, status: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 5,
      }),
    ]);

    return {
      totalPatients,
      totalReferrers,
      totalOrders,
      pendingTests,
      todayRevenue: Number(todayRevenue._sum.totalAmount ?? 0),
      recentOrders,
    };
  }
}
