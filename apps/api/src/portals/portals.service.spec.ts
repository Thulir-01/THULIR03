/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/require-await */
import { PortalsService } from './portals.service';

describe('PortalsService', () => {
  const makeService = (overrides: Record<string, unknown>) =>
    new PortalsService({ client: overrides } as any);

  const baseMocks = () => ({
    role: {
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest
        .fn()
        .mockImplementation(async ({ data }) => ({ id: 'role-1', ...data })),
    },
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation(async ({ data }) => ({
        id: 'user-1',
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        role: { slug: data.roleId === 'role-1' ? 'patient' : 'referrer' },
      })),
      update: jest.fn().mockResolvedValue({}),
    },
    patient: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    party: {
      findFirst: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue({}),
    },
    order: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      findUnique: jest.fn().mockResolvedValue(null),
    },
    organization: {
      findFirst: jest.fn().mockResolvedValue({ name: 'THULIR03 Diagnostics' }),
    },
  });

  it('enroll creates the patient role on demand and links the patient', async () => {
    const mocks = baseMocks();
    mocks.role.findFirst = jest.fn().mockResolvedValue(null);
    mocks.patient.findFirst = jest.fn().mockResolvedValue({
      id: 'patient-1',
      firstName: 'Ravi',
      lastName: 'Kumar',
      userId: null,
    });
    const service = makeService(mocks);

    const result = await service.enroll('tenant-A', {
      kind: 'patient',
      entityId: 'patient-1',
      email: 'ravi@example.com',
      password: 'secret123',
    });

    expect(mocks.role.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ slug: 'patient' }),
      }),
    );
    expect(mocks.patient.update).toHaveBeenCalledWith({
      where: { id: 'patient-1' },
      data: { userId: 'user-1' },
    });
    expect(result.email).toBe('ravi@example.com');
  });

  it('enroll rejects a patient that already has portal access', async () => {
    const mocks = baseMocks();
    mocks.patient.findFirst = jest.fn().mockResolvedValue({
      id: 'patient-1',
      firstName: 'Ravi',
      lastName: 'Kumar',
      userId: 'user-existing',
    });
    const service = makeService(mocks);

    await expect(
      service.enroll('tenant-A', {
        kind: 'patient',
        entityId: 'patient-1',
        email: 'ravi@example.com',
        password: 'secret123',
      }),
    ).rejects.toThrow('already has portal access');
    expect(mocks.user.create).not.toHaveBeenCalled();
  });

  it('enroll requires a valid email', async () => {
    const service = makeService(baseMocks());
    await expect(
      service.enroll('tenant-A', {
        kind: 'patient',
        entityId: 'patient-1',
        email: 'not-an-email',
        password: 'secret123',
      }),
    ).rejects.toThrow('valid email');
  });

  it('revoke unlinks the patient and deactivates the portal user', async () => {
    const mocks = baseMocks();
    mocks.patient.findFirst = jest.fn().mockResolvedValue({
      id: 'patient-1',
      userId: 'user-1',
    });
    const service = makeService(mocks);

    await service.revoke('tenant-A', {
      kind: 'patient',
      entityId: 'patient-1',
    });

    expect(mocks.patient.update).toHaveBeenCalledWith({
      where: { id: 'patient-1' },
      data: { userId: null },
    });
    expect(mocks.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { isActive: false },
    });
  });

  it('patientOrders returns orders for the linked patient only', async () => {
    const mocks = baseMocks();
    mocks.patient.findFirst = jest.fn().mockResolvedValue({
      id: 'patient-1',
      firstName: 'Ravi',
      lastName: 'Kumar',
    });
    mocks.order.findMany = jest.fn().mockResolvedValue([
      {
        id: 'order-1',
        orderNumber: 'ORD-TEST-1',
        status: 'approved',
        priority: 'routine',
        emergency: false,
        createdAt: new Date(),
        finalReportDate: new Date(),
        tests: [{ testName: 'CBC', status: 'completed' }],
      },
    ]);
    const service = makeService(mocks);

    const orders = await service.patientOrders('user-1', 'tenant-A');

    expect(orders.length).toBe(1);
    expect(orders[0].reportReady).toBe(true);
    expect(orders[0].testCount).toBe(1);
    const where = mocks.order.findMany.mock.calls[0][0].where;
    expect(where.patientId).toBe('patient-1');
    expect(where.tenantId).toBe('tenant-A');
  });

  it('patientReport blocks a report that is not yet approved', async () => {
    const mocks = baseMocks();
    mocks.patient.findFirst = jest.fn().mockResolvedValue({
      id: 'patient-1',
      firstName: 'Ravi',
      lastName: 'Kumar',
    });
    mocks.order.findFirst = jest.fn().mockResolvedValue({
      id: 'order-1',
      status: 'pending',
    });
    const service = makeService(mocks);

    await expect(
      service.patientReport('user-1', 'tenant-A', 'order-1'),
    ).rejects.toThrow('Report is not yet available');
  });

  it('verifyReport returns a valid payload for a known order number', async () => {
    const mocks = baseMocks();
    mocks.order.findUnique = jest.fn().mockResolvedValue({
      orderNumber: 'ORD-VERIFY-1',
      status: 'approved',
      tenantId: 'tenant-A',
      deletedAt: null,
      finalReportDate: new Date(),
      approvedAt: new Date(),
      patient: { firstName: 'Ravi', lastName: 'Kumar' },
      tests: [{ testName: 'CBC' }, { testName: 'ESR' }],
    });
    const service = makeService(mocks);

    const result = await service.verifyReport('ord-verify-1');

    expect(result.valid).toBe(true);
    expect(result.orderNumber).toBe('ORD-VERIFY-1');
    expect(result.labName).toBe('THULIR03 Diagnostics');
    expect(result.tests).toEqual(['CBC', 'ESR']);
    // uppercased + trimmed before lookup
    expect(mocks.order.findUnique.mock.calls[0][0].where.orderNumber).toBe(
      'ORD-VERIFY-1',
    );
  });

  it('verifyReport returns invalid for an unknown order number', async () => {
    const mocks = baseMocks();
    mocks.order.findUnique = jest.fn().mockResolvedValue(null);
    const service = makeService(mocks);

    const result = await service.verifyReport('ORD-NOPE');
    expect(result.valid).toBe(false);
  });

  it('resetPassword rehashes and reactivates a portal user', async () => {
    const mocks = baseMocks();
    mocks.user.findFirst = jest.fn().mockResolvedValue({ id: 'user-1' });
    const service = makeService(mocks);

    await service.resetPassword('tenant-A', {
      userId: 'user-1',
      password: 'newpass123',
    });

    const updateData = mocks.user.update.mock.calls[0][0].data;
    expect(updateData.isActive).toBe(true);
    expect(updateData.passwordHash).not.toBe('newpass123');
  });
});
