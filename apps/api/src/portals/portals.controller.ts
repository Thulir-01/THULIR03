import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { PortalsService } from './portals.service';
import type { EnrollDto, ResetPasswordDto, RevokeDto } from './portals.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const ADMIN_MANAGER = ['lab_admin', 'lab_manager'];

// ─── Admin: manage portal access ─────────────────────────────────────────────

@ApiTags('portals')
@Controller({ path: 'portals', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PortalsAdminController {
  constructor(private readonly portalsService: PortalsService) {}

  @Post('enroll')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({
    summary: 'Enable portal login for a patient or referrer party',
  })
  enroll(
    @Body() body: EnrollDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.portalsService.enroll(orgId, body);
  }

  @Post('revoke')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Revoke portal login for a patient or party' })
  revoke(
    @Body() body: RevokeDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.portalsService.revoke(orgId, body);
  }

  @Post('reset-password')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Reset a portal user password' })
  resetPassword(
    @Body() body: ResetPasswordDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.portalsService.resetPassword(orgId, body);
  }
}

// ─── Patient portal ──────────────────────────────────────────────────────────

@ApiTags('portals')
@Controller({ path: 'portals/patient', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles('patient')
export class PatientPortalController {
  constructor(private readonly portalsService: PortalsService) {}

  @Get('orders')
  @ApiOperation({ summary: 'My orders (patient portal)' })
  orders(
    @CurrentUser('sub') userId: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.portalsService.patientOrders(userId, orgId);
  }

  @Get('orders/:orderId')
  @ApiOperation({ summary: 'My report for an order (patient portal)' })
  report(
    @Param('orderId') orderId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.portalsService.patientReport(userId, orgId, orderId);
  }
}

// ─── Referrer portal ─────────────────────────────────────────────────────────

@ApiTags('portals')
@Controller({ path: 'portals/referrer', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
@Roles('referrer')
export class ReferrerPortalController {
  constructor(private readonly portalsService: PortalsService) {}

  @Get('orders')
  @ApiOperation({ summary: 'My referred orders (referrer portal)' })
  orders(
    @CurrentUser('sub') userId: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.portalsService.referrerOrders(userId, orgId);
  }

  @Get('orders/:orderId')
  @ApiOperation({ summary: 'Report for a referred order (referrer portal)' })
  report(
    @Param('orderId') orderId: string,
    @CurrentUser('sub') userId: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.portalsService.referrerReport(userId, orgId, orderId);
  }
}

// ─── Public: report verification (no auth) ───────────────────────────────────

@ApiTags('public')
@Controller({ path: 'public', version: '1' })
export class PublicPortalController {
  constructor(private readonly portalsService: PortalsService) {}

  @Get('reports/verify')
  @ApiOperation({ summary: 'Verify a report by order number (no auth)' })
  verify(@Query('orderNumber') orderNumber: string) {
    return this.portalsService.verifyReport(orderNumber);
  }
}
