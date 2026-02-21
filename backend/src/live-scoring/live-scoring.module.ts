import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { MatchesModule } from '../matches/matches.module';
import { TournamentsModule } from '../tournaments/tournaments.module';
import { StandingsModule } from '../standings/standings.module';

// Gateway & services
import { LiveScoringGateway } from './live-scoring.gateway';
import { LiveScoringService } from './live-scoring.service';
import { MatchEventsService } from './match-events.service';
import { MatchEventsController } from './match-events.controller';

// Scoring engines
import { ScoringEngineFactory } from './scoring/scoring-engine.factory';
import { GenericScoringEngine } from './scoring/generic-scoring.engine';
import { FootballScoringEngine } from './scoring/football-scoring.engine';
import { BasketballScoringEngine } from './scoring/basketball-scoring.engine';
import { VolleyballScoringEngine } from './scoring/volleyball-scoring.engine';

// Ownership
import { OwnershipService } from '../common/ownership.service';

@Module({
  imports: [
    MatchesModule,
    TournamentsModule,
    StandingsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_ACCESS_SECRET'),
      }),
    }),
  ],
  controllers: [MatchEventsController],
  providers: [
    // Gateway
    LiveScoringGateway,

    // Services
    LiveScoringService,
    MatchEventsService,

    // Ownership
    OwnershipService,

    // Scoring engines
    GenericScoringEngine,
    FootballScoringEngine,
    BasketballScoringEngine,
    VolleyballScoringEngine,
    ScoringEngineFactory,
  ],
  exports: [LiveScoringService],
})
export class LiveScoringModule { }
