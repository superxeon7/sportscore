import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { MatchEventType, MatchStatus } from '@prisma/client';

const STATS_CACHE_TTL = 900; // 15 minutes in seconds

@Injectable()
export class StatisticsService {
  private readonly logger = new Logger(StatisticsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  /**
   * Get aggregated statistics for a player:
   * - Count of events by type (goals, assists, yellow cards, red cards, etc.)
   * - Total matches played (distinct matches where the player has events or lineups)
   */
  async getPlayerStats(playerId: string) {
    const cacheKey = `sportscore:stats:player:${playerId}`;

    const cached = await this.redis.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const player = await this.prisma.player.findUnique({
      where: { id: playerId },
      select: {
        id: true,
        fullName: true,
        jerseyNumber: true,
        position: true,
        team: {
          select: {
            id: true,
            name: true,
            shortName: true,
            logoUrl: true,
          },
        },
      },
    });

    if (!player) {
      throw new NotFoundException(`Player with id ${playerId} not found`);
    }

    // Count events by type
    const eventCounts = await this.prisma.matchEvent.groupBy({
      by: ['type'],
      where: { playerId },
      _count: { id: true },
    });

    // Build event type map
    const eventTypeMap: Record<string, number> = {};
    for (const eventType of Object.values(MatchEventType)) {
      eventTypeMap[eventType] = 0;
    }
    for (const ec of eventCounts) {
      eventTypeMap[ec.type] = ec._count.id;
    }

    // Count distinct matches played
    const matchesPlayed = await this.prisma.matchEvent.findMany({
      where: { playerId },
      select: { matchId: true },
      distinct: ['matchId'],
    });

    const stats = {
      player,
      matchesPlayed: matchesPlayed.length,
      goals: eventTypeMap[MatchEventType.GOAL] || 0,
      assists: eventTypeMap[MatchEventType.ASSIST] || 0,
      yellowCards: eventTypeMap[MatchEventType.YELLOW_CARD] || 0,
      redCards: eventTypeMap[MatchEventType.RED_CARD] || 0,
      fouls: eventTypeMap[MatchEventType.FOUL] || 0,
      penalties: eventTypeMap[MatchEventType.PENALTY] || 0,
      ownGoals: eventTypeMap[MatchEventType.OWN_GOAL] || 0,
      eventsByType: eventTypeMap,
    };

    await this.redis.set(cacheKey, stats, STATS_CACHE_TTL);

    return stats;
  }

  /**
   * Get aggregated statistics for a team:
   * - Total matches, wins, draws, losses
   * - Goals for, goals against
   * - Clean sheets
   */
  async getTeamStats(teamId: string) {
    const cacheKey = `sportscore:stats:team:${teamId}`;

    const cached = await this.redis.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: {
        id: true,
        name: true,
        shortName: true,
        slug: true,
        logoUrl: true,
      },
    });

    if (!team) {
      throw new NotFoundException(`Team with id ${teamId} not found`);
    }

    // Get all completed matches for this team
    const matches = await this.prisma.match.findMany({
      where: {
        status: MatchStatus.COMPLETED,
        OR: [{ homeTeamId: teamId }, { awayTeamId: teamId }],
      },
      include: {
        matchScore: true,
      },
    });

    let totalMatches = 0;
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;
    let cleanSheets = 0;

    for (const match of matches) {
      if (!match.matchScore) continue;

      totalMatches += 1;

      const isHome = match.homeTeamId === teamId;
      const scored = isHome
        ? match.matchScore.homeScore
        : match.matchScore.awayScore;
      const conceded = isHome
        ? match.matchScore.awayScore
        : match.matchScore.homeScore;

      goalsFor += scored;
      goalsAgainst += conceded;

      if (conceded === 0) {
        cleanSheets += 1;
      }

      if (scored > conceded) {
        wins += 1;
      } else if (scored < conceded) {
        losses += 1;
      } else {
        draws += 1;
      }
    }

    const stats = {
      team,
      totalMatches,
      wins,
      draws,
      losses,
      goalsFor,
      goalsAgainst,
      goalDifference: goalsFor - goalsAgainst,
      cleanSheets,
      winRate: totalMatches > 0 ? Math.round((wins / totalMatches) * 100) : 0,
    };

    await this.redis.set(cacheKey, stats, STATS_CACHE_TTL);

    return stats;
  }

  /**
   * Get top scorers for a tournament.
   * Returns players with the most GOAL events in completed tournament matches.
   */
  async getTopScorers(tournamentId: string, limit: number = 10) {
    const cacheKey = `sportscore:stats:topscorers:${tournamentId}:${limit}`;

    const cached = await this.redis.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException(
        `Tournament with id ${tournamentId} not found`,
      );
    }

    // Get all match IDs for this tournament
    const tournamentMatches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        status: MatchStatus.COMPLETED,
      },
      select: { id: true },
    });

    const matchIds = tournamentMatches.map((m) => m.id);

    if (matchIds.length === 0) {
      return [];
    }

    // Count GOAL events per player within these matches
    const goalCounts = await this.prisma.matchEvent.groupBy({
      by: ['playerId'],
      where: {
        matchId: { in: matchIds },
        type: MatchEventType.GOAL,
        playerId: { not: null },
      },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: limit,
    });

    // Fetch player details for the top scorers
    const playerIds = goalCounts
      .map((gc) => gc.playerId)
      .filter((id): id is string => id !== null);

    const players = await this.prisma.player.findMany({
      where: { id: { in: playerIds } },
      select: {
        id: true,
        fullName: true,
        jerseyNumber: true,
        position: true,
        photoUrl: true,
        team: {
          select: {
            id: true,
            name: true,
            shortName: true,
            logoUrl: true,
          },
        },
      },
    });

    const playerMap = new Map(players.map((p) => [p.id, p]));

    const topScorers = goalCounts.map((gc, index) => ({
      rank: index + 1,
      goals: gc._count.id,
      player: playerMap.get(gc.playerId!) || null,
    }));

    await this.redis.set(cacheKey, topScorers, STATS_CACHE_TTL);

    return topScorers;
  }

  /**
   * Get per-division top scorer and top assist for a team.
   * Groups by player.divisionId (TeamDivision) and queries match_events
   * filtered by teamId.
   */
  async getTeamDivisionStats(teamId: string) {
    const cacheKey = `sportscore:stats:team-divisions:${teamId}`;

    const cached = await this.redis.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    // Validate team exists
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { id: true },
    });

    if (!team) {
      throw new NotFoundException(`Team with id ${teamId} not found`);
    }

    // Fetch all active players with division info (include players without division)
    const players = await this.prisma.player.findMany({
      where: { teamId, isActive: true },
      select: {
        id: true,
        fullName: true,
        jerseyNumber: true,
        photoUrl: true,
        divisionId: true,
        division: { select: { id: true, name: true } },
      },
    });

    if (players.length === 0) {
      return [];
    }

    // Build maps: divisionId -> { name, playerIds }
    const divisionMap: Record<string, { name: string; playerIds: string[] }> = {};
    const playerDetailMap = new Map<string, {
      id: string;
      fullName: string;
      jerseyNumber: number | null;
      photoUrl: string | null;
    }>();

    for (const player of players) {
      // Only include players that belong to a division
      if (!player.divisionId || !player.division) continue;

      if (!divisionMap[player.divisionId]) {
        divisionMap[player.divisionId] = {
          name: player.division.name,
          playerIds: [],
        };
      }
      divisionMap[player.divisionId].playerIds.push(player.id);
      playerDetailMap.set(player.id, {
        id: player.id,
        fullName: player.fullName,
        jerseyNumber: player.jerseyNumber,
        photoUrl: player.photoUrl,
      });
    }

    if (Object.keys(divisionMap).length === 0) {
      return [];
    }

    const allPlayerIds = Array.from(playerDetailMap.keys());

    // Fetch GOAL and ASSIST counts for all division players in parallel
    const [goalCounts, assistCounts] = await Promise.all([
      this.prisma.matchEvent.groupBy({
        by: ['playerId'],
        where: {
          teamId,
          type: MatchEventType.GOAL,
          playerId: { in: allPlayerIds },
        },
        _count: { id: true },
      }),
      this.prisma.matchEvent.groupBy({
        by: ['playerId'],
        where: {
          teamId,
          type: MatchEventType.ASSIST,
          playerId: { in: allPlayerIds },
        },
        _count: { id: true },
      }),
    ]);

    // Build lookup maps: playerId -> count
    const goalMap: Record<string, number> = {};
    for (const gc of goalCounts) {
      if (gc.playerId) goalMap[gc.playerId] = gc._count.id;
    }

    const assistMap: Record<string, number> = {};
    for (const ac of assistCounts) {
      if (ac.playerId) assistMap[ac.playerId] = ac._count.id;
    }

    // Compute top scorer & top assist per division
    const results = Object.entries(divisionMap).map(
      ([divisionId, { name, playerIds }]) => {
        let topScorerPlayerId: string | null = null;
        let topScorerGoals = 0;
        let topAssistPlayerId: string | null = null;
        let topAssistCount = 0;

        for (const pid of playerIds) {
          const goals = goalMap[pid] || 0;
          if (goals > topScorerGoals) {
            topScorerGoals = goals;
            topScorerPlayerId = pid;
          }

          const assists = assistMap[pid] || 0;
          if (assists > topAssistCount) {
            topAssistCount = assists;
            topAssistPlayerId = pid;
          }
        }

        return {
          divisionId,
          divisionName: name,
          topScorer:
            topScorerGoals > 0 && topScorerPlayerId
              ? {
                  player: playerDetailMap.get(topScorerPlayerId) ?? null,
                  goals: topScorerGoals,
                }
              : null,
          topAssist:
            topAssistCount > 0 && topAssistPlayerId
              ? {
                  player: playerDetailMap.get(topAssistPlayerId) ?? null,
                  assists: topAssistCount,
                }
              : null,
        };
      },
    );

    await this.redis.set(cacheKey, results, STATS_CACHE_TTL);

    return results;
  }

  /**
   * Get aggregated summary stats for a tournament:
   * - Total teams, matches, completed matches, goals
   * - Top scorer
   * - Next scheduled match
   */
  async getTournamentSummary(tournamentId: string) {
    const cacheKey = `sportscore:stats:tournament-summary:${tournamentId}`;

    const cached = await this.redis.get<any>(cacheKey);
    if (cached) {
      return cached;
    }

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException(
        `Tournament with id ${tournamentId} not found`,
      );
    }

    // Get all non-draft/cancelled matches
    const matches = await this.prisma.match.findMany({
      where: {
        tournamentId,
        status: { notIn: [MatchStatus.DRAFT, MatchStatus.CANCELLED] },
      },
      include: {
        homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        matchScore: true,
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // Count distinct teams
    const teamIds = new Set<string>();
    for (const match of matches) {
      if (match.homeTeamId) teamIds.add(match.homeTeamId);
      if (match.awayTeamId) teamIds.add(match.awayTeamId);
    }

    const totalMatches = matches.length;
    const completedMatches = matches.filter(
      (m) => m.status === MatchStatus.COMPLETED,
    ).length;

    // Total goals from match scores
    let totalGoals = 0;
    for (const match of matches) {
      if (match.matchScore) {
        totalGoals += match.matchScore.homeScore + match.matchScore.awayScore;
      }
    }

    // Next scheduled match
    const now = new Date();
    const nextMatch =
      matches.find(
        (m) =>
          m.status === MatchStatus.SCHEDULED &&
          m.scheduledAt &&
          new Date(m.scheduledAt) >= now,
      ) || null;

    // Top scorer (reuse logic from getTopScorers but limit=1)
    const completedMatchIds = matches
      .filter((m) => m.status === MatchStatus.COMPLETED)
      .map((m) => m.id);

    let topScorer: { player: any; goals: number } | null = null;

    if (completedMatchIds.length > 0) {
      const goalCounts = await this.prisma.matchEvent.groupBy({
        by: ['playerId'],
        where: {
          matchId: { in: completedMatchIds },
          type: MatchEventType.GOAL,
          playerId: { not: null },
        },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 1,
      });

      if (goalCounts.length > 0 && goalCounts[0].playerId) {
        const player = await this.prisma.player.findUnique({
          where: { id: goalCounts[0].playerId },
          select: {
            id: true,
            fullName: true,
            jerseyNumber: true,
            position: true,
            photoUrl: true,
            team: {
              select: { id: true, name: true, shortName: true, logoUrl: true },
            },
          },
        });

        if (player) {
          topScorer = { player, goals: goalCounts[0]._count.id };
        }
      }
    }

    const summary = {
      totalTeams: teamIds.size,
      totalMatches,
      completedMatches,
      totalGoals,
      topScorer,
      nextMatch,
    };

    await this.redis.set(cacheKey, summary, STATS_CACHE_TTL);

    return summary;
  }
}
