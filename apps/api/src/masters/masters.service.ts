import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolveEffectivePrice, round2 } from './price-resolver';

// ─── DTOs ───────────────────────────────────────────────────────────────────

export interface CreateCategoryDto {
  name: string;
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
  methodology?: string;
  turnaroundHours?: number;
  defaultPrice?: number;
  isActive?: boolean;
  sortOrder?: number;
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
    return this.prisma.client.testParameter.findMany({
      where,
      include: { category: { select: { id: true, name: true } } },
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
    });
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
    return this.prisma.client.testParameter.create({
      data: {
        tenantId,
        code,
        name: data.name.trim(),
        categoryId: data.categoryId,
        sampleType: data.sampleType ?? null,
        unit: data.unit ?? null,
        methodology: data.methodology ?? null,
        turnaroundHours: data.turnaroundHours ?? null,
        defaultPrice: data.defaultPrice ?? 0,
        isActive: data.isActive ?? true,
        sortOrder: data.sortOrder ?? 0,
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

  // ── Referrer price overrides ──────────────────────────────────────────────

  async listReferrerPrices(tenantId: string, referrerId: string) {
    const referrer = await this.prisma.client.party.findFirst({
      where: { id: referrerId, tenantId, partyType: 'doctor', deletedAt: null },
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
      where: { id: referrerId, tenantId, partyType: 'doctor', deletedAt: null },
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
        where: {
          id: query.referrerId,
          tenantId,
          partyType: 'doctor',
          deletedAt: null,
        },
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
