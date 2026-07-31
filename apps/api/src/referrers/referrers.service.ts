import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreateReferrerDto {
  name: string;
  specialty?: string;
  phone?: string;
  email?: string;
  clinicName?: string;
  registration?: string;
  commission?: number;
}

export interface UpdateReferrerDto extends Partial<CreateReferrerDto> {}

@Injectable()
export class ReferrersService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string, query?: { search?: string }) {
    const where: Record<string, unknown> = {
      tenantId: organizationId,
      deletedAt: null,
    };

    if (query?.search) {
      const s = query.search;
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s } },
        { email: { contains: s, mode: 'insensitive' } },
        { clinicName: { contains: s, mode: 'insensitive' } },
        { specialty: { contains: s, mode: 'insensitive' } },
      ];
    }

    return this.prisma.client.doctorReferrer.findMany({
      where,
      include: {
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const referrer = await this.prisma.client.doctorReferrer.findFirst({
      where: { id, tenantId: organizationId, deletedAt: null },
    });
    if (!referrer) throw new NotFoundException('Referrer not found');
    return referrer;
  }

  async create(organizationId: string, data: CreateReferrerDto) {
    return this.prisma.client.doctorReferrer.create({
      data: {
        tenantId: organizationId,
        name: data.name,
        specialty: data.specialty ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        clinicName: data.clinicName ?? null,
        registration: data.registration ?? null,
        commission: data.commission ?? 0,
      },
    });
  }

  async update(id: string, organizationId: string, data: UpdateReferrerDto) {
    const referrer = await this.prisma.client.doctorReferrer.findFirst({
      where: { id, tenantId: organizationId, deletedAt: null },
    });
    if (!referrer) throw new NotFoundException('Referrer not found');

    const updateData: Record<string, unknown> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.specialty !== undefined) updateData.specialty = data.specialty;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.clinicName !== undefined) updateData.clinicName = data.clinicName;
    if (data.registration !== undefined) updateData.registration = data.registration;
    if (data.commission !== undefined) updateData.commission = data.commission;

    return this.prisma.client.doctorReferrer.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, organizationId: string) {
    const referrer = await this.prisma.client.doctorReferrer.findFirst({
      where: { id, tenantId: organizationId, deletedAt: null },
    });
    if (!referrer) throw new NotFoundException('Referrer not found');
    await this.prisma.client.doctorReferrer.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { message: 'Referrer deleted' };
  }
}
