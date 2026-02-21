import { Module } from '@nestjs/common';
import { TournamentsController } from './tournaments.controller';
import { TournamentsService } from './tournaments.service';
import { LeagueStrategy } from './strategies/league.strategy';
import { KnockoutStrategy } from './strategies/knockout.strategy';
import { DoubleEliminationStrategy } from './strategies/double-elimination.strategy';
import { SpecialGroupStrategy } from './strategies/special-group.strategy';
import { BracketAdvancementService } from './bracket-advancement.service';
import { SwissSystemService } from './swiss-system.service';

@Module({
  controllers: [TournamentsController],
  providers: [TournamentsService, LeagueStrategy, KnockoutStrategy, DoubleEliminationStrategy, SpecialGroupStrategy, BracketAdvancementService, SwissSystemService],
  exports: [TournamentsService, BracketAdvancementService, SwissSystemService],
})
export class TournamentsModule { }

