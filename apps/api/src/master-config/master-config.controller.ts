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
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import {
  MasterConfigService,
  type CreateHospitalDto,
  type CreateInstrumentDto,
  type CreateMethodDto,
  type CreateSampleTypeDto,
  type UpdateHospitalDto,
  type UpdateInstrumentDto,
  type UpdateMethodDto,
  type UpdateSampleTypeDto,
} from './master-config.service';

const ADMIN_MANAGER = ['lab_admin', 'lab_manager'];

@ApiTags('Master Config')
@Controller({ path: 'master-config', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class MasterConfigController {
  constructor(private readonly service: MasterConfigService) {}

  // ── Hospitals ─────────────────────────────────────────────────────────────

  @Get('hospitals')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'List hospital masters' })
  findHospitals(
    @CurrentUser('organizationId') orgId: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.service.findHospitals(orgId, { search, isActive });
  }

  @Get('hospitals/generate-code')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Suggest next hospital code' })
  generateHospitalCode(@CurrentUser('organizationId') orgId: string) {
    return this.service.generateHospitalCode(orgId);
  }

  @Post('hospitals')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Create a hospital master' })
  createHospital(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: CreateHospitalDto,
  ) {
    return this.service.createHospital(orgId, dto);
  }

  @Patch('hospitals/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Update a hospital master' })
  updateHospital(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateHospitalDto,
  ) {
    return this.service.updateHospital(orgId, id, dto);
  }

  @Patch('hospitals/:id/status')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Enable / disable a hospital master' })
  setHospitalStatus(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.service.setHospitalStatus(orgId, id, body.isActive);
  }

  @Delete('hospitals/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Soft-delete a hospital master' })
  removeHospital(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeHospital(orgId, id);
  }

  // ── Sample types ──────────────────────────────────────────────────────────

  @Get('sample-types')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'List sample type masters' })
  findSampleTypes(
    @CurrentUser('organizationId') orgId: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.service.findSampleTypes(orgId, { search, isActive });
  }

  @Get('sample-types/generate-code')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Suggest next sample type code' })
  generateSampleTypeCode(@CurrentUser('organizationId') orgId: string) {
    return this.service.generateSampleTypeCode(orgId);
  }

  @Post('sample-types')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Create a sample type master' })
  createSampleType(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: CreateSampleTypeDto,
  ) {
    return this.service.createSampleType(orgId, dto);
  }

  @Patch('sample-types/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Update a sample type master' })
  updateSampleType(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateSampleTypeDto,
  ) {
    return this.service.updateSampleType(orgId, id, dto);
  }

  @Patch('sample-types/:id/status')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Enable / disable a sample type master' })
  setSampleTypeStatus(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.service.setSampleTypeStatus(orgId, id, body.isActive);
  }

  @Delete('sample-types/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({
    summary: 'Soft-delete a sample type master (blocked if in use)',
  })
  removeSampleType(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeSampleType(orgId, id);
  }

  // ── Methods ───────────────────────────────────────────────────────────────

  @Get('methods')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'List method masters' })
  findMethods(
    @CurrentUser('organizationId') orgId: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.service.findMethods(orgId, { search, isActive });
  }

  @Get('methods/generate-code')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Suggest next method code' })
  generateMethodCode(@CurrentUser('organizationId') orgId: string) {
    return this.service.generateMethodCode(orgId);
  }

  @Post('methods')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Create a method master' })
  createMethod(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: CreateMethodDto,
  ) {
    return this.service.createMethod(orgId, dto);
  }

  @Patch('methods/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Update a method master' })
  updateMethod(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateMethodDto,
  ) {
    return this.service.updateMethod(orgId, id, dto);
  }

  @Patch('methods/:id/status')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Enable / disable a method master' })
  setMethodStatus(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.service.setMethodStatus(orgId, id, body.isActive);
  }

  @Delete('methods/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Soft-delete a method master (blocked if in use)' })
  removeMethod(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeMethod(orgId, id);
  }

  // ── Instruments ───────────────────────────────────────────────────────────

  @Get('instruments')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'List instrument masters' })
  findInstruments(
    @CurrentUser('organizationId') orgId: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
  ) {
    return this.service.findInstruments(orgId, { search, isActive });
  }

  @Get('instruments/generate-code')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Suggest next instrument code' })
  generateInstrumentCode(@CurrentUser('organizationId') orgId: string) {
    return this.service.generateInstrumentCode(orgId);
  }

  @Post('instruments')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Create an instrument master' })
  createInstrument(
    @CurrentUser('organizationId') orgId: string,
    @Body() dto: CreateInstrumentDto,
  ) {
    return this.service.createInstrument(orgId, dto);
  }

  @Patch('instruments/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Update an instrument master' })
  updateInstrument(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() dto: UpdateInstrumentDto,
  ) {
    return this.service.updateInstrument(orgId, id, dto);
  }

  @Patch('instruments/:id/status')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Enable / disable an instrument master' })
  setInstrumentStatus(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
    @Body() body: { isActive: boolean },
  ) {
    return this.service.setInstrumentStatus(orgId, id, body.isActive);
  }

  @Delete('instruments/:id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Soft-delete an instrument master' })
  removeInstrument(
    @CurrentUser('organizationId') orgId: string,
    @Param('id') id: string,
  ) {
    return this.service.removeInstrument(orgId, id);
  }
}
