import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface CreatePatientDto {
  firstName: string;
  lastName: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  email?: string;
  address?: string;
  abhaAddress?: string;
  abhaNumber?: string;
  patientId?: string;
}

export interface UpdatePatientDto extends Partial<CreatePatientDto> {}

@Injectable()
export class PatientsService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string, query?: { search?: string }) {
    const where: Record<string, unknown> = {
      tenantId: organizationId,
      deletedAt: null,
    };

    if (query?.search) {
      const s = query.search;
      where.OR = [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s } },
        { email: { contains: s, mode: 'insensitive' } },
        { patientId: { contains: s } },
        { abhaAddress: { contains: s, mode: 'insensitive' } },
      ];
    }

    return this.prisma.patient.findMany({
      where,
      include: {
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, tenantId: organizationId, deletedAt: null },
      include: {
        orders: {
          where: { deletedAt: null },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    return patient;
  }

  async create(organizationId: string, data: CreatePatientDto) {
    return this.prisma.patient.create({
      data: {
        tenantId: organizationId,
        firstName: data.firstName,
        lastName: data.lastName,
        dateOfBirth: data.dateOfBirth ? new Date(data.dateOfBirth) : null,
        gender: data.gender ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        address: data.address ?? null,
        abhaAddress: data.abhaAddress ?? null,
        abhaNumber: data.abhaNumber ?? null,
        patientId: data.patientId ?? null,
      },
    });
  }

  async update(id: string, organizationId: string, data: UpdatePatientDto) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, tenantId: organizationId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');

    const updateData: Record<string, unknown> = {};
    if (data.firstName !== undefined) updateData.firstName = data.firstName;
    if (data.lastName !== undefined) updateData.lastName = data.lastName;
    if (data.dateOfBirth !== undefined)
      updateData.dateOfBirth = data.dateOfBirth ? new Date(data.dateOfBirth) : null;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.email !== undefined) updateData.email = data.email;
    if (data.address !== undefined) updateData.address = data.address;
    if (data.abhaAddress !== undefined) updateData.abhaAddress = data.abhaAddress;
    if (data.abhaNumber !== undefined) updateData.abhaNumber = data.abhaNumber;
    if (data.patientId !== undefined) updateData.patientId = data.patientId;

    return this.prisma.patient.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(id: string, organizationId: string) {
    const patient = await this.prisma.patient.findFirst({
      where: { id, tenantId: organizationId, deletedAt: null },
    });
    if (!patient) throw new NotFoundException('Patient not found');
    await this.prisma.patient.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
    return { message: 'Patient deleted' };
  }
}
