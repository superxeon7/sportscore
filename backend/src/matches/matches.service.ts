import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MatchEventType, MatchStatus, UserRole } from '@prisma/client';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchQueryDto } from './dto/match-query.dto';
import { buildPaginationMeta } from '../common/dto/pagination.dto';
import { OwnershipService } from '../common/ownership.service';

/**
 * Valid status transitions for matches.
 * Maps from a current status to the set of statuses it can transition to.
 */
const VALID_STATUS_TRANSITIONS: Record<string, string[]> = {
  [MatchStatus.DRAFT]: [
    MatchStatus.PUBLISHED,
    MatchStatus.CANCELLED,
  ],
  [MatchStatus.PUBLISHED]: [
    MatchStatus.DRAFT,
    MatchStatus.SCHEDULED,
    MatchStatus.LIVE,
    MatchStatus.CANCELLED,
  ],
  [MatchStatus.SCHEDULED]: [
    MatchStatus.WARMUP,
    MatchStatus.LIVE,
    MatchStatus.POSTPONED,
    MatchStatus.CANCELLED,
  ],
  [MatchStatus.WARMUP]: [
    MatchStatus.LIVE,
    MatchStatus.CANCELLED,
    MatchStatus.POSTPONED,
  ],
  [MatchStatus.LIVE]: [
    MatchStatus.HALF_TIME,
    MatchStatus.PAUSED,
    MatchStatus.COMPLETED,
    MatchStatus.CANCELLED,
  ],
  [MatchStatus.HALF_TIME]: [
    MatchStatus.LIVE,
    MatchStatus.CANCELLED,
  ],
  [MatchStatus.PAUSED]: [
    MatchStatus.LIVE,
    MatchStatus.CANCELLED,
    MatchStatus.POSTPONED,
  ],
  [MatchStatus.POSTPONED]: [
    MatchStatus.SCHEDULED,
    MatchStatus.CANCELLED,
  ],
  [MatchStatus.COMPLETED]: [],
  [MatchStatus.CANCELLED]: [],
};

@Injectable()
export class MatchesService {
  private readonly logger = new Logger(MatchesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ownershipService: OwnershipService,
  ) { }

  async create(dto: CreateMatchDto, userId: string, userRole: UserRole) {
    // Verify the user owns the event that contains this tournament
    await this.ownershipService.assertTournamentOwner(
      dto.tournamentId,
      userId,
      userRole,
    );

    const tournament = await this.prisma.tournament.findUnique({
      where: { id: dto.tournamentId },
    });

    if (!tournament) {
      throw new NotFoundException(
        `Tournament with id ${dto.tournamentId} not found`,
      );
    }

    if (dto.homeTeamId === dto.awayTeamId) {
      throw new BadRequestException(
        'Home team and away team must be different',
      );
    }

    const [homeTeam, awayTeam] = await Promise.all([
      this.prisma.team.findUnique({ where: { id: dto.homeTeamId } }),
      this.prisma.team.findUnique({ where: { id: dto.awayTeamId } }),
    ]);

    if (!homeTeam) {
      throw new NotFoundException(
        `Home team with id ${dto.homeTeamId} not found`,
      );
    }

    if (!awayTeam) {
      throw new NotFoundException(
        `Away team with id ${dto.awayTeamId} not found`,
      );
    }

    // Validate event category and team registration
    if (dto.eventCategoryId) {
      const category = await this.prisma.eventCategory.findUnique({
        where: { id: dto.eventCategoryId },
      });

      if (!category) {
        throw new NotFoundException(
          `Event category with id ${dto.eventCategoryId} not found`,
        );
      }

      // Verify both teams are registered in the category
      const [homeReg, awayReg] = await Promise.all([
        this.prisma.eventCategoryTeam.findUnique({
          where: {
            eventCategoryId_teamId: {
              eventCategoryId: dto.eventCategoryId,
              teamId: dto.homeTeamId,
            },
          },
        }),
        this.prisma.eventCategoryTeam.findUnique({
          where: {
            eventCategoryId_teamId: {
              eventCategoryId: dto.eventCategoryId,
              teamId: dto.awayTeamId,
            },
          },
        }),
      ]);

      if (!homeReg) {
        throw new BadRequestException(
          `Home team "${homeTeam.name}" is not registered in category "${category.name}"`,
        );
      }

      if (!awayReg) {
        throw new BadRequestException(
          `Away team "${awayTeam.name}" is not registered in category "${category.name}"`,
        );
      }
    }

    const match = await this.prisma.match.create({
      data: {
        tournamentId: dto.tournamentId,
        homeTeamId: dto.homeTeamId,
        awayTeamId: dto.awayTeamId,
        eventCategoryId: dto.eventCategoryId,
        scheduledAt: new Date(dto.scheduledAt),
        venue: dto.venue,
        round: dto.round,
        leg: dto.leg,
        group: dto.group,
        matchDay: dto.matchDay,
        matchDurationMinutes: dto.matchDurationMinutes,
        halfCount: dto.halfCount,
        breakDurationMinutes: dto.breakDurationMinutes,
        injuryTimeMinutes: dto.injuryTimeMinutes,
      },
      include: {
        homeTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            logoUrl: true,
          },
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            logoUrl: true,
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        eventCategory: true,
      },
    });

    return match;
  }

  async findAllPublic(query: MatchQueryDto) {
    const where: Record<string, unknown> = {
      status: { notIn: [MatchStatus.DRAFT, MatchStatus.CANCELLED] },
    };

    if (query.tournamentId) {
      where.tournamentId = query.tournamentId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.eventCategoryId) {
      where.eventCategoryId = query.eventCategoryId;
    }

    if (query.teamId) {
      where.OR = [
        { homeTeamId: query.teamId },
        { awayTeamId: query.teamId },
      ];
    }

    if (query.dateFrom || query.dateTo) {
      where.scheduledAt = {};
      if (query.dateFrom) {
        (where.scheduledAt as Record<string, unknown>).gte = new Date(
          query.dateFrom,
        );
      }
      if (query.dateTo) {
        (where.scheduledAt as Record<string, unknown>).lte = new Date(
          query.dateTo,
        );
      }
    }

    const [matches, total] = await Promise.all([
      this.prisma.match.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy,
        include: {
          homeTeam: {
            select: {
              id: true,
              name: true,
              shortName: true,
              logoUrl: true,
            },
          },
          awayTeam: {
            select: {
              id: true,
              name: true,
              shortName: true,
              logoUrl: true,
            },
          },
          matchScore: true,
          tournament: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          eventCategory: true,
        },
      }),
      this.prisma.match.count({ where }),
    ]);

    return {
      data: matches,
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findAll(query: MatchQueryDto, userId: string, userRole: UserRole) {
    const where: Record<string, unknown> = {};

    // ── Ownership scoping: organizers only see matches from their own events ──
    if (userRole !== UserRole.ADMIN) {
      where.tournament = { event: { organizerId: userId } };
    }

    if (query.tournamentId) {
      where.tournamentId = query.tournamentId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.eventCategoryId) {
      where.eventCategoryId = query.eventCategoryId;
    }

    if (query.teamId) {
      where.OR = [
        { homeTeamId: query.teamId },
        { awayTeamId: query.teamId },
      ];
    }

    if (query.dateFrom || query.dateTo) {
      where.scheduledAt = {};
      if (query.dateFrom) {
        (where.scheduledAt as Record<string, unknown>).gte = new Date(
          query.dateFrom,
        );
      }
      if (query.dateTo) {
        (where.scheduledAt as Record<string, unknown>).lte = new Date(
          query.dateTo,
        );
      }
    }

    const [matches, total] = await Promise.all([
      this.prisma.match.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy,
        include: {
          homeTeam: {
            select: {
              id: true,
              name: true,
              shortName: true,
              logoUrl: true,
            },
          },
          awayTeam: {
            select: {
              id: true,
              name: true,
              shortName: true,
              logoUrl: true,
            },
          },
          matchScore: true,
          tournament: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          eventCategory: true,
        },
      }),
      this.prisma.match.count({ where }),
    ]);

    return {
      data: matches,
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findByIdPublic(id: string) {
    const match = await this.prisma.match.findFirst({
      where: {
        id,
        status: { notIn: [MatchStatus.DRAFT, MatchStatus.CANCELLED] },
      },
      include: {
        homeTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
            logoUrl: true,
          },
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
            logoUrl: true,
          },
        },
        matchScore: true,
        matchEvents: {
          orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }],
          include: {
            player: {
              select: {
                id: true,
                fullName: true,
                jerseyNumber: true,
              },
            },
          },
        },
        matchLineups: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                shortName: true,
                logoUrl: true,
              },
            },
            players: {
              include: {
                player: {
                  select: {
                    id: true,
                    fullName: true,
                    position: true,
                  },
                },
              },
              orderBy: [
                { isStarter: 'desc' as const },
                { jerseyNumber: 'asc' as const },
              ],
            },
          },
        },
        matchOfficials: {
          include: {
            official: {
              select: {
                id: true,
                fullName: true,
                role: true,
                photoUrl: true,
              },
            },
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
            event: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        eventCategory: true,
        playerOfTheMatch: {
          select: {
            id: true,
            fullName: true,
            jerseyNumber: true,
            photoUrl: true,
            team: { select: { id: true, name: true, shortName: true, logoUrl: true } },
          },
        },
      },
    });

    if (!match) {
      throw new NotFoundException('Match not found');
    }

    return match;
  }

  async findById(id: string, userId: string, userRole: UserRole) {
    // Build ownership-scoped query
    const whereClause: Record<string, unknown> = { id };
    if (userRole !== UserRole.ADMIN) {
      whereClause.tournament = { event: { organizerId: userId } };
    }

    const match = await this.prisma.match.findFirst({
      where: whereClause,
      include: {
        homeTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
            logoUrl: true,
          },
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
            logoUrl: true,
          },
        },
        matchScore: true,
        matchEvents: {
          orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }],
          include: {
            player: {
              select: {
                id: true,
                fullName: true,
                jerseyNumber: true,
              },
            },
          },
        },
        matchLineups: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                shortName: true,
                logoUrl: true,
              },
            },
            players: {
              include: {
                player: {
                  select: {
                    id: true,
                    fullName: true,
                    position: true,
                  },
                },
              },
              orderBy: [
                { isStarter: 'desc' as const },
                { jerseyNumber: 'asc' as const },
              ],
            },
          },
        },
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
            event: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        },
        eventCategory: true,
        playerOfTheMatch: {
          select: {
            id: true,
            fullName: true,
            jerseyNumber: true,
            photoUrl: true,
            team: { select: { id: true, name: true, shortName: true, logoUrl: true } },
          },
        },
      },
    });

    if (!match) {
      throw new ForbiddenException(
        'You do not have permission to access this match',
      );
    }

    return match;
  }

  async update(id: string, dto: UpdateMatchDto, userId: string, userRole: UserRole) {
    // Verify the user owns the event that contains this match
    await this.ownershipService.assertMatchOwner(id, userId, userRole);

    const match = await this.prisma.match.findUnique({
      where: { id },
    });

    if (!match) {
      throw new NotFoundException(`Match with id ${id} not found`);
    }

    if (dto.homeTeamId && dto.awayTeamId && dto.homeTeamId === dto.awayTeamId) {
      throw new BadRequestException(
        'Home team and away team must be different',
      );
    }

    // Validate team-category registration if category or teams are changing
    const effectiveCategoryId = dto.eventCategoryId ?? match.eventCategoryId;
    if (effectiveCategoryId && (dto.eventCategoryId || dto.homeTeamId || dto.awayTeamId)) {
      const category = await this.prisma.eventCategory.findUnique({
        where: { id: effectiveCategoryId },
      });

      if (!category) {
        throw new NotFoundException(
          `Event category with id ${effectiveCategoryId} not found`,
        );
      }

      const effectiveHomeTeamId = dto.homeTeamId ?? match.homeTeamId;
      const effectiveAwayTeamId = dto.awayTeamId ?? match.awayTeamId;

      const [homeReg, awayReg] = await Promise.all([
        this.prisma.eventCategoryTeam.findUnique({
          where: {
            eventCategoryId_teamId: {
              eventCategoryId: effectiveCategoryId,
              teamId: effectiveHomeTeamId,
            },
          },
        }),
        this.prisma.eventCategoryTeam.findUnique({
          where: {
            eventCategoryId_teamId: {
              eventCategoryId: effectiveCategoryId,
              teamId: effectiveAwayTeamId,
            },
          },
        }),
      ]);

      if (!homeReg) {
        throw new BadRequestException(
          `Home team is not registered in category "${category.name}"`,
        );
      }

      if (!awayReg) {
        throw new BadRequestException(
          `Away team is not registered in category "${category.name}"`,
        );
      }
    }

    const data: Record<string, unknown> = {};

    if (dto.tournamentId !== undefined) data.tournamentId = dto.tournamentId;
    if (dto.homeTeamId !== undefined) data.homeTeamId = dto.homeTeamId;
    if (dto.awayTeamId !== undefined) data.awayTeamId = dto.awayTeamId;
    if (dto.eventCategoryId !== undefined) data.eventCategoryId = dto.eventCategoryId;
    if (dto.scheduledAt !== undefined) data.scheduledAt = new Date(dto.scheduledAt);
    if (dto.venue !== undefined) data.venue = dto.venue;
    if (dto.round !== undefined) data.round = dto.round;
    if (dto.leg !== undefined) data.leg = dto.leg;
    if (dto.group !== undefined) data.group = dto.group;
    if (dto.matchDay !== undefined) data.matchDay = dto.matchDay;
    if (dto.matchDurationMinutes !== undefined) data.matchDurationMinutes = dto.matchDurationMinutes;
    if (dto.halfCount !== undefined) data.halfCount = dto.halfCount;
    if (dto.breakDurationMinutes !== undefined) data.breakDurationMinutes = dto.breakDurationMinutes;
    if (dto.injuryTimeMinutes !== undefined) data.injuryTimeMinutes = dto.injuryTimeMinutes;

    const updated = await this.prisma.match.update({
      where: { id },
      data,
      include: {
        homeTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            logoUrl: true,
          },
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            logoUrl: true,
          },
        },
        matchScore: true,
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        eventCategory: true,
      },
    });

    return updated;
  }

  async updateStatus(id: string, newStatus: MatchStatus, userId: string, userRole: UserRole) {
    // Verify the user owns the event that contains this match
    await this.ownershipService.assertMatchOwner(id, userId, userRole);

    const match = await this.prisma.match.findUnique({
      where: { id },
    });

    if (!match) {
      throw new NotFoundException(`Match with id ${id} not found`);
    }

    const allowedTransitions = VALID_STATUS_TRANSITIONS[match.status] ?? [];

    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `Cannot transition match status from "${match.status}" to "${newStatus}". ` +
        `Allowed transitions: ${allowedTransitions.length > 0 ? allowedTransitions.join(', ') : 'none (terminal state)'}`,
      );
    }

    const data: Record<string, unknown> = { status: newStatus };

    // Automatically set timestamps based on status transition
    if (newStatus === MatchStatus.LIVE && !match.startedAt) {
      data.startedAt = new Date();
    }

    if (newStatus === MatchStatus.COMPLETED) {
      data.endedAt = new Date();
    }

    const updated = await this.prisma.match.update({
      where: { id },
      data,
      include: {
        homeTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            logoUrl: true,
          },
        },
        awayTeam: {
          select: {
            id: true,
            name: true,
            shortName: true,
            logoUrl: true,
          },
        },
        matchScore: true,
        tournament: {
          select: {
            id: true,
            name: true,
            type: true,
          },
        },
        playerOfTheMatch: {
          select: {
            id: true,
            fullName: true,
            jerseyNumber: true,
            photoUrl: true,
            team: { select: { id: true, name: true, shortName: true, logoUrl: true } },
          },
        },
      },
    });

    // Auto-generate POTM after match ends
    if (newStatus === MatchStatus.COMPLETED) {
      this.autoGeneratePotm(id).catch((err) =>
        this.logger.error(`POTM auto-generate failed for match ${id}: ${err?.message}`),
      );
    }

    return updated;
  }

  // ─── Publish / Unpublish ─────────────────────────────────────────

  async publish(id: string, userId: string, userRole: UserRole) {
    await this.ownershipService.assertMatchOwner(id, userId, userRole);

    const match = await this.prisma.match.findUnique({ where: { id } });
    if (!match) throw new NotFoundException(`Match with id ${id} not found`);

    if (match.status !== MatchStatus.DRAFT) {
      throw new BadRequestException(
        `Cannot publish match in status "${match.status}". Only DRAFT matches can be published.`,
      );
    }

    return this.prisma.match.update({
      where: { id },
      data: { status: MatchStatus.PUBLISHED },
      include: this.matchInclude(),
    });
  }

  async unpublish(id: string, userId: string, userRole: UserRole) {
    await this.ownershipService.assertMatchOwner(id, userId, userRole);

    const match = await this.prisma.match.findUnique({ where: { id } });
    if (!match) throw new NotFoundException(`Match with id ${id} not found`);

    if (match.status !== MatchStatus.PUBLISHED) {
      throw new BadRequestException(
        `Cannot unpublish match in status "${match.status}". Only PUBLISHED matches can be unpublished.`,
      );
    }

    // Prevent unpublishing if lineups already exist
    const lineupCount = await this.prisma.matchLineup.count({
      where: { matchId: id },
    });

    if (lineupCount > 0) {
      throw new BadRequestException(
        'Cannot unpublish match: lineups have already been submitted. Remove lineups first.',
      );
    }

    return this.prisma.match.update({
      where: { id },
      data: { status: MatchStatus.DRAFT },
      include: this.matchInclude(),
    });
  }

  // ─── Team Manager — My Team Matches ─────────────────────────────

  async findMyTeamMatches(userId: string) {
    // Find the team managed by this user
    const team = await this.prisma.team.findUnique({
      where: { managerId: userId },
    });

    if (!team) {
      return { data: [], meta: { total: 0 } };
    }

    const now = new Date();
    const H3_MS = 3 * 24 * 60 * 60 * 1000;

    const matches = await this.prisma.match.findMany({
      where: {
        status: { notIn: [MatchStatus.DRAFT] },
        OR: [
          { homeTeamId: team.id },
          { awayTeamId: team.id },
        ],
      },
      include: {
        homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
        matchScore: true,
        tournament: { select: { id: true, name: true, type: true } },
        eventCategory: { select: { id: true, name: true, sportType: true } },
        matchLineups: {
          where: { teamId: team.id },
          select: { id: true, isLocked: true },
        },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    // Add computed fields
    const enriched = matches.map((m) => {
      const lineupOpensAt = new Date(m.scheduledAt.getTime() - H3_MS);
      const hasLineup = m.matchLineups.length > 0;
      const canSubmitLineup =
        m.status === MatchStatus.PUBLISHED &&
        now >= lineupOpensAt &&
        !hasLineup;
      const canEditLineup =
        m.status === MatchStatus.PUBLISHED &&
        now >= lineupOpensAt &&
        hasLineup &&
        !m.matchLineups[0]?.isLocked;

      return {
        ...m,
        myTeamId: team.id,
        lineupOpensAt,
        canSubmitLineup,
        canEditLineup,
        hasLineup,
        isLineupLocked: m.matchLineups[0]?.isLocked ?? false,
      };
    });

    return { data: enriched, meta: { total: enriched.length, teamId: team.id } };
  }

  async getMatchTimeConfig(id: string) {
    const match = await this.prisma.match.findUnique({
      where: { id },
      include: { eventCategory: true },
    });

    if (!match) {
      throw new NotFoundException(`Match with id ${id} not found`);
    }

    const category = match.eventCategory;

    return {
      matchDurationMinutes: match.matchDurationMinutes ?? category?.matchDurationMinutes ?? 90,
      halfCount: match.halfCount ?? category?.halfCount ?? 2,
      breakDurationMinutes: match.breakDurationMinutes ?? category?.breakDurationMinutes ?? 15,
      injuryTimeMinutes: match.injuryTimeMinutes ?? category?.injuryTimeMinutes ?? 0,
      source: match.matchDurationMinutes !== null ? 'match' : (category ? 'category' : 'default'),
    };
  }

  // ─── POTM ────────────────────────────────────────────────────────

  /**
   * Auto-generate POTM when a match becomes COMPLETED.
   * Scores winner-team players from match events and picks the highest.
   * If draw → no auto assignment; EO must choose manually.
   */
  async autoGeneratePotm(matchId: string): Promise<void> {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { matchScore: true },
    });

    if (!match || !match.matchScore) return;

    const { homeScore, awayScore } = match.matchScore;

    // Draw → leave null; EO must pick manually
    if (homeScore === awayScore) return;

    const isHomeWinner = homeScore > awayScore;
    const winnerTeamId = isHomeWinner ? match.homeTeamId : match.awayTeamId;
    const concededByWinner = isHomeWinner ? awayScore : homeScore;

    // Get winner lineup (with player position for clean-sheet GK bonus)
    const lineup = await this.prisma.matchLineup.findUnique({
      where: { matchId_teamId: { matchId, teamId: winnerTeamId } },
      include: {
        players: {
          include: { player: { select: { id: true, position: true } } },
        },
      },
    });

    if (!lineup || lineup.players.length === 0) return;

    const playerIds = lineup.players.map((lp) => lp.playerId);

    const events = await this.prisma.matchEvent.findMany({
      where: {
        matchId,
        playerId: { in: playerIds },
        type: {
          in: [
            MatchEventType.GOAL,
            MatchEventType.ASSIST,
            MatchEventType.YELLOW_CARD,
            MatchEventType.RED_CARD,
          ],
        },
      },
      select: { playerId: true, type: true },
    });

    // Build per-player score
    const scores: Record<string, { goals: number; score: number }> = {};
    for (const lp of lineup.players) {
      const pos = (lp.player?.position ?? '').toLowerCase();
      const isGK = pos.includes('goal') || pos.includes('kiper') || pos === 'gk';
      const cleanSheetBonus = isGK && concededByWinner === 0 ? 2 : 0;
      scores[lp.playerId] = { goals: 0, score: cleanSheetBonus };
    }

    for (const ev of events) {
      if (!ev.playerId || !scores[ev.playerId]) continue;
      const s = scores[ev.playerId];
      switch (ev.type) {
        case MatchEventType.GOAL:
          s.goals += 1;
          s.score += 3;
          break;
        case MatchEventType.ASSIST:
          s.score += 1;
          break;
        case MatchEventType.YELLOW_CARD:
          s.score -= 1;
          break;
        case MatchEventType.RED_CARD:
          s.score -= 3;
          break;
      }
    }

    // Pick best player (score desc, then goals as tiebreaker)
    let bestId: string | null = null;
    let bestScore = -Infinity;
    let bestGoals = 0;
    for (const [pid, { goals, score }] of Object.entries(scores)) {
      if (score > bestScore || (score === bestScore && goals > bestGoals)) {
        bestScore = score;
        bestGoals = goals;
        bestId = pid;
      }
    }

    if (!bestId) return;

    await this.prisma.match.update({
      where: { id: matchId },
      data: { playerOfTheMatchId: bestId },
    });
  }

  /**
   * Return all lineup players from both teams as POTM candidates.
   */
  async getPotmCandidates(
    matchId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.ownershipService.assertMatchOwner(matchId, userId, userRole);

    const lineups = await this.prisma.matchLineup.findMany({
      where: { matchId },
      include: {
        team: { select: { id: true, name: true, shortName: true } },
        players: {
          include: {
            player: {
              select: {
                id: true,
                fullName: true,
                jerseyNumber: true,
                position: true,
                photoUrl: true,
              },
            },
          },
          orderBy: [
            { isStarter: 'desc' as const },
            { jerseyNumber: 'asc' as const },
          ],
        },
      },
    });

    return lineups.flatMap((lineup) =>
      lineup.players.map((lp) => ({
        playerId: lp.player.id,
        fullName: lp.player.fullName,
        jerseyNumber: lp.player.jerseyNumber ?? null,
        position: lp.player.position ?? null,
        photoUrl: lp.player.photoUrl ?? null,
        teamId: lineup.teamId,
        teamName: lineup.team.name,
        isStarter: lp.isStarter,
      })),
    );
  }

  /**
   * EO selects or changes the POTM. Player must be in match lineup.
   * Blocked if potmLocked = true.
   */
  async updatePotm(
    matchId: string,
    playerId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.ownershipService.assertMatchOwner(matchId, userId, userRole);

    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException(`Match ${matchId} not found`);

    if (match.status !== MatchStatus.COMPLETED) {
      throw new BadRequestException('POTM dapat diatur hanya pada pertandingan yang sudah selesai.');
    }

    if (match.potmLocked) {
      throw new BadRequestException('POTM sudah dikunci dan tidak dapat diubah.');
    }

    const lineupPlayer = await this.prisma.matchLineupPlayer.findFirst({
      where: { playerId, lineup: { matchId } },
    });

    if (!lineupPlayer) {
      throw new BadRequestException('Pemain tidak terdaftar di lineup pertandingan ini.');
    }

    return this.prisma.match.update({
      where: { id: matchId },
      data: { playerOfTheMatchId: playerId },
      include: {
        playerOfTheMatch: {
          select: {
            id: true,
            fullName: true,
            jerseyNumber: true,
            photoUrl: true,
            team: { select: { id: true, name: true, shortName: true, logoUrl: true } },
          },
        },
      },
    });
  }

  /**
   * Lock (publish) the POTM. playerOfTheMatchId must be set.
   */
  async lockPotm(matchId: string, userId: string, userRole: UserRole) {
    await this.ownershipService.assertMatchOwner(matchId, userId, userRole);

    const match = await this.prisma.match.findUnique({ where: { id: matchId } });
    if (!match) throw new NotFoundException(`Match ${matchId} not found`);

    if (match.status !== MatchStatus.COMPLETED) {
      throw new BadRequestException('Hanya dapat mengunci POTM pada pertandingan yang sudah selesai.');
    }

    if (!match.playerOfTheMatchId) {
      throw new BadRequestException('Pilih Player of The Match dulu sebelum mengunci.');
    }

    return this.prisma.match.update({
      where: { id: matchId },
      data: { potmLocked: true },
      include: {
        playerOfTheMatch: {
          select: {
            id: true,
            fullName: true,
            jerseyNumber: true,
            photoUrl: true,
            team: { select: { id: true, name: true, shortName: true, logoUrl: true } },
          },
        },
      },
    });
  }

  // ─── Private helpers ────────────────────────────────────────────

  private matchInclude() {
    return {
      homeTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
      awayTeam: { select: { id: true, name: true, shortName: true, logoUrl: true } },
      matchScore: true,
      tournament: { select: { id: true, name: true, type: true } },
    };
  }
}
