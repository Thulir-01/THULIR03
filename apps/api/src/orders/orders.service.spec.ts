/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
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

  it('rejects approval when the approver is the same user who verified', async () => {
    const service = makeService({
      order: {
        findFirst: () => ({ ...order('verified'), verifiedBy: 'tech-1' }),
      },
    });
    await expect(
      service.approveOrder('tenant-A', 'order-1', 'tech-1'),
    ).rejects.toThrow('Two-person sign-off required');
  });

  it('allows approval when the approver is a different user from who verified', async () => {
    const updateMany = jest.fn().mockResolvedValue({ count: 2 });
    const orderUpdate = jest.fn().mockResolvedValue({ status: 'approved' });
    const service = makeService({
      order: {
        findFirst: () => ({ ...order('verified'), verifiedBy: 'tech-1' }),
        update: orderUpdate,
      },
      orderTest: { updateMany },
    });
    (service as any).prisma.client.$transaction = jest.fn(
      async (fn: (tx: any) => Promise<unknown>) =>
        fn({ orderTest: { updateMany }, order: { update: orderUpdate } }),
    );
    await service.approveOrder('tenant-A', 'order-1', 'path-1');

    expect(orderUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-1' },
        data: expect.objectContaining({
          status: 'approved',
          approvedBy: 'path-1',
        }),
      }),
    );
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

  it('resolves the verifier name on order detail for the approval screen', async () => {
    const service = makeService({
      order: {
        findFirst: () => ({
          id: 'order-1',
          orderNumber: 'ORD-ABC123',
          status: 'verified',
          verifiedBy: 'tech-1',
          tests: [
            {
              testCode: 'HB',
              status: 'completed',
              unit: 'g/dL',
              refRange: '13-17',
            },
          ],
        }),
      },
      user: {
        findFirst: () => ({
          id: 'tech-1',
          firstName: 'Kavitha',
          lastName: 'R',
        }),
      },
    });
    const data = await service.findOne('tenant-A', 'order-1');
    expect(data.verifiedByUser).toEqual({ id: 'tech-1', name: 'Kavitha R' });
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

describe('OrdersService — register (Bug #5: cross-tenant order-number safety)', () => {
  const makeTx = () => ({
    patient: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }: any) => ({
        id: 'patient-1',
        ...data,
      })),
    },
    order: {
      create: jest.fn().mockImplementation(async ({ data }: any) => ({
        id: 'order-1',
        ...data,
      })),
    },
    sample: {
      create: jest.fn().mockImplementation(async ({ data }: any) => ({
        id: 'sample-1',
        ...data,
      })),
    },
    orderTest: {
      createMany: jest.fn().mockResolvedValue({ count: 0 }),
      createManyAndReturn: jest.fn().mockResolvedValue([]),
    },
  });

  const makeClient = (tx: any) => ({
    party: { findFirst: jest.fn().mockResolvedValue(null) },
    testParameter: { findMany: jest.fn().mockResolvedValue([]) },
    testPackage: { findMany: jest.fn().mockResolvedValue([]) },
    referrerPrice: { findMany: jest.fn().mockResolvedValue([]) },
    $transaction: jest.fn().mockImplementation(async (fn: any) => fn(tx)),
  });

  const dto = (overrides: Record<string, unknown> = {}) =>
    ({
      firstName: 'Ravi',
      lastName: 'Kumar',
      tests: [{ code: 'HEM', name: 'Hemoglobin', rate: 100 }],
      ...overrides,
    }) as any;

  it('mints a distinct order number per tenant under concurrent registration', async () => {
    const txA = makeTx();
    const serviceA = new OrdersService({ client: makeClient(txA) } as any);
    const txB = makeTx();
    const serviceB = new OrdersService({ client: makeClient(txB) } as any);

    const [resultA, resultB] = await Promise.all([
      serviceA.register('tenant-A', dto()),
      serviceB.register('tenant-B', dto()),
    ]);

    expect(resultA.orderNumber).toMatch(/^ORD-/);
    expect(resultB.orderNumber).toMatch(/^ORD-/);
    // The order-number space is GLOBALLY unique (shared across tenants), so
    // two labs registering at the same moment must never share a number.
    expect(resultA.orderNumber).not.toBe(resultB.orderNumber);
    // Each registration is fully scoped to its own tenant.
    expect(txA.order.create.mock.calls[0][0].data.tenantId).toBe('tenant-A');
    expect(txB.order.create.mock.calls[0][0].data.tenantId).toBe('tenant-B');
    expect(resultA.patientId).toBeTruthy();
    expect(resultB.patientId).toBeTruthy();
  });

  it('retries with a fresh order number when the DB rejects a P2002 collision', async () => {
    const tx = makeTx();
    tx.order.create = jest
      .fn()
      .mockRejectedValueOnce({
        code: 'P2002',
        meta: { target: ['order_number'] },
      })
      .mockImplementation(async ({ data }: any) => ({
        id: 'order-1',
        ...data,
      }));
    const service = new OrdersService({ client: makeClient(tx) } as any);

    const result = await service.register('tenant-A', dto());

    expect(result.orderNumber).toMatch(/^ORD-/);
    expect(tx.order.create).toHaveBeenCalledTimes(2);
    // The retry must NOT reuse the collided number.
    const firstNumber = tx.order.create.mock.calls[0][0].data.orderNumber;
    const secondNumber = tx.order.create.mock.calls[1][0].data.orderNumber;
    expect(firstNumber).not.toBe(secondNumber);
  });

  it('does not swallow a non-collision failure', async () => {
    const tx = makeTx();
    tx.order.create = jest.fn().mockRejectedValue(new Error('connection lost'));
    const service = new OrdersService({ client: makeClient(tx) } as any);

    await expect(service.register('tenant-A', dto())).rejects.toThrow(
      'connection lost',
    );
    // No pointless retries for errors that a fresh order number cannot fix.
    expect(tx.order.create).toHaveBeenCalledTimes(1);
  });
});
