import { Module } from '@nestjs/common';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';
import { LeagueStrategy } from './strategies/league.strategy';
import { KnockoutStrategy } from './strategies/knockout.strategy';

@Module({
  controllers: [TournamentsController],
  providers: [TournamentsService, LeagueStrategy, KnockoutStrategy],
  exports: [TournamentsService],
})
export class TournamentsModule {}
