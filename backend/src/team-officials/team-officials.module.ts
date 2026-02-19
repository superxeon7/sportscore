import { Module } from '@nestjs/common';
import { TeamOfficialsController } from './team-officials.controller';
import { TeamOfficialsService } from './team-officials.service';

@Module({
  controllers: [TeamOfficialsController],
  providers: [TeamOfficialsService],
  exports: [TeamOfficialsService],
})
export class TeamOfficialsModule {}
