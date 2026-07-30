import { Controller, Get, Post, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { OrdersService, type RegisterPatientOrderDto } from './orders.service';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RolesGuard } from '../common/guards/roles.guard';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';

@ApiTags('Orders')
@Controller({ path: 'orders', version: '1' })
@UseGuards(JwtAuthGuard, RolesGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private ordersService: OrdersService) {}

  @Get()
  @Roles('lab_admin', 'receptionist', 'technician')
  @ApiOperation({ summary: 'List all orders with patient and test details' })
  findAll(
    @Query('search') search: string | undefined,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.ordersService.findAll(orgId, search);
  }

  @Post('register')
  @Roles('lab_admin', 'receptionist')
  @ApiOperation({ summary: 'Full patient registration: patient + tests + billing in one call' })
  register(
    @Body() body: RegisterPatientOrderDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.ordersService.register(orgId, body);
  }
}
