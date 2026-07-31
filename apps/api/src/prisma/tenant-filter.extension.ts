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
  'referrerprice',
  'auditlog',
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
        if (tenantId && TENANT_SCOPED_MODELS.has(model.toLowerCase())) {
          applyTenantScoping(operation, args, tenantId);
        }
        return query(args);
      },
    },
  },
};
