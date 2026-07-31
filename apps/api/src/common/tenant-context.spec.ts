import { getCurrentTenantId, runWithTenant } from './tenant-context';

describe('TenantContext (AsyncLocalStorage)', () => {
  it('returns undefined outside a tenant context', () => {
    expect(getCurrentTenantId()).toBeUndefined();
  });

  it('returns the tenant id inside runWithTenant', () => {
    runWithTenant('org-1', () => {
      expect(getCurrentTenantId()).toBe('org-1');
    });
  });

  it('preserves the outer context after runWithTenant exits', () => {
    runWithTenant('org-outer', () => {
      runWithTenant('org-inner', () => {
        expect(getCurrentTenantId()).toBe('org-inner');
      });
      expect(getCurrentTenantId()).toBe('org-outer');
    });
    expect(getCurrentTenantId()).toBeUndefined();
  });

  it('does not leak tenant context across concurrent async tasks', async () => {
    const results: string[] = [];

    await Promise.all(
      Array.from({ length: 20 }, (_, i) =>
        runWithTenant(`org-${i}`, async () => {
          // Simulate a DB round-trip so the continuation runs on a microtask.
          await new Promise((resolve) => setTimeout(resolve, 1));
          results.push(getCurrentTenantId() ?? 'none');
        }),
      ),
    );

    expect(results).toHaveLength(20);
    // Every task observed exactly its own tenant id — none leaked.
    results.forEach((tenantId, i) => expect(tenantId).toBe(`org-${i}`));
  });
});
