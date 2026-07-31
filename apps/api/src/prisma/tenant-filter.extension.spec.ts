/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
import {
  TENANT_SCOPED_MODELS,
  applyTenantScoping,
} from './tenant-filter.extension';

describe('applyTenantScoping', () => {
  it('scopes tenant models (case-insensitive model list)', () => {
    expect(TENANT_SCOPED_MODELS.has('patient')).toBe(true);
    expect(TENANT_SCOPED_MODELS.has('doctorreferrer')).toBe(true);
    expect(TENANT_SCOPED_MODELS.has('order')).toBe(true);
    expect(TENANT_SCOPED_MODELS.has('auditlog')).toBe(true);
    // Non-tenant models are never scoped
    expect(TENANT_SCOPED_MODELS.has('user')).toBe(false);
    expect(TENANT_SCOPED_MODELS.has('organization')).toBe(false);
    expect(TENANT_SCOPED_MODELS.has('ordertest')).toBe(false);
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
