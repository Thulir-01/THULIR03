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
import {
  ApiBearerAuth,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { PartiesService } from './parties.service';
import type { CreatePartyDto, UpdatePartyDto } from './parties.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

const ADMIN_MANAGER = ['lab_admin', 'lab_manager'];

@ApiTags('parties')
@Controller({ path: 'parties', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PartiesController {
  constructor(private readonly partiesService: PartiesService) {}

  @Get()
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({
    summary:
      'List parties (hospitals, corporates, insurance TPAs, reference labs, consultants) — optional type filter + search',
  })
  @ApiQuery({ name: 'type', required: false })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @CurrentUser('organizationId') orgId: string,
    @Query('type') type?: string,
    @Query('search') search?: string,
  ) {
    return this.partiesService.findAll(orgId, { type, search });
  }

  @Get(':id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Get a single party with detail' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.partiesService.findOne(id, orgId);
  }

  @Post()
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Create a party of any supported type' })
  create(
    @Body() body: CreatePartyDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.partiesService.create(orgId, body);
  }

  @Patch(':id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({
    summary: 'Update a party (contact, GSTIN, status, doctor detail)',
  })
  update(
    @Param('id') id: string,
    @Body() body: UpdatePartyDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.partiesService.update(id, orgId, body);
  }

  @Delete(':id')
  @Roles(...ADMIN_MANAGER)
  @ApiOperation({ summary: 'Soft-delete a party' })
  remove(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.partiesService.remove(id, orgId);
  }
}
