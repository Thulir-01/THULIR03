import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { PrismaService } from '../../prisma/prisma.service';
import { getCurrentTenantId } from '../tenant-context';

/** Paths that are never audited (auth flow + infra endpoints). */
const SKIP_PREFIXES = ['/api/v1/auth', '/api/docs', '/health'];

/** Max size of the serialized `after` payload stored per audit entry. */
const MAX_AFTER_BYTES = 100_000;

/** Recursively strips secrets from response payloads before storing them. */
function sanitizeAfter(value: unknown, depth = 0): unknown {
  if (depth > 6) return undefined;
  if (Array.isArray(value)) {
    return value.map((item) => sanitizeAfter(item, depth + 1));
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (/(password|secret|token)/i.test(key)) continue;
      out[key] = sanitizeAfter(val, depth + 1);
    }
    return out;
  }
  return value;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(private prisma: PrismaService) {}

  async intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Promise<Observable<unknown>> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<{
      method: string;
      originalUrl?: string;
      url?: string;
      ip?: string;
      headers?: Record<string, string | string[] | undefined>;
      params?: Record<string, string>;
      body?: Record<string, unknown>;
      user?: { sub?: string; organizationId?: string };
    }>();

    const method = request.method;
    if (!['POST', 'PATCH', 'PUT', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const path = request.originalUrl ?? request.url ?? '';
    if (SKIP_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return next.handle();
    }

    const parts = path.split('/').filter(Boolean);
    const entity = parts[2] ?? 'unknown';
    const actorId = request.user?.sub ?? null;
    const tenantId =
      getCurrentTenantId() ?? request.user?.organizationId ?? null;
    const ipAddress = request.ip ?? null;
    const userAgent =
      (request.headers?.['user-agent'] as string | undefined) ?? null;

    // Snapshot the pre-image of the record being mutated (PATCH/PUT/DELETE)
    // so the audit trail captures "what did this value used to be" too.
    const before =
      method === 'PATCH' || method === 'PUT' || method === 'DELETE'
        ? await this.fetchPreImage(entity, parts, request.params, tenantId)
        : undefined;

    return next.handle().pipe(
      map((body: unknown) => {
        // For creates the entity id is only known from the response payload.
        const responseBody = (body ?? {}) as {
          id?: unknown;
          orderId?: unknown;
        };
        const entityId: string | null =
          request.params?.orderId ??
          request.params?.id ??
          (typeof request.body?.id === 'string'
            ? request.body.id
            : undefined) ??
          (typeof responseBody.id === 'string' ? responseBody.id : undefined) ??
          (typeof responseBody.orderId === 'string'
            ? responseBody.orderId
            : undefined) ??
          null;

        // Fire-and-forget — an audit failure must never fail the request.
        void this.writeAudit({
          tenantId,
          actorId,
          action: method,
          entity,
          entityId,
          before,
          after: sanitizeAfter(body),
          ipAddress,
          userAgent,
        });
        return body;
      }),
    );
  }

  private async writeAudit(entry: {
    tenantId: string | null;
    actorId: string | null;
    action: string;
    entity: string;
    entityId: string | null;
    before: unknown;
    after: unknown;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<void> {
    try {
      const toPlainJson = (value: unknown): unknown => {
        if (value === undefined || value === null) return value;
        try {
          const serialized = JSON.stringify(value);
          if (serialized.length > MAX_AFTER_BYTES) {
            return { truncated: true, bytes: serialized.length };
          }
          // Round-trip through JSON so Prisma Decimal/Date instances and
          // undefined fields become plain JSON values (Json columns reject
          // class instances).
          return JSON.parse(serialized);
        } catch {
          return { unserializable: true };
        }
      };
      const before = toPlainJson(entry.before);
      const after = toPlainJson(entry.after);
      await this.prisma.client.auditLog.create({
        data: {
          tenantId: entry.tenantId,
          actorId: entry.actorId,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          before: before === null || before === undefined ? undefined : before,
          after: after === null || after === undefined ? undefined : after,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch {
      // Intentionally ignored — auditing must not break business requests.
    }
  }

  /**
   * Fetches the pre-image of the record a write is about to mutate, so audit
   * entries carry both `before` and `after`. Tenant-scoped models go through
   * the extended client, so the tenant filter applies automatically.
   */
  private async fetchPreImage(
    entity: string,
    parts: string[],
    params?: Record<string, string>,
    tenantId?: string | null,
  ): Promise<unknown> {
    if (!params) return undefined;
    try {
      if (entity === 'orders' && parts[4] === 'tests' && params.testId) {
        return await this.prisma.client.orderTest.findFirst({
          where: { id: params.testId },
        });
      }
      if (entity === 'orders' && params.orderId) {
        return await this.prisma.client.order.findFirst({
          where: { id: params.orderId },
        });
      }
      if (entity === 'patients' && params.id) {
        return await this.prisma.client.patient.findFirst({
          where: { id: params.id },
        });
      }
      if (entity === 'referrers' && params.id) {
        return await this.prisma.client.party.findFirst({
          where: { id: params.id, partyType: 'doctor' },
          include: { doctorDetail: true },
        });
      }
      if (entity === 'parties' && params.id) {
        return await this.prisma.client.party.findFirst({
          where: { id: params.id },
        });
      }
      if (entity === 'inventory' && parts[3] === 'items' && params.id) {
        return await this.prisma.client.inventoryItem.findFirst({
          where: { id: params.id },
        });
      }
      if (entity === 'inventory' && parts[3] === 'suppliers' && params.id) {
        return await this.prisma.client.inventorySupplier.findFirst({
          where: { id: params.id },
        });
      }
      if (entity === 'inventory' && parts[3] === 'requirements' && params.id) {
        return await this.prisma.client.testInventoryRequirement.findFirst({
          where: { id: params.id },
        });
      }
      // Lab settings live on the Organization row itself (tenant-scoped by
      // definition — the org id IS the tenant id).
      if (entity === 'settings' && parts[3] === 'lab' && tenantId) {
        return await this.prisma.client.organization.findFirst({
          where: { id: tenantId },
        });
      }
    } catch {
      // Pre-image fetch must never fail the request it audits.
    }
    return undefined;
  }
}
