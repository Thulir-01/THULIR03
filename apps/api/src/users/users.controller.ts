import {
  Controller,
  Get,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import {
  type UpdateUserDto,
  type UpsertStaffDetailDto,
  UsersService,
} from './users.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Users')
@Controller({ path: 'users', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class UsersController {
  constructor(private usersService: UsersService) {}

  @Get()
  @Roles('lab_admin', 'lab_manager')
  @ApiOperation({ summary: 'List all users in organization' })
  findAll(@CurrentUser('organizationId') orgId: string) {
    return this.usersService.findAll(orgId);
  }

  // Static routes must be declared BEFORE the :id route, or "staff" would be
  // swallowed by the :id param (same route-shadowing bug as bulk-status).
  @Get('staff')
  @Roles('lab_admin', 'lab_manager')
  @ApiOperation({ summary: 'List users with NABL staff/sign-off details' })
  listStaff(@CurrentUser('organizationId') orgId: string) {
    return this.usersService.listStaff(orgId);
  }

  @Get(':id')
  @Roles('lab_admin', 'lab_manager')
  @ApiOperation({ summary: 'Get single user details' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.usersService.findOne(id, orgId);
  }

  @Get(':id/staff-detail')
  @Roles('lab_admin', 'lab_manager')
  @ApiOperation({ summary: 'Get a user with their NABL staff details' })
  getStaffDetail(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.usersService.getStaffDetail(id, orgId);
  }

  @Put(':id/staff-detail')
  @Roles('lab_admin')
  @ApiOperation({ summary: 'Create or update NABL staff details' })
  upsertStaffDetail(
    @Param('id') id: string,
    @Body() body: UpsertStaffDetailDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.usersService.upsertStaffDetail(id, orgId, body);
  }

  @Delete(':id/staff-detail')
  @Roles('lab_admin')
  @ApiOperation({ summary: 'Remove NABL staff details' })
  removeStaffDetail(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.usersService.removeStaffDetail(id, orgId);
  }

  @Put(':id')
  @Roles('lab_admin')
  @ApiOperation({ summary: 'Update user details' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateUserDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.usersService.update(id, orgId, body);
  }

  @Delete(':id')
  @Roles('lab_admin')
  @ApiOperation({ summary: 'Deactivate user (soft delete)' })
  remove(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.usersService.remove(id, orgId);
  }
}
