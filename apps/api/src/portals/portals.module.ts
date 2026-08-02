import { Module } from '@nestjs/common';
import {
  PatientPortalController,
  PortalsAdminController,
  PublicPortalController,
  ReferrerPortalController,
} from './portals.controller';
import { PortalsService } from './portals.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [
    PortalsAdminController,
    PatientPortalController,
    ReferrerPortalController,
    PublicPortalController,
  ],
  providers: [PortalsService],
  exports: [PortalsService],
})
export class PortalsModule {}
