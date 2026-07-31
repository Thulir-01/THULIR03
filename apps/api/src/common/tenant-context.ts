import { AsyncLocalStorage } from 'async_hooks';

/**
 * Request-scoped tenant (organization) context.
 *
 * The `TenantInterceptor` wraps every authenticated request in `runWithTenant()`
 * so that any downstream async work (Prisma queries, services) can read the
 * current tenant id via `getCurrentTenantId()` — no need to thread it through
 * method signatures. AsyncLocalStorage guarantees the value is scoped to the
 * request and cannot leak across concurrent requests.
 */
export const tenantStorage = new AsyncLocalStorage<string>();

/** Run `fn` inside the given tenant context. */
export function runWithTenant<T>(tenantId: string, fn: () => T): T {
  return tenantStorage.run(tenantId, fn);
}

/** Returns the tenant id for the current request, or `undefined` outside one. */
export function getCurrentTenantId(): string | undefined {
  return tenantStorage.getStore();
}
