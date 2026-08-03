/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment */
import { UsersService } from './users.service';

describe('UsersService — NABL staff details', () => {
  const makeService = (overrides: Record<string, unknown>) =>
    new UsersService({ client: overrides } as any);

  it('rejects staff-detail reads for a user from another organization (404)', async () => {
    const service = makeService({
      user: { findFirst: () => null },
    });
    await expect(
      service.getStaffDetail('user-other-tenant', 'tenant-A'),
    ).rejects.toThrow('User not found');
  });

  it('rejects upserting staff details for a cross-organization user', async () => {
    const service = makeService({
      user: { findFirst: () => null },
    });
    await expect(
      service.upsertStaffDetail('user-other-tenant', 'tenant-A', {
        registrationNo: 'MCI-123',
      }),
    ).rejects.toThrow('User not found');
  });

  it('rejects removing staff details for a cross-organization user', async () => {
    const service = makeService({
      user: { findFirst: () => null },
    });
    await expect(
      service.removeStaffDetail('user-other-tenant', 'tenant-A'),
    ).rejects.toThrow('User not found');
  });

  it('creates a staff-detail row on first upsert (scoped to the userId)', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 'sd-1' });
    const service = makeService({
      user: { findFirst: () => ({ id: 'user-1' }) },
      staffDetail: { upsert },
    });
    await service.upsertStaffDetail('user-1', 'tenant-A', {
      registrationNo: 'MCI-456',
      qualification: 'MD Pathology',
      designation: 'Chief Pathologist',
      signatureImageUrl: 'https://cdn.example.com/sig.png',
    });
    expect(upsert).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      create: {
        userId: 'user-1',
        tenantId: 'tenant-A',
        registrationNo: 'MCI-456',
        qualification: 'MD Pathology',
        designation: 'Chief Pathologist',
        signatureImageUrl: 'https://cdn.example.com/sig.png',
      },
      update: {
        registrationNo: 'MCI-456',
        qualification: 'MD Pathology',
        designation: 'Chief Pathologist',
        signatureImageUrl: 'https://cdn.example.com/sig.png',
      },
      select: expect.any(Object),
    });
  });

  it('normalizes empty strings to null so partial updates clear fields', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 'sd-1' });
    const service = makeService({
      user: { findFirst: () => ({ id: 'user-1' }) },
      staffDetail: { upsert },
    });
    await service.upsertStaffDetail('user-1', 'tenant-A', {
      registrationNo: '',
      designation: 'Technician',
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { registrationNo: null, designation: 'Technician' },
      }),
    );
  });

  it('does not touch fields omitted from the update payload', async () => {
    const upsert = jest.fn().mockResolvedValue({ id: 'sd-1' });
    const service = makeService({
      user: { findFirst: () => ({ id: 'user-1' }) },
      staffDetail: { upsert },
    });
    await service.upsertStaffDetail('user-1', 'tenant-A', {
      designation: 'Technician',
    });
    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: { designation: 'Technician' },
      }),
    );
    const updateArg = upsert.mock.calls[0][0].update;
    expect('registrationNo' in updateArg).toBe(false);
    expect('qualification' in updateArg).toBe(false);
  });

  it('removes the staff-detail row for a valid in-org user', async () => {
    const deleteMany = jest.fn().mockResolvedValue({ count: 1 });
    const service = makeService({
      user: { findFirst: () => ({ id: 'user-1' }) },
      staffDetail: { deleteMany },
    });
    const result = await service.removeStaffDetail('user-1', 'tenant-A');
    expect(deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(result).toEqual({ message: 'Staff details removed' });
  });
});
