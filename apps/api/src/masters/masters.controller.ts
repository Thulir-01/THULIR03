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
  type CreatePackageDto,
  type CreateParameterDto,
  type ReferrerPriceRowDto,
  type UpdateCategoryDto,
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

  // ── Packages ──────────────────────────────────────────────────────────────

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
