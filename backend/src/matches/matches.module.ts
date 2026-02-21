import { Module } from '@nestjs/common';
import { MatchesController } from './matches.controller';
import { MatchesService } from './matches.service';
import { OwnershipService } from '../common/ownership.service';
import { StandingsModule } from '../standings/standings.module';

@Module({
  imports: [StandingsModule],
  controllers: [MatchesController],
  providers: [MatchesService, OwnershipService],
  exports: [MatchesService],
})
export class MatchesModule { }
