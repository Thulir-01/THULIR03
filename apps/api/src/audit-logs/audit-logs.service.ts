import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogQuery {
  action?: string;
  entity?: string;
  from?: string;
  to?: string;
  limit?: number;
}

@Injectable()
export class AuditLogsService {
  constructor(private prisma: PrismaService) {}

  async list(orgId: string, query: AuditLogQuery) {
    // Tenant scoping is enforced by the tenant-filter extension, and we also
    // pass the org explicitly (defense in depth).
    const rawLimit = Number(query.limit);
    const limit = Number.isFinite(rawLimit)
      ? Math.min(Math.max(Math.floor(rawLimit), 1), 200)
      : 100;

    const where = {
      tenantId: orgId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.entity ? { entity: query.entity } : {}),
      // ISO date-range filter (inclusive) — used by the Audit Log viewer's
      // "Last 24h / Last 7 days / Last month / custom" presets.
      ...(query.from || query.to
        ? {
            createdAt: {
              ...(query.from ? { gte: new Date(query.from) } : {}),
              ...(query.to ? { lte: new Date(query.to) } : {}),
            },
          }
        : {}),
    };

    const logs = await this.prisma.client.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });

    // The AuditLog model has no FK relation to User, so resolve actor names
    // with a single follow-up query.
    const actorIds = [
      ...new Set(
        logs
          .map((log) => log.actorId)
          .filter((id): id is string => id !== null),
      ),
    ];
    const actorNames = new Map<string, string>();
    const actorRoles = new Map<string, string | null>();
    if (actorIds.length > 0) {
      const users = await this.prisma.client.user.findMany({
        where: { id: { in: actorIds } },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          role: { select: { name: true } },
        },
      });
      for (const user of users) {
        actorNames.set(user.id, `${user.firstName} ${user.lastName}`.trim());
        actorRoles.set(user.id, user.role?.name ?? null);
      }
    }

    return logs.map((log) => ({
      id: log.id,
      tenantId: log.tenantId,
      actorId: log.actorId,
      actorName: log.actorId ? (actorNames.get(log.actorId) ?? null) : null,
      action: log.action,
      entity: log.entity,
      entityId: log.entityId,
      actorRole: log.actorId ? (actorRoles.get(log.actorId) ?? null) : null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      before: log.before,
      after: log.after,
      createdAt: log.createdAt,
    }));
  }
}
