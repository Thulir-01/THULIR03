/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import { ReportsService } from './reports.service';

describe('ReportsService — analytics', () => {
  const makeService = (overrides: Record<string, unknown>) =>
    new ReportsService({ client: overrides } as any);

  const baseMocks = () => ({
    order: {
      aggregate: jest.fn().mockResolvedValue({
        _sum: {
          totalAmount: 1200,
          discountAmount: 100,
          amountPaid: 800,
          balanceAmount: 400,
        },
      }),
      count: jest.fn().mockResolvedValue(10),
      groupBy: jest.fn().mockResolvedValue([]),
    },
    orderTest: {
      groupBy: jest.fn().mockResolvedValue([]),
    },
    party: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  });

  it('returns revenue aggregates from tenant-scoped order queries', async () => {
    const mocks = baseMocks();
    const service = makeService(mocks);
    const data = await service.getAnalytics('tenant-A');

    expect(data.revenue.totalBilled).toBe(1200);
    expect(data.revenue.totalDiscount).toBe(100);
    expect(data.revenue.totalCollected).toBe(800);
    expect(data.revenue.totalOutstanding).toBe(400);
    expect(data.revenue.orderCount).toBe(10);
    // daily series is always 14 entries
    expect(data.dailySeries.length).toBe(14);
    expect(data.testVolumes).toEqual([]);
    expect(data.referrerPayouts).toEqual([]);

    // every order query scoped to tenant-A
    const callArgs = mocks.order.aggregate.mock.calls.map(
      (c) => (c[0] as { where: { tenantId?: string } }).where?.tenantId,
    );
    expect(callArgs.every((t) => t === 'tenant-A')).toBe(true);
  });

  it('scopes test volumes through the order relation (OrderTest is not tenant-scoped)', async () => {
    const mocks = baseMocks();
    mocks.orderTest.groupBy = jest.fn().mockResolvedValue([
      {
        testCode: 'CBC',
        testName: 'CBC',
        _count: { _all: 5 },
        _sum: { rate: 750 },
      },
    ]);
    const service = makeService(mocks);
    const data = await service.getAnalytics('tenant-A');

    expect(data.testVolumes[0]).toEqual({
      testCode: 'CBC',
      testName: 'CBC',
      count: 5,
      rateSum: 750,
    });
    const where = mocks.orderTest.groupBy.mock.calls[0][0].where as {
      order: { tenantId?: string };
    };
    expect(where.order.tenantId).toBe('tenant-A');
  });

  it('computes referrer payouts using the doctor commission percent', async () => {
    const mocks = baseMocks();
    mocks.order.groupBy = jest.fn().mockResolvedValue([
      {
        referrerPartyId: 'party-1',
        _count: { _all: 3 },
        _sum: { totalAmount: 10000 },
      },
    ]);
    mocks.party.findMany = jest.fn().mockResolvedValue([
      {
        id: 'party-1',
        name: 'Dr Meera',
        doctorDetail: { commissionPercent: 10 },
      },
    ]);
    const service = makeService(mocks);
    const data = await service.getAnalytics('tenant-A');

    expect(data.referrerPayouts[0]).toEqual({
      partyId: 'party-1',
      name: 'Dr Meera',
      orderCount: 3,
      billed: 10000,
      commissionPercent: 10,
      estimatedPayout: 1000, // 10% of 10000
    });
  });

  it('handles an unknown referrer party gracefully', async () => {
    const mocks = baseMocks();
    mocks.order.groupBy = jest.fn().mockResolvedValue([
      {
        referrerPartyId: 'party-ghost',
        _count: { _all: 1 },
        _sum: { totalAmount: 500 },
      },
    ]);
    const service = makeService(mocks);
    const data = await service.getAnalytics('tenant-A');

    expect(data.referrerPayouts[0].name).toBe('Unknown referrer');
    expect(data.referrerPayouts[0].commissionPercent).toBe(0);
    expect(data.referrerPayouts[0].estimatedPayout).toBe(0);
  });
});
