import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '../../generated/prisma/client';
import { resolveEffectivePrice, round2 } from './price-resolver';

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface CreateCategoryDto {
  name: string;
  codePrefix?: string;
  defaultSampleType?: string;
  defaultTurnaroundHours?: number;
  sortOrder?: number;
  isActive?: boolean;
}

export type UpdateCategoryDto = Partial<CreateCategoryDto>;

export interface CreateParameterDto {
  code: string;
  name: string;
  categoryId: string;
  sampleType?: string;
  unit?: string;
  refLow?: number;
  refHigh?: number;
  methodology?: string;
  turnaroundHours?: number;
  defaultPrice?: number;
  isActive?: boolean;
  sortOrder?: number;
  // Master-config extensions (technical specs + acceptance criteria + workflow)
  testCategory?: string;
  detectionLimit?: number;
  reportingLimit?: number;
  lowerLimit?: number;
  upperLimit?: number;
  limitType?: string;
  criticalValueAlert?: boolean;
  autoApprove?: boolean;
  requiresApproval?: boolean;
  visibleOnReport?: boolean;
  calculationFormula?: string;
}

export type UpdateParameterDto = Partial<CreateParameterDto>;

export interface CreatePackageDto {
  code: string;
  name: string;
  description?: string;
  pricingMode?: 'sum' | 'fixed';
  fixedPrice?: number;
  isActive?: boolean;
  /** Parameter ids included in this package (replace-all semantics). */
  items?: string[];
}

export type UpdatePackageDto = Partial<CreatePackageDto>;

export interface ReferrerPriceRowDto {
  parameterId?: string;
  packageId?: string;
  price: number;
}

/** The eight simple code+name lookup masters share one table + one API. */
export const LOOKUP_TYPES = [
  'sample_type',
  'container_type',
  'unit',
  'method',
  'payment_mode',
  'rejection_reason',
  'discount_scheme',
  'tax_rate',
] as const;

export type LookupType = (typeof LOOKUP_TYPES)[number];

/** Short human prefix used for auto-generated codes, e.g. `RJ-001`. */
export const LOOKUP_CODE_PREFIX: Record<LookupType, string> = {
  sample_type: 'ST',
  container_type: 'CT',
  unit: 'UN',
  method: 'MD',
  payment_mode: 'PM',
  rejection_reason: 'RJ',
  discount_scheme: 'DS',
  tax_rate: 'TX',
};

export interface CreateLookupDto {
  code: string;
  name: string;
  /** Free-form extra fields per type, e.g. { colorHex, percent } */
  metadata?: Prisma.InputJsonValue;
  sortOrder?: number;
  isActive?: boolean;
}

export type UpdateLookupDto = Partial<CreateLookupDto>;

// ─── Service ────────────────────────────────────────────────────────────────

@Injectable()
export class MastersService {
  constructor(private prisma: PrismaService) {}

  // ── Categories ────────────────────────────────────────────────────────────

  async findAllCategories(tenantId: string) {
    return this.prisma.client.testCategory.findMany({
      where: { tenantId },
      include: { _count: { select: { parameters: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createCategory(tenantId: string, data: CreateCategoryDto) {
    if (!data.name?.trim()) throw new BadRequestException('Name is required');
    return this.prisma.client.testCategory.create({
      data: {
        tenantId,
        name: data.name.trim(),
        codePrefix: data.codePrefix?.trim() ?? '',
        defaultSampleType: data.defaultSampleType ?? null,
        defaultTurnaroundHours: data.defaultTurnaroundHours ?? null,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateCategory(tenantId: string, id: string, data: UpdateCategoryDto) {
    const cat = await this.prisma.client.testCategory.findFirst({
      where: { id, tenantId },
    });
    if (!cat) throw new NotFoundException('Category not found');
    return this.prisma.client.testCategory.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.codePrefix !== undefined
          ? { codePrefix: data.codePrefix.trim() }
          : {}),
        ...(data.defaultSampleType !== undefined
          ? { defaultSampleType: data.defaultSampleType }
          : {}),
        ...(data.defaultTurnaroundHours !== undefined
          ? { defaultTurnaroundHours: data.defaultTurnaroundHours }
          : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  // ── Parameters ────────────────────────────────────────────────────────────

  async findParameters(
    tenantId: string,
    query?: { categoryId?: string; search?: string; isActive?: string },
  ) {
    const where: Record<string, unknown> = { tenantId };
    if (query?.categoryId) where.categoryId = query.categoryId;
    if (query?.isActive !== undefined && query.isActive !== '') {
      where.isActive = query.isActive === 'true';
    }
    if (query?.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    const params = await this.prisma.client.testParameter.findMany({
      where,
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
    // Usage counts (how many order lines already reference each code) — used
    // by the UI to show a non-blocking warning when disabling a parameter
    // that appears in existing orders.
    if (params.length === 0) return params;
    const counts = await this.prisma.client.orderTest.groupBy({
      by: ['testCode'],
      where: { testCode: { in: params.map((p) => p.code) } },
      _count: { _all: true },
    });
    const usage = new Map(counts.map((c) => [c.testCode, c._count._all]));
    return params.map((p) => ({
      ...p,
      usageCount: usage.get(p.code) ?? 0,
    }));
  }

  async findParameter(tenantId: string, id: string) {
    const param = await this.prisma.client.testParameter.findFirst({
      where: { id, tenantId },
      include: { category: { select: { id: true, name: true } } },
    });
    if (!param) throw new NotFoundException('Test parameter not found');
    return param;
  }

  async createParameter(tenantId: string, data: CreateParameterDto) {
    if (!data.code?.trim() || !data.name?.trim() || !data.categoryId) {
      throw new BadRequestException('code, name and categoryId are required');
    }
    const code = data.code.trim().toUpperCase();
    const existing = await this.prisma.client.testParameter.findFirst({
      where: { tenantId, code },
    });
    if (existing) {
      throw new ConflictException(`Test code "${code}" already exists`);
    }
    const category = await this.prisma.client.testCategory.findFirst({
      where: { id: data.categoryId, tenantId },
    });
    if (!category) {
      throw new BadRequestException('Category not found in this tenant');
    }
    // Category-level defaults: pre-fill sample type / turnaround from the
    // category when the caller didn't supply them explicitly.
    const sampleType = data.sampleType ?? category.defaultSampleType ?? null;
    const turnaroundHours =
      data.turnaroundHours ?? category.defaultTurnaroundHours ?? null;
    return this.prisma.client.testParameter.create({
      data: {
        tenantId,
        code,
        name: data.name.trim(),
        categoryId: data.categoryId,
        sampleType,
        unit: data.unit ?? null,
        refLow: data.refLow ?? null,
        refHigh: data.refHigh ?? null,
        methodology: data.methodology ?? null,
        turnaroundHours,
        defaultPrice: data.defaultPrice ?? 0,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
        testCategory: data.testCategory ?? null,
        detectionLimit: data.detectionLimit ?? null,
        reportingLimit: data.reportingLimit ?? null,
        lowerLimit: data.lowerLimit ?? null,
        upperLimit: data.upperLimit ?? null,
        limitType: data.limitType ?? null,
        criticalValueAlert: data.criticalValueAlert ?? false,
        autoApprove: data.autoApprove ?? false,
        requiresApproval: data.requiresApproval ?? false,
        visibleOnReport: data.visibleOnReport ?? true,
        calculationFormula: data.calculationFormula ?? null,
      },
    });
  }

  async updateParameter(
    tenantId: string,
    id: string,
    data: UpdateParameterDto,
  ) {
    const param = await this.prisma.client.testParameter.findFirst({
      where: { id, tenantId },
    });
    if (!param) throw new NotFoundException('Test parameter not found');
    if (data.code) {
      const code = data.code.trim().toUpperCase();
      const dup = await this.prisma.client.testParameter.findFirst({
        where: { tenantId, code, NOT: { id } },
      });
      if (dup)
        throw new ConflictException(`Test code "${code}" already exists`);
    }
    if (data.categoryId) {
      const category = await this.prisma.client.testCategory.findFirst({
        where: { id: data.categoryId, tenantId },
      });
      if (!category) {
        throw new BadRequestException('Category not found in this tenant');
      }
    }
    return this.prisma.client.testParameter.update({
      where: { id },
      data: {
        ...(data.code ? { code: data.code.trim().toUpperCase() } : {}),
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.categoryId !== undefined
          ? { categoryId: data.categoryId }
          : {}),
        ...(data.sampleType !== undefined
          ? { sampleType: data.sampleType }
          : {}),
        ...(data.unit !== undefined ? { unit: data.unit } : {}),
        ...(data.refLow !== undefined ? { refLow: data.refLow } : {}),
        ...(data.refHigh !== undefined ? { refHigh: data.refHigh } : {}),
        ...(data.methodology !== undefined
          ? { methodology: data.methodology }
          : {}),
        ...(data.turnaroundHours !== undefined
          ? { turnaroundHours: data.turnaroundHours }
          : {}),
        ...(data.defaultPrice !== undefined
          ? { defaultPrice: data.defaultPrice }
          : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.testCategory !== undefined
          ? { testCategory: data.testCategory }
          : {}),
        ...(data.detectionLimit !== undefined
          ? { detectionLimit: data.detectionLimit }
          : {}),
        ...(data.reportingLimit !== undefined
          ? { reportingLimit: data.reportingLimit }
          : {}),
        ...(data.lowerLimit !== undefined
          ? { lowerLimit: data.lowerLimit }
          : {}),
        ...(data.upperLimit !== undefined
          ? { upperLimit: data.upperLimit }
          : {}),
        ...(data.limitType !== undefined ? { limitType: data.limitType } : {}),
        ...(data.criticalValueAlert !== undefined
          ? { criticalValueAlert: data.criticalValueAlert }
          : {}),
        ...(data.autoApprove !== undefined
          ? { autoApprove: data.autoApprove }
          : {}),
        ...(data.requiresApproval !== undefined
          ? { requiresApproval: data.requiresApproval }
          : {}),
        ...(data.visibleOnReport !== undefined
          ? { visibleOnReport: data.visibleOnReport }
          : {}),
        ...(data.calculationFormula !== undefined
          ? { calculationFormula: data.calculationFormula }
          : {}),
      },
    });
  }

  /** Soft delete only — a parameter that has appeared in orders is never
   *  hard-deleted; it just stops appearing in new-order search. */
  async removeParameter(tenantId: string, id: string) {
    const param = await this.prisma.client.testParameter.findFirst({
      where: { id, tenantId },
    });
    if (!param) throw new NotFoundException('Test parameter not found');
    return this.prisma.client.testParameter.update({
      where: { id },
      data: { isActive: false },
    });
  }

  // ── Auto code generation ──────────────────────────────────────────────────

  /**
   * Consume the next value of a per-tenant, per-scope counter inside a
   * transaction. The upsert both creates the counter row on first use and
   * increments it atomically, so two concurrent generate-code calls for the
   * same category can never produce the same number (same pattern as the
   * Order/Sample ID fixes). Returns the value that was just consumed.
   */
  private async nextSequence(tenantId: string, scope: string): Promise<number> {
    return this.prisma.client.$transaction(async (tx) => {
      const row = await tx.mastersSequence.upsert({
        where: { tenantId_scope: { tenantId, scope } },
        create: { tenantId, scope, nextValue: 1 },
        update: { nextValue: { increment: 1 } },
      });
      // First call: create returns nextValue=1 (code -001). Every later call
      // increments and returns the value just consumed, so concurrent calls
      // can never collide.
      return row.nextValue;
    });
  }

  /**
   * Generate a suggested code for a new parameter: `PREFIX-001`, where the
   * prefix is the category's configured codePrefix (e.g. "HEM") or falls back
   * to the first 3 letters of the category name ("BIO" for Biochemistry).
   */
  async generateParameterCode(tenantId: string, categoryId: string) {
    const category = await this.prisma.client.testCategory.findFirst({
      where: { id: categoryId, tenantId },
    });
    if (!category) throw new NotFoundException('Category not found');
    const prefix =
      category.codePrefix?.trim() ||
      category.name.slice(0, 3).toUpperCase() ||
      'TST';
    const seq = await this.nextSequence(tenantId, `test-param:${categoryId}`);
    return `${prefix}-${String(seq).padStart(3, '0')}`;
  }

  /** Generate a suggested code for a new package: `PKG-001`. */
  async generatePackageCode(tenantId: string) {
    const seq = await this.nextSequence(tenantId, 'test-package');
    return `PKG-${String(seq).padStart(3, '0')}`;
  }

  // ── Quick enable / disable (fast PATCH, picked up by the audit interceptor)

  async setParameterStatus(tenantId: string, id: string, isActive: boolean) {
    const param = await this.prisma.client.testParameter.findFirst({
      where: { id, tenantId },
    });
    if (!param) throw new NotFoundException('Test parameter not found');
    return this.prisma.client.testParameter.update({
      where: { id },
      data: { isActive },
    });
  }

  async bulkSetParameterStatus(
    tenantId: string,
    ids: string[],
    isActive: boolean,
  ) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('ids are required');
    }
    const res = await this.prisma.client.testParameter.updateMany({
      where: { id: { in: ids }, tenantId },
      data: { isActive },
    });
    return { updated: res.count };
  }

  // ── Packages ──────────────────────────────────────────────────────────────

  async findPackages(tenantId: string, query?: { search?: string }) {
    const where: Record<string, unknown> = { tenantId };
    if (query?.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.client.testPackage.findMany({
      where,
      include: {
        items: { include: { parameter: true } },
        _count: { select: { referrerPrices: true } },
      },
      orderBy: [{ name: 'asc' }],
    });
  }

  async findPackage(tenantId: string, id: string) {
    const pkg = await this.prisma.client.testPackage.findFirst({
      where: { id, tenantId },
      include: { items: { include: { parameter: true } } },
    });
    if (!pkg) throw new NotFoundException('Test package not found');
    return pkg;
  }

  private assertPackagePricing(data: CreatePackageDto | UpdatePackageDto) {
    if (data.pricingMode === 'fixed' && data.fixedPrice == null) {
      throw new BadRequestException(
        'fixedPrice is required when pricingMode = "fixed"',
      );
    }
  }

  private async replacePackageItems(
    tenantId: string,
    packageId: string,
    parameterIds: string[],
  ): Promise<void> {
    const ids = [...new Set(parameterIds)];
    if (ids.length > 0) {
      const params = await this.prisma.client.testParameter.findMany({
        where: { id: { in: ids }, tenantId },
        select: { id: true },
      });
      const found = new Set(params.map((p) => p.id));
      const missing = ids.filter((i) => !found.has(i));
      if (missing.length > 0) {
        throw new BadRequestException(
          'One or more parameters do not belong to this tenant',
        );
      }
    }
    await this.prisma.client.$transaction(async (tx) => {
      await tx.testPackageItem.deleteMany({ where: { packageId } });
      if (ids.length > 0) {
        await tx.testPackageItem.createMany({
          data: ids.map((parameterId) => ({ packageId, parameterId })),
        });
      }
    });
  }

  async createPackage(tenantId: string, data: CreatePackageDto) {
    if (!data.code?.trim() || !data.name?.trim()) {
      throw new BadRequestException('code and name are required');
    }
    const code = data.code.trim().toUpperCase();
    this.assertPackagePricing(data);
    const existing = await this.prisma.client.testPackage.findFirst({
      where: { tenantId, code },
    });
    if (existing) {
      throw new ConflictException(`Package code "${code}" already exists`);
    }
    const pkg = await this.prisma.client.testPackage.create({
      data: {
        tenantId,
        code,
        name: data.name.trim(),
        description: data.description ?? null,
        pricingMode: data.pricingMode ?? 'sum',
        fixedPrice:
          data.pricingMode === 'fixed' ? (data.fixedPrice ?? 0) : null,
        isActive: data.isActive ?? true,
      },
    });
    await this.replacePackageItems(tenantId, pkg.id, data.items ?? []);
    return this.findPackage(tenantId, pkg.id);
  }

  async updatePackage(tenantId: string, id: string, data: UpdatePackageDto) {
    const pkg = await this.prisma.client.testPackage.findFirst({
      where: { id, tenantId },
    });
    if (!pkg) throw new NotFoundException('Test package not found');
    this.assertPackagePricing(data);
    if (data.code) {
      const code = data.code.trim().toUpperCase();
      const dup = await this.prisma.client.testPackage.findFirst({
        where: { tenantId, code, NOT: { id } },
      });
      if (dup)
        throw new ConflictException(`Package code "${code}" already exists`);
    }
    await this.prisma.client.testPackage.update({
      where: { id },
      data: {
        ...(data.code ? { code: data.code.trim().toUpperCase() } : {}),
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined
          ? { description: data.description }
          : {}),
        ...(data.pricingMode !== undefined
          ? { pricingMode: data.pricingMode }
          : {}),
        ...(data.pricingMode !== undefined
          ? {
              fixedPrice:
                data.pricingMode === 'fixed' ? (data.fixedPrice ?? 0) : null,
            }
          : data.fixedPrice !== undefined
            ? { fixedPrice: data.fixedPrice }
            : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
    if (data.items !== undefined) {
      await this.replacePackageItems(tenantId, id, data.items);
    }
    return this.findPackage(tenantId, id);
  }

  /** Soft delete only. */
  async removePackage(tenantId: string, id: string) {
    const pkg = await this.prisma.client.testPackage.findFirst({
      where: { id, tenantId },
    });
    if (!pkg) throw new NotFoundException('Test package not found');
    return this.prisma.client.testPackage.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async setPackageStatus(tenantId: string, id: string, isActive: boolean) {
    const pkg = await this.prisma.client.testPackage.findFirst({
      where: { id, tenantId },
    });
    if (!pkg) throw new NotFoundException('Test package not found');
    return this.prisma.client.testPackage.update({
      where: { id },
      data: { isActive },
    });
  }

  async bulkSetPackageStatus(
    tenantId: string,
    ids: string[],
    isActive: boolean,
  ) {
    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('ids are required');
    }
    const res = await this.prisma.client.testPackage.updateMany({
      where: { id: { in: ids }, tenantId },
      data: { isActive },
    });
    return { updated: res.count };
  }

  // ── Generic lookup masters (8 types, one table) ───────────────────────────

  private assertLookupType(type: string): asserts type is LookupType {
    if (!(LOOKUP_TYPES as readonly string[]).includes(type)) {
      throw new BadRequestException(`Unknown lookup type "${type}"`);
    }
  }

  async findLookups(
    tenantId: string,
    type: string,
    query?: { search?: string; isActive?: string },
  ) {
    this.assertLookupType(type);
    const where: Record<string, unknown> = { tenantId, type };
    if (query?.isActive !== undefined && query.isActive !== '') {
      where.isActive = query.isActive === 'true';
    }
    if (query?.search) {
      where.OR = [
        { code: { contains: query.search, mode: 'insensitive' } },
        { name: { contains: query.search, mode: 'insensitive' } },
      ];
    }
    return this.prisma.client.lookupMaster.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
  }

  async createLookup(tenantId: string, type: string, data: CreateLookupDto) {
    this.assertLookupType(type);
    if (!data.code?.trim() || !data.name?.trim()) {
      throw new BadRequestException('code and name are required');
    }
    const code = data.code.trim().toUpperCase();
    const existing = await this.prisma.client.lookupMaster.findFirst({
      where: { tenantId, type, code },
    });
    if (existing) {
      throw new ConflictException(`Code "${code}" already exists`);
    }
    return this.prisma.client.lookupMaster.create({
      data: {
        tenantId,
        type: type,
        code,
        name: data.name.trim(),
        metadata: data.metadata ?? undefined,
        sortOrder: data.sortOrder ?? 0,
        isActive: data.isActive ?? true,
      },
    });
  }

  async updateLookup(
    tenantId: string,
    type: string,
    id: string,
    data: UpdateLookupDto,
  ) {
    this.assertLookupType(type);
    const row = await this.prisma.client.lookupMaster.findFirst({
      where: { id, tenantId, type },
    });
    if (!row) throw new NotFoundException('Lookup value not found');
    if (data.code) {
      const code = data.code.trim().toUpperCase();
      const dup = await this.prisma.client.lookupMaster.findFirst({
        where: { tenantId, type, code, NOT: { id } },
      });
      if (dup) throw new ConflictException(`Code "${code}" already exists`);
    }
    return this.prisma.client.lookupMaster.update({
      where: { id },
      data: {
        ...(data.code ? { code: data.code.trim().toUpperCase() } : {}),
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
        ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
      },
    });
  }

  /** Quick enable/disable (fast PATCH, picked up by the audit interceptor). */
  async setLookupStatus(
    tenantId: string,
    type: string,
    id: string,
    isActive: boolean,
  ) {
    this.assertLookupType(type);
    const row = await this.prisma.client.lookupMaster.findFirst({
      where: { id, tenantId, type },
    });
    if (!row) throw new NotFoundException('Lookup value not found');
    return this.prisma.client.lookupMaster.update({
      where: { id },
      data: { isActive },
    });
  }

  /** Soft delete only — same rule as TestParameter. */
  async removeLookup(tenantId: string, type: string, id: string) {
    this.assertLookupType(type);
    const row = await this.prisma.client.lookupMaster.findFirst({
      where: { id, tenantId, type },
    });
    if (!row) throw new NotFoundException('Lookup value not found');
    return this.prisma.client.lookupMaster.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /** Optional auto-code for lookups, e.g. `RJ-001` — scope `lookup:<type>`. */
  async generateLookupCode(tenantId: string, type: string) {
    this.assertLookupType(type);
    const prefix = LOOKUP_CODE_PREFIX[type];
    const seq = await this.nextSequence(tenantId, `lookup:${type}`);
    return `${prefix}-${String(seq).padStart(3, '0')}`;
  }

  // ── Referrer price overrides ──────────────────────────────────────────────

  async listReferrerPrices(tenantId: string, referrerId: string) {
    // Any party type can hold rate-card overrides (doctors, hospitals,
    // corporates, insurance TPAs, reference labs, consultants).
    const referrer = await this.prisma.client.party.findFirst({
      where: { id: referrerId, tenantId, deletedAt: null },
    });
    if (!referrer) throw new NotFoundException('Referrer not found');
    return this.prisma.client.referrerPrice.findMany({
      where: { partyId: referrerId, tenantId },
      include: {
        parameter: {
          select: { id: true, code: true, name: true, defaultPrice: true },
        },
        package: {
          select: {
            id: true,
            code: true,
            name: true,
            pricingMode: true,
            fixedPrice: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Bulk upsert — replace-all semantics. The UI sends the whole edited
   * price-list grid; we validate every row against the tenant and swap the
   * referrer's override set atomically.
   *
   * Explicit cross-tenant guard (not just the Prisma extension): this table
   * has two optional FKs (parameter/package), so each reference is checked
   * against the caller's tenant before anything is written.
   */
  async upsertReferrerPrices(
    tenantId: string,
    referrerId: string,
    rows: ReferrerPriceRowDto[],
  ) {
    const referrer = await this.prisma.client.party.findFirst({
      where: { id: referrerId, tenantId, deletedAt: null },
    });
    if (!referrer) throw new NotFoundException('Referrer not found');

    const clean: Array<{
      parameterId: string | null;
      packageId: string | null;
      price: number;
    }> = [];

    for (const row of rows) {
      const hasParam = !!row.parameterId;
      const hasPkg = !!row.packageId;
      if (hasParam === hasPkg) {
        throw new BadRequestException(
          'Each override must set exactly one of parameterId or packageId',
        );
      }
      if (typeof row.price !== 'number' || row.price < 0) {
        throw new BadRequestException('Invalid price value');
      }
      if (hasParam) {
        const p = await this.prisma.client.testParameter.findFirst({
          where: { id: row.parameterId, tenantId },
        });
        if (!p) {
          throw new BadRequestException(
            'Parameter does not belong to this tenant',
          );
        }
      } else {
        const p = await this.prisma.client.testPackage.findFirst({
          where: { id: row.packageId, tenantId },
        });
        if (!p) {
          throw new BadRequestException(
            'Package does not belong to this tenant',
          );
        }
      }
      clean.push({
        parameterId: row.parameterId ?? null,
        packageId: row.packageId ?? null,
        price: row.price,
      });
    }

    await this.prisma.client.$transaction(async (tx) => {
      await tx.referrerPrice.deleteMany({ where: { partyId: referrerId } });
      if (clean.length > 0) {
        await tx.referrerPrice.createMany({
          data: clean.map((r) => ({
            tenantId,
            partyId: referrerId,
            parameterId: r.parameterId,
            packageId: r.packageId,
            price: r.price,
          })),
        });
      }
    });

    return this.listReferrerPrices(tenantId, referrerId);
  }

  async removeReferrerPrice(tenantId: string, referrerId: string, id: string) {
    const row = await this.prisma.client.referrerPrice.findFirst({
      where: { id, partyId: referrerId, tenantId },
    });
    if (!row) throw new NotFoundException('Referrer price override not found');
    await this.prisma.client.referrerPrice.delete({ where: { id } });
    return { message: 'Referrer price override removed' };
  }

  // ── Price preview ─────────────────────────────────────────────────────────

  async pricePreview(
    tenantId: string,
    query: { referrerId?: string; parameterIds?: string; packageIds?: string },
  ) {
    const parameterIds = (query.parameterIds ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const packageIds = (query.packageIds ?? '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);

    let referrer: {
      id: string;
      pricingMode: string | null;
      discountPercent: number | null;
    } | null = null;

    if (query.referrerId) {
      const r = await this.prisma.client.party.findFirst({
        where: { id: query.referrerId, tenantId, deletedAt: null },
        include: { doctorDetail: true },
      });
      if (!r) throw new NotFoundException('Referrer not found');
      referrer = {
        id: r.id,
        pricingMode: r.doctorDetail?.pricingMode ?? 'default',
        discountPercent: r.doctorDetail?.discountPercent
          ? Number(r.doctorDetail.discountPercent)
          : null,
      };
    }

    const pricing = referrer
      ? {
          pricingMode: referrer.pricingMode ?? 'default',
          discountPercent: referrer.discountPercent,
        }
      : null;

    const overrides = new Map<string, number>();
    if (referrer?.pricingMode === 'custom') {
      const rows = await this.prisma.client.referrerPrice.findMany({
        where: { partyId: referrer.id, tenantId },
      });
      for (const row of rows) {
        if (row.parameterId)
          overrides.set(`param:${row.parameterId}`, Number(row.price));
        if (row.packageId)
          overrides.set(`pkg:${row.packageId}`, Number(row.price));
      }
    }

    const items: Array<{
      id: string;
      code: string;
      name: string;
      kind: 'parameter' | 'package';
      defaultPrice: number;
      resolvedPrice: number;
      mode: string;
    }> = [];

    if (parameterIds.length > 0) {
      const params = await this.prisma.client.testParameter.findMany({
        where: { id: { in: parameterIds }, tenantId, isActive: true },
      });
      for (const p of params) {
        const defaultPrice = Number(p.defaultPrice);
        items.push({
          id: p.id,
          code: p.code,
          name: p.name,
          kind: 'parameter',
          defaultPrice,
          resolvedPrice: resolveEffectivePrice({
            code: p.code,
            defaultPrice,
            referrer: pricing,
            overridePrice: overrides.get(`param:${p.id}`) ?? null,
          }),
          mode: 'parameter',
        });
      }
    }

    if (packageIds.length > 0) {
      const pkgs = await this.prisma.client.testPackage.findMany({
        where: { id: { in: packageIds }, tenantId, isActive: true },
        include: { items: { include: { parameter: true } } },
      });
      for (const pk of pkgs) {
        if (pk.pricingMode === 'fixed') {
          const defaultPrice = Number(pk.fixedPrice ?? 0);
          items.push({
            id: pk.id,
            code: pk.code,
            name: pk.name,
            kind: 'package',
            defaultPrice,
            resolvedPrice: resolveEffectivePrice({
              code: pk.code,
              defaultPrice,
              fixedPrice: defaultPrice,
              referrer: pricing,
              overridePrice: overrides.get(`pkg:${pk.id}`) ?? null,
            }),
            mode: 'fixed',
          });
        } else {
          // "sum" — resolve each included parameter with the same referrer
          // rule, so a custom override on one parameter inside a package
          // still applies.
          const total = pk.items.reduce((sum, item) => {
            const d = Number(item.parameter.defaultPrice);
            return (
              sum +
              resolveEffectivePrice({
                code: item.parameter.code,
                defaultPrice: d,
                referrer: pricing,
                overridePrice:
                  overrides.get(`param:${item.parameter.id}`) ?? null,
              })
            );
          }, 0);
          items.push({
            id: pk.id,
            code: pk.code,
            name: pk.name,
            kind: 'package',
            defaultPrice: round2(total),
            resolvedPrice: round2(total),
            mode: 'sum',
          });
        }
      }
    }

    return {
      referrer: referrer
        ? {
            id: referrer.id,
            pricingMode: referrer.pricingMode,
            discountPercent: referrer.discountPercent,
          }
        : null,
      items,
    };
  }
}
