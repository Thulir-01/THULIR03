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

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
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
    after: unknown;
    ipAddress: string | null;
    userAgent: string | null;
  }): Promise<void> {
    try {
      let after: unknown = entry.after;
      if (after !== undefined && after !== null) {
        const serialized = JSON.stringify(after);
        if (serialized.length > MAX_AFTER_BYTES) {
          after = { truncated: true, bytes: serialized.length };
        }
      }
      await this.prisma.client.auditLog.create({
        data: {
          tenantId: entry.tenantId,
          actorId: entry.actorId,
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId,
          after: after === null ? undefined : after,
          ipAddress: entry.ipAddress,
          userAgent: entry.userAgent,
        },
      });
    } catch {
      // Intentionally ignored — auditing must not break business requests.
    }
  }
}
