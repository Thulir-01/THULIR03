/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
import { OrdersService } from './orders.service';

describe('OrdersService — verify / approve workflow', () => {
  const makeService = (overrides: Record<string, unknown>) =>
    new OrdersService({ client: overrides } as any);

  const order = (status: string, tests = [{ status: 'completed' }]) => ({
    id: 'order-1',
    orderNumber: 'ORD-ABC123',
    status,
    tests,
  });

  it('rejects verify for an order from another tenant (404)', async () => {
    const service = makeService({ order: { findFirst: () => null } });
    await expect(
      service.verifyOrder('tenant-A', 'order-X', 'tech-1'),
    ).rejects.toThrow('Order not found');
  });

  it('rejects verify when order is not completed', async () => {
    const service = makeService({
      order: { findFirst: () => order('pending') },
    });
    await expect(
      service.verifyOrder('tenant-A', 'order-1', 'tech-1'),
    ).rejects.toThrow('only completed orders can be verified');
  });

  it('rejects verify when some tests are still pending', async () => {
    const service = makeService({
      order: {
        findFirst: () =>
          order('completed', [{ status: 'completed' }, { status: 'pending' }]),
      },
    });
    await expect(
      service.verifyOrder('tenant-A', 'order-1', 'tech-1'),
    ).rejects.toThrow('All test results must be completed');
  });

  it('verifies a completed order and records the technician', async () => {
    const update = jest.fn().mockResolvedValue({ status: 'verified' });
    const service = makeService({
      order: {
        findFirst: () => order('completed'),
        update,
      },
    });
    await service.verifyOrder('tenant-A', 'order-1', 'tech-1');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1' },
        data: expect.objectContaining({
          status: 'verified',
          verifiedBy: 'tech-1',
          verifiedAt: expect.any(Date),
        }),
      }),
    );
  });

  it('rejects approve from any state other than verified', async () => {
    const service = makeService({
      order: { findFirst: () => order('completed') },
    });
    await expect(
      service.approveOrder('tenant-A', 'order-1', 'path-1'),
    ).rejects.toThrow('only verified orders can be approved');
  });

  it('approves a verified order and stamps every test e-signature', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const orderUpdate = jest.fn().mockResolvedValue({ status: 'approved' });
    const service = makeService({
      order: {
        findFirst: () => order('verified'),
        update: orderUpdate,
      },
      orderTest: { updateMany },
    });
    (service as any).prisma.client.$transaction = jest.fn(
      async (fn: (tx: any) => Promise<unknown>) =>
        fn({ orderTest: { updateMany }, order: { update: orderUpdate } }),
    );
    await service.approveOrder('tenant-A', 'order-1', 'path-1');

    expect(updateMany).toHaveBeenCalledWith({
      where: { orderId: 'order-1' },
      data: expect.objectContaining({
        verifiedBy: 'path-1',
        verifiedAt: expect.any(Date),
        signatureHash: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    });
    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1' },
        data: expect.objectContaining({
          status: 'approved',
          approvedBy: 'path-1',
          approvedAt: expect.any(Date),
          finalReportDate: expect.any(Date),
        }),
      }),
    );
  });

  it('rejects report for an order that is not approved', async () => {
    const service = makeService({
      order: { findFirst: () => order('verified') },
    });
    await expect(service.getReportData('tenant-A', 'order-1')).rejects.toThrow(
      'only available for approved orders',
    );
  });

  it('rejects invoice for an order from another tenant (404)', async () => {
    const service = makeService({ order: { findFirst: () => null } });
    await expect(service.getInvoiceData('tenant-A', 'order-X')).rejects.toThrow(
      'Order not found',
    );
  });

  it('returns invoice payload with billing + tests for ANY order status', async () => {
    const invoiceOrder = {
      id: 'order-1',
      orderNumber: 'ORD-ABC123',
      status: 'pending', // billing happens at registration — no approval gate
      createdAt: new Date('2026-08-01'),
      priority: 'routine',
      emergency: false,
      refNo: 'LAB-9',
      deliveryMode: 'walk-in',
      consolidatedBill: false,
      patient: {
        title: 'Mr',
        firstName: 'Arun',
        lastName: 'Kumar',
        gender: 'Male',
        dateOfBirth: null,
        ageYears: 34,
        ageMonths: null,
        phone: '9999988888',
        email: 'arun@example.com',
      },
      referrerParty: { name: 'Dr Meera' },
      tests: [
        {
          testCode: 'CBC',
          testName: 'Complete Blood Count',
          isProfile: true,
          rate: '450',
          status: 'pending',
          children: [{ testCode: 'HB', testName: 'Haemoglobin', rate: '80' }],
        },
      ],
      billAmount: '500',
      otherCharges: '0',
      discountPercent: '10',
      discountAmount: '50',
      discountAuth: 'MGMT',
      totalAmount: '450',
      amountPaid: '200',
      balanceAmount: '250',
      paymentMode: 'Cash',
      bankName: null,
      paymentRef: null,
      paymentDate: null,
      paymentRemarks: 'advance',
    };
    const service = makeService({
      order: { findFirst: () => invoiceOrder },
    });
    const data = await service.getInvoiceData('tenant-A', 'order-1');
    expect(data.orderNumber).toBe('ORD-ABC123');
    expect(data.status).toBe('pending');
    expect(data.patient.firstName).toBe('Arun');
    expect(data.referrer).toBe('Dr Meera');
    expect(data.tests[0].testCode).toBe('CBC');
    expect(data.tests[0].children[0].testName).toBe('Haemoglobin');
    expect(data.billing.billAmount).toBe('500');
    expect(data.billing.discountPercent).toBe('10');
    expect(data.billing.discountAmount).toBe('50');
    expect(data.billing.totalAmount).toBe('450');
    expect(data.billing.amountPaid).toBe('200');
    expect(data.billing.balanceAmount).toBe('250');
    expect(data.billing.paymentMode).toBe('Cash');
  });
});
