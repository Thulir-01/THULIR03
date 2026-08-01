import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  MastersService,
  type CreateCategoryDto,
  type CreateLookupDto,
  type CreatePackageDto,
  type CreateParameterDto,
  type ReferrerPriceRowDto,
  type UpdateCategoryDto,
  type UpdateLookupDto,
  type UpdatePackageDto,
  type UpdateParameterDto,
} from './masters.service';

const ADMIN_MANAGER = ['lab_admin', 'lab_manager'];

@ApiTags('Masters')
@Controller({ path: 'masters', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MastersController {
  constructor(private mastersService: MastersService) {}

  // ── Categories ────────────────────────────────────────────────────────────

  @Get('categories')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'List test categories' })
  findCategories(@CurrentUser('organizationId') orgId: string) {
    return this.mastersService.findAllCategories(orgId);
  }

  @Post('categories')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Create a test category' })
  createCategory(
    @Body() body: CreateCategoryDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.createCategory(orgId, body);
  }

  @Patch('categories/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Update a test category' })
  updateCategory(
    @Param('id') id: string,
    @Body() body: UpdateCategoryDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.updateCategory(orgId, id, body);
  }

  // ── Parameters ────────────────────────────────────────────────────────────

  @Get('parameters/generate-code')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({
    summary: 'Suggest the next auto-generated parameter code for a category',
  })
  generateParameterCode(
    @Query('categoryId') categoryId: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.generateParameterCode(orgId, categoryId);
  }

  @Get('parameters')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({
    summary: 'List test parameters (filters: categoryId, search, isActive)',
  })
  findParameters(
    @CurrentUser('organizationId') orgId: string,
    @Query('categoryId') categoryId?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.mastersService.findParameters(orgId, {
      categoryId,
      search,
      isActive,
    });
  }

  @Post('parameters')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Create a test parameter (409 on duplicate code)' })
  createParameter(
    @Body() body: CreateParameterDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.createParameter(orgId, body);
  }

  @Get('parameters/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Get a single test parameter' })
  findParameter(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.findParameter(orgId, id);
  }

  // NOTE: static segments (bulk-status) MUST be declared before the :id
  // routes — NestJS matches in declaration order, so a later bulk-status
  // would be swallowed by parameters/:id ("bulk-status" parsed as a uuid).

  @Patch('parameters/bulk-status')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Enable/disable many parameters at once' })
  bulkSetParameterStatus(
    @Body() body: { ids: string[]; isActive: boolean },
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.bulkSetParameterStatus(
      orgId,
      body.ids,
      body.isActive,
    );
  }

  @Patch('parameters/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Update a test parameter' })
  updateParameter(
    @Param('id') id: string,
    @Body() body: UpdateParameterDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.updateParameter(orgId, id, body);
  }

  @Delete('parameters/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Soft delete (deactivate) a test parameter' })
  removeParameter(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.removeParameter(orgId, id);
  }

  @Patch('parameters/:id/status')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({
    summary: 'Quick enable/disable a parameter (fast PATCH, audited)',
  })
  setParameterStatus(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.setParameterStatus(orgId, id, body.isActive);
  }

  // ── Packages ──────────────────────────────────────────────────────────────

  @Get('packages/generate-code')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Suggest the next auto-generated package code' })
  generatePackageCode(@CurrentUser('organizationId') orgId: string) {
    return this.mastersService.generatePackageCode(orgId);
  }

  @Get('packages')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'List test packages' })
  findPackages(
    @CurrentUser('organizationId') orgId: string,
    @Query('search') search?: string,
  ) {
    return this.mastersService.findPackages(orgId, { search });
  }

  @Post('packages')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Create a test package (409 on duplicate code)' })
  createPackage(
    @Body() body: CreatePackageDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.createPackage(orgId, body);
  }

  @Get('packages/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Get a single test package with items' })
  findPackage(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.findPackage(orgId, id);
  }

  @Patch('packages/bulk-status')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Enable/disable many packages at once' })
  bulkSetPackageStatus(
    @Body() body: { ids: string[]; isActive: boolean },
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.bulkSetPackageStatus(
      orgId,
      body.ids,
      body.isActive,
    );
  }

  @Patch('packages/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Update a test package (items = replace-all)' })
  updatePackage(
    @Param('id') id: string,
    @Body() body: UpdatePackageDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.updatePackage(orgId, id, body);
  }

  @Delete('packages/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Soft delete (deactivate) a test package' })
  removePackage(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.removePackage(orgId, id);
  }

  @Patch('packages/:id/status')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({
    summary: 'Quick enable/disable a package (fast PATCH, audited)',
  })
  setPackageStatus(
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.setPackageStatus(orgId, id, body.isActive);
  }

  // ── Generic lookup masters (8 types, one table) ───────────────────────────
  // NOTE: static segments (generate-code) must be declared BEFORE the :id
  // routes — NestJS matches in declaration order.

  @Get('lookup/:type/generate-code')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Suggest the next auto-generated lookup code' })
  generateLookupCode(
    @Param('type') type: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.generateLookupCode(orgId, type);
  }

  @Get('lookup/:type')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({
    summary: 'List lookup values for a type (search, isActive filters)',
  })
  findLookups(
    @Param('type') type: string,
    @CurrentUser('organizationId') orgId: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.mastersService.findLookups(orgId, type, { search, isActive });
  }

  @Post('lookup/:type')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({
    summary: 'Create a lookup value (409 on duplicate code in this type)',
  })
  createLookup(
    @Param('type') type: string,
    @Body() body: CreateLookupDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.createLookup(orgId, type, body);
  }

  @Patch('lookup/:type/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Update a lookup value' })
  updateLookup(
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() body: UpdateLookupDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.updateLookup(orgId, type, id, body);
  }

  @Delete('lookup/:type/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Soft delete (deactivate) a lookup value' })
  removeLookup(
    @Param('type') type: string,
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.removeLookup(orgId, type, id);
  }

  @Patch('lookup/:type/:id/status')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({
    summary: 'Quick enable/disable a lookup value (fast PATCH, audited)',
  })
  setLookupStatus(
    @Param('type') type: string,
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.setLookupStatus(orgId, type, id, body.isActive);
  }

  // ── Referrer price overrides ──────────────────────────────────────────────

  @Get('referrers/:referrerId/prices')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'List price overrides for a referrer' })
  listReferrerPrices(
    @Param('referrerId') referrerId: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.listReferrerPrices(orgId, referrerId);
  }

  @Put('referrers/:referrerId/prices')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({
    summary: 'Bulk upsert referrer price overrides (replace-all)',
  })
  upsertReferrerPrices(
    @Param('referrerId') referrerId: string,
    @Body() body: ReferrerPriceRowDto[],
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.upsertReferrerPrices(orgId, referrerId, body);
  }

  @Delete('referrers/:referrerId/prices/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Remove a single referrer price override' })
  removeReferrerPrice(
    @Param('referrerId') referrerId: string,
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.mastersService.removeReferrerPrice(orgId, referrerId, id);
  }

  // ── Price preview (also used at the registration counter) ─────────────────

  @Get('price-preview')
  @Roles(...ADMIN_MANAGER, 'receptionist', 'pathologist')
  @ApiOperation({ summary: 'Resolve prices for a cart via the shared rule' })
  pricePreview(
    @CurrentUser('organizationId') orgId: string,
    @Query('referrerId') referrerId?: string,
    @Query('parameterIds') parameterIds?: string,
    @Query('packageIds') packageIds?: string,
  ) {
    return this.mastersService.pricePreview(orgId, {
      referrerId,
      parameterIds,
      packageIds,
    });
  }
}
