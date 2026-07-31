import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  async findAll() {
    return this.prisma.client.role.findMany({
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: { select: { users: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string) {
    const role = await this.prisma.client.role.findUnique({
      where: { id },
      include: {
        rolePermissions: {
          include: { permission: true },
        },
        _count: { select: { users: true } },
      },
    });
    if (!role) throw new NotFoundException('Role not found');
    return role;
  }

  async create(data: { name: string; slug: string; description?: string }) {
    return this.prisma.client.role.create({
      data: {
        name: data.name,
        slug: data.slug,
        description: data.description,
      },
    });
  }

  async update(id: string, data: { name?: string; description?: string }) {
    const role = await this.prisma.client.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new Error('System roles cannot be modified');

    return this.prisma.client.role.update({
      where: { id },
      data: { ...data },
    });
  }

  async remove(id: string) {
    const role = await this.prisma.client.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role not found');
    if (role.isSystem) throw new Error('System roles cannot be deleted');

    await this.prisma.client.rolePermission.deleteMany({
      where: { roleId: id },
    });
    return this.prisma.client.role.delete({ where: { id } });
  }

  // ─── Permissions ─────────────────────────────────────────────────────

  async getPermissions() {
    return this.prisma.client.permission.findMany({
      orderBy: [{ resource: 'asc' }, { action: 'asc' }],
    });
  }

  async setRolePermissions(roleId: string, permissionIds: string[]) {
    const role = await this.prisma.client.role.findUnique({
      where: { id: roleId },
    });
    if (!role) throw new NotFoundException('Role not found');

    // Remove existing permissions
    await this.prisma.client.rolePermission.deleteMany({ where: { roleId } });

    // Add new permissions
    if (permissionIds.length > 0) {
      await this.prisma.client.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({
          roleId,
          permissionId,
        })),
      });
    }

    return this.findOne(roleId);
  }

  async seedDefaultPermissions() {
    const resources = [
      'patients',
      'orders',
      'samples',
      'results',
      'invoices',
      'users',
      'roles',
      'reports',
      'inventory',
      'instruments',
    ];
    const actions = ['create', 'read', 'update', 'delete', 'verify', 'approve'];

    for (const resource of resources) {
      for (const action of actions) {
        await this.prisma.client.permission.upsert({
          where: { resource_action: { resource, action } },
          update: {},
          create: { resource, action },
        });
      }
    }
    return { message: 'Default permissions seeded' };
  }
}
