import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export type PartyType =
  | 'doctor'
  | 'hospital'
  | 'corporate'
  | 'insurance_tpa'
  | 'reference_lab'
  | 'consultant';

export interface CreatePartyDto {
  name: string;
  partyType: PartyType;
  address?: string;
  gstin?: string;
  primaryContactName?: string;
  primaryContactPhone?: string;
  primaryContactEmail?: string;
  // Doctor-only extension
  specialty?: string;
  qualification?: string;
  clinicName?: string;
  registration?: string;
  commission?: number;
  pricingMode?: string;
  discountPercent?: number | null;
}

export type UpdatePartyDto = Partial<CreatePartyDto>;

export interface PartyRow {
  id: string;
  partyType: PartyType;
  name: string;
  address: string | null;
  gstin: string | null;
  primaryContactName: string | null;
  primaryContactPhone: string | null;
  primaryContactEmail: string | null;
  status: string;
  createdAt: Date;
  // Doctor detail (flattened when partyType === 'doctor')
  specialty: string | null;
  qualification: string | null;
  clinicName: string | null;
  registration: string | null;
  commission: number | null;
  pricingMode: string | null;
  discountPercent: number | null;
  _count?: { orders: number; referrerPrices: number };
}

function num(
  v: { toNumber?: () => number } | number | null | undefined,
): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (v.toNumber) return v.toNumber();
  return Number(v);
}

function toRow(party: {
  id: string;
  partyType: string;
  name: string;
  address: string | null;
  gstin: string | null;
  primaryContactName: string | null;
  primaryContactPhone: string | null;
  primaryContactEmail: string | null;
  status: string;
  createdAt: Date;
  doctorDetail: {
    specialization: string | null;
    qualification: string | null;
    clinicAffiliation: string | null;
    medicalCouncilNo: string | null;
    commissionPercent: { toNumber?: () => number } | number | null;
    pricingMode: string | null;
    discountPercent: { toNumber?: () => number } | number | null;
  } | null;
  _count?: { orders: number; referrerPrices: number };
}): PartyRow {
  const d = party.doctorDetail;
  return {
    id: party.id,
    partyType: party.partyType as PartyType,
    name: party.name,
    address: party.address,
    gstin: party.gstin,
    primaryContactName: party.primaryContactName,
    primaryContactPhone: party.primaryContactPhone,
    primaryContactEmail: party.primaryContactEmail,
    status: party.status,
    createdAt: party.createdAt,
    specialty: d?.specialization ?? null,
    qualification: d?.qualification ?? null,
    clinicName: d?.clinicAffiliation ?? null,
    registration: d?.medicalCouncilNo ?? null,
    commission: num(d?.commissionPercent),
    pricingMode: d?.pricingMode ?? 'default',
    discountPercent: num(d?.discountPercent),
    _count: party._count,
  };
}

@Injectable()
export class PartiesService {
  constructor(private prisma: PrismaService) {}

  async findAll(
    organizationId: string,
    query?: { type?: string; search?: string },
  ) {
    const where: Record<string, unknown> = {
      tenantId: organizationId,
      deletedAt: null,
    };

    // If a type filter is provided, restrict to it. Without one, return all
    // parties except standalone doctors (those live in the Referrers screen).
    if (query?.type) {
      where.partyType = query.type;
    } else {
      where.partyType = { not: 'doctor' };
    }

    if (query?.search) {
      const s = query.search;
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { primaryContactPhone: { contains: s } },
        { primaryContactEmail: { contains: s, mode: 'insensitive' } },
        { gstin: { contains: s, mode: 'insensitive' } },
      ];
    }

    const rows = await this.prisma.client.party.findMany({
      where,
      include: {
        doctorDetail: true,
        _count: { select: { orders: true, referrerPrices: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toRow);
  }

  async findOne(id: string, organizationId: string) {
    const party = await this.prisma.client.party.findFirst({
      where: { id, tenantId: organizationId, deletedAt: null },
      include: {
        doctorDetail: true,
        _count: { select: { orders: true, referrerPrices: true } },
      },
    });
    if (!party) throw new NotFoundException('Party not found');
    return toRow(party);
  }

  async create(organizationId: string, data: CreatePartyDto) {
    const isDoctor = data.partyType === 'doctor';
    const party = await this.prisma.client.party.create({
      data: {
        tenantId: organizationId,
        partyType: data.partyType,
        name: data.name,
        address: data.address ?? null,
        gstin: data.gstin ?? null,
        primaryContactName: data.primaryContactName ?? null,
        primaryContactPhone: data.primaryContactPhone ?? null,
        primaryContactEmail: data.primaryContactEmail ?? null,
        ...(isDoctor
          ? {
              doctorDetail: {
                create: {
                  tenantId: organizationId,
                  specialization: data.specialty ?? null,
                  qualification: data.qualification ?? null,
                  clinicAffiliation: data.clinicName ?? null,
                  medicalCouncilNo: data.registration ?? null,
                  commissionPercent: data.commission ?? 0,
                  pricingMode: data.pricingMode ?? 'default',
                  discountPercent: data.discountPercent ?? null,
                },
              },
            }
          : {}),
      },
      include: { doctorDetail: true },
    });
    return toRow(party);
  }

  async update(id: string, organizationId: string, data: UpdatePartyDto) {
    const party = await this.prisma.client.party.findFirst({
      where: { id, tenantId: organizationId, deletedAt: null },
    });
    if (!party) throw new NotFoundException('Party not found');

    const partyData: Record<string, unknown> = {};
    if (data.name !== undefined) partyData.name = data.name;
    if (data.address !== undefined) partyData.address = data.address;
    if (data.gstin !== undefined) partyData.gstin = data.gstin;
    if (data.primaryContactName !== undefined)
      partyData.primaryContactName = data.primaryContactName;
    if (data.primaryContactPhone !== undefined)
      partyData.primaryContactPhone = data.primaryContactPhone;
    if (data.primaryContactEmail !== undefined)
      partyData.primaryContactEmail = data.primaryContactEmail;

    let detailUpsert: Record<string, unknown> | undefined;
    if (party.partyType === 'doctor' || data.partyType === 'doctor') {
      const detailData: Record<string, unknown> = { tenantId: organizationId };
      if (data.specialty !== undefined)
        detailData.specialization = data.specialty;
      if (data.qualification !== undefined)
        detailData.qualification = data.qualification;
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
      detailUpsert = { upsert: { create: detailData, update: detailData } };
    }

    const updated = await this.prisma.client.party.update({
      where: { id },
      data: {
        ...partyData,
        ...(detailUpsert ? { doctorDetail: detailUpsert } : {}),
      },
      include: { doctorDetail: true },
    });
    return toRow(updated);
  }

  async remove(id: string, organizationId: string) {
    const party = await this.prisma.client.party.findFirst({
      where: { id, tenantId: organizationId, deletedAt: null },
    });
    if (!party) throw new NotFoundException('Party not found');
    await this.prisma.client.party.update({
      where: { id },
      data: { deletedAt: new Date(), status: 'inactive' },
    });
    return { message: 'Party deleted' };
  }
}
