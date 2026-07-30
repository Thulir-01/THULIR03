import { Module } from '@nestjs/common';
import { ReferrersController } from './referrers.controller';
import { ReferrersService } from './referrers.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [ReferrersController],
  providers: [ReferrersService],
  exports: [ReferrersService],
})
export class ReferrersModule {}
