import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import {
  BracketType,
  MatchStatus,
  TournamentStatus,
  TournamentType,
  UserRole,
} from '@prisma/client';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { LeagueStrategy } from './strategies/league.strategy';
import { KnockoutStrategy } from './strategies/knockout.strategy';
import { DoubleEliminationStrategy } from './strategies/double-elimination.strategy';
import { SpecialGroupStrategy } from './strategies/special-group.strategy';
import { TournamentStrategy } from './strategies/tournament-strategy.interface';

@Injectable()
export class TournamentsService {
  private readonly strategies: Record<string, TournamentStrategy>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly leagueStrategy: LeagueStrategy,
    private readonly knockoutStrategy: KnockoutStrategy,
    private readonly doubleEliminationStrategy: DoubleEliminationStrategy,
    private readonly specialGroupStrategy: SpecialGroupStrategy,
  ) {
    this.strategies = {
      [TournamentType.LEAGUE]: this.leagueStrategy,
      [TournamentType.KNOCKOUT]: this.knockoutStrategy,
      [TournamentType.GROUP_KNOCKOUT]: this.leagueStrategy,
      [TournamentType.DOUBLE_ELIMINATION]: this.doubleEliminationStrategy,
      [TournamentType.CUSTOM]: this.leagueStrategy,
      SPECIAL_GROUP: this.specialGroupStrategy,
      GROUP_NEIGHBOR: this.specialGroupStrategy,
    };
  }

  async create(
    eventId: string,
    dto: CreateTournamentDto,
    userId: string,
    userRole: UserRole,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with id ${eventId} not found`);
    }

    if (event.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to create tournaments for this event',
      );
    }

    // Validate config for the chosen tournament type
    if (dto.config) {
      const strategy = this.strategies[dto.type];
      if (strategy) {
        strategy.validateConfig(dto.config);
      }
    }

    // Validate eventCategoryId if provided
    if (dto.eventCategoryId) {
      const category = await this.prisma.eventCategory.findUnique({
        where: { id: dto.eventCategoryId },
      });
      if (!category) {
        throw new NotFoundException(`Event category with id ${dto.eventCategoryId} not found`);
      }
      if (category.eventId !== eventId) {
        throw new BadRequestException(
          'The specified event category does not belong to this event',
        );
      }
    }

    const tournament = await this.prisma.tournament.create({
      data: {
        name: dto.name,
        type: dto.type,
        config: (dto.config ?? {}) as any,
        eventId,
        eventCategoryId: dto.eventCategoryId,
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: { matches: true },
        },
      },
    });

    return tournament;
  }

  // ─── Public methods (no auth, only public events) ─────────────────

  async findByEventPublic(eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        isPublic: true,
        status: { in: ['PUBLISHED', 'ONGOING', 'COMPLETED'] },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const tournaments = await this.prisma.tournament.findMany({
      where: { eventId },
      include: {
        _count: {
          select: {
            matches: true,
            standings: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return tournaments;
  }

  async findByIdPublic(id: string) {
    const tournament = await this.prisma.tournament.findFirst({
      where: {
        id,
        event: {
          isPublic: true,
          status: { in: ['PUBLISHED', 'ONGOING', 'COMPLETED'] },
        },
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
            location: true,
            venue: true,
            startDate: true,
            endDate: true,
            status: true,
            bannerUrl: true,
            sport: { select: { id: true, name: true, slug: true, icon: true } },
          },
        },
        matches: {
          where: { status: { notIn: [MatchStatus.DRAFT, MatchStatus.CANCELLED] } },
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
          },
          orderBy: [{ scheduledAt: 'asc' }, { round: 'asc' }, { matchDay: 'asc' }],
        },
        standings: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                shortName: true,
                logoUrl: true,
              },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException('Tournament not found');
    }

    return tournament;
  }

  async findByEvent(eventId: string, userId: string, userRole: UserRole) {
    // ── Verify event ownership ──
    const where: Record<string, unknown> = { id: eventId };
    if (userRole !== UserRole.ADMIN) {
      where.organizerId = userId;
    }

    const event = await this.prisma.event.findFirst({ where });

    if (!event) {
      throw new ForbiddenException(
        'You do not have permission to access this event',
      );
    }

    const tournaments = await this.prisma.tournament.findMany({
      where: { eventId },
      include: {
        _count: {
          select: {
            matches: true,
            standings: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return tournaments;
  }

  async findById(id: string, userId: string, userRole: UserRole) {
    // Build ownership-scoped query
    const whereClause: Record<string, unknown> = { id };
    if (userRole !== UserRole.ADMIN) {
      whereClause.event = { organizerId: userId };
    }

    const tournament = await this.prisma.tournament.findFirst({
      where: whereClause,
      include: {
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
            organizerId: true,
          },
        },
        matches: {
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
          },
          orderBy: [{ round: 'asc' }, { matchDay: 'asc' }],
        },
        standings: {
          include: {
            team: {
              select: {
                id: true,
                name: true,
                shortName: true,
                logoUrl: true,
              },
            },
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!tournament) {
      throw new ForbiddenException(
        'You do not have permission to access this tournament',
      );
    }

    return tournament;
  }

  async update(
    id: string,
    dto: UpdateTournamentDto,
    userId: string,
    userRole: UserRole,
  ) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        event: {
          select: { organizerId: true },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException(`Tournament with id ${id} not found`);
    }

    if (tournament.event.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to update this tournament',
      );
    }

    // Validate config if being updated
    if (dto.config) {
      const type = dto.type ?? tournament.type;
      const strategy = this.strategies[type];
      if (strategy) {
        strategy.validateConfig(dto.config);
      }
    }

    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.type !== undefined) data.type = dto.type;
    if (dto.config !== undefined) data.config = dto.config;

    const updated = await this.prisma.tournament.update({
      where: { id },
      data,
      include: {
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
          },
        },
        _count: {
          select: { matches: true },
        },
      },
    });

    return updated;
  }

  async generateFixtures(
    id: string,
    userId: string,
    userRole: UserRole,
  ) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        event: {
          select: {
            id: true,
            organizerId: true,
          },
        },
        eventCategory: {
          include: {
            categoryTeams: {
              select: { teamId: true },
              orderBy: { seed: 'asc' },
            },
          },
        },
        _count: {
          select: { matches: true },
        },
      },
    });

    if (!tournament) {
      throw new NotFoundException(`Tournament with id ${id} not found`);
    }

    if (
      tournament.event.organizerId !== userId &&
      userRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'You do not have permission to generate fixtures for this tournament',
      );
    }

    if (tournament._count.matches > 0) {
      throw new BadRequestException(
        'Fixtures have already been generated for this tournament. Delete existing matches first.',
      );
    }

    if (!tournament.eventCategory) {
      throw new BadRequestException(
        'Tournament must be linked to an event category before generating fixtures',
      );
    }

    const teamIds = tournament.eventCategory.categoryTeams.map((ct) => ct.teamId);

    if (teamIds.length < 2) {
      throw new BadRequestException(
        'At least 2 teams must be registered for the category to generate fixtures',
      );
    }

    const strategy = this.strategies[tournament.type];
    if (!strategy) {
      throw new BadRequestException(
        `No fixture generation strategy available for tournament type: ${tournament.type}`,
      );
    }

    const config = (tournament.config as Record<string, unknown>) ?? {};
    const fixtureMatches = strategy.generateFixtures(teamIds, config);

    const BYE_TEAM = '__BYE__';
    const hasBracketLinks = fixtureMatches.some((f) => f._tempId);

    // Set a default scheduled date for the fixtures
    const baseDate = new Date();

    if (hasBracketLinks) {
      // ── Double Elimination: create matches one-by-one, resolve linkage ──
      const tempToRealId = new Map<string, string>();
      const pendingLinks: Array<{
        matchId: string;
        winnerTo?: string;
        loserTo?: string;
        sourceA?: string;
        sourceB?: string;
      }> = [];

      for (const fixture of fixtureMatches) {
        // Replace BYE placeholder with first team (Prisma FK needs a valid team)
        const homeId = fixture.homeTeamId === BYE_TEAM ? teamIds[0] : fixture.homeTeamId;
        const awayId = fixture.awayTeamId === BYE_TEAM ? teamIds[0] : fixture.awayTeamId;

        const bracketVal = fixture.bracket as BracketType | undefined;

        const created = await this.prisma.match.create({
          data: {
            tournamentId: tournament.id,
            homeTeamId: homeId,
            awayTeamId: awayId,
            eventCategoryId: tournament.eventCategoryId,
            round: fixture.round,
            matchDay: fixture.matchDay,
            scheduledAt: fixture.scheduledAt ?? new Date(baseDate.getTime() + fixture.matchDay * 86400000),
            status: fixture.isResetFinal ? MatchStatus.DRAFT : MatchStatus.DRAFT,
            stageType: fixture.stageType ?? 'DOUBLE_ELIMINATION',
            bracket: bracketVal,
            matchIndex: fixture.matchIndex,
            isGrandFinal: fixture.isGrandFinal ?? false,
            isResetFinal: fixture.isResetFinal ?? false,
          },
        });

        if (fixture._tempId) {
          tempToRealId.set(fixture._tempId, created.id);
        }

        pendingLinks.push({
          matchId: created.id,
          winnerTo: fixture._winnerTo,
          loserTo: fixture._loserTo,
          sourceA: fixture._sourceA,
          sourceB: fixture._sourceB,
        });
      }

      // Resolve temp IDs to real IDs
      const updates: Promise<unknown>[] = [];
      for (const link of pendingLinks) {
        const data: Record<string, string> = {};
        if (link.winnerTo && tempToRealId.has(link.winnerTo)) {
          data.winnerToMatchId = tempToRealId.get(link.winnerTo)!;
        }
        if (link.loserTo && tempToRealId.has(link.loserTo)) {
          data.loserToMatchId = tempToRealId.get(link.loserTo)!;
        }
        if (link.sourceA && tempToRealId.has(link.sourceA)) {
          data.sourceMatchAId = tempToRealId.get(link.sourceA)!;
        }
        if (link.sourceB && tempToRealId.has(link.sourceB)) {
          data.sourceMatchBId = tempToRealId.get(link.sourceB)!;
        }
        if (Object.keys(data).length > 0) {
          updates.push(
            this.prisma.match.update({
              where: { id: link.matchId },
              data,
            }),
          );
        }
      }
      await Promise.all(updates);
    } else {
      // ── Legacy path: bulk create (league / knockout) ──
      const matchCreateData = fixtureMatches.map((fixture) => ({
        tournamentId: tournament.id,
        homeTeamId: fixture.homeTeamId,
        awayTeamId: fixture.awayTeamId,
        eventCategoryId: tournament.eventCategoryId,
        round: fixture.round,
        matchDay: fixture.matchDay,
        scheduledAt: fixture.scheduledAt ?? new Date(baseDate.getTime() + fixture.matchDay * 86400000),
        status: MatchStatus.PUBLISHED,
      }));

      await this.prisma.match.createMany({
        data: matchCreateData,
      });
    }

    // Update tournament status to IN_PROGRESS
    await this.prisma.tournament.update({
      where: { id },
      data: { status: TournamentStatus.IN_PROGRESS },
    });

    // Return the tournament with its new matches
    return this.findById(id, userId, userRole);
  }

  // ── Double Elimination specific endpoints ──────────────────────

  async updateSeeding(
    id: string,
    seedingOrder: string[],
    userId: string,
    userRole: UserRole,
  ) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        event: { select: { organizerId: true } },
      },
    });

    if (!tournament) throw new NotFoundException(`Tournament ${id} not found`);
    if (tournament.event.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('No permission');
    }
    if (tournament.status !== TournamentStatus.SETUP) {
      throw new BadRequestException('Cannot update seeding after tournament has started');
    }

    // Update seeds on EventCategoryTeam
    const updates = seedingOrder.map((teamId, index) =>
      this.prisma.eventCategoryTeam.updateMany({
        where: {
          eventCategoryId: tournament.eventCategoryId!,
          teamId,
        },
        data: { seed: index + 1 },
      }),
    );
    await Promise.all(updates);

    return { success: true, seedingOrder };
  }

  async resetBracket(
    id: string,
    userId: string,
    userRole: UserRole,
  ) {
    const tournament = await this.prisma.tournament.findUnique({
      where: { id },
      include: {
        event: { select: { organizerId: true } },
        _count: { select: { matches: true } },
      },
    });

    if (!tournament) throw new NotFoundException(`Tournament ${id} not found`);
    if (tournament.event.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('No permission');
    }

    // Clear linkage fields first to avoid FK constraint violations
    await this.prisma.match.updateMany({
      where: { tournamentId: id },
      data: {
        winnerToMatchId: null,
        loserToMatchId: null,
        sourceMatchAId: null,
        sourceMatchBId: null,
      },
    });

    // Delete all matches
    await this.prisma.match.deleteMany({
      where: { tournamentId: id },
    });

    // Reset status
    await this.prisma.tournament.update({
      where: { id },
      data: { status: TournamentStatus.SETUP },
    });

    return { success: true };
  }
}
