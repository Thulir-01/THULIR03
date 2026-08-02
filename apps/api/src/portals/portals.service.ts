import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';

export interface EnrollDto {
  kind: 'patient' | 'referrer';
  entityId: string;
  email: string;
  password: string;
}

export interface RevokeDto {
  kind: 'patient' | 'referrer';
  entityId: string;
}

export interface ResetPasswordDto {
  userId: string;
  password: string;
}

export interface PortalOrderRow {
  id: string;
  orderNumber: string;
  status: string;
  priority: string;
  emergency: boolean;
  createdAt: Date;
  finalReportDate: Date | null;
  reportReady: boolean;
  patientName: string | null;
  testCount: number;
  tests: { testName: string; status: string }[];
}

export interface PortalReport {
  orderNumber: string;
  status: string;
  priority: string;
  emergency: boolean;
  createdAt: Date;
  sampleCollectDt: Date | null;
  refNo: string | null;
  remarks: string | null;
  finalReportDate: Date | null;
  verifiedAt: Date | null;
  approvedAt: Date | null;
  patient: {
    firstName: string;
    lastName: string;
    gender: string | null;
    dateOfBirth: Date | null;
    ageYears: number | null;
    ageMonths: number | null;
    phone: string | null;
  };
  referrer: string | null;
  lab: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  } | null;
  tests: {
    testCode: string;
    testName: string;
    isProfile: boolean;
    result: string | null;
    unit: string | null;
    refRange: string | null;
    refLow: number | null;
    refHigh: number | null;
    notes: string | null;
    status: string;
    children: {
      testCode: string;
      testName: string;
      result: string | null;
      unit: string | null;
      refRange: string | null;
      refLow: number | null;
      refHigh: number | null;
      status: string;
    }[];
  }[];
}

function num(
  v: { toNumber?: () => number } | number | null | undefined,
): number | null {
  if (v == null) return null;
  if (typeof v === 'number') return v;
  if (v.toNumber) return v.toNumber();
  return Number(v);
}

@Injectable()
export class PortalsService {
  constructor(private prisma: PrismaService) {}

  // ─── Admin: enroll / revoke / reset ───────────────────────────────────

  private async ensureRole(slug: 'patient' | 'referrer') {
    let role = await this.prisma.client.role.findFirst({ where: { slug } });
    if (!role) {
      role = await this.prisma.client.role.create({
        data: {
          name: slug === 'patient' ? 'Patient' : 'Referrer',
          slug,
          description:
            slug === 'patient'
              ? 'Patient portal — view own orders & reports'
              : 'Referrer portal — view referred orders & reports',
          isSystem: true,
        },
      });
    }
    return role;
  }

  async enroll(organizationId: string, dto: EnrollDto) {
    if (!dto.email || !/^\S+@\S+\.\S+$/.test(dto.email)) {
      throw new BadRequestException('A valid email is required');
    }
    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }

    let firstName = '';
    let lastName = '';
    if (dto.kind === 'patient') {
      const patient = await this.prisma.client.patient.findFirst({
        where: { id: dto.entityId, tenantId: organizationId, deletedAt: null },
      });
      if (!patient) throw new NotFoundException('Patient not found');
      if (patient.userId) {
        throw new BadRequestException('Patient already has portal access');
      }
      firstName = patient.firstName;
      lastName = patient.lastName;
    } else {
      const party = await this.prisma.client.party.findFirst({
        where: { id: dto.entityId, tenantId: organizationId, deletedAt: null },
      });
      if (!party) throw new NotFoundException('Party not found');
      if (party.userId) {
        throw new BadRequestException('Party already has portal access');
      }
      firstName = party.name;
      lastName = '';
    }

    const existing = await this.prisma.client.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new BadRequestException('A user with this email already exists');
    }

    const role = await this.ensureRole(dto.kind);
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.client.user.create({
      data: {
        email: dto.email,
        passwordHash,
        firstName,
        lastName,
        organizationId,
        roleId: role.id,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        role: { select: { slug: true } },
      },
    });

    if (dto.kind === 'patient') {
      await this.prisma.client.patient.update({
        where: { id: dto.entityId },
        data: { userId: user.id },
      });
    } else {
      await this.prisma.client.party.update({
        where: { id: dto.entityId },
        data: { userId: user.id },
      });
    }

    return {
      message: 'Portal access enabled',
      email: user.email,
      role: user.role?.slug,
    };
  }

  async revoke(organizationId: string, dto: RevokeDto) {
    let userId: string | null = null;
    if (dto.kind === 'patient') {
      const patient = await this.prisma.client.patient.findFirst({
        where: { id: dto.entityId, tenantId: organizationId, deletedAt: null },
      });
      if (!patient) throw new NotFoundException('Patient not found');
      userId = patient.userId;
      await this.prisma.client.patient.update({
        where: { id: dto.entityId },
        data: { userId: null },
      });
    } else {
      const party = await this.prisma.client.party.findFirst({
        where: { id: dto.entityId, tenantId: organizationId, deletedAt: null },
      });
      if (!party) throw new NotFoundException('Party not found');
      userId = party.userId;
      await this.prisma.client.party.update({
        where: { id: dto.entityId },
        data: { userId: null },
      });
    }
    if (userId) {
      await this.prisma.client.user.update({
        where: { id: userId },
        data: { isActive: false },
      });
    }
    return { message: 'Portal access revoked' };
  }

  async resetPassword(organizationId: string, dto: ResetPasswordDto) {
    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestException('Password must be at least 6 characters');
    }
    const user = await this.prisma.client.user.findFirst({
      where: { id: dto.userId, organizationId },
    });
    if (!user) throw new NotFoundException('User not found');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    await this.prisma.client.user.update({
      where: { id: dto.userId },
      data: { passwordHash, isActive: true },
    });
    return { message: 'Password reset' };
  }

  // ─── Patient portal ───────────────────────────────────────────────────

  private async patientForUser(userId: string, organizationId: string) {
    const patient = await this.prisma.client.patient.findFirst({
      where: { userId, tenantId: organizationId, deletedAt: null },
    });
    if (!patient) {
      throw new ForbiddenException('No patient portal profile linked');
    }
    return patient;
  }

  async patientOrders(userId: string, organizationId: string) {
    const patient = await this.patientForUser(userId, organizationId);
    const orders = await this.prisma.client.order.findMany({
      where: {
        tenantId: organizationId,
        patientId: patient.id,
        deletedAt: null,
      },
      include: {
        tests: {
          where: { parentTestId: null },
          select: { testName: true, status: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((o): PortalOrderRow => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      priority: o.priority,
      emergency: o.emergency,
      createdAt: o.createdAt,
      finalReportDate: o.finalReportDate,
      reportReady: o.status === 'approved',
      patientName: `${patient.firstName} ${patient.lastName}`.trim(),
      testCount: o.tests.length,
      tests: o.tests,
    }));
  }

  async patientReport(userId: string, organizationId: string, orderId: string) {
    const patient = await this.patientForUser(userId, organizationId);
    const order = await this.prisma.client.order.findFirst({
      where: {
        id: orderId,
        tenantId: organizationId,
        patientId: patient.id,
        deletedAt: null,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.buildReport(organizationId, order);
  }

  // ─── Referrer portal ──────────────────────────────────────────────────

  private async partyForUser(userId: string, organizationId: string) {
    const party = await this.prisma.client.party.findFirst({
      where: { userId, tenantId: organizationId, deletedAt: null },
    });
    if (!party)
      throw new ForbiddenException('No referrer portal profile linked');
    return party;
  }

  async referrerOrders(userId: string, organizationId: string) {
    const party = await this.partyForUser(userId, organizationId);
    const orders = await this.prisma.client.order.findMany({
      where: {
        tenantId: organizationId,
        referrerPartyId: party.id,
        deletedAt: null,
      },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        tests: {
          where: { parentTestId: null },
          select: { testName: true, status: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((o): PortalOrderRow => ({
      id: o.id,
      orderNumber: o.orderNumber,
      status: o.status,
      priority: o.priority,
      emergency: o.emergency,
      createdAt: o.createdAt,
      finalReportDate: o.finalReportDate,
      reportReady: o.status === 'approved',
      patientName: `${o.patient.firstName} ${o.patient.lastName}`.trim(),
      testCount: o.tests.length,
      tests: o.tests,
    }));
  }

  async referrerReport(
    userId: string,
    organizationId: string,
    orderId: string,
  ) {
    const party = await this.partyForUser(userId, organizationId);
    const order = await this.prisma.client.order.findFirst({
      where: {
        id: orderId,
        tenantId: organizationId,
        referrerPartyId: party.id,
        deletedAt: null,
      },
    });
    if (!order) throw new NotFoundException('Order not found');
    return this.buildReport(organizationId, order);
  }

  // ─── Public verification ──────────────────────────────────────────────

  async verifyReport(orderNumber: string) {
    if (!orderNumber) {
      return { valid: false, message: 'Order number is required' };
    }
    const order = await this.prisma.client.order.findUnique({
      where: { orderNumber: orderNumber.trim().toUpperCase() },
      include: {
        patient: { select: { firstName: true, lastName: true } },
        tests: {
          where: { parentTestId: null },
          select: { testName: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });
    if (!order || order.deletedAt) {
      return { valid: false, orderNumber, message: 'No matching report found' };
    }
    const lab = await this.prisma.client.organization.findFirst({
      where: { id: order.tenantId },
      select: { name: true },
    });
    return {
      valid: true,
      orderNumber: order.orderNumber,
      status: order.status,
      labName: lab?.name ?? null,
      reportDate: order.finalReportDate ?? order.approvedAt,
      patientName:
        `${order.patient.firstName} ${order.patient.lastName}`.trim(),
      tests: order.tests.map((t) => t.testName),
    };
  }

  // ─── Shared report builder ────────────────────────────────────────────

  private async buildReport(organizationId: string, order: { id: string }) {
    const full = await this.prisma.client.order.findFirst({
      where: { id: order.id, tenantId: organizationId },
      include: {
        patient: {
          select: {
            firstName: true,
            lastName: true,
            gender: true,
            dateOfBirth: true,
            ageYears: true,
            ageMonths: true,
            phone: true,
          },
        },
        referrerParty: { select: { name: true } },
        tests: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!full) throw new NotFoundException('Order not found');
    if (full.status !== 'approved') {
      throw new ForbiddenException('Report is not yet available');
    }
    const lab = await this.prisma.client.organization.findFirst({
      where: { id: organizationId },
      select: { name: true, address: true, phone: true, email: true },
    });

    const tests = full.tests
      .filter((t) => !t.parentTestId)
      .map((t) => ({
        testCode: t.testCode,
        testName: t.testName,
        isProfile: t.isProfile,
        result: t.result,
        unit: t.unit,
        refRange: t.refRange,
        refLow: num(t.refLow),
        refHigh: num(t.refHigh),
        notes: t.notes,
        status: t.status,
        children: full.tests
          .filter((c) => c.parentTestId === t.id)
          .map((c) => ({
            testCode: c.testCode,
            testName: c.testName,
            result: c.result,
            unit: c.unit,
            refRange: c.refRange,
            refLow: num(c.refLow),
            refHigh: num(c.refHigh),
            status: c.status,
          })),
      }));

    return {
      orderNumber: full.orderNumber,
      status: full.status,
      priority: full.priority,
      emergency: full.emergency,
      createdAt: full.createdAt,
      sampleCollectDt: full.sampleCollectDt,
      refNo: full.refNo,
      remarks: full.remarks,
      finalReportDate: full.finalReportDate,
      verifiedAt: full.verifiedAt,
      approvedAt: full.approvedAt,
      patient: {
        firstName: full.patient.firstName,
        lastName: full.patient.lastName,
        gender: full.patient.gender,
        dateOfBirth: full.patient.dateOfBirth,
        ageYears: full.patient.ageYears,
        ageMonths: full.patient.ageMonths,
        phone: full.patient.phone,
      },
      referrer: full.referrerParty?.name ?? null,
      lab: lab
        ? {
            name: lab.name,
            address: lab.address,
            phone: lab.phone,
            email: lab.email,
          }
        : null,
      tests,
    };
  }
}
