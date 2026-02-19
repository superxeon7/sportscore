import { Module } from '@nestjs/common';
import { MatchOfficialsController } from './match-officials.controller';
import { MatchOfficialsService } from './match-officials.service';
import { PrismaModule } from '../prisma/prisma.module';
import { OwnershipService } from '../common/ownership.service';

@Module({
  imports: [PrismaModule],
  controllers: [MatchOfficialsController],
  providers: [MatchOfficialsService, OwnershipService],
  exports: [MatchOfficialsService],
})
export class MatchOfficialsModule {}
