import { Module } from '@nestjs/common';
import { TeamDivisionsController } from './team-divisions.controller';
import { TeamDivisionsService } from './team-divisions.service';

@Module({
  controllers: [TeamDivisionsController],
  providers: [TeamDivisionsService],
  exports: [TeamDivisionsService],
})
export class TeamDivisionsModule {}
