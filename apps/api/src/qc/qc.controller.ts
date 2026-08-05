import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { QcService, type CreateQcControlDto, type EnterQcRunDto } from './qc.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const STAFF = ['technician', 'lab_admin', 'lab_manager'];
const ALL_ROLES = ['technician', 'pathologist', 'lab_admin', 'lab_manager'];

@ApiTags('qc')
@Controller({ path: 'qc', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class QcController {
  constructor(private readonly qcService: QcService) {}

  @Get('controls')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'List QC controls (search by name/test)' })
  findControls(
    @CurrentUser('organizationId') orgId: string,
    @Query('search') search?: string,
  ) {
    return this.qcService.findControls(orgId, search);
  }

  @Post('controls')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Create a QC control material (manual entry)' })
  createControl(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: CreateQcControlDto,
  ) {
    return this.qcService.createControl(orgId, userId, dto);
  }

  @Get('runs')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'List QC runs (optionally per control)' })
  listRuns(
    @CurrentUser('organizationId') orgId: string,
    @Query('controlId') controlId?: string,
    @Query('limit') limit?: string,
  ) {
    return this.qcService.listRuns(orgId, controlId, limit ? Number(limit) : undefined);
  }

  @Post('runs')
  @Roles(...STAFF)
  @ApiOperation({ summary: 'Enter a manual QC run — evaluates Westgard rules, persists + audits' })
  enterRun(
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') userId: string,
    @Body() dto: EnterQcRunDto,
  ) {
    return this.qcService.enterRun(orgId, userId, dto);
  }

  @Get('summary')
  @Roles(...ALL_ROLES)
  @ApiOperation({ summary: 'Today QC summary (runs, pass/warn/reject, latest)' })
  summary(@CurrentUser('organizationId') orgId: string) {
    return this.qcService.summary(orgId);
  }
}
