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
