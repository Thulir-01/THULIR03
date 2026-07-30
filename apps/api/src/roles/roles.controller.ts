import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';

@ApiTags('Roles')
@Controller({ path: 'roles', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get()
  @Roles('lab_admin')
  @ApiOperation({ summary: 'List all roles with permissions' })
  findAll() {
    return this.rolesService.findAll();
  }

  @Get('permissions')
  @Roles('lab_admin')
  @ApiOperation({ summary: 'List all available permissions' })
  getPermissions() {
    return this.rolesService.getPermissions();
  }

  @Post('seed-permissions')
  @Roles('lab_admin')
  @ApiOperation({ summary: 'Seed default permissions' })
  seedPermissions() {
    return this.rolesService.seedDefaultPermissions();
  }

  @Get(':id')
  @Roles('lab_admin')
  @ApiOperation({ summary: 'Get role details with permissions' })
  findOne(@Param('id') id: string) {
    return this.rolesService.findOne(id);
  }

  @Post()
  @Roles('lab_admin')
  @ApiOperation({ summary: 'Create a new custom role' })
  create(@Body() body: { name: string; slug: string; description?: string }) {
    return this.rolesService.create(body);
  }

  @Put(':id')
  @Roles('lab_admin')
  @ApiOperation({ summary: 'Update role name/description' })
  update(
    @Param('id') id: string,
    @Body() body: { name?: string; description?: string },
  ) {
    return this.rolesService.update(id, body);
  }

  @Delete(':id')
  @Roles('lab_admin')
  @ApiOperation({ summary: 'Delete custom role' })
  remove(@Param('id') id: string) {
    return this.rolesService.remove(id);
  }

  @Put(':id/permissions')
  @Roles('lab_admin')
  @ApiOperation({ summary: 'Set permissions for a role' })
  setPermissions(
    @Param('id') id: string,
    @Body('permissionIds') permissionIds: string[],
  ) {
    return this.rolesService.setRolePermissions(id, permissionIds);
  }
}
