import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MatchStatus, StageType } from '@prisma/client';

const STANDINGS_CACHE_TTL = 300; // 5 minutes in seconds

interface TournamentConfig {
  pointsForWin?: number;
  pointsForDraw?: number;
  pointsForLoss?: number;
}

interface TeamRecord {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  penaltyWins: number;
  penaltyLosses: number;
  group: string | null;
}

@Injectable()
export class StandingsService {
  private readonly logger = new Logger(StandingsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) { }

  /**
   * Get standings for a tournament, optionally filtered by group.
   * Returns standings sorted by position ascending.
   */
  async findByTournament(tournamentId: string, group?: string) {
    const cacheKey = `sportscore:standings:${tournamentId}`;

    // Try to return cached standings
    const cached = await this.redis.get<any>(cacheKey);
    if (cached) {
      const standings = Array.isArray(cached) ? cached : [];
      if (group) {
        return standings.filter(
          (s: any) => s.group === group,
        );
      }
      return standings;
    }

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException(
        `Tournament with id ${tournamentId} not found`,
      );
    }

    const where: Record<string, unknown> = { tournamentId };
    if (group) {
      where.group = group;
    }

    const standings = await this.prisma.standing.findMany({
      where,
      orderBy: [{ position: 'asc' }],
      include: {
        team: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
            logoUrl: true,
          },
        },
      },
    });

    // Cache the full standings (without group filter) so we can filter from cache
    if (!group) {
      await this.redis.set(cacheKey, standings, STANDINGS_CACHE_TTL);
    }

    return standings;
  }

  /**
   * Recalculate all standings for a tournament based on completed matches.
   */
  async recalculate(tournamentId: string) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException(
        `Tournament with id ${tournamentId} not found`,
      );
    }

    // Determine if penalty mode is active for this tournament's stage
    let penaltyEnabled = false;
    if (tournament.eventCategoryId) {
      const groupStage = await this.prisma.categoryStage.findFirst({
        where: {
          categoryId: tournament.eventCategoryId,
          stageType: { in: [StageType.GROUP, StageType.SPECIAL_GROUP, StageType.GROUP_NEIGHBOR] },
        },
      });
      penaltyEnabled = groupStage?.penaltyEnabled ?? false;
    }

    const config = (tournament.config as TournamentConfig) || {};
    const pointsForWin = config.pointsForWin ?? 3;
    const pointsForDraw = config.pointsForDraw ?? 1;
    const pointsForLoss = config.pointsForLoss ?? 0;

    // Penalty-aware points
    const pointsForPenaltyWin = 2;
    const pointsForPenaltyLoss = 1;

    // Get all completed matches for this tournament
    const matches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        status: MatchStatus.COMPLETED,
      },
      include: {
        matchScore: true,
      },
    });

    // Build a record for each team
    const teamRecords = new Map<string, TeamRecord>();

    for (const match of matches) {
      if (!match.matchScore) continue;

      const homeId = match.homeTeamId;
      const awayId = match.awayTeamId;
      const homeScore = match.matchScore.homeScore;
      const awayScore = match.matchScore.awayScore;

      // Initialize team records if not present
      if (!teamRecords.has(homeId)) {
        teamRecords.set(homeId, {
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
          penaltyWins: 0,
          penaltyLosses: 0,
          group: match.group,
        });
      }
      if (!teamRecords.has(awayId)) {
        teamRecords.set(awayId, {
          played: 0,
          won: 0,
          drawn: 0,
          lost: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          goalDifference: 0,
          points: 0,
          penaltyWins: 0,
          penaltyLosses: 0,
          group: match.group,
        });
      }

      const homeRecord = teamRecords.get(homeId)!;
      const awayRecord = teamRecords.get(awayId)!;

      // Update match counts
      homeRecord.played += 1;
      awayRecord.played += 1;

      // Update goals
      homeRecord.goalsFor += homeScore;
      homeRecord.goalsAgainst += awayScore;
      awayRecord.goalsFor += awayScore;
      awayRecord.goalsAgainst += homeScore;

      // Determine result
      if (homeScore > awayScore) {
        homeRecord.won += 1;
        homeRecord.points += pointsForWin;
        awayRecord.lost += 1;
        awayRecord.points += pointsForLoss;
      } else if (homeScore < awayScore) {
        awayRecord.won += 1;
        awayRecord.points += pointsForWin;
        homeRecord.lost += 1;
        homeRecord.points += pointsForLoss;
      } else {
        // Draw in regular time
        if (penaltyEnabled && match.isPenaltyUsed) {
          const hPen = match.homePenaltyScore ?? 0;
          const aPen = match.awayPenaltyScore ?? 0;
          if (hPen > aPen) {
            homeRecord.penaltyWins += 1;
            homeRecord.points += pointsForPenaltyWin;
            awayRecord.penaltyLosses += 1;
            awayRecord.points += pointsForPenaltyLoss;
          } else if (aPen > hPen) {
            awayRecord.penaltyWins += 1;
            awayRecord.points += pointsForPenaltyWin;
            homeRecord.penaltyLosses += 1;
            homeRecord.points += pointsForPenaltyLoss;
          } else {
            homeRecord.drawn += 1;
            homeRecord.points += pointsForDraw;
            awayRecord.drawn += 1;
            awayRecord.points += pointsForDraw;
          }
        } else {
          homeRecord.drawn += 1;
          homeRecord.points += pointsForDraw;
          awayRecord.drawn += 1;
          awayRecord.points += pointsForDraw;
        }
      }

      // Update goal difference
      homeRecord.goalDifference =
        homeRecord.goalsFor - homeRecord.goalsAgainst;
      awayRecord.goalDifference =
        awayRecord.goalsFor - awayRecord.goalsAgainst;

      // Update group from match if available
      if (match.group) {
        homeRecord.group = match.group;
        awayRecord.group = match.group;
      }
    }

    // Sort teams: by points desc, then goal difference desc, then goals for desc
    const sortedTeams = Array.from(teamRecords.entries()).sort(
      ([, a], [, b]) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDifference !== a.goalDifference)
          return b.goalDifference - a.goalDifference;
        return b.goalsFor - a.goalsFor;
      },
    );

    // Calculate form for each team and upsert standings
    const standings: any[] = [];
    for (let i = 0; i < sortedTeams.length; i++) {
      const [teamId, record] = sortedTeams[i];
      const form = await this.calculateForm(teamId, tournamentId);

      const standing = await this.prisma.standing.upsert({
        where: {
          tournamentId_teamId: { tournamentId, teamId },
        },
        create: {
          tournamentId,
          teamId,
          position: i + 1,
          played: record.played,
          won: record.won,
          drawn: record.drawn,
          lost: record.lost,
          goalsFor: record.goalsFor,
          goalsAgainst: record.goalsAgainst,
          goalDifference: record.goalDifference,
          points: record.points,
          penaltyWins: record.penaltyWins,
          penaltyLosses: record.penaltyLosses,
          group: record.group,
          form,
        },
        update: {
          position: i + 1,
          played: record.played,
          won: record.won,
          drawn: record.drawn,
          lost: record.lost,
          goalsFor: record.goalsFor,
          goalsAgainst: record.goalsAgainst,
          goalDifference: record.goalDifference,
          points: record.points,
          penaltyWins: record.penaltyWins,
          penaltyLosses: record.penaltyLosses,
          group: record.group,
          form,
        },
        include: {
          team: {
            select: {
              id: true,
              name: true,
              shortName: true,
              slug: true,
              logoUrl: true,
            },
          },
        },
      });

      standings.push(standing);
    }

    // Invalidate the cache
    const cacheKey = `sportscore:standings:${tournamentId}`;
    await this.redis.del(cacheKey);

    this.logger.log(
      `Recalculated standings for tournament ${tournamentId}: ${standings.length} teams`,
    );

    return standings;
  }

  /**
   * Update standings after a single match completes.
   * Only recalculates the two teams involved in the match.
   */
  async updateAfterMatch(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: {
        matchScore: true,
        tournament: true,
      },
    });

    if (!match) {
      throw new NotFoundException(`Match with id ${matchId} not found`);
    }

    if (!match.matchScore) {
      this.logger.warn(
        `Match ${matchId} has no score record, skipping standings update`,
      );
      return;
    }

    const tournamentId = match.tournamentId;

    // Determine if penalty mode is active
    let penaltyEnabled = false;
    if (match.tournament.eventCategoryId) {
      const groupStage = await this.prisma.categoryStage.findFirst({
        where: {
          categoryId: match.tournament.eventCategoryId,
          stageType: { in: [StageType.GROUP, StageType.SPECIAL_GROUP, StageType.GROUP_NEIGHBOR] },
        },
      });
      penaltyEnabled = groupStage?.penaltyEnabled ?? false;
    }

    const config = (match.tournament.config as TournamentConfig) || {};
    const pointsForWin = config.pointsForWin ?? 3;
    const pointsForDraw = config.pointsForDraw ?? 1;
    const pointsForLoss = config.pointsForLoss ?? 0;
    const pointsForPenaltyWin = 2;
    const pointsForPenaltyLoss = 1;

    const teamIds = [match.homeTeamId, match.awayTeamId];

    // For each team, recalculate their full record from all completed matches
    for (const teamId of teamIds) {
      const teamMatches = await this.prisma.match.findMany({
        where: {
          tournamentId,
          status: MatchStatus.COMPLETED,
          OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
        },
        include: {
          matchScore: true,
        },
      });

      const record: TeamRecord = {
        played: 0,
        won: 0,
        drawn: 0,
        lost: 0,
        goalsFor: 0,
        goalsAgainst: 0,
        goalDifference: 0,
        points: 0,
        penaltyWins: 0,
        penaltyLosses: 0,
        group: null,
      };

      for (const m of teamMatches) {
        if (!m.matchScore) continue;

        record.played += 1;

        const isHome = m.homeTeamId === teamId;
        const goalsScored = isHome
          ? m.matchScore.homeScore
          : m.matchScore.awayScore;
        const goalsConceded = isHome
          ? m.matchScore.awayScore
          : m.matchScore.homeScore;

        record.goalsFor += goalsScored;
        record.goalsAgainst += goalsConceded;

        if (goalsScored > goalsConceded) {
          record.won += 1;
          record.points += pointsForWin;
        } else if (goalsScored < goalsConceded) {
          record.lost += 1;
          record.points += pointsForLoss;
        } else {
          // Draw in regular time
          if (penaltyEnabled && m.isPenaltyUsed) {
            const myPen = isHome ? (m.homePenaltyScore ?? 0) : (m.awayPenaltyScore ?? 0);
            const oppPen = isHome ? (m.awayPenaltyScore ?? 0) : (m.homePenaltyScore ?? 0);
            if (myPen > oppPen) {
              record.penaltyWins += 1;
              record.points += pointsForPenaltyWin;
            } else if (oppPen > myPen) {
              record.penaltyLosses += 1;
              record.points += pointsForPenaltyLoss;
            } else {
              record.drawn += 1;
              record.points += pointsForDraw;
            }
          } else {
            record.drawn += 1;
            record.points += pointsForDraw;
          }
        }

        if (m.group) {
          record.group = m.group;
        }
      }

      record.goalDifference = record.goalsFor - record.goalsAgainst;

      const form = await this.calculateForm(teamId, tournamentId);

      await this.prisma.standing.upsert({
        where: {
          tournamentId_teamId: { tournamentId, teamId },
        },
        create: {
          tournamentId,
          teamId,
          position: 0, // Will be recalculated below
          played: record.played,
          won: record.won,
          drawn: record.drawn,
          lost: record.lost,
          goalsFor: record.goalsFor,
          goalsAgainst: record.goalsAgainst,
          goalDifference: record.goalDifference,
          points: record.points,
          penaltyWins: record.penaltyWins,
          penaltyLosses: record.penaltyLosses,
          group: record.group,
          form,
        },
        update: {
          played: record.played,
          won: record.won,
          drawn: record.drawn,
          lost: record.lost,
          goalsFor: record.goalsFor,
          goalsAgainst: record.goalsAgainst,
          goalDifference: record.goalDifference,
          points: record.points,
          penaltyWins: record.penaltyWins,
          penaltyLosses: record.penaltyLosses,
          group: record.group,
          form,
        },
      });
    }

    // Recalculate positions for all teams in this tournament
    const allStandings = await this.prisma.standing.findMany({
      where: { tournamentId },
      orderBy: [
        { points: 'desc' },
        { goalDifference: 'desc' },
        { goalsFor: 'desc' },
      ],
    });

    for (let i = 0; i < allStandings.length; i++) {
      await this.prisma.standing.update({
        where: { id: allStandings[i].id },
        data: { position: i + 1 },
      });
    }

    // Invalidate the cache
    const cacheKey = `sportscore:standings:${tournamentId}`;
    await this.redis.del(cacheKey);

    this.logger.log(
      `Updated standings after match ${matchId} for tournament ${tournamentId}`,
    );
  }

  /**
   * Calculate the form string for a team in a tournament.
   * Returns the last 5 match results as a string like "WWDLW" (most recent first).
   */
  async calculateForm(
    teamId: string,
    tournamentId: string,
  ): Promise<string> {
    const recentMatches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        status: MatchStatus.COMPLETED,
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      },
      orderBy: { endedAt: 'desc' },
      take: 5,
      include: {
        matchScore: true,
      },
    });

    const formChars: string[] = [];

    for (const match of recentMatches) {
      if (!match.matchScore) continue;

      const isHome = match.homeTeamId === teamId;
      const goalsScored = isHome
        ? match.matchScore.homeScore
        : match.matchScore.awayScore;
      const goalsConceded = isHome
        ? match.matchScore.awayScore
        : match.matchScore.homeScore;

      if (goalsScored > goalsConceded) {
        formChars.push('W');
      } else if (goalsScored < goalsConceded) {
        formChars.push('L');
      } else {
        formChars.push('D');
      }
    }

    return formChars.join('');
  }
}
