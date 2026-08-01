import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ReportsRange {
  from?: string;
  to?: string;
}

/** Sprint 8 — Reports & Analytics. All queries are aggregates on the
 *  tenant-scoped Order model (OrderTest is not tenant-scoped, so test-volume
 *  queries scope through the order relation). */
@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  private resolveRange(range: ReportsRange): { gte?: Date; lte?: Date } {
    const out: { gte?: Date; lte?: Date } = {};
    if (range.from) {
      const d = new Date(range.from);
      if (!isNaN(d.getTime())) out.gte = d;
    }
    if (range.to) {
      const d = new Date(range.to);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999); // inclusive end of day
        out.lte = d;
      }
    }
    return out;
  }

  async getAnalytics(tenantId: string, range: ReportsRange = {}) {
    const { gte, lte } = this.resolveRange(range);

    const [
      revenueAgg,
      orderCount,
      collectedAgg,
      outstandingAgg,
      testVolumes,
      referrerPayouts,
    ] = await Promise.all([
      // Total billed in range
      this.prisma.client.order.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          ...(gte || lte
            ? {
                createdAt: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) },
              }
            : {}),
        },
        _sum: { totalAmount: true, discountAmount: true },
      }),
      this.prisma.client.order.count({
        where: {
          tenantId,
          deletedAt: null,
          ...(gte || lte
            ? {
                createdAt: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) },
              }
            : {}),
        },
      }),
      // Collected = sum of what was actually paid
      this.prisma.client.order.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          ...(gte || lte
            ? {
                createdAt: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) },
              }
            : {}),
        },
        _sum: { amountPaid: true },
      }),
      // Outstanding = unpaid balance
      this.prisma.client.order.aggregate({
        where: {
          tenantId,
          deletedAt: null,
          ...(gte || lte
            ? {
                createdAt: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) },
              }
            : {}),
        },
        _sum: { balanceAmount: true },
      }),
      // Top tests by volume (OrderTest scoped through its order relation)
      this.prisma.client.orderTest.groupBy({
        by: ['testCode', 'testName'],
        where: {
          order: {
            tenantId,
            deletedAt: null,
            ...(gte || lte
              ? {
                  createdAt: {
                    ...(gte ? { gte } : {}),
                    ...(lte ? { lte } : {}),
                  },
                }
              : {}),
          },
        },
        _count: { _all: true },
        _sum: { rate: true },
        orderBy: { _count: { testCode: 'desc' } },
        take: 10,
      }),
      // Referrer payouts: order totals grouped by referrer party
      this.prisma.client.order.groupBy({
        by: ['referrerPartyId'],
        where: {
          tenantId,
          deletedAt: null,
          referrerPartyId: { not: null },
          ...(gte || lte
            ? {
                createdAt: { ...(gte ? { gte } : {}), ...(lte ? { lte } : {}) },
              }
            : {}),
        },
        _count: { _all: true },
        _sum: { totalAmount: true },
        orderBy: { _sum: { totalAmount: 'desc' } },
        take: 20,
      }),
    ]);

    // Resolve referrer party names + commission % (doctor detail)
    const referrerIds = referrerPayouts
      .map((r) => r.referrerPartyId)
      .filter(Boolean) as string[];
    const parties = referrerIds.length
      ? await this.prisma.client.party.findMany({
          where: { id: { in: referrerIds }, tenantId },
          select: {
            id: true,
            name: true,
            doctorDetail: { select: { commissionPercent: true } },
          },
        })
      : [];
    const partyMap = new Map(parties.map((p) => [p.id, p]));

    // Daily revenue series (last 14 days of the range end / today)
    const rangeEnd = lte ?? new Date();
    const seriesStart = new Date(rangeEnd);
    seriesStart.setDate(seriesStart.getDate() - 13);
    seriesStart.setHours(0, 0, 0, 0);

    const dailyRows = await this.prisma.client.order.groupBy({
      by: ['createdAt'],
      where: {
        tenantId,
        deletedAt: null,
        createdAt: { gte: seriesStart, lte: rangeEnd },
      },
      _sum: { totalAmount: true, amountPaid: true },
    });
    const dailyMap = new Map<string, { billed: number; collected: number }>();
    for (const row of dailyRows) {
      const day = new Date(row.createdAt);
      if (isNaN(day.getTime())) continue; // guard: no createdAt (e.g. other groupBy paths)
      day.setHours(0, 0, 0, 0);
      const key = day.toISOString().slice(0, 10);
      const cur = dailyMap.get(key) ?? { billed: 0, collected: 0 };
      cur.billed += Number(row._sum.totalAmount ?? 0);
      cur.collected += Number(row._sum.amountPaid ?? 0);
      dailyMap.set(key, cur);
    }
    const dailySeries: { date: string; billed: number; collected: number }[] =
      [];
    for (let i = 0; i < 14; i++) {
      const d = new Date(seriesStart);
      d.setDate(seriesStart.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      dailySeries.push({
        date: key,
        ...(dailyMap.get(key) ?? { billed: 0, collected: 0 }),
      });
    }

    return {
      range: { from: range.from ?? null, to: range.to ?? null },
      revenue: {
        totalBilled: Number(revenueAgg._sum.totalAmount ?? 0),
        totalDiscount: Number(revenueAgg._sum.discountAmount ?? 0),
        totalCollected: Number(collectedAgg._sum.amountPaid ?? 0),
        totalOutstanding: Number(outstandingAgg._sum.balanceAmount ?? 0),
        orderCount,
      },
      dailySeries,
      testVolumes: testVolumes.map((t) => ({
        testCode: t.testCode,
        testName: t.testName,
        count: t._count._all,
        rateSum: Number(t._sum.rate ?? 0),
      })),
      referrerPayouts: referrerPayouts.map((r) => {
        const party = r.referrerPartyId
          ? partyMap.get(r.referrerPartyId)
          : undefined;
        const billed = Number(r._sum.totalAmount ?? 0);
        const commissionPercent = Number(
          party?.doctorDetail?.commissionPercent ?? 0,
        );
        return {
          partyId: r.referrerPartyId,
          name: party?.name ?? 'Unknown referrer',
          orderCount: r._count._all,
          billed,
          commissionPercent,
          estimatedPayout:
            commissionPercent > 0 ? (billed * commissionPercent) / 100 : 0,
        };
      }),
    };
  }
}
