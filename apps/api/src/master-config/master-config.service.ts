import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─── Validation helpers ─────────────────────────────────────────────────────
const PAN_RE = /^[A-Z]{5}[0-9]{4}[A-Z]$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const URL_RE = /^(https?:\/\/)?([\w-]+\.)+[a-z]{2,}(\/\S*)?$/i;

function clean(v: string | undefined | null): string | undefined {
  const t = (v ?? '').trim();
  return t ? t : undefined;
}

function num(v: unknown): number | undefined {
  if (v === undefined || v === null || v === '') return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface CreateHospitalDto {
  code: string;
  name: string;
  country?: string;
  state?: string;
  city?: string;
  place?: string;
  street?: string;
  pinCode?: string;
  stdCode?: string;
  isdCode?: string;
  zone?: string;
  mobile?: string;
  phone1?: string;
  phone2?: string;
  fax?: string;
  whatsapp?: string;
  email?: string;
  website?: string;
  panNo?: string;
  headerImagePath?: string;
  footerImagePath?: string;
  reportName?: string;
  headerMarginPx?: number;
  footerMarginPx?: number;
  inactive?: boolean;
  uploadResults?: boolean;
  noSms?: boolean;
  noEmail?: boolean;
  outsourceTests?: boolean;
  footerInfo?: boolean;
  monthWiseCommission?: boolean;
  criticalEmail?: boolean;
  whatsappReport?: boolean;
  enableOnlineBooking?: boolean;
  blockPrintWhenDue?: boolean;
  noWhatsapp?: boolean;
  onlySplAmountBilling?: boolean;
  specialDiscountApplicable?: boolean;
  stopReportPrinting?: boolean;
  ignoreCreditLimit?: boolean;
  noReportDate?: boolean;
  showPatientTrendGraph?: boolean;
  whatsappReportForPatient?: boolean;
  criticalValueSms?: boolean;
  allowDueReportOnline?: boolean;
  onlySplAmountOnline?: boolean;
  noDueEmail?: boolean;
  autoInvoice?: boolean;
  autoInvoicePeriod?: string;
  preferredDoctorId?: string;
  collectionBoyId?: string;
  reportDisplayMode?: string;
  creditBill?: boolean;
  cashBill?: boolean;
  creditDays?: number;
  creditLimit?: number;
  webPassword?: string;
  sentChannels?: string[];
  isActive?: boolean;
}

export type UpdateHospitalDto = Partial<CreateHospitalDto>;

export interface CreateSampleTypeDto {
  code: string;
  name: string;
  collectionMethod?: string;
  containerType?: string;
  containerColor?: string;
  storageCondition?: string;
  shelfLifeHours?: number;
  preAnalytical?: string;
  active?: boolean;
  requiresRequisition?: boolean;
  autoGenerateId?: boolean;
  rejectOnHemolysis?: boolean;
  compositeSample?: boolean;
  priorityDefault?: string;
  tatHours?: number;
  associatedTests?: string[];
}

export type UpdateSampleTypeDto = Partial<CreateSampleTypeDto>;

export interface CreateMethodDto {
  code: string;
  name: string;
  standardBody?: string;
  category?: string;
  referenceDoc?: string;
  description?: string;
  active?: boolean;
  mandatory?: boolean;
  versionControl?: boolean;
  defaultParameters?: string[];
  safetyPrecautions?: string;
}

export type UpdateMethodDto = Partial<CreateMethodDto>;

export interface CreateInstrumentDto {
  code: string;
  name: string;
  modelName?: string;
  manufacturer?: string;
  assetTag?: string;
  serialNo?: string;
  location?: string;
  status?: string;
  assignedTo?: string;
  calibrationFrequency?: string;
  lastCalibratedAt?: string;
  nextCalibrationDue?: string;
  calibrationStandard?: string;
  active?: boolean;
  requiresQc?: boolean;
  downtimeWarning?: boolean;
}

export type UpdateInstrumentDto = Partial<CreateInstrumentDto>;

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class MasterConfigService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Shared helpers ────────────────────────────────────────────────────────

  private async nextSequence(tenantId: string, scope: string): Promise<number> {
    return this.prisma.client.$transaction(async (tx) => {
      const row = await tx.mastersSequence.upsert({
        where: { tenantId_scope: { tenantId, scope } },
        create: { tenantId, scope, nextValue: 1 },
        update: { nextValue: { increment: 1 } },
      });
      return row.nextValue;
    });
  }

  private async assertUnique(
    tenantId: string,
    model: 'hospitalMaster' | 'sampleTypeMaster' | 'testMethod' | 'instrument',
    code: string,
    excludeId?: string,
  ) {
    const where = {
      tenantId,
      code,
      ...(excludeId ? { NOT: { id: excludeId } } : {}),
    };
    let existing: { id: string } | null = null;
    if (model === 'hospitalMaster') {
      existing = await this.prisma.client.hospitalMaster.findFirst({ where });
    } else if (model === 'sampleTypeMaster') {
      existing = await this.prisma.client.sampleTypeMaster.findFirst({ where });
    } else if (model === 'testMethod') {
      existing = await this.prisma.client.testMethod.findFirst({ where });
    } else {
      existing = await this.prisma.client.instrument.findFirst({ where });
    }
    if (existing) throw new ConflictException(`Code "${code}" already exists`);
  }

  // ── Hospital master ───────────────────────────────────────────────────────

  private validateHospital(data: Partial<CreateHospitalDto>) {
    if (data.panNo) {
      const pan = data.panNo.toUpperCase().replace(/\s/g, '');
      if (!PAN_RE.test(pan)) {
        throw new BadRequestException(
          'PAN No must match the format AAAAA9999A',
        );
      }
      data.panNo = pan;
    }
    if (data.email && !EMAIL_RE.test(data.email)) {
      throw new BadRequestException('Email is not valid');
    }
    if (data.website && !URL_RE.test(data.website)) {
      throw new BadRequestException('Website URL is not valid');
    }
    if (data.whatsapp) {
      const digits = data.whatsapp.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 13) {
        throw new BadRequestException(
          'WhatsApp No must be a 10–13 digit phone number',
        );
      }
      data.whatsapp = digits;
    }
    if (data.creditBill && data.creditLimit != null && data.creditLimit <= 0) {
      throw new BadRequestException(
        'Credit Limit must be greater than 0 when Credit Bill is active',
      );
    }
  }

  async findHospitals(
    tenantId: string,
    query?: { search?: string; isActive?: string },
  ) {
    const where: Record<string, unknown> = { tenantId };
    if (query?.isActive !== undefined && query.isActive !== '') {
      where.isActive = query.isActive === 'true';
    }
    if (query?.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { city: { contains: query.search, mode: 'insensitive' } },
        { mobile: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.client.hospitalMaster.findMany({
      where,
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
  }

  async createHospital(tenantId: string, data: CreateHospitalDto) {
    this.validateHospital(data);
    if (!clean(data.code) || !clean(data.name)) {
      throw new BadRequestException('code and name are required');
    }
    const code = clean(data.code)!.toUpperCase();
    await this.assertUnique(tenantId, 'hospitalMaster', code);
    return this.prisma.client.hospitalMaster.create({
      data: {
        tenantId,
        code,
        name: clean(data.name)!,
        country: clean(data.country),
        state: clean(data.state),
        city: clean(data.city),
        place: clean(data.place),
        street: clean(data.street),
        pinCode: clean(data.pinCode),
        stdCode: clean(data.stdCode),
        isdCode: clean(data.isdCode),
        zone: clean(data.zone),
        mobile: clean(data.mobile),
        phone1: clean(data.phone1),
        phone2: clean(data.phone2),
        fax: clean(data.fax),
        whatsapp: clean(data.whatsapp),
        email: clean(data.email),
        website: clean(data.website),
        panNo: clean(data.panNo),
        headerImagePath: clean(data.headerImagePath),
        footerImagePath: clean(data.footerImagePath),
        reportName: clean(data.reportName),
        headerMarginPx: num(data.headerMarginPx),
        footerMarginPx: num(data.footerMarginPx),
        inactive: data.inactive ?? false,
        uploadResults: data.uploadResults ?? false,
        noSms: data.noSms ?? false,
        noEmail: data.noEmail ?? false,
        outsourceTests: data.outsourceTests ?? false,
        footerInfo: data.footerInfo ?? false,
        monthWiseCommission: data.monthWiseCommission ?? false,
        criticalEmail: data.criticalEmail ?? false,
        whatsappReport: data.whatsappReport ?? false,
        enableOnlineBooking: data.enableOnlineBooking ?? false,
        blockPrintWhenDue: data.blockPrintWhenDue ?? false,
        noWhatsapp: data.noWhatsapp ?? false,
        onlySplAmountBilling: data.onlySplAmountBilling ?? false,
        specialDiscountApplicable: data.specialDiscountApplicable ?? false,
        stopReportPrinting: data.stopReportPrinting ?? false,
        ignoreCreditLimit: data.ignoreCreditLimit ?? false,
        noReportDate: data.noReportDate ?? false,
        showPatientTrendGraph: data.showPatientTrendGraph ?? false,
        whatsappReportForPatient: data.whatsappReportForPatient ?? false,
        criticalValueSms: data.criticalValueSms ?? false,
        allowDueReportOnline: data.allowDueReportOnline ?? false,
        onlySplAmountOnline: data.onlySplAmountOnline ?? false,
        noDueEmail: data.noDueEmail ?? false,
        autoInvoice: data.autoInvoice ?? false,
        autoInvoicePeriod: clean(data.autoInvoicePeriod),
        preferredDoctorId: clean(data.preferredDoctorId),
        collectionBoyId: clean(data.collectionBoyId),
        reportDisplayMode: clean(data.reportDisplayMode),
        creditBill: data.creditBill ?? false,
        cashBill: data.cashBill ?? false,
        creditDays: num(data.creditDays),
        creditLimit: num(data.creditLimit),
        webPassword: clean(data.webPassword),
        sentChannels: data.sentChannels?.length ? data.sentChannels : undefined,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateHospital(tenantId: string, id: string, data: UpdateHospitalDto) {
    this.validateHospital(data);
    const row = await this.prisma.client.hospitalMaster.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Hospital not found');
    if (data.code) {
      await this.assertUnique(
        tenantId,
        'hospitalMaster',
        data.code.toUpperCase(),
        id,
      );
    }
    return this.prisma.client.hospitalMaster.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code.toUpperCase() } : {}),
        ...(data.name !== undefined ? { name: clean(data.name)! } : {}),
        ...(data.country !== undefined ? { country: clean(data.country) } : {}),
        ...(data.state !== undefined ? { state: clean(data.state) } : {}),
        ...(data.city !== undefined ? { city: clean(data.city) } : {}),
        ...(data.place !== undefined ? { place: clean(data.place) } : {}),
        ...(data.street !== undefined ? { street: clean(data.street) } : {}),
        ...(data.pinCode !== undefined ? { pinCode: clean(data.pinCode) } : {}),
        ...(data.stdCode !== undefined ? { stdCode: clean(data.stdCode) } : {}),
        ...(data.isdCode !== undefined ? { isdCode: clean(data.isdCode) } : {}),
        ...(data.zone !== undefined ? { zone: clean(data.zone) } : {}),
        ...(data.mobile !== undefined ? { mobile: clean(data.mobile) } : {}),
        ...(data.phone1 !== undefined ? { phone1: clean(data.phone1) } : {}),
        ...(data.phone2 !== undefined ? { phone2: clean(data.phone2) } : {}),
        ...(data.fax !== undefined ? { fax: clean(data.fax) } : {}),
        ...(data.whatsapp !== undefined
          ? { whatsapp: clean(data.whatsapp) }
          : {}),
        ...(data.email !== undefined ? { email: clean(data.email) } : {}),
        ...(data.website !== undefined ? { website: clean(data.website) } : {}),
        ...(data.panNo !== undefined ? { panNo: clean(data.panNo) } : {}),
        ...(data.headerImagePath !== undefined
          ? { headerImagePath: clean(data.headerImagePath) }
          : {}),
        ...(data.footerImagePath !== undefined
          ? { footerImagePath: clean(data.footerImagePath) }
          : {}),
        ...(data.reportName !== undefined
          ? { reportName: clean(data.reportName) }
          : {}),
        ...(data.headerMarginPx !== undefined
          ? { headerMarginPx: num(data.headerMarginPx) }
          : {}),
        ...(data.footerMarginPx !== undefined
          ? { footerMarginPx: num(data.footerMarginPx) }
          : {}),
        ...(data.inactive !== undefined ? { inactive: data.inactive } : {}),
        ...(data.uploadResults !== undefined
          ? { uploadResults: data.uploadResults }
          : {}),
        ...(data.noSms !== undefined ? { noSms: data.noSms } : {}),
        ...(data.noEmail !== undefined ? { noEmail: data.noEmail } : {}),
        ...(data.outsourceTests !== undefined
          ? { outsourceTests: data.outsourceTests }
          : {}),
        ...(data.footerInfo !== undefined
          ? { footerInfo: data.footerInfo }
          : {}),
        ...(data.monthWiseCommission !== undefined
          ? { monthWiseCommission: data.monthWiseCommission }
          : {}),
        ...(data.criticalEmail !== undefined
          ? { criticalEmail: data.criticalEmail }
          : {}),
        ...(data.whatsappReport !== undefined
          ? { whatsappReport: data.whatsappReport }
          : {}),
        ...(data.enableOnlineBooking !== undefined
          ? { enableOnlineBooking: data.enableOnlineBooking }
          : {}),
        ...(data.blockPrintWhenDue !== undefined
          ? { blockPrintWhenDue: data.blockPrintWhenDue }
          : {}),
        ...(data.noWhatsapp !== undefined
          ? { noWhatsapp: data.noWhatsapp }
          : {}),
        ...(data.onlySplAmountBilling !== undefined
          ? { onlySplAmountBilling: data.onlySplAmountBilling }
          : {}),
        ...(data.specialDiscountApplicable !== undefined
          ? { specialDiscountApplicable: data.specialDiscountApplicable }
          : {}),
        ...(data.stopReportPrinting !== undefined
          ? { stopReportPrinting: data.stopReportPrinting }
          : {}),
        ...(data.ignoreCreditLimit !== undefined
          ? { ignoreCreditLimit: data.ignoreCreditLimit }
          : {}),
        ...(data.noReportDate !== undefined
          ? { noReportDate: data.noReportDate }
          : {}),
        ...(data.showPatientTrendGraph !== undefined
          ? { showPatientTrendGraph: data.showPatientTrendGraph }
          : {}),
        ...(data.whatsappReportForPatient !== undefined
          ? { whatsappReportForPatient: data.whatsappReportForPatient }
          : {}),
        ...(data.criticalValueSms !== undefined
          ? { criticalValueSms: data.criticalValueSms }
          : {}),
        ...(data.allowDueReportOnline !== undefined
          ? { allowDueReportOnline: data.allowDueReportOnline }
          : {}),
        ...(data.onlySplAmountOnline !== undefined
          ? { onlySplAmountOnline: data.onlySplAmountOnline }
          : {}),
        ...(data.noDueEmail !== undefined
          ? { noDueEmail: data.noDueEmail }
          : {}),
        ...(data.autoInvoice !== undefined
          ? { autoInvoice: data.autoInvoice }
          : {}),
        ...(data.autoInvoicePeriod !== undefined
          ? { autoInvoicePeriod: clean(data.autoInvoicePeriod) }
          : {}),
        ...(data.preferredDoctorId !== undefined
          ? { preferredDoctorId: clean(data.preferredDoctorId) }
          : {}),
        ...(data.collectionBoyId !== undefined
          ? { collectionBoyId: clean(data.collectionBoyId) }
          : {}),
        ...(data.reportDisplayMode !== undefined
          ? { reportDisplayMode: clean(data.reportDisplayMode) }
          : {}),
        ...(data.creditBill !== undefined
          ? { creditBill: data.creditBill }
          : {}),
        ...(data.cashBill !== undefined ? { cashBill: data.cashBill } : {}),
        ...(data.creditDays !== undefined
          ? { creditDays: num(data.creditDays) }
          : {}),
        ...(data.creditLimit !== undefined
          ? { creditLimit: num(data.creditLimit) }
          : {}),
        ...(data.webPassword !== undefined
          ? { webPassword: clean(data.webPassword) }
          : {}),
        ...(data.sentChannels !== undefined
          ? { sentChannels: data.sentChannels }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  async setHospitalStatus(tenantId: string, id: string, isActive: boolean) {
    const row = await this.prisma.client.hospitalMaster.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Hospital not found');
    return this.prisma.client.hospitalMaster.update({
      where: { id },
      data: { isActive },
    });
  }

  /** Soft delete only — history and audit trail are preserved. */
  async removeHospital(tenantId: string, id: string) {
    const row = await this.prisma.client.hospitalMaster.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Hospital not found');
    return this.prisma.client.hospitalMaster.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async generateHospitalCode(tenantId: string) {
    const seq = await this.nextSequence(tenantId, 'hospital');
    return `HSP-${String(seq).padStart(3, '0')}`;
  }

  // ── Sample type master ────────────────────────────────────────────────────

  async findSampleTypes(
    tenantId: string,
    query?: { search?: string; isActive?: string },
  ) {
    const where: Record<string, unknown> = { tenantId };
    if (query?.isActive !== undefined && query.isActive !== '') {
      where.active = query.isActive === 'true';
    }
    if (query?.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { containerType: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.client.sampleTypeMaster.findMany({
      where,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async createSampleType(tenantId: string, data: CreateSampleTypeDto) {
    if (!clean(data.code) || !clean(data.name)) {
      throw new BadRequestException('code and name are required');
    }
    const code = clean(data.code)!.toUpperCase();
    await this.assertUnique(tenantId, 'sampleTypeMaster', code);
    return this.prisma.client.sampleTypeMaster.create({
      data: {
        tenantId,
        code,
        name: clean(data.name)!,
        collectionMethod: clean(data.collectionMethod),
        containerType: clean(data.containerType),
        containerColor: clean(data.containerColor),
        storageCondition: clean(data.storageCondition),
        shelfLifeHours: num(data.shelfLifeHours),
        preAnalytical: clean(data.preAnalytical),
        active: data.active ?? true,
        requiresRequisition: data.requiresRequisition ?? false,
        autoGenerateId: data.autoGenerateId ?? false,
        rejectOnHemolysis: data.rejectOnHemolysis ?? false,
        compositeSample: data.compositeSample ?? false,
        priorityDefault: clean(data.priorityDefault),
        tatHours: num(data.tatHours),
        associatedTests: data.associatedTests?.length
          ? data.associatedTests
          : undefined,
      },
    });
  }

  async updateSampleType(
    tenantId: string,
    id: string,
    data: UpdateSampleTypeDto,
  ) {
    const row = await this.prisma.client.sampleTypeMaster.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Sample type not found');
    if (data.code) {
      await this.assertUnique(
        tenantId,
        'sampleTypeMaster',
        data.code.toUpperCase(),
        id,
      );
    }
    return this.prisma.client.sampleTypeMaster.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code.toUpperCase() } : {}),
        ...(data.name !== undefined ? { name: clean(data.name)! } : {}),
        ...(data.collectionMethod !== undefined
          ? { collectionMethod: clean(data.collectionMethod) }
          : {}),
        ...(data.containerType !== undefined
          ? { containerType: clean(data.containerType) }
          : {}),
        ...(data.containerColor !== undefined
          ? { containerColor: clean(data.containerColor) }
          : {}),
        ...(data.storageCondition !== undefined
          ? { storageCondition: clean(data.storageCondition) }
          : {}),
        ...(data.shelfLifeHours !== undefined
          ? { shelfLifeHours: num(data.shelfLifeHours) }
          : {}),
        ...(data.preAnalytical !== undefined
          ? { preAnalytical: clean(data.preAnalytical) }
          : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.requiresRequisition !== undefined
          ? { requiresRequisition: data.requiresRequisition }
          : {}),
        ...(data.autoGenerateId !== undefined
          ? { autoGenerateId: data.autoGenerateId }
          : {}),
        ...(data.rejectOnHemolysis !== undefined
          ? { rejectOnHemolysis: data.rejectOnHemolysis }
          : {}),
        ...(data.compositeSample !== undefined
          ? { compositeSample: data.compositeSample }
          : {}),
        ...(data.priorityDefault !== undefined
          ? { priorityDefault: clean(data.priorityDefault) }
          : {}),
        ...(data.tatHours !== undefined
          ? { tatHours: num(data.tatHours) }
          : {}),
        ...(data.associatedTests !== undefined
          ? { associatedTests: data.associatedTests }
          : {}),
      },
    });
  }

  async setSampleTypeStatus(tenantId: string, id: string, active: boolean) {
    const row = await this.prisma.client.sampleTypeMaster.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Sample type not found');
    return this.prisma.client.sampleTypeMaster.update({
      where: { id },
      data: { active },
    });
  }

  /** Referential integrity: cannot disable a sample type still used by tests. */
  async removeSampleType(tenantId: string, id: string) {
    const row = await this.prisma.client.sampleTypeMaster.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Sample type not found');
    const inUse = await this.prisma.client.testParameter.count({
      where: { tenantId, sampleType: row.code },
    });
    if (inUse > 0) {
      throw new ConflictException(
        `Cannot delete "${row.name}" — it is used by ${inUse} test parameter(s)`,
      );
    }
    return this.prisma.client.sampleTypeMaster.update({
      where: { id },
      data: { active: false },
    });
  }

  async generateSampleTypeCode(tenantId: string) {
    const seq = await this.nextSequence(tenantId, 'sample-type-master');
    return `SMP-${String(seq).padStart(3, '0')}`;
  }

  // ── Method master ─────────────────────────────────────────────────────────

  async findMethods(
    tenantId: string,
    query?: { search?: string; isActive?: string },
  ) {
    const where: Record<string, unknown> = { tenantId };
    if (query?.isActive !== undefined && query.isActive !== '') {
      where.active = query.isActive === 'true';
    }
    if (query?.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { standardBody: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.client.testMethod.findMany({
      where,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async createMethod(tenantId: string, data: CreateMethodDto) {
    if (!clean(data.code) || !clean(data.name)) {
      throw new BadRequestException('code and name are required');
    }
    const code = clean(data.code)!.toUpperCase();
    await this.assertUnique(tenantId, 'testMethod', code);
    return this.prisma.client.testMethod.create({
      data: {
        tenantId,
        code,
        name: clean(data.name)!,
        standardBody: clean(data.standardBody),
        category: clean(data.category),
        referenceDoc: clean(data.referenceDoc),
        description: clean(data.description),
        active: data.active ?? true,
        mandatory: data.mandatory ?? false,
        versionControl: data.versionControl ?? false,
        defaultParameters: data.defaultParameters?.length
          ? data.defaultParameters
          : undefined,
        safetyPrecautions: clean(data.safetyPrecautions),
      },
    });
  }

  async updateMethod(tenantId: string, id: string, data: UpdateMethodDto) {
    const row = await this.prisma.client.testMethod.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Method not found');
    if (data.code) {
      await this.assertUnique(
        tenantId,
        'testMethod',
        data.code.toUpperCase(),
        id,
      );
    }
    return this.prisma.client.testMethod.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code.toUpperCase() } : {}),
        ...(data.name !== undefined ? { name: clean(data.name)! } : {}),
        ...(data.standardBody !== undefined
          ? { standardBody: clean(data.standardBody) }
          : {}),
        ...(data.category !== undefined
          ? { category: clean(data.category) }
          : {}),
        ...(data.referenceDoc !== undefined
          ? { referenceDoc: clean(data.referenceDoc) }
          : {}),
        ...(data.description !== undefined
          ? { description: clean(data.description) }
          : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.mandatory !== undefined ? { mandatory: data.mandatory } : {}),
        ...(data.versionControl !== undefined
          ? { versionControl: data.versionControl }
          : {}),
        ...(data.defaultParameters !== undefined
          ? { defaultParameters: data.defaultParameters }
          : {}),
        ...(data.safetyPrecautions !== undefined
          ? { safetyPrecautions: clean(data.safetyPrecautions) }
          : {}),
      },
    });
  }

  async setMethodStatus(tenantId: string, id: string, active: boolean) {
    const row = await this.prisma.client.testMethod.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Method not found');
    return this.prisma.client.testMethod.update({
      where: { id },
      data: { active },
    });
  }

  /** Referential integrity: cannot disable a method still used by tests. */
  async removeMethod(tenantId: string, id: string) {
    const row = await this.prisma.client.testMethod.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Method not found');
    const inUse = await this.prisma.client.testParameter.count({
      where: { tenantId, methodology: row.code },
    });
    if (inUse > 0) {
      throw new ConflictException(
        `Cannot delete "${row.name}" — it is used by ${inUse} test parameter(s)`,
      );
    }
    return this.prisma.client.testMethod.update({
      where: { id },
      data: { active: false },
    });
  }

  async generateMethodCode(tenantId: string) {
    const seq = await this.nextSequence(tenantId, 'test-method');
    return `MET-${String(seq).padStart(3, '0')}`;
  }

  // ── Instrument master ─────────────────────────────────────────────────────

  async findInstruments(
    tenantId: string,
    query?: { search?: string; isActive?: string },
  ) {
    const where: Record<string, unknown> = { tenantId };
    if (query?.isActive !== undefined && query.isActive !== '') {
      where.active = query.isActive === 'true';
    }
    if (query?.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
        { modelName: { contains: query.search, mode: 'insensitive' } },
        { manufacturer: { contains: query.search, mode: 'insensitive' } },
        { serialNo: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.client.instrument.findMany({
      where,
      orderBy: [{ active: 'desc' }, { name: 'asc' }],
    });
  }

  async createInstrument(tenantId: string, data: CreateInstrumentDto) {
    if (!clean(data.code) || !clean(data.name)) {
      throw new BadRequestException('code and name are required');
    }
    const code = clean(data.code)!.toUpperCase();
    await this.assertUnique(tenantId, 'instrument', code);
    return this.prisma.client.instrument.create({
      data: {
        tenantId,
        code,
        name: clean(data.name)!,
        modelName: clean(data.modelName),
        manufacturer: clean(data.manufacturer),
        assetTag: clean(data.assetTag),
        serialNo: clean(data.serialNo),
        location: clean(data.location) ?? 'Lab A',
        status: clean(data.status) ?? 'ACTIVE',
        assignedTo: clean(data.assignedTo),
        calibrationFrequency: clean(data.calibrationFrequency),
        lastCalibratedAt: data.lastCalibratedAt
          ? new Date(data.lastCalibratedAt)
          : undefined,
        nextCalibrationDue: data.nextCalibrationDue
          ? new Date(data.nextCalibrationDue)
          : undefined,
        calibrationStandard: clean(data.calibrationStandard),
        active: data.active ?? true,
        requiresQc: data.requiresQc ?? false,
        downtimeWarning: data.downtimeWarning ?? false,
      },
    });
  }

  async updateInstrument(
    tenantId: string,
    id: string,
    data: UpdateInstrumentDto,
  ) {
    const row = await this.prisma.client.instrument.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Instrument not found');
    if (data.code) {
      await this.assertUnique(
        tenantId,
        'instrument',
        data.code.toUpperCase(),
        id,
      );
    }
    return this.prisma.client.instrument.update({
      where: { id },
      data: {
        ...(data.code !== undefined ? { code: data.code.toUpperCase() } : {}),
        ...(data.name !== undefined ? { name: clean(data.name)! } : {}),
        ...(data.modelName !== undefined
          ? { modelName: clean(data.modelName) }
          : {}),
        ...(data.manufacturer !== undefined
          ? { manufacturer: clean(data.manufacturer) }
          : {}),
        ...(data.assetTag !== undefined
          ? { assetTag: clean(data.assetTag) }
          : {}),
        ...(data.serialNo !== undefined
          ? { serialNo: clean(data.serialNo) }
          : {}),
        ...(data.location !== undefined
          ? { location: clean(data.location) ?? 'Lab A' }
          : {}),
        ...(data.status !== undefined
          ? { status: clean(data.status) ?? 'ACTIVE' }
          : {}),
        ...(data.assignedTo !== undefined
          ? { assignedTo: clean(data.assignedTo) }
          : {}),
        ...(data.calibrationFrequency !== undefined
          ? { calibrationFrequency: clean(data.calibrationFrequency) }
          : {}),
        ...(data.lastCalibratedAt !== undefined
          ? {
              lastCalibratedAt: data.lastCalibratedAt
                ? new Date(data.lastCalibratedAt)
                : null,
            }
          : {}),
        ...(data.nextCalibrationDue !== undefined
          ? {
              nextCalibrationDue: data.nextCalibrationDue
                ? new Date(data.nextCalibrationDue)
                : null,
            }
          : {}),
        ...(data.calibrationStandard !== undefined
          ? { calibrationStandard: clean(data.calibrationStandard) }
          : {}),
        ...(data.active !== undefined ? { active: data.active } : {}),
        ...(data.requiresQc !== undefined
          ? { requiresQc: data.requiresQc }
          : {}),
        ...(data.downtimeWarning !== undefined
          ? { downtimeWarning: data.downtimeWarning }
          : {}),
      },
    });
  }

  async setInstrumentStatus(tenantId: string, id: string, active: boolean) {
    const row = await this.prisma.client.instrument.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Instrument not found');
    return this.prisma.client.instrument.update({
      where: { id },
      data: { active },
    });
  }

  async removeInstrument(tenantId: string, id: string) {
    const row = await this.prisma.client.instrument.findFirst({
      where: { id, tenantId },
    });
    if (!row) throw new NotFoundException('Instrument not found');
    return this.prisma.client.instrument.update({
      where: { id },
      data: { active: false },
    });
  }

  async generateInstrumentCode(tenantId: string) {
    const seq = await this.nextSequence(tenantId, 'instrument');
    return `INS-${String(seq).padStart(3, '0')}`;
  }
}
