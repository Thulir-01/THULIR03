/* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-call, @typescript-eslint/require-await */
import { InventoryService } from './inventory.service';

describe('InventoryService', () => {
  const makeService = (overrides: Record<string, unknown>) =>
    new InventoryService({ client: overrides } as any);

  const baseMocks = () => ({
    inventoryItem: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    inventoryTransaction: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
    },
    inventorySupplier: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({}),
      update: jest.fn().mockResolvedValue({}),
    },
    testInventoryRequirement: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({}),
      delete: jest.fn().mockResolvedValue({}),
    },
    testParameter: {
      findFirst: jest.fn().mockResolvedValue(null),
    },
    $transaction: jest.fn().mockImplementation((cb) => cb({})),
  });

  it('scopes item listing to the tenant', async () => {
    const mocks = baseMocks();
    const service = makeService(mocks);
    await service.findItems('tenant-A', { search: 'glu' });
    const where = mocks.inventoryItem.findMany.mock.calls[0][0].where;
    expect(where.tenantId).toBe('tenant-A');
    expect(where.deletedAt).toBeNull();
    expect(where.OR).toBeDefined();
  });

  it('creates an item with tenantId', async () => {
    const mocks = baseMocks();
    mocks.inventoryItem.create = jest
      .fn()
      .mockImplementation(async ({ data }) => ({
        id: 'item-1',
        name: data.name,
        sku: data.sku,
        category: data.category,
        unit: data.unit,
        minStock: { toNumber: () => data.minStock },
        quantityOnHand: { toNumber: () => 0 },
        supplierId: data.supplierId,
        isActive: true,
        createdAt: new Date(),
        supplier: null,
      }));
    const service = makeService(mocks);
    const row = await service.createItem('tenant-A', {
      name: 'Glucose Kit',
      sku: 'GLU-001',
      minStock: 5,
    });
    const createData = mocks.inventoryItem.create.mock.calls[0][0].data;
    expect(createData.tenantId).toBe('tenant-A');
    expect(row.sku).toBe('GLU-001');
    expect(row.minStock).toBe(5);
  });

  it('stockIn writes an IN transaction and increments the balance', async () => {
    const mocks = baseMocks();
    mocks.inventoryItem.findFirst = jest.fn().mockResolvedValue({
      id: 'item-1',
      quantityOnHand: { toNumber: () => 10 },
    });
    const txItem = {
      id: 'item-1',
      name: 'Glucose Kit',
      sku: 'GLU-001',
      category: null,
      unit: 'kit',
      minStock: { toNumber: () => 5 },
      quantityOnHand: { toNumber: () => 25 },
      supplierId: null,
      isActive: true,
      createdAt: new Date(),
      supplier: null,
    };
    const tx = {
      inventoryTransaction: {
        create: jest.fn().mockResolvedValue({}),
      },
      inventoryItem: {
        update: jest.fn().mockResolvedValue(txItem),
      },
    };
    mocks.$transaction = jest.fn().mockImplementation((cb) => cb(tx));
    const service = makeService(mocks);

    await service.stockIn('tenant-A', 'user-1', {
      itemId: 'item-1',
      quantity: 15,
      batchNo: 'B-100',
      expiryDate: '2027-01-01',
    });

    expect(tx.inventoryTransaction.create).toHaveBeenCalled();
    const txData = tx.inventoryTransaction.create.mock.calls[0][0].data;
    expect(txData.type).toBe('in');
    expect(txData.batchNo).toBe('B-100');
    expect(txData.performedBy).toBe('user-1');
    expect(
      tx.inventoryItem.update.mock.calls[0][0].data.quantityOnHand,
    ).toEqual({
      increment: 15,
    });
  });

  it('stockOut rejects when stock is insufficient', async () => {
    const mocks = baseMocks();
    mocks.inventoryItem.findFirst = jest.fn().mockResolvedValue({
      id: 'item-1',
      unit: 'kit',
      quantityOnHand: { toNumber: () => 3 },
    });
    const service = makeService(mocks);
    await expect(
      service.stockOut('tenant-A', 'user-1', {
        itemId: 'item-1',
        quantity: 10,
      }),
    ).rejects.toThrow('Insufficient stock');
    expect(mocks.inventoryTransaction.create).not.toHaveBeenCalled();
  });

  it('stockOut writes an OUT transaction and decrements', async () => {
    const mocks = baseMocks();
    mocks.inventoryItem.findFirst = jest.fn().mockResolvedValue({
      id: 'item-1',
      unit: 'kit',
      quantityOnHand: { toNumber: () => 20 },
    });
    const tx = {
      inventoryTransaction: { create: jest.fn().mockResolvedValue({}) },
      inventoryItem: {
        update: jest.fn().mockResolvedValue({
          id: 'item-1',
          supplier: null,
          quantityOnHand: { toNumber: () => 15 },
        }),
      },
    };
    mocks.$transaction = jest.fn().mockImplementation((cb) => cb(tx));
    const service = makeService(mocks);

    await service.stockOut('tenant-A', 'user-1', {
      itemId: 'item-1',
      quantity: 5,
      reference: 'CBC panel',
    });

    expect(tx.inventoryTransaction.create.mock.calls[0][0].data.type).toBe(
      'out',
    );
    expect(
      tx.inventoryItem.update.mock.calls[0][0].data.quantityOnHand,
    ).toEqual({
      decrement: 5,
    });
  });

  it('alerts returns low-stock items and expiring batches', async () => {
    const mocks = baseMocks();
    mocks.inventoryItem.findMany = jest.fn().mockResolvedValue([
      {
        id: 'item-1',
        name: 'Glucose Kit',
        sku: 'GLU-001',
        category: null,
        unit: 'kit',
        minStock: { toNumber: () => 5 },
        quantityOnHand: { toNumber: () => 2 },
        supplierId: null,
        isActive: true,
        createdAt: new Date(),
        supplier: null,
      },
    ]);
    const soon = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    mocks.inventoryTransaction.findMany = jest.fn().mockResolvedValue([
      {
        id: 'tx-1',
        itemId: 'item-1',
        batchNo: 'B-200',
        expiryDate: soon,
        item: { name: 'Glucose Kit', sku: 'GLU-001' },
      },
    ]);
    const service = makeService(mocks);

    const result = await service.alerts('tenant-A');
    expect(result.lowStock.length).toBe(1);
    expect(result.lowStock[0].lowStock).toBe(true);
    expect(result.expiring.length).toBe(1);
    expect(result.expiring[0].batchNo).toBe('B-200');
  });

  it('setRequirement upserts a test→item link with tenant scoping', async () => {
    const mocks = baseMocks();
    mocks.inventoryItem.findFirst = jest
      .fn()
      .mockResolvedValue({ id: 'item-1' });
    mocks.testParameter.findFirst = jest
      .fn()
      .mockResolvedValue({ id: 'param-1' });
    mocks.testInventoryRequirement.upsert = jest.fn().mockResolvedValue({
      id: 'req-1',
      parameterId: 'param-1',
      parameter: { code: 'GLU', name: 'Glucose' },
      itemId: 'item-1',
      item: { name: 'Glucose Kit', sku: 'GLU-001' },
      quantity: { toNumber: () => 1 },
    });
    const service = makeService(mocks);

    const row = await service.setRequirement('tenant-A', {
      parameterId: 'param-1',
      itemId: 'item-1',
      quantity: 1,
    });

    expect(row.parameterName).toBe('Glucose');
    const upsertArgs = mocks.testInventoryRequirement.upsert.mock.calls[0][0];
    expect(upsertArgs.where.parameterId_itemId).toEqual({
      parameterId: 'param-1',
      itemId: 'item-1',
    });
    expect(upsertArgs.create.tenantId).toBe('tenant-A');
  });

  it('setRequirement rejects a quantity of zero', async () => {
    const service = makeService(baseMocks());
    await expect(
      service.setRequirement('tenant-A', {
        parameterId: 'p',
        itemId: 'i',
        quantity: 0,
      }),
    ).rejects.toThrow('Quantity must be greater than zero');
  });
});
