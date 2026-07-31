import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogQuery {
  action?: string;
  entity?: string;
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
      : 50;

    const where = {
      tenantId: orgId,
      ...(query.action ? { action: query.action } : {}),
      ...(query.entity ? { entity: query.entity } : {}),
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
    if (actorIds.length > 0) {
      const users = await this.prisma.client.user.findMany({
        where: { id: { in: actorIds } },
        select: { id: true, firstName: true, lastName: true },
      });
      for (const user of users) {
        actorNames.set(user.id, `${user.firstName} ${user.lastName}`.trim());
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
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      before: log.before,
      after: log.after,
      createdAt: log.createdAt,
    }));
  }
}
