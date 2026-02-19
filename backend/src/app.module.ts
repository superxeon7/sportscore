import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { RedisModule } from './redis/redis.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { SportsModule } from './sports/sports.module';
import { TeamsModule } from './teams/teams.module';
import { PlayersModule } from './players/players.module';
import { UploadsModule } from './uploads/uploads.module';
import { EventsModule } from './events/events.module';
import { TournamentsModule } from './tournaments/tournaments.module';
import { MatchesModule } from './matches/matches.module';
import { LineupsModule } from './lineups/lineups.module';
import { MatchLineupsModule } from './match-lineups/match-lineups.module';
import { StandingsModule } from './standings/standings.module';
import { StatisticsModule } from './statistics/statistics.module';
import { AdminModule } from './admin/admin.module';
import { LiveScoringModule } from './live-scoring/live-scoring.module';
import { EventCategoriesModule } from './event-categories/event-categories.module';
import { CategoryRosterModule } from './category-roster/category-roster.module';
import { CategoryOfficialModule } from './category-official/category-official.module';
import { TeamDivisionsModule } from './team-divisions/team-divisions.module';
import { TeamOfficialsModule } from './team-officials/team-officials.module';
import { MatchOfficialsModule } from './match-officials/match-officials.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),
    PrismaModule,
    RedisModule,
    AuthModule,
    UsersModule,
    SportsModule,
    TeamsModule,
    PlayersModule,
    UploadsModule,
    EventsModule,
    TournamentsModule,
    MatchesModule,
    LineupsModule,
    MatchLineupsModule,
    StandingsModule,
    StatisticsModule,
    AdminModule,
    LiveScoringModule,
    EventCategoriesModule,
    CategoryRosterModule,
    CategoryOfficialModule,
    TeamDivisionsModule,
    TeamOfficialsModule,
    MatchOfficialsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule { }
