import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { MasterConfigController } from './master-config.controller';
import { MasterConfigService } from './master-config.service';

@Module({
  imports: [PrismaModule],
  controllers: [MasterConfigController],
  providers: [MasterConfigService],
  exports: [MasterConfigService],
})
export class MasterConfigModule {}
