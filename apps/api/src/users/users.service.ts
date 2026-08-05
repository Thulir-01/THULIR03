import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';

export interface CreateUserDto {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone?: string;
  roleId?: string;
  branchId?: string;
}

export interface UpdateUserDto {
  firstName?: string;
  lastName?: string;
  phone?: string;
  roleId?: string;
  branchId?: string;
  isActive?: boolean;
  password?: string;
  /** Admin “extend access” — bumps lastLoginAt so dormant accounts stay usable. */
  lastLoginAt?: Date | string;
}

export interface UpsertStaffDetailDto {
  registrationNo?: string;
  qualification?: string;
  designation?: string;
  signatureImageUrl?: string;
}

/** Staff detail fields (excludes the internal id/tenant plumbing). */
const staffDetailSelect = {
  id: true,
  registrationNo: true,
  qualification: true,
  designation: true,
  signatureImageUrl: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  async findAll(organizationId: string) {
    return this.prisma.client.user.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        totpEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        role: { select: { id: true, name: true, slug: true } },
        branch: { select: { id: true, name: true } },
        staffDetail: { select: staffDetailSelect },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string, organizationId: string) {
    const user = await this.prisma.client.user.findFirst({
      where: { id, organizationId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        totpEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        role: { select: { id: true, name: true, slug: true } },
        branch: { select: { id: true, name: true } },
        staffDetail: { select: staffDetailSelect },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Users who have (or could have) NABL sign-off details — every active user
   * with their staffDetail row (null when not yet filled in).
   */
  async listStaff(organizationId: string) {
    return this.prisma.client.user.findMany({
      where: { organizationId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        role: { select: { id: true, name: true, slug: true } },
        branch: { select: { id: true, name: true } },
        staffDetail: { select: staffDetailSelect },
      },
      orderBy: { firstName: 'asc' },
    });
  }

  /** One user + their staff detail (throws 404 if not in this organization). */
  async getStaffDetail(userId: string, organizationId: string) {
    const user = await this.prisma.client.user.findFirst({
      where: { id: userId, organizationId, deletedAt: null },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        role: { select: { id: true, name: true, slug: true } },
        branch: { select: { id: true, name: true } },
        staffDetail: { select: staffDetailSelect },
      },
    });
    if (!user) throw new NotFoundException('User not found');
    return user;
  }

  /**
   * Create or update a staff member's NABL sign-off details. The user is
   * resolved within the organization first (so tenant isolation holds), then
   * the 1:1 detail row is upserted by userId.
   */
  async upsertStaffDetail(
    userId: string,
    organizationId: string,
    data: UpsertStaffDetailDto,
  ) {
    const user = await this.prisma.client.user.findFirst({
      where: { id: userId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const payload: Record<string, unknown> = {};
    if (data.registrationNo !== undefined)
      payload.registrationNo = data.registrationNo || null;
    if (data.qualification !== undefined)
      payload.qualification = data.qualification || null;
    if (data.designation !== undefined)
      payload.designation = data.designation || null;
    if (data.signatureImageUrl !== undefined)
      payload.signatureImageUrl = data.signatureImageUrl || null;

    // tenantId is required by the schema; the tenant-filter extension
    // overrides it with the request's real tenant at runtime anyway.
    return this.prisma.client.staffDetail.upsert({
      where: { userId },
      create: { userId, tenantId: organizationId, ...payload },
      update: payload,
      select: staffDetailSelect,
    });
  }

  /** Remove a staff member's NABL sign-off details (row deleted). */
  async removeStaffDetail(userId: string, organizationId: string) {
    const user = await this.prisma.client.user.findFirst({
      where: { id: userId, organizationId, deletedAt: null },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.client.staffDetail.deleteMany({ where: { userId } });
    return { message: 'Staff details removed' };
  }

  /**
   * Admin-created staff user (same organization, chosen role). Registration
   * for the public flow lives in AuthService — this is the internal path used
   * by the System Settings → Add User onboarding workflow.
   */
  async create(organizationId: string, data: CreateUserDto) {
    const email = data.email.toLowerCase().trim();
    if (!email || !data.password || !data.firstName || !data.lastName) {
      throw new BadRequestException('Email, password and name are required');
    }

    const existing = await this.prisma.client.user.findFirst({
      where: { email, deletedAt: null },
    });
    if (existing) throw new ConflictException('Email already registered');

    // Resolve the role within the org's available roles (defaults to lab_admin
    // when omitted, matching the auth register flow).
    let role = null;
    if (data.roleId) {
      role = await this.prisma.client.role.findUnique({
        where: { id: data.roleId },
      });
      if (!role) throw new BadRequestException('Role not found');
    } else {
      role = await this.prisma.client.role.findFirst({
        where: { slug: 'lab_admin' },
      });
    }

    const passwordHash = await bcrypt.hash(data.password, 12);
    const user = await this.prisma.client.user.create({
      data: {
        email,
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone ?? null,
        organizationId,
        roleId: role?.id ?? null,
        branchId: data.branchId ?? null,
      },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        totpEnabled: true,
        lastLoginAt: true,
        createdAt: true,
        role: { select: { id: true, name: true, slug: true } },
        branch: { select: { id: true, name: true } },
      },
    });
    return user;
  }

  async update(id: string, organizationId: string, data: UpdateUserDto) {
    const user = await this.prisma.client.user.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');

    const updateData: Record<string, unknown> = {};
    if (data.firstName) updateData.firstName = data.firstName;
    if (data.lastName) updateData.lastName = data.lastName;
    if (data.phone !== undefined) updateData.phone = data.phone;
    if (data.roleId) updateData.roleId = data.roleId;
    if (data.branchId !== undefined) updateData.branchId = data.branchId;
    if (data.isActive !== undefined) updateData.isActive = data.isActive;
    if (data.lastLoginAt !== undefined) {
      updateData.lastLoginAt = new Date(data.lastLoginAt);
    }
    if (data.password) {
      updateData.passwordHash = await bcrypt.hash(data.password, 12);
    }

    return this.prisma.client.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        phone: true,
        isActive: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string, organizationId: string) {
    const user = await this.prisma.client.user.findFirst({
      where: { id, organizationId, deletedAt: null },
    });
    if (!user) throw new NotFoundException('User not found');
    await this.prisma.client.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
    return { message: 'User deactivated' };
  }
}
