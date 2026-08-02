import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { InventoryService } from './inventory.service';
import type {
  CreateInventoryItemDto,
  CreateSupplierDto,
  RequirementDto,
  StockInDto,
  StockOutDto,
  UpdateInventoryItemDto,
  UpdateSupplierDto,
} from './inventory.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const ADMIN_MANAGER = ['lab_admin', 'lab_manager'];

@ApiTags('inventory')
@Controller({ path: 'inventory', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  // ─── Items ────────────────────────────────────────────────────────────

  @Get('items')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'List inventory items (search, low-stock filter)' })
  findItems(
    @CurrentUser('organizationId') orgId: string,
    @Query('search') search?: string,
    @Query('lowStock') lowStock?: string,
    @Query('includeInactive') includeInactive?: string,
  ) {
    return this.inventoryService.findItems(orgId, {
      search,
      lowStock,
      includeInactive,
    });
  }

  @Get('items/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Get a single inventory item' })
  findItem(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.inventoryService.findItem(id, orgId);
  }

  @Post('items')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Create an inventory item' })
  createItem(
    @Body() body: CreateInventoryItemDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.inventoryService.createItem(orgId, body);
  }

  @Patch('items/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Update an inventory item' })
  updateItem(
    @Param('id') id: string,
    @Body() body: UpdateInventoryItemDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.inventoryService.updateItem(id, orgId, body);
  }

  @Delete('items/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Soft-delete an inventory item' })
  removeItem(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.inventoryService.removeItem(id, orgId);
  }

  // ─── Stock movements ──────────────────────────────────────────────────

  @Post('stock/in')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Record a stock receipt (IN)' })
  stockIn(
    @Body() body: StockInDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.inventoryService.stockIn(orgId, actorId, body);
  }

  @Post('stock/out')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Record stock issued / consumed (OUT)' })
  stockOut(
    @Body() body: StockOutDto,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.inventoryService.stockOut(orgId, actorId, body);
  }

  @Get('items/:id/transactions')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Stock ledger for one item' })
  itemTransactions(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.inventoryService.itemTransactions(orgId, id);
  }

  @Get('transactions')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'All stock movements (optional item/type filter)' })
  allTransactions(
    @CurrentUser('organizationId') orgId: string,
    @Query('itemId') itemId?: string,
    @Query('type') type?: string,
  ) {
    return this.inventoryService.allTransactions(orgId, { itemId, type });
  }

  // ─── Alerts ───────────────────────────────────────────────────────────

  @Get('alerts')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Low-stock + expiring/expired batch alerts' })
  alerts(@CurrentUser('organizationId') orgId: string) {
    return this.inventoryService.alerts(orgId);
  }

  // ─── Suppliers ────────────────────────────────────────────────────────

  @Get('suppliers')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'List inventory suppliers' })
  findSuppliers(
    @CurrentUser('organizationId') orgId: string,
    @Query('search') search?: string,
  ) {
    return this.inventoryService.findSuppliers(orgId, search);
  }

  @Post('suppliers')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Create a supplier' })
  createSupplier(
    @Body() body: CreateSupplierDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.inventoryService.createSupplier(orgId, body);
  }

  @Patch('suppliers/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Update a supplier' })
  updateSupplier(
    @Param('id') id: string,
    @Body() body: UpdateSupplierDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.inventoryService.updateSupplier(id, orgId, body);
  }

  @Delete('suppliers/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Soft-delete a supplier' })
  removeSupplier(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.inventoryService.removeSupplier(id, orgId);
  }

  // ─── Test links ───────────────────────────────────────────────────────

  @Get('requirements')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Test ↔ inventory item consumption links' })
  findRequirements(
    @CurrentUser('organizationId') orgId: string,
    @Query('itemId') itemId?: string,
    @Query('parameterId') parameterId?: string,
  ) {
    return this.inventoryService.findRequirements(orgId, {
      itemId,
      parameterId,
    });
  }

  @Post('requirements')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Upsert a test → item consumption link' })
  setRequirement(
    @Body() body: RequirementDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.inventoryService.setRequirement(orgId, body);
  }

  @Delete('requirements/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Remove a test → item consumption link' })
  removeRequirement(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.inventoryService.removeRequirement(id, orgId);
  }
}
