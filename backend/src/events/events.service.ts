import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventStatus, MatchEventType, MatchStatus, UserRole } from '@prisma/client';

import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { buildPaginationMeta } from '../common/dto/pagination.dto';

import { SwissSystemService } from '../tournaments/swiss-system.service';

@Injectable()
export class EventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly swissSystemService: SwissSystemService,
  ) { }

  async create(dto: CreateEventDto, organizerId: string) {
    const existingSlug = await this.prisma.event.findUnique({
      where: { slug: dto.slug },
    });

    if (existingSlug) {
      throw new ConflictException('An event with this slug already exists');
    }

    const sport = await this.prisma.sport.findUnique({
      where: { id: dto.sportId },
    });

    if (!sport) {
      throw new NotFoundException(`Sport with id ${dto.sportId} not found`);
    }

    const event = await this.prisma.event.create({
      data: {
        name: dto.name,
        slug: dto.slug,
        description: dto.description,
        location: dto.location,
        venue: dto.venue,
        startDate: new Date(dto.startDate),
        endDate: new Date(dto.endDate),
        sportId: dto.sportId,
        organizerId,
        maxTeams: dto.maxTeams,
        isPublic: dto.isPublic ?? true,
        rules: dto.rules,
      },
      include: {
        sport: true,
        organizer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return event;
  }

  async findAll(query: EventQueryDto, userId: string, userRole: UserRole) {
    const where: Record<string, unknown> = {};

    // ── Ownership scoping: organizers only see their own events ──
    if (userRole !== UserRole.ADMIN) {
      where.organizerId = userId;
    }

    if (query.sportId) {
      where.sportId = query.sportId;
    }

    if (query.status) {
      where.status = query.status;
    }

    if (query.startDate || query.endDate) {
      where.startDate = {};
      if (query.startDate) {
        (where.startDate as Record<string, unknown>).gte = new Date(query.startDate);
      }
      if (query.endDate) {
        (where.startDate as Record<string, unknown>).lte = new Date(query.endDate);
      }
    }

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy,
        include: {
          sport: true,
          organizer: {
            select: {
              id: true,
              email: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              tournaments: true,
              categories: true,
            },
          },
        },
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      data: events,
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  // ─── Public methods (no auth, only published/public events) ──────

  private readonly PUBLIC_STATUSES: EventStatus[] = [
    EventStatus.PUBLISHED,
    EventStatus.ONGOING,
    EventStatus.COMPLETED,
  ];

  async findAllPublic(query: EventQueryDto) {
    const where: Record<string, unknown> = {
      isPublic: true,
      status: { in: this.PUBLIC_STATUSES },
    };

    if (query.sportId) {
      where.sportId = query.sportId;
    }

    if (query.status) {
      // Only allow filtering within public statuses
      if (this.PUBLIC_STATUSES.includes(query.status)) {
        where.status = query.status;
      }
    }

    if (query.startDate || query.endDate) {
      where.startDate = {};
      if (query.startDate) {
        (where.startDate as Record<string, unknown>).gte = new Date(query.startDate);
      }
      if (query.endDate) {
        (where.startDate as Record<string, unknown>).lte = new Date(query.endDate);
      }
    }

    const [events, total] = await Promise.all([
      this.prisma.event.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy,
        include: {
          sport: true,
          organizer: {
            select: {
              id: true,
              firstName: true,
              lastName: true,
            },
          },
          _count: {
            select: {
              tournaments: true,
              categories: true,
            },
          },
        },
      }),
      this.prisma.event.count({ where }),
    ]);

    return {
      data: events,
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findByIdPublic(id: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        id,
        isPublic: true,
        status: { in: this.PUBLIC_STATUSES },
      },
      include: {
        sport: true,
        organizer: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
          },
        },
        tournaments: {
          include: {
            _count: {
              select: { matches: true },
            },
          },
        },
        categories: {
          include: {
            categoryTeams: {
              include: {
                team: {
                  select: {
                    id: true,
                    name: true,
                    shortName: true,
                    slug: true,
                    logoUrl: true,
                    city: true,
                  },
                },
              },
              orderBy: { registeredAt: 'asc' },
            },
            _count: { select: { categoryTeams: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event not found`);
    }

    return event;
  }

  async getEventTeamsPublic(eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        isPublic: true,
        status: { in: this.PUBLIC_STATUSES },
      },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const categoryTeams = await this.prisma.eventCategoryTeam.findMany({
      where: {
        eventCategory: { eventId },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
            city: true,
            country: true,
            logoUrl: true,
          },
        },
      },
    });

    const seen = new Set<string>();
    const uniqueTeams = categoryTeams
      .filter((ct) => {
        if (seen.has(ct.teamId)) return false;
        seen.add(ct.teamId);
        return true;
      })
      .map((ct) => ct.team);

    return { data: uniqueTeams };
  }

  async getEventMatchesPublic(eventId: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        id: eventId,
        isPublic: true,
        status: { in: this.PUBLIC_STATUSES },
      },
      include: { tournaments: { select: { id: true } } },
    });

    if (!event) {
      throw new NotFoundException('Event not found');
    }

    const tournamentIds = event.tournaments.map((t) => t.id);

    if (tournamentIds.length === 0) {
      return { data: [] };
    }

    const matches = await this.prisma.match.findMany({
      where: {
        tournamentId: { in: tournamentIds },
        status: { notIn: [MatchStatus.DRAFT, MatchStatus.CANCELLED] },
      },
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
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
      },
    });

    return { data: matches };
  }

  async findBySlug(slug: string) {
    const event = await this.prisma.event.findUnique({
      where: { slug },
      include: {
        sport: true,
        organizer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        tournaments: {
          include: {
            _count: {
              select: { matches: true },
            },
          },
        },
        categories: {
          include: {
            categoryTeams: {
              include: {
                team: {
                  select: {
                    id: true,
                    name: true,
                    shortName: true,
                    slug: true,
                    logoUrl: true,
                    city: true,
                  },
                },
              },
              orderBy: { registeredAt: 'asc' },
            },
            _count: { select: { categoryTeams: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event with slug "${slug}" not found`);
    }

    return event;
  }

  async findById(id: string, userId: string, userRole: UserRole) {
    const where: Record<string, unknown> = { id };

    // ── Ownership scoping ──
    if (userRole !== UserRole.ADMIN) {
      where.organizerId = userId;
    }

    const event = await this.prisma.event.findFirst({
      where,
      include: {
        sport: true,
        organizer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
        tournaments: {
          include: {
            _count: {
              select: { matches: true },
            },
          },
        },
        categories: {
          include: {
            categoryTeams: {
              include: {
                team: {
                  select: {
                    id: true,
                    name: true,
                    shortName: true,
                    slug: true,
                    logoUrl: true,
                    city: true,
                  },
                },
              },
              orderBy: { registeredAt: 'asc' },
            },
            _count: { select: { categoryTeams: true } },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!event) {
      throw new ForbiddenException(
        'You do not have permission to access this event',
      );
    }

    return event;
  }

  async update(
    id: string,
    dto: UpdateEventDto,
    userId: string,
    userRole: UserRole,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException(`Event with id ${id} not found`);
    }

    if (event.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to update this event',
      );
    }

    if (dto.slug && dto.slug !== event.slug) {
      const existingSlug = await this.prisma.event.findUnique({
        where: { slug: dto.slug },
      });

      if (existingSlug) {
        throw new ConflictException('An event with this slug already exists');
      }
    }

    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.slug !== undefined) data.slug = dto.slug;
    if (dto.description !== undefined) data.description = dto.description;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.venue !== undefined) data.venue = dto.venue;
    if (dto.startDate !== undefined) data.startDate = new Date(dto.startDate);
    if (dto.endDate !== undefined) data.endDate = new Date(dto.endDate);
    if (dto.sportId !== undefined) data.sportId = dto.sportId;
    if (dto.maxTeams !== undefined) data.maxTeams = dto.maxTeams;
    if (dto.isPublic !== undefined) data.isPublic = dto.isPublic;
    if (dto.rules !== undefined) data.rules = dto.rules;

    const updated = await this.prisma.event.update({
      where: { id },
      data,
      include: {
        sport: true,
        organizer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return updated;
  }

  async updateStatus(
    id: string,
    status: EventStatus,
    userId: string,
    userRole: UserRole,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException(`Event with id ${id} not found`);
    }

    if (event.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to update this event',
      );
    }

    // PUBLISHED → DRAFT: only allowed if no matches have started
    if (status === EventStatus.DRAFT && event.status === EventStatus.PUBLISHED) {
      const startedMatch = await this.prisma.match.findFirst({
        where: {
          tournament: { eventId: id },
          status: {
            in: [
              MatchStatus.LIVE,
              MatchStatus.HALF_TIME,
              MatchStatus.PAUSED,
              MatchStatus.COMPLETED,
            ],
          },
        },
      });

      if (startedMatch) {
        throw new BadRequestException(
          'Cannot revert to draft because matches have already started',
        );
      }
    }

    const updated = await this.prisma.event.update({
      where: { id },
      data: { status },
      include: {
        sport: true,
        organizer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return updated;
  }

  async softDelete(id: string, userId: string, userRole: UserRole) {
    const event = await this.prisma.event.findUnique({
      where: { id },
    });

    if (!event) {
      throw new NotFoundException(`Event with id ${id} not found`);
    }

    if (event.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to delete this event',
      );
    }

    if (event.status === EventStatus.CANCELLED) {
      throw new BadRequestException('Event is already cancelled');
    }

    const updated = await this.prisma.event.update({
      where: { id },
      data: { status: EventStatus.CANCELLED },
      include: {
        sport: true,
        organizer: {
          select: {
            id: true,
            email: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    });

    return updated;
  }

  async getEventTeams(eventId: string, userId: string, userRole: UserRole) {
    // ── Verify ownership ──
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

    // Aggregate teams from all categories, deduplicated
    const categoryTeams = await this.prisma.eventCategoryTeam.findMany({
      where: {
        eventCategory: { eventId },
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
            city: true,
            country: true,
            logoUrl: true,
          },
        },
      },
    });

    const seen = new Set<string>();
    const uniqueTeams = categoryTeams
      .filter((ct) => {
        if (seen.has(ct.teamId)) return false;
        seen.add(ct.teamId);
        return true;
      })
      .map((ct) => ct.team);

    return { data: uniqueTeams };
  }

  async getEventMatches(
    eventId: string,
    userId: string,
    userRole: UserRole,
    query: { eventCategoryId?: string; includeCompleted?: boolean } = {},
  ) {
    // ── Verify ownership ──
    const ownerWhere: Record<string, unknown> = { id: eventId };
    if (userRole !== UserRole.ADMIN) {
      ownerWhere.organizerId = userId;
    }

    const event = await this.prisma.event.findFirst({
      where: ownerWhere,
      include: { tournaments: { select: { id: true } } },
    });

    if (!event) {
      throw new ForbiddenException(
        'You do not have permission to access this event',
      );
    }

    const tournamentIds = event.tournaments.map((t) => t.id);

    if (tournamentIds.length === 0) {
      return { data: [] };
    }

    // ── Organizer view: show all matches except CANCELLED ──
    const excludedStatuses: MatchStatus[] = [MatchStatus.CANCELLED];
    if (!query.includeCompleted) {
      excludedStatuses.push(MatchStatus.COMPLETED);
    }

    const matchWhere: Record<string, unknown> = {
      tournamentId: { in: tournamentIds },
      status: { notIn: excludedStatuses },
    };

    if (query.eventCategoryId) {
      matchWhere.eventCategoryId = query.eventCategoryId;
    }

    const matches = await this.prisma.match.findMany({
      where: matchWhere,
      orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
      include: {
        homeTeam: {
          select: { id: true, name: true, shortName: true, logoUrl: true },
        },
        awayTeam: {
          select: { id: true, name: true, shortName: true, logoUrl: true },
        },
        matchScore: true,
        tournament: {
          select: { id: true, name: true, type: true },
        },
        eventCategory: {
          select: { id: true, name: true, sportType: true, gender: true },
        },
      },
    });

    return { data: matches };
  }

  // ─── Public tournament data (single-call, all-in-one) ────────────

  async getPublicTournamentData(slug: string) {
    const event = await this.prisma.event.findFirst({
      where: {
        slug,
        isPublic: true,
        status: { in: this.PUBLIC_STATUSES },
      },
      include: {
        sport: {
          select: { id: true, name: true, slug: true, icon: true },
        },
        organizer: {
          select: { id: true, firstName: true, lastName: true },
        },
        tournaments: {
          select: { id: true, type: true, eventCategoryId: true },
        },
        categories: {
          include: {
            stages: { orderBy: { stageOrder: 'asc' } },
            categoryGroups: { orderBy: { name: 'asc' } },
            categoryTeams: {
              include: {
                team: {
                  select: {
                    id: true,
                    name: true,
                    shortName: true,
                    slug: true,
                    logoUrl: true,
                    city: true,
                  },
                },
                categoryGroup: { select: { id: true, name: true } },
              },
              orderBy: { registeredAt: 'asc' },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!event) {
      throw new NotFoundException(`Event not found`);
    }

    const categoryIds = event.categories.map((c) => c.id);

    // All non-draft/cancelled matches for all categories
    const allMatches = categoryIds.length > 0
      ? await this.prisma.match.findMany({
        where: {
          eventCategoryId: { in: categoryIds },
          status: { notIn: [MatchStatus.DRAFT, MatchStatus.CANCELLED] },
        },
        include: {
          homeTeam: {
            select: { id: true, name: true, shortName: true, logoUrl: true },
          },
          awayTeam: {
            select: { id: true, name: true, shortName: true, logoUrl: true },
          },
          matchScore: true,
        },
        orderBy: [{ scheduledAt: 'asc' }, { createdAt: 'asc' }],
      })
      : [];

    // GOAL events for top scorer calculation
    const matchIds = allMatches.map((m) => m.id);
    const goalEvents = matchIds.length > 0
      ? await this.prisma.matchEvent.findMany({
        where: {
          matchId: { in: matchIds },
          type: MatchEventType.GOAL,
        },
        select: {
          id: true,
          matchId: true,
          player: {
            select: {
              id: true,
              fullName: true,
              photoUrl: true,
              teamId: true,
              team: {
                select: { id: true, name: true, shortName: true, logoUrl: true },
              },
            },
          },
        },
      })
      : [];

    const swissTournaments = event.tournaments.filter((t) => t.type === 'SWISS');
    const swissDataMap = new Map<string, any>();

    if (swissTournaments.length > 0) {
      await Promise.all(
        swissTournaments.map(async (t) => {
          if (!t.eventCategoryId) return;
          const [standings, roundsData] = await Promise.all([
            this.swissSystemService.getStandings(t.id),
            this.swissSystemService.getRounds(t.id),
          ]);
          swissDataMap.set(t.eventCategoryId, {
            standings: standings.data,
            rounds: roundsData.rounds,
          });
        }),
      );
    }

    // Per-category processing
    const GROUP_STAGE_TYPES = ['GROUP', 'SPECIAL_GROUP', 'GROUP_NEIGHBOR', 'LEAGUE'];
    const KNOCKOUT_STAGE_TYPES = ['KNOCKOUT', 'DOUBLE_ELIMINATION'];

    const categories = event.categories.map((cat) => {
      const catMatchIds = new Set(
        allMatches.filter((m) => m.eventCategoryId === cat.id).map((m) => m.id),
      );
      const catMatches = allMatches.filter((m) => catMatchIds.has(m.id));
      const catGoalEvents = goalEvents.filter((ge) => catMatchIds.has(ge.matchId));

      const groupMatches = catMatches.filter((m) => GROUP_STAGE_TYPES.includes(m.stageType ?? ''));
      const knockoutMatches = catMatches.filter((m) => KNOCKOUT_STAGE_TYPES.includes(m.stageType ?? ''));
      const swissMatches = catMatches.filter((m) => m.stageType === 'SWISS');

      const sortedGroupMatches = [...groupMatches].sort((a, b) => {
        const gA = a.groupName ?? '';
        const gB = b.groupName ?? '';
        if (gA !== gB) return gA.localeCompare(gB);
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      });

      const sortedKnockoutMatches = [...knockoutMatches].sort((a, b) => {
        const rA = a.round ?? 999;
        const rB = b.round ?? 999;
        if (rA !== rB) return rA - rB;
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      });

      const sortedSwissMatches = [...swissMatches].sort((a, b) => {
        const rA = a.round ?? 0;
        const rB = b.round ?? 0;
        if (rA !== rB) return rA - rB;
        return new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime();
      });

      // Check if penalty mode is enabled for the group stage
      const groupStage = cat.stages?.find(
        (s) => GROUP_STAGE_TYPES.includes(s.stageType),
      );
      const penaltyEnabled = groupStage?.penaltyEnabled ?? false;

      // Build group standings (default zeros from registrations)
      const groupStandings: Record<string, any[]> = {};

      // Initialize standings rows for all teams in their groups
      if (cat.categoryGroups.length > 0) {
        cat.categoryGroups.forEach((cg) => {
          groupStandings[cg.name] = [];
        });

        cat.categoryTeams.forEach((ct) => {
          const groupName = ct.categoryGroup?.name;
          if (!groupName) return;
          if (!groupStandings[groupName]) groupStandings[groupName] = [];
          groupStandings[groupName].push({
            position: 0,
            teamId: ct.teamId,
            teamName: ct.team.name,
            teamShortName: ct.team.shortName ?? null,
            teamLogoUrl: ct.team.logoUrl ?? null,
            teamSlug: ct.team.slug,
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
          });
        });
      } else if (groupMatches.length > 0) {
        // No category groups (LEAGUE or flat format) — build a single "Klasemen" group
        groupStandings['Klasemen'] = [];
        cat.categoryTeams.forEach((ct) => {
          groupStandings['Klasemen'].push({
            position: 0,
            teamId: ct.teamId,
            teamName: ct.team.name,
            teamShortName: ct.team.shortName ?? null,
            teamLogoUrl: ct.team.logoUrl ?? null,
            teamSlug: ct.team.slug,
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
          });
        });
      }

      // Overlay completed match results (all group stage types)
      groupMatches
        .filter(
          (m) =>
            m.status === MatchStatus.COMPLETED &&
            m.matchScore &&
            m.homeTeamId &&
            m.awayTeamId,
        )
        .forEach((m) => {
          // Find rows — look in the match's groupName first, then fallback to any group
          const groupName = m.groupName ?? 'Klasemen';
          const rows = groupStandings[groupName]
            ?? Object.values(groupStandings).find((r) => r.some((row) => row.teamId === m.homeTeamId));
          if (!rows) return;

          const hs = m.matchScore!.homeScore;
          const as_ = m.matchScore!.awayScore;
          const homeRow = rows.find((r) => r.teamId === m.homeTeamId);
          const awayRow = rows.find((r) => r.teamId === m.awayTeamId);

          if (homeRow) {
            homeRow.played++;
            homeRow.goalsFor += hs;
            homeRow.goalsAgainst += as_;
            homeRow.goalDifference = homeRow.goalsFor - homeRow.goalsAgainst;
          }
          if (awayRow) {
            awayRow.played++;
            awayRow.goalsFor += as_;
            awayRow.goalsAgainst += hs;
            awayRow.goalDifference = awayRow.goalsFor - awayRow.goalsAgainst;
          }

          if (hs > as_) {
            if (homeRow) { homeRow.won++; homeRow.points += 3; }
            if (awayRow) { awayRow.lost++; }
          } else if (hs < as_) {
            if (awayRow) { awayRow.won++; awayRow.points += 3; }
            if (homeRow) { homeRow.lost++; }
          } else {
            // Draw — check penalty
            if (penaltyEnabled && m.isPenaltyUsed) {
              const hPen = m.homePenaltyScore ?? 0;
              const aPen = m.awayPenaltyScore ?? 0;
              if (hPen > aPen) {
                if (homeRow) { homeRow.penaltyWins++; homeRow.points += 2; }
                if (awayRow) { awayRow.penaltyLosses++; awayRow.points += 1; }
              } else if (aPen > hPen) {
                if (awayRow) { awayRow.penaltyWins++; awayRow.points += 2; }
                if (homeRow) { homeRow.penaltyLosses++; homeRow.points += 1; }
              } else {
                if (homeRow) { homeRow.drawn++; homeRow.points += 1; }
                if (awayRow) { awayRow.drawn++; awayRow.points += 1; }
              }
            } else {
              if (homeRow) { homeRow.drawn++; homeRow.points += 1; }
              if (awayRow) { awayRow.drawn++; awayRow.points += 1; }
            }
          }
        });

      // Sort and assign positions
      Object.keys(groupStandings).forEach((groupName) => {
        groupStandings[groupName].sort((a, b) => {
          if (b.points !== a.points) return b.points - a.points;
          if (b.goalDifference !== a.goalDifference)
            return b.goalDifference - a.goalDifference;
          return b.goalsFor - a.goalsFor;
        });
        groupStandings[groupName].forEach((row, i) => {
          row.position = i + 1;
        });
      });

      // Top scorers
      const scorerMap: Record<string, {
        playerId: string;
        playerName: string;
        photoUrl: string | null;
        teamId: string;
        teamName: string;
        teamShortName: string | null;
        teamLogoUrl: string | null;
        goals: number;
      }> = {};

      catGoalEvents.forEach((ge) => {
        if (!ge.player) return;
        const pid = ge.player.id;
        if (!scorerMap[pid]) {
          scorerMap[pid] = {
            playerId: ge.player.id,
            playerName: ge.player.fullName,
            photoUrl: ge.player.photoUrl ?? null,
            teamId: ge.player.teamId,
            teamName: ge.player.team?.name ?? '',
            teamShortName: ge.player.team?.shortName ?? null,
            teamLogoUrl: ge.player.team?.logoUrl ?? null,
            goals: 0,
          };
        }
        scorerMap[pid].goals++;
      });

      const topScorers = Object.values(scorerMap).sort((a, b) => b.goals - a.goals);

      const swissData = swissDataMap.get(cat.id);

      return {
        id: cat.id,
        name: cat.name,
        gender: cat.gender,
        sportType: cat.sportType,
        penaltyEnabled,
        stages: cat.stages.map((s) => ({
          stageOrder: s.stageOrder,
          stageType: s.stageType,
          groupCount: s.groupCount,
          penaltyEnabled: s.penaltyEnabled,
        })),
        categoryGroups: cat.categoryGroups.map((cg) => ({ id: cg.id, name: cg.name })),
        teams: cat.categoryTeams.map((ct) => ({
          teamId: ct.teamId,
          teamName: ct.team.name,
          teamShortName: ct.team.shortName ?? null,
          teamLogoUrl: ct.team.logoUrl ?? null,
          teamSlug: ct.team.slug,
          teamCity: ct.team.city ?? null,
          groupId: ct.groupId ?? null,
          groupName: ct.categoryGroup?.name ?? null,
        })),
        groupStandings,
        swissStandings: swissData?.standings ?? [],
        swissRounds: swissData?.rounds ?? [],
        allMatches: [...sortedGroupMatches, ...sortedKnockoutMatches, ...sortedSwissMatches],
        knockoutMatches: sortedKnockoutMatches,
        topScorers,
      };
    });

    return {
      event: {
        id: event.id,
        name: event.name,
        slug: event.slug,
        status: event.status,
        description: event.description,
        location: event.location,
        venue: event.venue,
        startDate: event.startDate,
        endDate: event.endDate,
        sport: event.sport,
        organizer: event.organizer,
      },
      categories,
    };
  }

}
