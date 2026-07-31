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
  // Pricing: "default" | "discount" | "custom" + optional flat discount %
  pricingMode?: string;
  discountPercent?: number;
}

export type UpdateReferrerDto = Partial<CreateReferrerDto>;

// A referrer is now a Party of type 'doctor' (Master Data Management
// foundation) with a 1:1 PartyDoctorDetail extension. The response shape is
// unchanged so the web layer and referrer-pricing screens keep working.
export interface ReferrerRow {
  id: string;
  name: string;
  specialty: string | null;
  phone: string | null;
  email: string | null;
  clinicName: string | null;
  registration: string | null;
  commission: number | null;
  pricingMode: string | null;
  discountPercent: number | null;
  isActive: boolean;
  createdAt: Date;
  _count?: { orders: number };
}

function toRow(party: {
  id: string;
  name: string;
  status: string;
  primaryContactPhone: string | null;
  primaryContactEmail: string | null;
  createdAt: Date;
  _count?: { orders: number };
  doctorDetail: {
    specialization: string | null;
    clinicAffiliation: string | null;
    medicalCouncilNo: string | null;
    commissionPercent: { toNumber?: () => number } | number | null;
    pricingMode: string | null;
    discountPercent: { toNumber?: () => number } | number | null;
  } | null;
}): ReferrerRow {
  const d = party.doctorDetail;
  const num = (
    v: { toNumber?: () => number } | number | null | undefined,
  ): number | null =>
    v == null
      ? null
      : typeof v === 'number'
        ? v
        : v.toNumber
          ? v.toNumber()
          : Number(v);
  return {
    id: party.id,
    name: party.name,
    specialty: d?.specialization ?? null,
    phone: party.primaryContactPhone ?? null,
    email: party.primaryContactEmail ?? null,
    clinicName: d?.clinicAffiliation ?? null,
    registration: d?.medicalCouncilNo ?? null,
    commission: num(d?.commissionPercent),
    pricingMode: d?.pricingMode ?? 'default',
    discountPercent: num(d?.discountPercent),
    isActive: party.status === 'active',
    createdAt: party.createdAt,
    _count: party._count,
  };
}

@Injectable()
export class ReferrersService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string, query?: { search?: string }) {
    const where: Record<string, unknown> = {
      tenantId: organizationId,
      partyType: 'doctor',
      deletedAt: null,
    };

    if (query?.search) {
      const s = query.search;
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { primaryContactPhone: { contains: s } },
        { primaryContactEmail: { contains: s, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.client.party.findMany({
      where,
      include: {
        doctorDetail: true,
        _count: { select: { orders: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRow);
  }

  async findOne(id: string, organizationId: string) {
    const party = await this.prisma.client.party.findFirst({
      where: {
        id,
        tenantId: organizationId,
        partyType: 'doctor',
        deletedAt: null,
      },
      include: { doctorDetail: true },
    });
    if (!party) throw new NotFoundException('Referrer not found');
    return toRow(party);
  }

  async create(organizationId: string, data: CreateReferrerDto) {
    const party = await this.prisma.client.party.create({
      data: {
        tenantId: organizationId,
        partyType: 'doctor',
        name: data.name,
        primaryContactPhone: data.phone ?? null,
        primaryContactEmail: data.email ?? null,
        doctorDetail: {
          create: {
            tenantId: organizationId,
            specialization: data.specialty ?? null,
            clinicAffiliation: data.clinicName ?? null,
            medicalCouncilNo: data.registration ?? null,
            commissionPercent: data.commission ?? 0,
            pricingMode: data.pricingMode ?? 'default',
            discountPercent: data.discountPercent ?? null,
          },
        },
      },
      include: { doctorDetail: true },
    });
    return toRow(party);
  }

  async update(id: string, organizationId: string, data: UpdateReferrerDto) {
    const party = await this.prisma.client.party.findFirst({
      where: {
        id,
        tenantId: organizationId,
        partyType: 'doctor',
        deletedAt: null,
      },
    });
    if (!party) throw new NotFoundException('Referrer not found');

    const partyData: Record<string, unknown> = {};
    if (data.name !== undefined) partyData.name = data.name;
    if (data.phone !== undefined) partyData.primaryContactPhone = data.phone;
    if (data.email !== undefined) partyData.primaryContactEmail = data.email;

    const detailData: {
      tenantId: string;
      specialization?: string | null;
      clinicAffiliation?: string | null;
      medicalCouncilNo?: string | null;
      commissionPercent?: number;
      pricingMode?: string;
      discountPercent?: number | null;
    } = { tenantId: organizationId };
    if (data.specialty !== undefined)
      detailData.specialization = data.specialty;
    if (data.clinicName !== undefined)
      detailData.clinicAffiliation = data.clinicName;
    if (data.registration !== undefined)
      detailData.medicalCouncilNo = data.registration;
    if (data.commission !== undefined)
      detailData.commissionPercent = data.commission;
    if (data.pricingMode !== undefined)
      detailData.pricingMode = data.pricingMode;
    if (data.discountPercent !== undefined)
      detailData.discountPercent = data.discountPercent;

    const updated = await this.prisma.client.party.update({
      where: { id },
      data: {
        ...partyData,
        doctorDetail: { upsert: { create: detailData, update: detailData } },
      },
      include: { doctorDetail: true },
    });
    return toRow(updated);
  }

  async remove(id: string, organizationId: string) {
    const party = await this.prisma.client.party.findFirst({
      where: {
        id,
        tenantId: organizationId,
        partyType: 'doctor',
        deletedAt: null,
      },
    });
    if (!party) throw new NotFoundException('Referrer not found');
    await this.prisma.client.party.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'inactive' },
    });
    return { message: 'Referrer deleted' };
  }
}
