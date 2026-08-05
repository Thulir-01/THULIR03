import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { AuditLogsService } from './audit-logs.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Audit Logs')
@Controller({ path: 'audit-logs', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class AuditLogsController {
  constructor(private auditLogsService: AuditLogsService) {}

  @Get()
  @Roles('lab_admin', 'lab_manager')
  @ApiOperation({
    summary: 'List audit log entries (scoped to the caller organization)',
  })
  @ApiQuery({
    name: 'action',
    required: false,
    description: 'Filter by HTTP method (POST/PATCH/PUT/DELETE)',
  })
  @ApiQuery({
    name: 'entity',
    required: false,
    description: 'Filter by entity, e.g. orders, patients',
  })
  @ApiQuery({
    name: 'from',
    required: false,
    description: 'ISO timestamp — include entries created at/after this time',
  })
  @ApiQuery({
    name: 'to',
    required: false,
    description: 'ISO timestamp — include entries created at/before this time',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: 'Max entries (default 100, max 200)',
  })
  list(
    @Query('action') action?: string,
    @Query('entity') entity?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('limit') limit?: string,
    @CurrentUser('organizationId') orgId?: string,
  ) {
    return this.auditLogsService.list(orgId ?? '', {
      action,
      entity,
      from,
      to,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
