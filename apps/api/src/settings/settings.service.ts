import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';

export interface LabSettingsDto {
  name?: string;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
}

export interface LabSettingsRow {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
}

@Injectable()
export class SettingsService {
  constructor(private prisma: PrismaService) {}

  async getLab(organizationId: string): Promise<LabSettingsRow> {
    const org = await this.prisma.client.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { name: true, address: true, phone: true, email: true },
    });
    if (!org) throw new NotFoundException('Organization not found');
    return org;
  }

  async updateLab(
    organizationId: string,
    data: LabSettingsDto,
  ): Promise<LabSettingsRow> {
    const org = await this.prisma.client.organization.findFirst({
      where: { id: organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!org) throw new NotFoundException('Organization not found');

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.address !== undefined) patch.address = data.address ?? null;
    if (data.phone !== undefined) patch.phone = data.phone ?? null;
    if (data.email !== undefined) patch.email = data.email ?? null;

    const updated = await this.prisma.client.organization.update({
      where: { id: org.id },
      data: patch,
      select: { name: true, address: true, phone: true, email: true },
    });
    return updated;
  }

  /**
   * All tenant config rows as a key → value map. Powers the fully-working
   * settings page (QC rules, notifications, audit, lab extras) — values are
   * server-persisted, shared across users, and survive refresh/logout.
   */
  async getConfig(organizationId: string): Promise<Record<string, unknown>> {
    const rows = await this.prisma.client.labConfig.findMany({
      where: { tenantId: organizationId },
      select: { key: true, value: true },
    });
    const out: Record<string, unknown> = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  }

  /** Upsert a single config key for the tenant. */
  async setConfig(
    organizationId: string,
    key: string,
    value: unknown,
  ): Promise<{ key: string; updatedAt: Date }> {
    const cleanKey = key.trim();
    if (!cleanKey) throw new BadRequestException('key is required');
    const existing = await this.prisma.client.labConfig.findFirst({
      where: { tenantId: organizationId, key: cleanKey },
      select: { id: true },
    });
    const json = value as Prisma.InputJsonValue;
    const row = existing
      ? await this.prisma.client.labConfig.update({
          where: { id: existing.id },
          data: { value: json },
        })
      : await this.prisma.client.labConfig.create({
          data: { tenantId: organizationId, key: cleanKey, value: json },
        });
    return { key: row.key, updatedAt: row.updatedAt };
  }
}
