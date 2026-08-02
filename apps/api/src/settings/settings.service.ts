import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

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
}
