import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
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
  @ApiQuery({ name: 'search', required: false })
  @ApiQuery({ name: 'limit', required: false })
  @ApiQuery({ name: 'offset', required: false })
  findAll(
    @Query('search') search: string | undefined,
    @Query('limit') limit: string | undefined,
    @Query('offset') offset: string | undefined,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.ordersService.findAll(
      orgId,
      search,
      limit ? Number(limit) : undefined,
      offset ? Number(offset) : undefined,
    );
  }

  @Get(':id')
  @Roles('lab_admin', 'receptionist', 'technician')
  @ApiOperation({
    summary:
      'Get single order with full test details including profile children',
  })
  findOne(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.ordersService.findOne(orgId, id);
  }

  @Post('register')
  @Roles('lab_admin', 'receptionist')
  @ApiOperation({
    summary:
      'Full patient registration: patient + tests (profiles expanded) + billing',
  })
  register(
    @Body() body: RegisterPatientOrderDto,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.ordersService.register(orgId, body);
  }

  @Patch(':orderId/tests/:testId')
  @Roles('lab_admin', 'technician')
  @ApiOperation({
    summary:
      'Update individual test result (auto-computes flag based on refLow/refHigh)',
  })
  updateResult(
    @Param('orderId') orderId: string,
    @Param('testId') testId: string,
    @Body()
    body: {
      result?: string;
      unit?: string;
      refRange?: string;
      status?: string;
      notes?: string;
    },
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.ordersService.updateTestResult(orgId, orderId, testId, body);
  }

  @Post(':id/verify')
  @Roles('lab_admin', 'technician')
  @ApiOperation({
    summary:
      'Technician verify — confirm all results entered, order → verified',
  })
  verify(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.ordersService.verifyOrder(orgId, id, actorId);
  }

  @Post(':id/approve')
  @Roles('lab_admin', 'pathologist')
  @ApiOperation({
    summary:
      'Pathologist approval — NABL sign-off: stamps every test e-signature, order → approved',
  })
  approve(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
    @CurrentUser('sub') actorId: string,
  ) {
    return this.ordersService.approveOrder(orgId, id, actorId);
  }

  @Get(':id/report')
  @Roles('lab_admin', 'pathologist', 'technician')
  @ApiOperation({
    summary: 'Get printable clinical report payload for an approved order',
  })
  report(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.ordersService.getReportData(orgId, id);
  }

  @Get(':id/invoice')
  @Roles('lab_admin', 'lab_manager', 'receptionist')
  @ApiOperation({
    summary:
      'Get invoice / receipt payload for an order (any status — billed at registration)',
  })
  invoice(
    @Param('id') id: string,
    @CurrentUser('organizationId') orgId: string,
  ) {
    return this.ordersService.getInvoiceData(orgId, id);
  }
}
