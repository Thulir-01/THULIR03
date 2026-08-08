/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import {
  TENANT_SCOPED_MODELS,
  TENANT_FREE_OPERATIONS,
  applyTenantScoping,
  resolveTenantEnforcement,
} from './tenant-filter.extension';

describe('applyTenantScoping', () => {
  it('scopes tenant models (case-insensitive model list)', () => {
    expect(TENANT_SCOPED_MODELS.has('patient')).toBe(true);
    // Referrers migrated into the parties foundation
    expect(TENANT_SCOPED_MODELS.has('party')).toBe(true);
    expect(TENANT_SCOPED_MODELS.has('partydoctordetail')).toBe(true);
    expect(TENANT_SCOPED_MODELS.has('doctorreferrer')).toBe(false);
    expect(TENANT_SCOPED_MODELS.has('order')).toBe(true);
    expect(TENANT_SCOPED_MODELS.has('auditlog')).toBe(true);
    // Sprint 5.6: Sample + OrderTest are tenant-scoped too
    expect(TENANT_SCOPED_MODELS.has('sample')).toBe(true);
    expect(TENANT_SCOPED_MODELS.has('ordertest')).toBe(true);
    // Non-tenant models are never scoped
    expect(TENANT_SCOPED_MODELS.has('user')).toBe(false);
    expect(TENANT_SCOPED_MODELS.has('organization')).toBe(false);
  });

  it('injects tenantId into findMany where', () => {
    const args: any = { where: { status: 'pending' } };
    applyTenantScoping('findMany', args, 'org-A');
    expect(args.where).toEqual({ status: 'pending', tenantId: 'org-A' });
  });

  it('injects tenantId into findFirst and count', () => {
    const args1: any = { where: { id: 'x' } };
    applyTenantScoping('findFirst', args1, 'org-A');
    expect(args1.where.tenantId).toBe('org-A');

    const args2: any = { where: {} };
    applyTenantScoping('count', args2, 'org-A');
    expect(args2.where.tenantId).toBe('org-A');
  });

  it('merges tenantId into findUnique where (extended where unique)', () => {
    const args: any = { where: { id: 'abc' } };
    applyTenantScoping('findUnique', args, 'org-B');
    expect(args.where).toEqual({ id: 'abc', tenantId: 'org-B' });
  });

  it('OVERWRITES a caller-supplied tenantId (isolation cannot be bypassed)', () => {
    const args: any = { where: { id: 'x', tenantId: 'org-EVIL' } };
    applyTenantScoping('findMany', args, 'org-GOOD');
    expect(args.where.tenantId).toBe('org-GOOD');
  });

  it('forces tenantId on create', () => {
    const args: any = { data: { firstName: 'A' } };
    applyTenantScoping('create', args, 'org-A');
    expect(args.data.tenantId).toBe('org-A');
  });

  it('forces tenantId on createMany (array and single data)', () => {
    const arrayArgs: any = {
      data: [{ firstName: 'A' }, { firstName: 'B' }],
    };
    applyTenantScoping('createMany', arrayArgs, 'org-A');
    expect(arrayArgs.data[0].tenantId).toBe('org-A');
    expect(arrayArgs.data[1].tenantId).toBe('org-A');

    const singleArgs: any = { data: { firstName: 'C' } };
    applyTenantScoping('createMany', singleArgs, 'org-A');
    expect(singleArgs.data.tenantId).toBe('org-A');
  });

  it('scopes update/delete and prevents tenant changes on update', () => {
    const updateArgs: any = {
      where: { id: 'x' },
      data: { result: '5.0', tenantId: 'org-EVIL' },
    };
    applyTenantScoping('update', updateArgs, 'org-A');
    expect(updateArgs.where.tenantId).toBe('org-A');
    expect(updateArgs.data.tenantId).toBe('org-A'); // forced back to context

    const deleteArgs: any = { where: { id: 'x' } };
    applyTenantScoping('delete', deleteArgs, 'org-A');
    expect(deleteArgs.where.tenantId).toBe('org-A');
  });

  it('is a no-op without args', () => {
    expect(() =>
      applyTenantScoping('findMany', undefined, 'org-A'),
    ).not.toThrow();
  });
});

describe('resolveTenantEnforcement (fail-closed policy)', () => {
  it('scopes tenant models when a tenant context exists', () => {
    expect(resolveTenantEnforcement('order', 'findMany', 'org-A')).toBe(
      'scope',
    );
    expect(resolveTenantEnforcement('Patient', 'findUnique', 'org-A')).toBe(
      'scope',
    );
  });

  it('DENIES tenant-scoped models queried WITHOUT a tenant context', () => {
    // The security fix: a background job / queue consumer / webhook that
    // forgets runWithTenant must fail loudly instead of silently reading
    // across ALL tenants.
    expect(resolveTenantEnforcement('order', 'findMany', undefined)).toBe(
      'deny',
    );
    expect(resolveTenantEnforcement('order', 'findFirst', undefined)).toBe(
      'deny',
    );
    expect(resolveTenantEnforcement('order', 'create', undefined)).toBe('deny');
    expect(resolveTenantEnforcement('patient', 'findUnique', undefined)).toBe(
      'deny',
    );
    expect(resolveTenantEnforcement('ordertest', 'updateMany', undefined)).toBe(
      'deny',
    );
    expect(resolveTenantEnforcement('auditlog', 'findMany', undefined)).toBe(
      'deny',
    );
  });

  it('allows ONLY the explicitly allowlisted tenant-free operations', () => {
    // Public report verification by globally-unique orderNumber (the service
    // scopes by order.tenantId itself) — must keep working without auth.
    expect(resolveTenantEnforcement('order', 'findUnique', undefined)).toBe(
      'allow-tenant-free',
    );
    expect(resolveTenantEnforcement('Order', 'FINDUNIQUE', undefined)).toBe(
      'allow-tenant-free',
    );
    // Fire-and-forget audit writes (tenantId nullable by schema).
    expect(resolveTenantEnforcement('auditlog', 'create', undefined)).toBe(
      'allow-tenant-free',
    );
    // Same model, non-allowlisted op → still denied.
    expect(resolveTenantEnforcement('order', 'findMany', undefined)).toBe(
      'deny',
    );
  });

  it('leaves non-tenant models untouched', () => {
    expect(resolveTenantEnforcement('user', 'findMany', undefined)).toBe(
      'not-scoped',
    );
    expect(resolveTenantEnforcement('organization', 'create', undefined)).toBe(
      'not-scoped',
    );
    expect(resolveTenantEnforcement('role', 'findFirst', undefined)).toBe(
      'not-scoped',
    );
  });

  it('keeps the allowlist minimal and explicit', () => {
    // Guard rails: if a future op gets added to the allowlist, these tests
    // force a conscious review — the set must stay tiny.
    expect(TENANT_FREE_OPERATIONS.size).toBe(2);
    expect(TENANT_FREE_OPERATIONS.has('order:findunique')).toBe(true);
    expect(TENANT_FREE_OPERATIONS.has('auditlog:create')).toBe(true);
  });
});
