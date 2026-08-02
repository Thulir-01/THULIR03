import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SettingsService, type LabSettingsDto } from './settings.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const ADMIN_MANAGER = ['lab_admin', 'lab_manager'];

@ApiTags('settings')
@Controller({ path: 'settings', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get('lab')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({
    summary:
      'Get the lab (organization) details used on printable reports and invoices',
  })
  getLab(@CurrentUser('organizationId') orgId: string) {
    return this.settingsService.getLab(orgId);
  }

  @Patch('lab')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Update lab name / address / phone / email' })
  updateLab(
    @Body() body: LabSettingsDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.settingsService.updateLab(orgId, body);
  }
}
