import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import {
  ReferrersService,
  type CreateReferrerDto,
  type UpdateReferrerDto,
} from './referrers.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Referrers')
@Controller({ path: 'referrers', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class ReferrersController {
  constructor(private referrersService: ReferrersService) {}

  @Get()
  @Roles('lab_admin', 'lab_manager', 'technician', 'receptionist')
  @ApiOperation({ summary: 'List all referrers with optional search' })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @CurrentUser('organizationId') orgId: string,
    @Query('search') search?: string,
  ) {
    return this.referrersService.findAll(orgId, { search });
  }

  @Get(':id')
  @Roles('lab_admin', 'lab_manager', 'technician', 'receptionist')
  @ApiOperation({ summary: 'Get single referrer details' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.referrersService.findOne(id, orgId);
  }

  @Post()
  @Roles('lab_admin')
  @ApiOperation({ summary: 'Create a new referrer' })
  create(
    @Body() body: CreateReferrerDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.referrersService.create(orgId, body);
  }

  @Put(':id')
  @Roles('lab_admin')
  @ApiOperation({ summary: 'Update referrer details' })
  update(
    @Param('id') id: string,
    @Body() body: UpdateReferrerDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.referrersService.update(id, orgId, body);
  }

  @Delete(':id')
  @Roles('lab_admin')
  @ApiOperation({ summary: 'Soft delete a referrer' })
  remove(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.referrersService.remove(id, orgId);
  }
}
