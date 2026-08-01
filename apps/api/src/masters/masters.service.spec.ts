/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { resolveEffectivePrice } from './price-resolver';
import { MastersService } from './masters.service';

describe('resolveEffectivePrice — the shared pricing rule', () => {
  it('returns the default price when no referrer pricing applies', () => {
    expect(resolveEffectivePrice({ code: 'CBC', defaultPrice: 500 })).toBe(500);
  });

  it('applies a flat discount when pricingMode = discount', () => {
    expect(
      resolveEffectivePrice({
        code: 'CBC',
        defaultPrice: 500,
        referrer: { pricingMode: 'discount', discountPercent: 10 },
      }),
    ).toBe(450);
  });

  it('ignores discount when discountPercent is not set', () => {
    expect(
      resolveEffectivePrice({
        code: 'CBC',
        defaultPrice: 500,
        referrer: { pricingMode: 'discount', discountPercent: null },
      }),
    ).toBe(500);
  });

  it('uses the custom override when pricingMode = custom and an override exists', () => {
    expect(
      resolveEffectivePrice({
        code: 'CBC',
        defaultPrice: 500,
        referrer: { pricingMode: 'custom' },
        overridePrice: 250,
      }),
    ).toBe(250);
  });

  it('falls back to the default price when custom mode has no override', () => {
    expect(
      resolveEffectivePrice({
        code: 'CBC',
        defaultPrice: 500,
        referrer: { pricingMode: 'custom' },
        overridePrice: null,
      }),
    ).toBe(500);
  });

  it('uses fixedPrice as the base for fixed-priced packages', () => {
    expect(
      resolveEffectivePrice({
        code: 'FULL',
        defaultPrice: 0,
        fixedPrice: 999,
        referrer: null,
      }),
    ).toBe(999);
  });

  it('applies the discount to the fixed price for fixed packages', () => {
    expect(
      resolveEffectivePrice({
        code: 'FULL',
        defaultPrice: 0,
        fixedPrice: 1000,
        referrer: { pricingMode: 'discount', discountPercent: 25 },
      }),
    ).toBe(750);
  });
});

describe('MastersService — tenant guards & business rules', () => {
  const makeService = (overrides: Record<string, unknown>) =>
    new MastersService({ client: overrides } as any);

  it('rejects a referrer from another tenant when listing prices', async () => {
    const service = makeService({
      party: { findFirst: () => null },
    });
    await expect(
      service.listReferrerPrices('tenant-A', 'referrer-X'),
    ).rejects.toThrow('Referrer not found');
  });

  it('rejects a cross-tenant parameter in a referrer price override', async () => {
    const service = makeService({
      party: {
        findFirst: () => ({ id: 'ref-1', tenantId: 'tenant-A' }),
      },
      testParameter: { findFirst: () => null },
      testPackage: { findFirst: () => null },
    });
    await expect(
      service.upsertReferrerPrices('tenant-A', 'ref-1', [
        { parameterId: 'param-other-tenant', price: 100 },
      ]),
    ).rejects.toThrow('Parameter does not belong to this tenant');
  });

  it('throws a conflict (409) when creating a parameter with a duplicate code', async () => {
    const service = makeService({
      testParameter: {
        findFirst: () => ({ id: 'existing', code: 'CBC' }),
      },
    });
    await expect(
      service.createParameter('tenant-A', {
        code: 'cbc',
        name: 'Duplicate',
        categoryId: 'cat-1',
      }),
    ).rejects.toThrow('already exists');
  });

  it('rejects a fixed-priced package without a fixedPrice', async () => {
    const service = makeService({
      testPackage: { findFirst: () => null },
    });
    await expect(
      service.createPackage('tenant-A', {
        code: 'FULL',
        name: 'Full Panel',
        pricingMode: 'fixed',
        items: [],
      }),
    ).rejects.toThrow('fixedPrice is required');
  });

  it('rejects an override that sets neither parameterId nor packageId', async () => {
    const service = makeService({
      party: {
        findFirst: () => ({ id: 'ref-1', tenantId: 'tenant-A' }),
      },
    });
    await expect(
      service.upsertReferrerPrices('tenant-A', 'ref-1', [
        { price: 100 } as any,
      ]),
    ).rejects.toThrow('exactly one of parameterId or packageId');
  });
});

describe('MastersService — auto code generation (sequence-safe)', () => {
  // Mock a $transaction whose tx.mastersSequence.upsert atomically increments
  // a shared counter — the same contract the DB enforces with row locks.
  const seqService = (start = 0) => {
    let seq = start;
    return new MastersService({
      client: {
        testCategory: {
          findFirst: () => ({
            id: 'cat-1',
            name: 'Hematology',
            codePrefix: 'HEM',
          }),
        },
        $transaction: async (fn: any) =>
          fn({
            mastersSequence: {
              upsert: async () => {
                seq += 1;
                return { nextValue: seq };
              },
            },
          }),
      },
    } as any);
  };

  it('uses the category codePrefix and pads to 3 digits', async () => {
    const service = seqService();
    await expect(
      service.generateParameterCode('tenant-A', 'cat-1'),
    ).resolves.toBe('HEM-001');
    await expect(
      service.generateParameterCode('tenant-A', 'cat-1'),
    ).resolves.toBe('HEM-002');
  });

  it('falls back to the first 3 letters of the category name', async () => {
    const service = new MastersService({
      client: {
        testCategory: {
          findFirst: () => ({
            id: 'cat-1',
            name: 'Biochemistry',
            codePrefix: '',
          }),
        },
        $transaction: async (fn: any) =>
          fn({ mastersSequence: { upsert: async () => ({ nextValue: 7 }) } }),
      },
    } as any);
    await expect(
      service.generateParameterCode('tenant-A', 'cat-1'),
    ).resolves.toBe('BIO-007');
  });

  it('returns distinct codes for two concurrent requests', async () => {
    const service = seqService();
    const [a, b] = await Promise.all([
      service.generateParameterCode('tenant-A', 'cat-1'),
      service.generateParameterCode('tenant-A', 'cat-1'),
    ]);
    expect(a).not.toBe(b);
    expect([a, b].sort()).toEqual(['HEM-001', 'HEM-002']);
  });

  it('rejects an unknown category', async () => {
    const service = new MastersService({
      client: { testCategory: { findFirst: () => null } },
    } as any);
    await expect(
      service.generateParameterCode('tenant-A', 'cat-missing'),
    ).rejects.toThrow('Category not found');
  });

  it('generates package codes with the PKG prefix', async () => {
    const service = new MastersService({
      client: {
        $transaction: async (fn: any) =>
          fn({ mastersSequence: { upsert: async () => ({ nextValue: 3 }) } }),
      },
    } as any);
    await expect(service.generatePackageCode('tenant-A')).resolves.toBe(
      'PKG-003',
    );
  });
});

describe('MastersService — quick enable/disable + category defaults', () => {
  it('pre-fills sampleType and turnaround from category defaults', async () => {
    const service = new MastersService({
      client: {
        testParameter: {
          findFirst: () => null, // no duplicate code
          create: (args: any) => args.data,
        },
        testCategory: {
          findFirst: () => ({
            id: 'cat-1',
            defaultSampleType: 'Serum',
            defaultTurnaroundHours: 24,
          }),
        },
      },
    } as any);
    const created = await service.createParameter('tenant-A', {
      code: 'TSH',
      name: 'Thyroid Stimulating Hormone',
      categoryId: 'cat-1',
      defaultPrice: 300,
    });
    expect(created.sampleType).toBe('Serum');
    expect(created.turnaroundHours).toBe(24);
  });

  it('keeps an explicit sampleType over the category default', async () => {
    const service = new MastersService({
      client: {
        testParameter: {
          findFirst: () => null,
          create: (args: any) => args.data,
        },
        testCategory: {
          findFirst: () => ({
            id: 'cat-1',
            defaultSampleType: 'Serum',
            defaultTurnaroundHours: 24,
          }),
        },
      },
    } as any);
    const created = await service.createParameter('tenant-A', {
      code: 'TSH',
      name: 'Thyroid',
      categoryId: 'cat-1',
      sampleType: 'Plasma',
    });
    expect(created.sampleType).toBe('Plasma');
  });

  it('sets parameter status via the fast PATCH', async () => {
    const service = new MastersService({
      client: {
        testParameter: {
          findFirst: () => ({ id: 'p-1' }),
          update: (args: any) => args.data,
        },
      },
    } as any);
    await expect(
      service.setParameterStatus('tenant-A', 'p-1', false),
    ).resolves.toEqual({ isActive: false });
  });

  it('bulk-disables only tenant-owned parameters', async () => {
    const service = new MastersService({
      client: {
        testParameter: {
          updateMany: (args: any) => ({
            count: (args.where.id.in as string[]).length,
          }),
        },
      },
    } as any);
    await expect(
      service.bulkSetParameterStatus('tenant-A', ['p-1', 'p-2'], false),
    ).resolves.toEqual({ updated: 2 });
  });

  it('rejects a bulk call with no ids', async () => {
    const service = new MastersService({ client: {} } as any);
    await expect(
      service.bulkSetParameterStatus('tenant-A', [], false),
    ).rejects.toThrow('ids are required');
  });
});

describe('MastersService — generic lookup masters (one table, 8 types)', () => {
  it('scopes lookups to the tenant and type (isolation is on the query)', async () => {
    let capturedWhere: unknown = null;
    const service = new MastersService({
      client: {
        lookupMaster: {
          findMany: (args: any) => {
            capturedWhere = args.where;
            return [{ id: 'l-1', code: 'BLOOD', name: 'Whole Blood' }];
          },
        },
      },
    } as any);
    const rows = await service.findLookups('tenant-A', 'sample_type', {
      search: 'blood',
    });
    expect(rows).toHaveLength(1);
    expect(capturedWhere).toMatchObject({
      tenantId: 'tenant-A',
      type: 'sample_type',
    });
    expect((capturedWhere as any).OR).toBeDefined();
  });

  it('rejects an unknown lookup type', async () => {
    const service = new MastersService({ client: {} } as any);
    await expect(
      service.findLookups('tenant-A', 'dinosaur', {}),
    ).rejects.toThrow('Unknown lookup type');
  });

  it('throws a conflict (409) when creating a duplicate code within a type', async () => {
    const service = new MastersService({
      client: {
        lookupMaster: { findFirst: () => ({ id: 'existing', code: 'EDTA' }) },
      },
    } as any);
    await expect(
      service.createLookup('tenant-A', 'container_type', {
        code: 'edta',
        name: 'EDTA Tube',
      }),
    ).rejects.toThrow('already exists');
  });

  it('allows the same code in a different type (unique is per tenant+type+code)', async () => {
    let capturedCreate: unknown = null;
    const service = new MastersService({
      client: {
        lookupMaster: {
          findFirst: () => null,
          create: (args: any) => {
            capturedCreate = args.data;
            return args.data;
          },
        },
      },
    } as any);
    await service.createLookup('tenant-A', 'payment_mode', {
      code: 'cash',
      name: 'Cash',
      metadata: { percent: 0 },
    });
    expect(capturedCreate).toMatchObject({
      tenantId: 'tenant-A',
      type: 'payment_mode',
      code: 'CASH',
    });
    expect((capturedCreate as any).metadata).toEqual({ percent: 0 });
  });

  it('sets lookup status via the fast PATCH', async () => {
    const service = new MastersService({
      client: {
        lookupMaster: {
          findFirst: () => ({ id: 'l-1', tenantId: 'tenant-A' }),
          update: (args: any) => args.data,
        },
      },
    } as any);
    await expect(
      service.setLookupStatus('tenant-A', 'unit', 'l-1', false),
    ).resolves.toEqual({ isActive: false });
  });

  it('soft-deletes by deactivating, never hard-deleting', async () => {
    const service = new MastersService({
      client: {
        lookupMaster: {
          findFirst: () => ({ id: 'l-1' }),
          update: (args: any) => args.data,
          delete: () => {
            throw new Error('must not hard-delete');
          },
        },
      },
    } as any);
    await expect(
      service.removeLookup('tenant-A', 'rejection_reason', 'l-1'),
    ).resolves.toEqual({ isActive: false });
  });

  it('generates lookup codes with the type prefix and padded sequence', async () => {
    const service = new MastersService({
      client: {
        $transaction: async (fn: any) =>
          fn({
            mastersSequence: { upsert: async () => ({ nextValue: 4 }) },
          }),
      },
    } as any);
    await expect(
      service.generateLookupCode('tenant-A', 'rejection_reason'),
    ).resolves.toBe('RJ-004');
    await expect(
      service.generateLookupCode('tenant-A', 'sample_type'),
    ).resolves.toBe('ST-004');
  });
});
