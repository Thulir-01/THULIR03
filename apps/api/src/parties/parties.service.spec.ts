/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/require-await */
import { PartiesService } from './parties.service';

describe('PartiesService — all party types', () => {
  const makeService = (overrides: Record<string, unknown>) =>
    new PartiesService({ client: overrides } as any);

  const baseMocks = () => ({
    party: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
  });

  it('filters by party type when one is given', async () => {
    const mocks = baseMocks();
    const service = makeService(mocks);

    await service.findAll('tenant-A', { type: 'doctor' });

    const where = mocks.party.findMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe('tenant-A');
    expect(where.deletedAt).toBeNull();
    expect(where.partyType).toBe('doctor');
  });

  it('returns ALL party types (including doctors) when no type filter is given', async () => {
    const mocks = baseMocks();
    const service = makeService(mocks);

    await service.findAll('tenant-A');

    const where = mocks.party.findMany.mock.calls[0][0].where;
    // Doctors are parties now — the merged list must not hide them.
    expect(where.partyType).toBeUndefined();
  });

  it('adds search across name/phone/email/gstin', async () => {
    const mocks = baseMocks();
    const service = makeService(mocks);

    await service.findAll('tenant-A', { search: 'apollo' });

    const where = mocks.party.findMany.mock.calls[0][0].where;
    expect(Array.isArray(where.OR)).toBe(true);
    expect(where.OR.length).toBe(4);
  });

  it('throws NotFound when finding a party outside the tenant', async () => {
    const mocks = baseMocks();
    mocks.party.findFirst = jest.fn().mockResolvedValue(null);
    const service = makeService(mocks);

    await expect(service.findOne('party-ghost', 'tenant-A')).rejects.toThrow(
      'Party not found',
    );
    // scoped to the caller's tenant
    expect(mocks.party.findFirst.mock.calls[0][0].where.tenantId).toBe(
      'tenant-A',
    );
  });

  it('creates a hospital party without doctor detail', async () => {
    const mocks = baseMocks();
    mocks.party.create = jest.fn().mockImplementation(async ({ data }) => ({
      id: 'party-1',
      partyType: 'hospital',
      name: data.name,
      address: data.address,
      gstin: data.gstin,
      primaryContactPhone: data.primaryContactPhone,
      primaryContactEmail: data.primaryContactEmail,
      status: 'active',
      createdAt: new Date(),
      doctorDetail: null,
    }));
    const service = makeService(mocks);

    const row = await service.create('tenant-A', {
      name: 'Apollo Hospital',
      partyType: 'hospital',
      gstin: '33ABCDE1234F1Z5',
      primaryContactPhone: '9876543210',
    });

    expect(row.partyType).toBe('hospital');
    expect(row.gstin).toBe('33ABCDE1234F1Z5');
    expect(row.name).toBe('Apollo Hospital');
    // hospital: no doctorDetail created
    const createData = mocks.party.create.mock.calls[0][0].data;
    expect(createData.doctorDetail).toBeUndefined();
    expect(createData.tenantId).toBe('tenant-A');
  });

  it('creates a doctor party with the doctorDetail extension', async () => {
    const mocks = baseMocks();
    mocks.party.create = jest.fn().mockImplementation(async ({ data }) => ({
      id: 'party-1',
      partyType: 'doctor',
      name: data.name,
      address: null,
      gstin: null,
      primaryContactPhone: null,
      primaryContactEmail: null,
      status: 'active',
      createdAt: new Date(),
      doctorDetail: {
        specialization: data.doctorDetail.create.specialization,
        clinicAffiliation: data.doctorDetail.create.clinicAffiliation,
        medicalCouncilNo: data.doctorDetail.create.medicalCouncilNo,
        commissionPercent: data.doctorDetail.create.commissionPercent,
        pricingMode: data.doctorDetail.create.pricingMode,
        discountPercent: data.doctorDetail.create.discountPercent,
      },
    }));
    const service = makeService(mocks);

    const row = await service.create('tenant-A', {
      name: 'Dr Meera',
      partyType: 'doctor',
      specialty: 'Cardiology',
      commission: 15,
      pricingMode: 'discount',
      discountPercent: 10,
    });

    expect(row.partyType).toBe('doctor');
    expect(row.specialty).toBe('Cardiology');
    expect(row.commission).toBe(15);
    expect(row.pricingMode).toBe('discount');
    expect(row.discountPercent).toBe(10);
  });

  it('soft-deletes a party (sets deletedAt + inactive)', async () => {
    const mocks = baseMocks();
    mocks.party.findFirst = jest.fn().mockResolvedValue({ id: 'party-1' });
    mocks.party.update = jest.fn().mockResolvedValue({});
    const service = makeService(mocks);

    await service.remove('party-1', 'tenant-A');

    const updateData = mocks.party.update.mock.calls[0][0].data;
    expect(updateData.deletedAt).toBeInstanceOf(Date);
    expect(updateData.status).toBe('inactive');
    // tenant-scoped lookup
    expect(mocks.party.findFirst.mock.calls[0][0].where.tenantId).toBe(
      'tenant-A',
    );
  });
});
