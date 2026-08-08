/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-return */
import { getCurrentTenantId } from '../common/tenant-context';

/**
 * Prisma 7 client extension that enforces tenant isolation at the query layer.
 *
 * For every operation on tenant-scoped models it:
 *   - reads the current tenant id from the AsyncLocalStorage context
 *     (set per-request by `TenantInterceptor`),
 *   - injects `tenantId` into the `where` clause (reads / updates / deletes),
 *   - forces `tenantId` on `create` (clients can never write into another org).
 *
 * Because this lives in the client itself, services cannot accidentally forget
 * to scope a query — the database access is the enforcement point.
 *
 * The check is FAIL-CLOSED: a tenant-scoped model queried with NO tenant
 * context throws instead of silently querying across all tenants. The only
 * exceptions are the operations explicitly listed in `TENANT_FREE_OPERATIONS`,
 * which must be reviewed before anything is added there.
 */

/** Models whose rows are scoped to a tenant (lower-cased for safety). */
export const TENANT_SCOPED_MODELS = new Set([
  'patient',
  'party',
  'partydoctordetail',
  'order',
  'sample',
  'ordertest',
  'testcategory',
  'testparameter',
  'testpackage',
  'masterssequence',
  'referrerprice',
  'lookupmaster',
  'staffdetail',
  'auditlog',
  'inventorysupplier',
  'inventoryitem',
  'inventorytransaction',
  'testinventoryrequirement',
  'labconfig',
]);

/**
 * Intentionally tenant-free operations on tenant-scoped models — `model:op`
 * pairs that legitimately run without a tenant context. Keep this list as
 * small as possible: anything listed here is NOT tenant-isolated.
 *
 * - `order:findunique` — the public report-verification endpoint looks up an
 *   order by its globally-unique `orderNumber` with no auth; the service then
 *   scopes by `order.tenantId` itself before returning anything (and returns
 *   no PHI — see portals.service `verifyReport`).
 * - `auditlog:create` — fire-and-forget audit rows; `tenantId` is nullable by
 *   schema and the AuditInterceptor explicitly passes null when there is no
 *   request context (a failed audit write must never fail the request).
 */
export const TENANT_FREE_OPERATIONS = new Set([
  'order:findunique',
  'auditlog:create',
]);

const READ_OPS = new Set([
  'findMany',
  'findFirst',
  'findFirstOrThrow',
  'findUnique',
  'findUniqueOrThrow',
  'count',
  'aggregate',
  'groupBy',
]);

const CREATE_OPS = new Set([
  'create',
  'createMany',
  'createManyAndReturn',
  'upsert',
]);

const UPDATE_OPS = new Set([
  'update',
  'updateMany',
  'updateManyAndReturn',
  'upsert',
]);

const DELETE_OPS = new Set(['delete', 'deleteMany', 'deleteManyAndReturn']);

/** Merge `tenantId` into a where clause, overriding any caller-provided value. */
function scopeWhere(
  where: Record<string, unknown> | undefined,
  tenantId: string,
): Record<string, unknown> {
  return { ...(where ?? {}), tenantId };
}

/**
 * Pure, testable scoping logic. Mutates `args` in place so the original
 * Prisma call is executed with the tenant constraints applied.
 */
export function applyTenantScoping(
  operation: string,
  args: Record<string, any> | undefined,
  tenantId: string,
): void {
  if (!args) return;

  if (READ_OPS.has(operation)) {
    args.where = scopeWhere(args.where, tenantId);
    return;
  }

  if (CREATE_OPS.has(operation)) {
    if (operation === 'upsert') {
      args.create = scopeWhere(args.create, tenantId);
      args.update = scopeWhere(args.update, tenantId);
      return;
    }
    if (operation === 'createMany' || operation === 'createManyAndReturn') {
      const items = Array.isArray(args.data) ? args.data : [args.data];
      for (const item of items) {
        if (item) item.tenantId = tenantId;
      }
      return;
    }
    args.data = { ...(args.data ?? {}), tenantId };
    return;
  }

  if (UPDATE_OPS.has(operation)) {
    args.where = scopeWhere(args.where, tenantId);
    args.data = { ...(args.data ?? {}), tenantId };
    return;
  }

  if (DELETE_OPS.has(operation)) {
    args.where = scopeWhere(args.where, tenantId);
  }
}

export type TenantEnforcement =
  'scope' | 'allow-tenant-free' | 'not-scoped' | 'deny';

/**
 * Pure decision function for the fail-closed policy. Returns what the query
 * hook should do for this model/operation/tenant combination:
 *
 * - `scope`           → tenant context present, apply scoping
 * - `allow-tenant-free` → no context, but the op is on the explicit allowlist
 * - `not-scoped`      → model isn't tenant-scoped, nothing to enforce
 * - `deny`            → tenant-scoped model without a tenant context → throw
 */
export function resolveTenantEnforcement(
  model: string,
  operation: string,
  tenantId: string | undefined,
): TenantEnforcement {
  const key = model.toLowerCase();
  if (!TENANT_SCOPED_MODELS.has(key)) return 'not-scoped';
  if (tenantId) return 'scope';
  if (TENANT_FREE_OPERATIONS.has(`${key}:${operation.toLowerCase()}`)) {
    return 'allow-tenant-free';
  }
  return 'deny';
}

export const tenantFilterExtension = {
  name: 'tenant-filter',
  query: {
    $allModels: {
      async $allOperations({
        operation,
        model,
        args,
        query,
      }: {
        operation: string;
        model: string;
        args: Record<string, any> | undefined;
        query: (args: any) => Promise<any>;
      }) {
        const tenantId = getCurrentTenantId();
        const enforcement = resolveTenantEnforcement(
          model,
          operation,
          tenantId,
        );
        if (enforcement === 'scope') {
          applyTenantScoping(operation, args, tenantId as string);
        } else if (enforcement === 'deny') {
          // Fail closed: never silently query across all tenants. Any future
          // background job / queue consumer / webhook that needs tenant data
          // MUST run inside `runWithTenant` — there is no silent bypass.
          throw new Error(
            `Tenant isolation violation: ${model}.${operation} executed without a tenant context. ` +
              `Tenant-scoped models must be queried inside a tenant context ` +
              `(runWithTenant), or be explicitly listed in TENANT_FREE_OPERATIONS.`,
          );
        }
        return query(args);
      },
    },
  },
};
