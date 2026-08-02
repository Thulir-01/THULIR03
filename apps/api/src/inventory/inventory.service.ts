import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─── Items ───────────────────────────────────────────────────────────────────

export interface CreateInventoryItemDto {
  name: string;
  sku: string;
  category?: string;
  unit?: string;
  minStock?: number;
  supplierId?: string;
}

export type UpdateInventoryItemDto = Partial<CreateInventoryItemDto> & {
  isActive?: boolean;
};

export interface InventoryItemRow {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  unit: string | null;
  minStock: number;
  quantityOnHand: number;
  supplierId: string | null;
  supplierName: string | null;
  isActive: boolean;
  lowStock: boolean;
  createdAt: Date;
  requirementCount?: number;
}

// ─── Stock movements ─────────────────────────────────────────────────────────

export interface StockInDto {
  itemId: string;
  quantity: number;
  batchNo?: string;
  expiryDate?: string;
  unitCost?: number;
  reference?: string;
  notes?: string;
}

export interface StockOutDto {
  itemId: string;
  quantity: number;
  reference?: string;
  notes?: string;
}

export interface TransactionRow {
  id: string;
  itemId: string;
  itemName: string;
  type: string;
  quantity: number;
  batchNo: string | null;
  expiryDate: Date | null;
  unitCost: number | null;
  reference: string | null;
  notes: string | null;
  performedAt: Date;
}

// ─── Suppliers ───────────────────────────────────────────────────────────────

export interface CreateSupplierDto {
  name: string;
  contactPerson?: string;
  phone?: string;
  email?: string;
  address?: string;
}

export type UpdateSupplierDto = Partial<CreateSupplierDto> & {
  isActive?: boolean;
};

// ─── Test links ──────────────────────────────────────────────────────────────

export interface RequirementDto {
  parameterId: string;
  itemId: string;
  quantity: number;
}

export interface RequirementRow {
  id: string;
  parameterId: string;
  parameterCode: string;
  parameterName: string;
  itemId: string;
  itemName: string;
  itemSku: string;
  quantity: number;
}

function num(
  v: { toNumber?: () => number } | number | null | undefined,
): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (v.toNumber) return v.toNumber();
  return Number(v);
}

function toItemRow(item: {
  id: string;
  name: string;
  sku: string;
  category: string | null;
  unit: string | null;
  minStock: { toNumber?: () => number } | number;
  quantityOnHand: { toNumber?: () => number } | number;
  supplierId: string | null;
  isActive: boolean;
  createdAt: Date;
  supplier: { name: string } | null;
  _count?: { requirements: number };
}): InventoryItemRow {
  const min = num(item.minStock) ?? 0;
  const qty = num(item.quantityOnHand) ?? 0;
  return {
    id: item.id,
    name: item.name,
    sku: item.sku,
    category: item.category,
    unit: item.unit,
    minStock: min,
    quantityOnHand: qty,
    supplierId: item.supplierId,
    supplierName: item.supplier?.name ?? null,
    isActive: item.isActive,
    lowStock: qty <= min,
    createdAt: item.createdAt,
    requirementCount: item._count?.requirements,
  };
}

function toTxRow(tx: {
  id: string;
  itemId: string;
  type: string;
  quantity: { toNumber?: () => number } | number;
  batchNo: string | null;
  expiryDate: Date | null;
  unitCost: { toNumber?: () => number } | number | null;
  reference: string | null;
  notes: string | null;
  performedAt: Date;
  item: { name: string };
}): TransactionRow {
  return {
    id: tx.id,
    itemId: tx.itemId,
    itemName: tx.item.name,
    type: tx.type,
    quantity: num(tx.quantity) ?? 0,
    batchNo: tx.batchNo,
    expiryDate: tx.expiryDate,
    unitCost: num(tx.unitCost),
    reference: tx.reference,
    notes: tx.notes,
    performedAt: tx.performedAt,
  };
}

@Injectable()
export class InventoryService {
  constructor(private prisma: PrismaService) {}

  // ─── Items ─────────────────────────────────────────────────────────────

  async findItems(
    organizationId: string,
    query?: { search?: string; lowStock?: string; includeInactive?: string },
  ): Promise<InventoryItemRow[]> {
    const where: Record<string, unknown> = {
      tenantId: organizationId,
      deletedAt: null,
    };
    if (query?.includeInactive !== 'true') {
      where.isActive = true;
    }
    if (query?.search) {
      const s = query.search;
      where.OR = [
        { name: { contains: s, mode: 'insensitive' } },
        { sku: { contains: s, mode: 'insensitive' } },
        { category: { contains: s, mode: 'insensitive' } },
      ];
    }
    const rows = await this.prisma.client.inventoryItem.findMany({
      where,
      include: {
        supplier: { select: { name: true } },
        _count: { select: { requirements: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    let items = rows.map(toItemRow);
    if (query?.lowStock === 'true') {
      items = items.filter((i) => i.lowStock);
    }
    return items;
  }

  async findItem(
    id: string,
    organizationId: string,
  ): Promise<InventoryItemRow> {
    const item = await this.prisma.client.inventoryItem.findFirst({
      where: { id, tenantId: organizationId, deletedAt: null },
      include: {
        supplier: { select: { name: true } },
        _count: { select: { requirements: true } },
      },
    });
    if (!item) throw new NotFoundException('Item not found');
    return toItemRow(item);
  }

  async createItem(organizationId: string, data: CreateInventoryItemDto) {
    const item = await this.prisma.client.inventoryItem.create({
      data: {
        tenantId: organizationId,
        name: data.name,
        sku: data.sku,
        category: data.category ?? null,
        unit: data.unit ?? null,
        minStock: data.minStock ?? 0,
        supplierId: data.supplierId ?? null,
      },
      include: { supplier: { select: { name: true } } },
    });
    return toItemRow(item);
  }

  async updateItem(
    id: string,
    organizationId: string,
    data: UpdateInventoryItemDto,
  ) {
    const item = await this.prisma.client.inventoryItem.findFirst({
      where: { id, tenantId: organizationId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Item not found');

    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.sku !== undefined) patch.sku = data.sku;
    if (data.category !== undefined) patch.category = data.category;
    if (data.unit !== undefined) patch.unit = data.unit;
    if (data.minStock !== undefined) patch.minStock = data.minStock;
    if (data.supplierId !== undefined) patch.supplierId = data.supplierId;
    if (data.isActive !== undefined) patch.isActive = data.isActive;

    const updated = await this.prisma.client.inventoryItem.update({
      where: { id },
      data: patch,
      include: { supplier: { select: { name: true } } },
    });
    return toItemRow(updated);
  }

  async removeItem(id: string, organizationId: string) {
    const item = await this.prisma.client.inventoryItem.findFirst({
      where: { id, tenantId: organizationId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Item not found');
    await this.prisma.client.inventoryItem.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { message: 'Item deleted' };
  }

  // ─── Stock movements ───────────────────────────────────────────────────

  async stockIn(organizationId: string, actorId: string, dto: StockInDto) {
    const item = await this.prisma.client.inventoryItem.findFirst({
      where: { id: dto.itemId, tenantId: organizationId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Item not found');
    if (!dto.quantity || dto.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }

    return this.prisma.client.$transaction(async (tx) => {
      await tx.inventoryTransaction.create({
        data: {
          tenantId: organizationId,
          itemId: dto.itemId,
          type: 'in',
          quantity: dto.quantity,
          batchNo: dto.batchNo ?? null,
          expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
          unitCost: dto.unitCost ?? null,
          reference: dto.reference ?? null,
          notes: dto.notes ?? null,
          performedBy: actorId,
        },
      });
      const updated = await tx.inventoryItem.update({
        where: { id: dto.itemId },
        data: {
          quantityOnHand: { increment: dto.quantity },
        },
        include: { supplier: { select: { name: true } } },
      });
      return toItemRow(updated);
    });
  }

  async stockOut(organizationId: string, actorId: string, dto: StockOutDto) {
    const item = await this.prisma.client.inventoryItem.findFirst({
      where: { id: dto.itemId, tenantId: organizationId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Item not found');
    if (!dto.quantity || dto.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }
    const onHand = num(item.quantityOnHand) ?? 0;
    if (dto.quantity > onHand) {
      throw new BadRequestException(
        `Insufficient stock — only ${onHand} ${item.unit ?? 'units'} available`,
      );
    }

    return this.prisma.client.$transaction(async (tx) => {
      await tx.inventoryTransaction.create({
        data: {
          tenantId: organizationId,
          itemId: dto.itemId,
          type: 'out',
          quantity: dto.quantity,
          reference: dto.reference ?? null,
          notes: dto.notes ?? null,
          performedBy: actorId,
        },
      });
      const updated = await tx.inventoryItem.update({
        where: { id: dto.itemId },
        data: {
          quantityOnHand: { decrement: dto.quantity },
        },
        include: { supplier: { select: { name: true } } },
      });
      return toItemRow(updated);
    });
  }

  async itemTransactions(organizationId: string, itemId: string) {
    const rows = await this.prisma.client.inventoryTransaction.findMany({
      where: { tenantId: organizationId, itemId },
      include: { item: { select: { name: true } } },
      orderBy: { performedAt: 'desc' },
    });
    return rows.map(toTxRow);
  }

  async allTransactions(
    organizationId: string,
    query?: { itemId?: string; type?: string },
  ) {
    const where: Record<string, unknown> = { tenantId: organizationId };
    if (query?.itemId) where.itemId = query.itemId;
    if (query?.type) where.type = query.type;
    const rows = await this.prisma.client.inventoryTransaction.findMany({
      where,
      include: { item: { select: { name: true } } },
      orderBy: { performedAt: 'desc' },
      take: 200,
    });
    return rows.map(toTxRow);
  }

  // ─── Alerts ────────────────────────────────────────────────────────────

  async alerts(organizationId: string) {
    const items = await this.prisma.client.inventoryItem.findMany({
      where: { tenantId: organizationId, deletedAt: null, isActive: true },
      include: { supplier: { select: { name: true } } },
    });

    const lowStock = items
      .filter((i) => (num(i.quantityOnHand) ?? 0) <= (num(i.minStock) ?? 0))
      .map(toItemRow);

    const now = new Date();
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const batches = await this.prisma.client.inventoryTransaction.findMany({
      where: {
        tenantId: organizationId,
        type: 'in',
        expiryDate: { not: null },
      },
      include: { item: { select: { name: true, sku: true } } },
      orderBy: { expiryDate: 'asc' },
      take: 200,
    });

    const expiring = batches
      .filter(
        (b) =>
          b.expiryDate !== null && b.expiryDate <= soon && b.expiryDate >= now,
      )
      .map((b) => ({
        id: b.id,
        itemId: b.itemId,
        itemName: b.item.name,
        sku: b.item.sku,
        batchNo: b.batchNo,
        expiryDate: b.expiryDate,
      }));
    const expired = batches
      .filter((b) => b.expiryDate !== null && b.expiryDate < now)
      .map((b) => ({
        id: b.id,
        itemId: b.itemId,
        itemName: b.item.name,
        sku: b.item.sku,
        batchNo: b.batchNo,
        expiryDate: b.expiryDate,
      }));

    return { lowStock, expiring, expired };
  }

  // ─── Suppliers ─────────────────────────────────────────────────────────

  async findSuppliers(organizationId: string, search?: string) {
    const where: Record<string, unknown> = {
      tenantId: organizationId,
      deletedAt: null,
    };
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
      ];
    }
    return this.prisma.client.inventorySupplier.findMany({
      where,
      include: { _count: { select: { items: true } } },
      orderBy: { name: 'asc' },
    });
  }

  async createSupplier(organizationId: string, data: CreateSupplierDto) {
    return this.prisma.client.inventorySupplier.create({
      data: {
        tenantId: organizationId,
        name: data.name,
        contactPerson: data.contactPerson ?? null,
        phone: data.phone ?? null,
        email: data.email ?? null,
        address: data.address ?? null,
      },
    });
  }

  async updateSupplier(
    id: string,
    organizationId: string,
    data: UpdateSupplierDto,
  ) {
    const supplier = await this.prisma.client.inventorySupplier.findFirst({
      where: { id, tenantId: organizationId, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.contactPerson !== undefined)
      patch.contactPerson = data.contactPerson;
    if (data.phone !== undefined) patch.phone = data.phone;
    if (data.email !== undefined) patch.email = data.email;
    if (data.address !== undefined) patch.address = data.address;
    if (data.isActive !== undefined) patch.isActive = data.isActive;
    return this.prisma.client.inventorySupplier.update({
      where: { id },
      data: patch,
    });
  }

  async removeSupplier(id: string, organizationId: string) {
    const supplier = await this.prisma.client.inventorySupplier.findFirst({
      where: { id, tenantId: organizationId, deletedAt: null },
    });
    if (!supplier) throw new NotFoundException('Supplier not found');
    await this.prisma.client.inventorySupplier.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { message: 'Supplier deleted' };
  }

  // ─── Test links ────────────────────────────────────────────────────────

  async findRequirements(
    organizationId: string,
    query?: { itemId?: string; parameterId?: string },
  ): Promise<RequirementRow[]> {
    const where: Record<string, unknown> = { tenantId: organizationId };
    if (query?.itemId) where.itemId = query.itemId;
    if (query?.parameterId) where.parameterId = query.parameterId;
    const rows = await this.prisma.client.testInventoryRequirement.findMany({
      where,
      include: {
        parameter: { select: { code: true, name: true } },
        item: { select: { name: true, sku: true } },
      },
      orderBy: { parameter: { name: 'asc' } },
    });
    return rows.map((r) => ({
      id: r.id,
      parameterId: r.parameterId,
      parameterCode: r.parameter.code,
      parameterName: r.parameter.name,
      itemId: r.itemId,
      itemName: r.item.name,
      itemSku: r.item.sku,
      quantity: num(r.quantity) ?? 0,
    }));
  }

  async setRequirement(organizationId: string, dto: RequirementDto) {
    if (!dto.quantity || dto.quantity <= 0) {
      throw new BadRequestException('Quantity must be greater than zero');
    }
    const item = await this.prisma.client.inventoryItem.findFirst({
      where: { id: dto.itemId, tenantId: organizationId, deletedAt: null },
    });
    if (!item) throw new NotFoundException('Item not found');
    const parameter = await this.prisma.client.testParameter.findFirst({
      where: { id: dto.parameterId, tenantId: organizationId },
    });
    if (!parameter) throw new NotFoundException('Test parameter not found');

    const row = await this.prisma.client.testInventoryRequirement.upsert({
      where: {
        parameterId_itemId: {
          parameterId: dto.parameterId,
          itemId: dto.itemId,
        },
      },
      create: {
        tenantId: organizationId,
        parameterId: dto.parameterId,
        itemId: dto.itemId,
        quantity: dto.quantity,
      },
      update: { quantity: dto.quantity },
      include: {
        parameter: { select: { code: true, name: true } },
        item: { select: { name: true, sku: true } },
      },
    });
    return {
      id: row.id,
      parameterId: row.parameterId,
      parameterCode: row.parameter.code,
      parameterName: row.parameter.name,
      itemId: row.itemId,
      itemName: row.item.name,
      itemSku: row.item.sku,
      quantity: num(row.quantity) ?? 0,
    };
  }

  async removeRequirement(id: string, organizationId: string) {
    const row = await this.prisma.client.testInventoryRequirement.findFirst({
      where: { id, tenantId: organizationId },
    });
    if (!row) throw new NotFoundException('Requirement not found');
    await this.prisma.client.testInventoryRequirement.delete({ where: { id } });
    return { message: 'Requirement removed' };
  }
}
