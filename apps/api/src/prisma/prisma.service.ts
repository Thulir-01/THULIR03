import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { tenantFilterExtension } from './tenant-filter.extension';

function createExtendedClient() {
  const adapter = new PrismaPg({
    connectionString: process.env.DATABASE_URL,
  });
  return new PrismaClient({ adapter }).$extends(tenantFilterExtension);
}

/** The PrismaClient type with the tenant-filter extension applied. */
export type ExtendedPrismaClient = ReturnType<typeof createExtendedClient>;

/**
 * Database service. Exposes `client` — the PrismaClient extended with the
 * tenant-filter extension — which auto-injects the request's organization id
 * into every query against tenant-scoped models.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: ExtendedPrismaClient = createExtendedClient();

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
