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
  PatientsService,
  type CreatePatientDto,
  type UpdatePatientDto,
} from './patients.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Patients')
@Controller({ path: 'patients', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class PatientsController {
  constructor(private patientsService: PatientsService) {}

  @Get()
  @Roles('lab_admin', 'lab_manager', 'technician', 'receptionist')
  @ApiOperation({ summary: 'List all patients with optional search' })
  @ApiQuery({ name: 'search', required: false })
  findAll(
    @CurrentUser('organizationId') orgId: string,
    @Query('search') search?: string,
  ) {
    return this.patientsService.findAll(orgId, { search });
  }

  @Get(':id')
  @Roles('lab_admin', 'lab_manager', 'technician', 'receptionist')
  @ApiOperation({ summary: 'Get single patient with recent orders' })
  findOne(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.patientsService.findOne(id, orgId);
  }

  @Post()
  @Roles('lab_admin', 'receptionist')
  @ApiOperation({ summary: 'Register a new patient' })
  create(
    @Body() body: CreatePatientDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.patientsService.create(orgId, body);
  }

  @Put(':id')
  @Roles('lab_admin', 'receptionist')
  @ApiOperation({ summary: 'Update patient details' })
  update(
    @Param('id') id: string,
    @Body() body: UpdatePatientDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.patientsService.update(id, orgId, body);
  }

  @Delete(':id')
  @Roles('lab_admin')
  @ApiOperation({ summary: 'Soft delete a patient' })
  remove(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.patientsService.remove(id, orgId);
  }
}
