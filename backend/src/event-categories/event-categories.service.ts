import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EventStatus, MatchStatus, StageType, UserRole } from '@prisma/client';
import { CreateEventCategoryDto } from './dto/create-event-category.dto';
import { UpdateEventCategoryDto } from './dto/update-event-category.dto';
import { EventCategoryQueryDto } from './dto/event-category-query.dto';
import { buildPaginationMeta } from '../common/dto/pagination.dto';

@Injectable()
export class EventCategoriesService {
  constructor(private readonly prisma: PrismaService) { }

  async create(
    eventId: string,
    dto: CreateEventCategoryDto,
    userId: string,
    userRole: UserRole,
  ) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with id ${eventId} not found`);
    }

    // Only the event organizer or admin can create categories
    if (event.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to create categories for this event',
      );
    }

    // Check uniqueness of name within this event
    const existing = await this.prisma.eventCategory.findUnique({
      where: { eventId_name: { eventId, name: dto.name } },
    });

    if (existing) {
      throw new ConflictException(
        `A category named "${dto.name}" already exists for this event`,
      );
    }

    const category = await this.prisma.eventCategory.create({
      data: {
        name: dto.name,
        eventId,
        sportType: dto.sportType,
        gender: dto.gender,
        maxDateOfBirth: new Date(dto.maxDateOfBirth),
        minDateOfBirth: dto.minDateOfBirth
          ? new Date(dto.minDateOfBirth)
          : null,
        matchDurationMinutes: dto.matchDurationMinutes,
        halfCount: dto.halfCount,
        breakDurationMinutes: dto.breakDurationMinutes ?? 15,
        injuryTimeMinutes: dto.injuryTimeMinutes ?? 0,
      },
    });

    // Build stages from dto.stages[] (preferred) or legacy formatType
    const stageConfigs = this.buildStageConfigs(dto, category.id);

    if (stageConfigs.length > 0) {
      await this.prisma.categoryStage.createMany({ data: stageConfigs });

      // Auto-create a tournament per stage
      for (const stage of stageConfigs) {
        const typeLabel = stage.stageType.toLowerCase();
        const tournamentType =
          stage.stageType === StageType.GROUP
            ? 'GROUP_KNOCKOUT'
            : stage.stageType === StageType.SPECIAL_GROUP
              ? 'GROUP_KNOCKOUT'
              : stage.stageType === StageType.GROUP_NEIGHBOR
                ? 'GROUP_KNOCKOUT'
                : stage.stageType === StageType.LEAGUE
                  ? 'LEAGUE'
                  : stage.stageType === StageType.DOUBLE_ELIMINATION
                    ? 'DOUBLE_ELIMINATION'
                    : stage.stageType === StageType.SWISS
                      ? 'SWISS'
                      : 'KNOCKOUT';

        await this.prisma.tournament.create({
          data: {
            name: `${typeLabel}_${dto.name.toLowerCase().replace(/\s+/g, '_')}`,
            type: tournamentType as any,
            eventId,
            eventCategoryId: category.id,
            config: {
              stageOrder: stage.stageOrder,
              stageType: stage.stageType,
              ...(stage.groupCount ? { groupCount: stage.groupCount } : {}),
              ...(stage.qualifyPerGroup
                ? { qualifyPerGroup: stage.qualifyPerGroup }
                : {}),
              ...((stage as any).settingsJson && Object.keys((stage as any).settingsJson).length > 0
                ? { settingsJson: (stage as any).settingsJson }
                : {}),
            } as any,
          },
        });
      }

      // Auto-create CategoryGroup rows for GROUP stages (linked to the category itself)
      const hasGroupStage = stageConfigs.some(
        (s) => s.stageType === StageType.GROUP || s.stageType === StageType.SPECIAL_GROUP || s.stageType === StageType.GROUP_NEIGHBOR,
      );
      if (hasGroupStage) {
        const groupStageConfig = stageConfigs.find(
          (s) => s.stageType === StageType.GROUP || s.stageType === StageType.SPECIAL_GROUP || s.stageType === StageType.GROUP_NEIGHBOR,
        )!;
        const groupCount = groupStageConfig.groupCount ?? 2;

        // Check for existing groups (avoid duplicates)
        const existingGroups = await this.prisma.categoryGroup.findMany({
          where: { categoryId: category.id },
          select: { name: true },
        });
        const existingNames = new Set(existingGroups.map((g) => g.name));

        const groupsToCreate = Array.from({ length: groupCount }, (_, i) => ({
          categoryId: category.id,
          name: `Group ${String.fromCharCode(65 + i)}`,
        })).filter((g) => !existingNames.has(g.name));

        if (groupsToCreate.length > 0) {
          await this.prisma.categoryGroup.createMany({ data: groupsToCreate });
        }
      }
    }

    return this.prisma.eventCategory.findUnique({
      where: { id: category.id },
      include: {
        stages: { orderBy: { stageOrder: 'asc' } },
        tournaments: { orderBy: { createdAt: 'asc' } },
        categoryGroups: { orderBy: { name: 'asc' } },
      },
    });
  }

  private buildStageConfigs(
    dto: CreateEventCategoryDto,
    categoryId: string,
  ) {
    // Prefer explicit stages[] array
    if (dto.stages && dto.stages.length > 0) {
      return dto.stages.map((s) => ({
        categoryId,
        stageOrder: s.stageOrder,
        stageType: s.stageType as StageType,
        groupCount: s.groupCount ?? null,
        qualifyPerGroup: s.qualifyPerGroup ?? null,
        matchPerTeam: s.matchPerTeam ?? null,
        penaltyEnabled: s.stageType === 'KNOCKOUT' ? true : (s.penaltyEnabled ?? false),
        settingsJson: (s.settingsJson ?? {}) as any,
      }));
    }

    // Legacy: formatType shorthand
    if (dto.formatType) {
      if (dto.formatType === 'GROUP_KNOCKOUT') {
        return [
          {
            categoryId,
            stageOrder: 1,
            stageType: StageType.GROUP,
            groupCount: dto.groupCount ?? 2,
            qualifyPerGroup: dto.qualifyPerGroup ?? 2,
            settingsJson: {} as any,
          },
          {
            categoryId,
            stageOrder: 2,
            stageType: StageType.KNOCKOUT,
            groupCount: null,
            qualifyPerGroup: null,
            settingsJson: {} as any,
          },
        ];
      }
      return [
        {
          categoryId,
          stageOrder: 1,
          stageType: StageType.KNOCKOUT,
          groupCount: null,
          qualifyPerGroup: null,
          settingsJson: {} as any,
        },
      ];
    }

    return [];
  }

  async findAll(query: EventCategoryQueryDto) {
    const where: Record<string, unknown> = {};

    if (query.eventId) where.eventId = query.eventId;
    if (query.sportType) where.sportType = query.sportType;
    if (query.gender) where.gender = query.gender;

    const [categories, total] = await Promise.all([
      this.prisma.eventCategory.findMany({
        where,
        skip: query.skip,
        take: query.limit,
        orderBy: query.orderBy,
      }),
      this.prisma.eventCategory.count({ where }),
    ]);

    return {
      data: categories,
      meta: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  async findById(id: string) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id },
      include: {
        event: { select: { id: true, name: true, organizerId: true } },
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
        _count: { select: { matches: true, categoryTeams: true } },
      },
    });

    if (!category) {
      throw new NotFoundException(`Event category with id ${id} not found`);
    }

    return category;
  }

  async update(
    id: string,
    dto: UpdateEventCategoryDto,
    userId: string,
    userRole: UserRole,
  ) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id },
      include: {
        event: { select: { organizerId: true } },
      },
    });

    if (!category) {
      throw new NotFoundException(`Event category with id ${id} not found`);
    }

    if (
      category.event.organizerId !== userId &&
      userRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'You do not have permission to update this category',
      );
    }

    // If name is changing, check uniqueness within the event
    if (dto.name && dto.name !== category.name) {
      const duplicate = await this.prisma.eventCategory.findUnique({
        where: {
          eventId_name: { eventId: category.eventId, name: dto.name },
        },
      });

      if (duplicate && duplicate.id !== id) {
        throw new ConflictException(
          `A category named "${dto.name}" already exists for this event`,
        );
      }
    }

    const data: Record<string, unknown> = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.sportType !== undefined) data.sportType = dto.sportType;
    if (dto.gender !== undefined) data.gender = dto.gender;
    if (dto.maxDateOfBirth !== undefined)
      data.maxDateOfBirth = new Date(dto.maxDateOfBirth);
    if (dto.minDateOfBirth !== undefined)
      data.minDateOfBirth = dto.minDateOfBirth
        ? new Date(dto.minDateOfBirth)
        : null;
    if (dto.matchDurationMinutes !== undefined)
      data.matchDurationMinutes = dto.matchDurationMinutes;
    if (dto.halfCount !== undefined) data.halfCount = dto.halfCount;
    if (dto.breakDurationMinutes !== undefined)
      data.breakDurationMinutes = dto.breakDurationMinutes;
    if (dto.injuryTimeMinutes !== undefined)
      data.injuryTimeMinutes = dto.injuryTimeMinutes;

    await this.prisma.eventCategory.update({
      where: { id },
      data,
    });

    // If stages are provided, rebuild stage config (delete-and-recreate)
    if (dto.stages !== undefined && dto.stages.length > 0) {
      // Block if any "started" matches exist (not DRAFT/CANCELLED/SCHEDULED/PUBLISHED)
      const startedMatchCount = await this.prisma.match.count({
        where: {
          eventCategoryId: id,
          status: {
            notIn: [
              MatchStatus.DRAFT,
              MatchStatus.CANCELLED,
              MatchStatus.SCHEDULED,
              MatchStatus.PUBLISHED,
            ],
          },
        },
      });

      if (startedMatchCount > 0) {
        throw new BadRequestException(
          'Stage tidak bisa diubah karena pertandingan sudah dimulai',
        );
      }

      // Delete existing stages/groups/tournaments (preserving teams)
      await this.prisma.$transaction([
        this.prisma.tournament.deleteMany({ where: { eventCategoryId: id } }),
        this.prisma.categoryStage.deleteMany({ where: { categoryId: id } }),
        this.prisma.categoryGroup.deleteMany({ where: { categoryId: id } }),
      ]);

      // Recreate stages
      const stageConfigs = dto.stages.map((s) => ({
        categoryId: id,
        stageOrder: s.stageOrder,
        stageType: s.stageType as StageType,
        groupCount: s.groupCount ?? null,
        qualifyPerGroup: s.qualifyPerGroup ?? null,
        settingsJson: (s.settingsJson ?? {}) as any,
      }));
      await this.prisma.categoryStage.createMany({ data: stageConfigs });

      // Auto-create a tournament per stage (mirrors create() logic)
      for (const stage of stageConfigs) {
        const typeLabel = stage.stageType.toLowerCase();
        const tournamentType =
          stage.stageType === StageType.GROUP
            ? 'GROUP_KNOCKOUT'
            : stage.stageType === StageType.SPECIAL_GROUP
              ? 'GROUP_KNOCKOUT'
              : stage.stageType === StageType.GROUP_NEIGHBOR
                ? 'GROUP_KNOCKOUT'
                : stage.stageType === StageType.LEAGUE
                  ? 'LEAGUE'
                  : stage.stageType === StageType.DOUBLE_ELIMINATION
                    ? 'DOUBLE_ELIMINATION'
                    : stage.stageType === StageType.SWISS
                      ? 'SWISS'
                      : 'KNOCKOUT';

        await this.prisma.tournament.create({
          data: {
            name: `${typeLabel}_${category.name.toLowerCase().replace(/\s+/g, '_')}`,
            type: tournamentType as any,
            eventId: category.eventId,
            eventCategoryId: id,
            config: {
              stageOrder: stage.stageOrder,
              stageType: stage.stageType,
              ...(stage.groupCount ? { groupCount: stage.groupCount } : {}),
              ...(stage.qualifyPerGroup
                ? { qualifyPerGroup: stage.qualifyPerGroup }
                : {}),
              ...(stage.settingsJson && Object.keys(stage.settingsJson).length > 0
                ? { settingsJson: stage.settingsJson }
                : {}),
            } as any,
          },
        });
      }

      // Auto-create CategoryGroups for GROUP stages
      const groupStage = stageConfigs.find(
        (s) => s.stageType === StageType.GROUP || s.stageType === StageType.SPECIAL_GROUP || s.stageType === StageType.GROUP_NEIGHBOR,
      );
      if (groupStage) {
        const groupCount = groupStage.groupCount ?? 2;
        await this.prisma.categoryGroup.createMany({
          data: Array.from({ length: groupCount }, (_, i) => ({
            categoryId: id,
            name: `Group ${String.fromCharCode(65 + i)}`,
          })),
        });
      }
    }

    // Re-fetch and return with stages
    return this.prisma.eventCategory.findUnique({
      where: { id },
      include: {
        stages: { orderBy: { stageOrder: 'asc' } },
        categoryGroups: { orderBy: { name: 'asc' } },
        _count: { select: { categoryTeams: true, matches: true } },
      },
    });
  }

  async delete(id: string, userId: string, userRole: UserRole) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id },
      include: {
        event: { select: { organizerId: true } },
        _count: { select: { matches: true } },
      },
    });

    if (!category) {
      throw new NotFoundException(`Event category with id ${id} not found`);
    }

    if (
      category.event.organizerId !== userId &&
      userRole !== UserRole.ADMIN
    ) {
      throw new ForbiddenException(
        'You do not have permission to delete this category',
      );
    }

    if (category._count.matches > 0) {
      throw new ConflictException(
        'Cannot delete a category that has matches assigned to it',
      );
    }

    await this.prisma.eventCategory.delete({ where: { id } });

    return { message: 'Category deleted successfully' };
  }

  async getEventCategories(eventId: string) {
    const event = await this.prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new NotFoundException(`Event with id ${eventId} not found`);
    }

    const categories = await this.prisma.eventCategory.findMany({
      where: { eventId },
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
        _count: { select: { categoryTeams: true, matches: true } },
      },
      orderBy: { createdAt: 'asc' },
    });

    return { data: categories };
  }

  // ── Team Management Methods ──

  async getCategoryTeams(categoryId: string) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Event category with id ${categoryId} not found`);
    }

    const categoryTeams = await this.prisma.eventCategoryTeam.findMany({
      where: { eventCategoryId: categoryId },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
            logoUrl: true,
            city: true,
            country: true,
          },
        },
        categoryGroup: { select: { id: true, name: true } },
      },
      orderBy: { registeredAt: 'asc' },
    });

    return { data: categoryTeams };
  }

  async addTeamToCategory(
    categoryId: string,
    teamId: string,
    userId: string,
    userRole: UserRole,
    groupId?: string,
  ) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id: categoryId },
      include: {
        event: { select: { organizerId: true } },
        stages: { where: { stageType: StageType.GROUP } },
      },
    });

    if (!category) {
      throw new NotFoundException(`Event category with id ${categoryId} not found`);
    }

    if (category.event.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to add teams to this category',
      );
    }

    const team = await this.prisma.team.findUnique({ where: { id: teamId } });
    if (!team) {
      throw new NotFoundException(`Team with id ${teamId} not found`);
    }

    const existing = await this.prisma.eventCategoryTeam.findUnique({
      where: { eventCategoryId_teamId: { eventCategoryId: categoryId, teamId } },
    });
    if (existing) {
      throw new ConflictException('This team is already registered for this category');
    }

    const hasGroupStage = category.stages.length > 0;

    if (hasGroupStage) {
      if (!groupId) {
        throw new BadRequestException(
          'This category uses group stages. Please select a group for the team.',
        );
      }
      // Validate group belongs to this category
      const group = await this.prisma.categoryGroup.findFirst({
        where: { id: groupId, categoryId },
      });
      if (!group) {
        throw new BadRequestException('Invalid group for this category');
      }
    }

    const categoryTeam = await this.prisma.eventCategoryTeam.create({
      data: {
        eventCategoryId: categoryId,
        teamId,
        groupId: hasGroupStage ? groupId : null,
      },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
            logoUrl: true,
            city: true,
            country: true,
          },
        },
        categoryGroup: { select: { id: true, name: true } },
      },
    });

    return categoryTeam;
  }

  async removeTeamFromCategory(
    categoryId: string,
    teamId: string,
    userId: string,
    userRole: UserRole,
  ) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id: categoryId },
      include: {
        event: { select: { organizerId: true } },
      },
    });

    if (!category) {
      throw new NotFoundException(`Event category with id ${categoryId} not found`);
    }

    if (category.event.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to remove teams from this category',
      );
    }

    const categoryTeam = await this.prisma.eventCategoryTeam.findUnique({
      where: { eventCategoryId_teamId: { eventCategoryId: categoryId, teamId } },
    });

    if (!categoryTeam) {
      throw new NotFoundException('Team is not registered for this category');
    }

    await this.prisma.eventCategoryTeam.delete({
      where: { eventCategoryId_teamId: { eventCategoryId: categoryId, teamId } },
    });

    return { message: 'Team removed from category' };
  }

  async registerTeam(
    categoryId: string,
    teamId: string,
    userId: string,
  ) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id: categoryId },
      include: {
        event: { select: { id: true, status: true } },
      },
    });

    if (!category) {
      throw new NotFoundException(`Event category with id ${categoryId} not found`);
    }

    if (
      category.event.status !== EventStatus.DRAFT &&
      category.event.status !== EventStatus.PUBLISHED
    ) {
      throw new BadRequestException(
        'Team registration is only allowed for draft or published events',
      );
    }

    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
    });

    if (!team) {
      throw new NotFoundException(`Team with id ${teamId} not found`);
    }

    if (team.managerId !== userId) {
      throw new ForbiddenException(
        'You can only register teams that you manage',
      );
    }

    const existing = await this.prisma.eventCategoryTeam.findUnique({
      where: { eventCategoryId_teamId: { eventCategoryId: categoryId, teamId } },
    });

    if (existing) {
      throw new ConflictException(
        'This team is already registered for this category',
      );
    }

    const categoryTeam = await this.prisma.eventCategoryTeam.create({
      data: { eventCategoryId: categoryId, teamId },
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

    return categoryTeam;
  }

  // ── Standings (computed from match results) ──

  async getCategoryStandings(categoryId: string) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id: categoryId },
      include: {
        stages: { orderBy: { stageOrder: 'asc' } },
      },
    });

    if (!category) {
      throw new NotFoundException(
        `Event category with id ${categoryId} not found`,
      );
    }

    // Check if penalty mode is enabled for the group stage
    const groupStage = category.stages?.find(
      (s) => s.stageType === StageType.GROUP || s.stageType === StageType.SPECIAL_GROUP || s.stageType === StageType.GROUP_NEIGHBOR,
    );
    const penaltyEnabled = groupStage?.penaltyEnabled ?? false;

    const matches = await this.prisma.match.findMany({
      where: {
        eventCategoryId: categoryId,
        status: MatchStatus.COMPLETED,
      },
      include: { matchScore: true },
    });

    // Build standings map keyed by teamId
    const map = new Map<
      string,
      {
        teamId: string;
        played: number;
        win: number;
        draw: number;
        lose: number;
        goalsFor: number;
        goalsAgainst: number;
        penaltyWins: number;
        penaltyLosses: number;
      }
    >();

    const ensure = (teamId: string) => {
      if (!map.has(teamId)) {
        map.set(teamId, {
          teamId,
          played: 0,
          win: 0,
          draw: 0,
          lose: 0,
          goalsFor: 0,
          goalsAgainst: 0,
          penaltyWins: 0,
          penaltyLosses: 0,
        });
      }
      return map.get(teamId)!;
    };

    for (const match of matches) {
      if (!match.matchScore) continue;

      const home = ensure(match.homeTeamId);
      const away = ensure(match.awayTeamId);
      const hs = match.matchScore.homeScore;
      const as_ = match.matchScore.awayScore;

      home.played++;
      away.played++;
      home.goalsFor += hs;
      home.goalsAgainst += as_;
      away.goalsFor += as_;
      away.goalsAgainst += hs;

      if (hs > as_) {
        home.win++;
        away.lose++;
      } else if (hs < as_) {
        away.win++;
        home.lose++;
      } else {
        // Draw in regular time
        if (penaltyEnabled && match.isPenaltyUsed) {
          // Penalty shootout determines winner
          const hPen = match.homePenaltyScore ?? 0;
          const aPen = match.awayPenaltyScore ?? 0;
          if (hPen > aPen) {
            home.penaltyWins++;
            away.penaltyLosses++;
          } else if (aPen > hPen) {
            away.penaltyWins++;
            home.penaltyLosses++;
          } else {
            home.draw++;
            away.draw++;
          }
        } else {
          home.draw++;
          away.draw++;
        }
      }
    }

    // Convert to sorted array
    // Penalty-aware points: Win=3, PenWin=2, Draw=1, PenLoss=1, Loss=0
    const standings = Array.from(map.values())
      .map((s) => ({
        ...s,
        goalDiff: s.goalsFor - s.goalsAgainst,
        points: penaltyEnabled
          ? s.win * 3 + s.penaltyWins * 2 + s.draw + s.penaltyLosses
          : s.win * 3 + s.draw,
      }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.goalDiff !== a.goalDiff) return b.goalDiff - a.goalDiff;
        return b.goalsFor - a.goalsFor;
      });

    // Fetch team details
    const teamIds = standings.map((s) => s.teamId);
    const teams = await this.prisma.team.findMany({
      where: { id: { in: teamIds } },
      select: {
        id: true,
        name: true,
        shortName: true,
        slug: true,
        logoUrl: true,
      },
    });
    const teamMap = new Map(teams.map((t) => [t.id, t]));

    return {
      penaltyEnabled,
      data: standings.map((s, i) => ({
        position: i + 1,
        team: teamMap.get(s.teamId) || null,
        ...s,
      })),
    };
  }

  // ── Bracket (matches grouped by round) ──

  async getCategoryBracket(categoryId: string) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(
        `Event category with id ${categoryId} not found`,
      );
    }

    const matches = await this.prisma.match.findMany({
      where: {
        eventCategoryId: categoryId,
        round: { not: null },
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
      orderBy: [{ bracket: 'asc' }, { round: 'asc' }, { matchIndex: 'asc' }],
    });

    // Check if this is a double elimination bracket
    const hasDoubleElim = matches.some((m) => m.bracket != null);

    if (hasDoubleElim) {
      // Structured double elimination response
      const upper: Record<number, typeof matches> = {};
      const lower: Record<number, typeof matches> = {};
      let grandFinal: typeof matches[0] | null = null;
      let resetFinal: typeof matches[0] | null = null;

      for (const match of matches) {
        if (match.bracket === 'UPPER') {
          const r = match.round!;
          if (!upper[r]) upper[r] = [];
          upper[r].push(match);
        } else if (match.bracket === 'LOWER') {
          const r = match.round!;
          if (!lower[r]) lower[r] = [];
          lower[r].push(match);
        } else if (match.bracket === 'GRAND_FINAL') {
          grandFinal = match;
        } else if (match.bracket === 'RESET_FINAL') {
          resetFinal = match;
        }
      }

      // Get seeding
      const seeding = await this.prisma.eventCategoryTeam.findMany({
        where: { eventCategoryId: categoryId },
        include: {
          team: {
            select: { id: true, name: true, shortName: true, logoUrl: true },
          },
        },
        orderBy: { seed: 'asc' },
      });

      return {
        type: 'DOUBLE_ELIMINATION',
        data: {
          upper,
          lower,
          grandFinal,
          resetFinal,
          seeding: seeding.map((s) => ({
            seed: s.seed,
            team: s.team,
          })),
        },
      };
    }

    // Legacy: group by round (for knockout / league)
    const rounds: Record<number, typeof matches> = {};
    for (const match of matches) {
      const round = match.round!;
      if (!rounds[round]) rounds[round] = [];
      rounds[round].push(match);
    }

    return { type: 'STANDARD', data: rounds };
  }

  // ── Stages ──

  async getCategoryStages(categoryId: string) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(
        `Event category with id ${categoryId} not found`,
      );
    }

    const stages = await this.prisma.categoryStage.findMany({
      where: { categoryId },
      orderBy: { stageOrder: 'asc' },
    });

    return { data: stages };
  }

  // ── Category Groups (for dropdown when adding team) ──

  async getStageGroups(categoryId: string) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id: categoryId },
    });

    if (!category) {
      throw new NotFoundException(`Event category with id ${categoryId} not found`);
    }

    const groups = await this.prisma.categoryGroup.findMany({
      where: { categoryId },
      orderBy: { name: 'asc' },
    });

    return { data: groups };
  }

  async generateGroupFixtures(
    categoryId: string,
    userId: string,
    userRole: UserRole,
  ) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id: categoryId },
      include: {
        event: { select: { id: true, organizerId: true } },
        stages: { orderBy: { stageOrder: 'asc' } },
        categoryTeams: { select: { teamId: true }, orderBy: { seed: 'asc' } },
      },
    });

    if (!category) {
      throw new NotFoundException(`Event category with id ${categoryId} not found`);
    }

    if (category.event.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('You do not have permission');
    }

    const groupStage = category.stages.find(
      (s) => s.stageType === StageType.GROUP || s.stageType === StageType.SPECIAL_GROUP || s.stageType === StageType.GROUP_NEIGHBOR,
    );
    if (!groupStage) {
      throw new BadRequestException('No GROUP, SPECIAL_GROUP, or GROUP_NEIGHBOR stage found for this category');
    }

    const isSpecialGroup = groupStage.stageType === StageType.SPECIAL_GROUP;
    const isNeighborGroup = groupStage.stageType === StageType.GROUP_NEIGHBOR;

    // Find the tournament linked to this group stage
    const tournament = await this.prisma.tournament.findFirst({
      where: {
        eventCategoryId: categoryId,
        config: { path: ['stageType'], equals: isNeighborGroup ? 'GROUP_NEIGHBOR' : isSpecialGroup ? 'SPECIAL_GROUP' : 'GROUP' },
      },
    });

    if (!tournament) {
      throw new BadRequestException('No tournament found for the group stage');
    }

    // Check no matches exist yet for this tournament
    const existingMatches = await this.prisma.match.count({
      where: { tournamentId: tournament.id },
    });

    if (existingMatches > 0) {
      throw new BadRequestException('Matches already generated for this group stage');
    }

    // Load category teams with their assigned CategoryGroup
    const categoryTeamsWithGroup = await this.prisma.eventCategoryTeam.findMany({
      where: { eventCategoryId: categoryId },
      include: { categoryGroup: true },
    });

    if (categoryTeamsWithGroup.length < 2) {
      throw new BadRequestException('At least 2 teams required');
    }

    // Verify all teams have a group assigned
    const unassigned = categoryTeamsWithGroup.filter((ct) => !ct.groupId);
    if (unassigned.length > 0) {
      throw new BadRequestException(
        `${unassigned.length} team(s) are not assigned to a group. Assign all teams to groups before generating matches.`,
      );
    }

    // Build group → [teamIds] map
    const groupMap = new Map<string, { groupId: string; groupName: string; teamIds: string[] }>();
    for (const ct of categoryTeamsWithGroup) {
      if (!groupMap.has(ct.groupId!)) {
        groupMap.set(ct.groupId!, {
          groupId: ct.groupId!,
          groupName: ct.categoryGroup!.name,
          teamIds: [],
        });
      }
      groupMap.get(ct.groupId!)!.teamIds.push(ct.teamId);
    }

    const groups = Array.from(groupMap.values()).sort((a, b) =>
      a.groupName.localeCompare(b.groupName),
    );

    // Generate round-robin matches per group
    const baseDate = new Date();
    let dayOffset = 0;
    const matchData: {
      tournamentId: string;
      homeTeamId: string;
      awayTeamId: string;
      eventCategoryId: string;
      stageType: string;
      groupId: string;
      groupName: string;
      matchDay: number;
      scheduledAt: Date;
      status: MatchStatus;
    }[] = [];

    for (const group of groups) {
      const teamList = group.teamIds;

      if (isNeighborGroup) {
        // ── GROUP_NEIGHBOR: circular neighbor pairing ──
        // Each team plays only its immediate neighbors (above + below, wrapping around)
        const n = teamList.length;
        let matchDay = 0;
        const usedPairs = new Set<string>();

        for (let i = 0; i < n; i++) {
          const neighbors = [
            teamList[(i - 1 + n) % n], // team above (wraps to last)
            teamList[(i + 1) % n],     // team below (wraps to first)
          ];

          for (const neighbor of neighbors) {
            const pairKey = [teamList[i], neighbor].sort().join(':');
            if (usedPairs.has(pairKey)) continue;
            usedPairs.add(pairKey);

            matchDay++;
            dayOffset++;
            matchData.push({
              tournamentId: tournament.id,
              homeTeamId: teamList[i],
              awayTeamId: neighbor,
              eventCategoryId: categoryId,
              stageType: 'GROUP_NEIGHBOR',
              groupId: group.groupId,
              groupName: group.groupName,
              matchDay,
              scheduledAt: new Date(baseDate.getTime() + dayOffset * 86400000),
              status: MatchStatus.PUBLISHED,
            });
          }
        }
      } else if (isSpecialGroup && groupStage.matchPerTeam) {
        // ── Special Group: limited matches per team via rotation pairing ──
        const matchPerTeam = groupStage.matchPerTeam;
        const maxMatches = Math.min(matchPerTeam, teamList.length - 1);

        const matchCountMap = new Map<string, number>();
        for (const id of teamList) matchCountMap.set(id, 0);

        const usedPairs = new Set<string>();
        const teams = [...teamList];
        const hasBye = teams.length % 2 !== 0;
        if (hasBye) teams.push('BYE');

        const teamCount = teams.length;
        const totalRounds = teamCount - 1;
        const matchesPerRound = teamCount / 2;
        const fixed = teams[teamCount - 1];
        const rotating = teams.slice(0, teamCount - 1);

        let matchDay = 0;

        for (let round = 0; round < totalRounds; round++) {
          const current = [...rotating];
          const pairings: [string, string][] = [];

          if (round % 2 === 0) {
            pairings.push([fixed, current[0]]);
          } else {
            pairings.push([current[0], fixed]);
          }

          for (let i = 1; i < matchesPerRound; i++) {
            const home = current[i];
            const away = current[current.length - i];
            pairings.push([home, away]);
          }

          for (const [home, away] of pairings) {
            if (home === 'BYE' || away === 'BYE') continue;

            const hc = matchCountMap.get(home)!;
            const ac = matchCountMap.get(away)!;
            if (hc >= maxMatches || ac >= maxMatches) continue;

            const pairKey = [home, away].sort().join(':');
            if (usedPairs.has(pairKey)) continue;

            usedPairs.add(pairKey);
            matchCountMap.set(home, hc + 1);
            matchCountMap.set(away, ac + 1);

            matchDay++;
            dayOffset++;
            matchData.push({
              tournamentId: tournament.id,
              homeTeamId: home,
              awayTeamId: away,
              eventCategoryId: categoryId,
              stageType: isNeighborGroup ? 'GROUP_NEIGHBOR' : 'SPECIAL_GROUP',
              groupId: group.groupId,
              groupName: group.groupName,
              matchDay,
              scheduledAt: new Date(baseDate.getTime() + dayOffset * 86400000),
              status: MatchStatus.PUBLISHED,
            });
          }

          const last = rotating.pop()!;
          rotating.unshift(last);
        }
      } else {
        // ── Standard: full round-robin ──
        let matchDay = 0;
        for (let i = 0; i < teamList.length; i++) {
          for (let j = i + 1; j < teamList.length; j++) {
            matchDay++;
            dayOffset++;
            matchData.push({
              tournamentId: tournament.id,
              homeTeamId: teamList[i],
              awayTeamId: teamList[j],
              eventCategoryId: categoryId,
              stageType: isNeighborGroup ? 'GROUP_NEIGHBOR' : isSpecialGroup ? 'SPECIAL_GROUP' : 'GROUP',
              groupId: group.groupId,
              groupName: group.groupName,
              matchDay,
              scheduledAt: new Date(baseDate.getTime() + dayOffset * 86400000),
              status: MatchStatus.PUBLISHED,
            });
          }
        }
      }
    }

    console.log(`[generateGroupFixtures] stageType=${groupStage.stageType} groups=${groups.length} totalMatches=${matchData.length}`);
    for (const g of groups) {
      const groupMatches = matchData.filter(m => m.groupId === g.groupId);
      console.log(`  Group "${g.groupName}": ${g.teamIds.length} teams, ${groupMatches.length} matches`);
    }

    await this.prisma.match.createMany({ data: matchData });

    // Update stage status
    await this.prisma.categoryStage.update({
      where: { id: groupStage.id },
      data: { status: 'IN_PROGRESS' },
    });

    return {
      groups: groups.length,
      totalMatches: matchData.length,
      matchesPerGroup: groups.map((g) => ({
        group: g.groupName,
        teams: g.teamIds.length,
        matches: (g.teamIds.length * (g.teamIds.length - 1)) / 2,
      })),
    };
  }

  async advanceToKnockout(
    categoryId: string,
    userId: string,
    userRole: UserRole,
  ) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id: categoryId },
      include: {
        event: { select: { organizerId: true } },
        stages: { orderBy: { stageOrder: 'asc' } },
      },
    });

    if (!category) {
      throw new NotFoundException(
        `Event category with id ${categoryId} not found`,
      );
    }

    if (category.event.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException(
        'You do not have permission to advance stages for this category',
      );
    }

    // Find group stage and knockout stage
    const groupStage = category.stages.find(
      (s) => s.stageType === StageType.GROUP,
    );
    const knockoutStage = category.stages.find(
      (s) => s.stageType === StageType.KNOCKOUT,
    );

    if (!groupStage || !knockoutStage) {
      throw new BadRequestException(
        'Category must have both GROUP and KNOCKOUT stages',
      );
    }

    if (groupStage.status === 'COMPLETED') {
      throw new BadRequestException('Group stage is already completed');
    }

    // Check all group matches are completed (use stageType field)
    const pendingGroupMatches = await this.prisma.match.count({
      where: {
        eventCategoryId: categoryId,
        stageType: 'GROUP',
        status: { notIn: [MatchStatus.COMPLETED, MatchStatus.CANCELLED] },
      },
    });

    if (pendingGroupMatches > 0) {
      throw new BadRequestException(
        `${pendingGroupMatches} group match(es) not yet completed`,
      );
    }

    // Get standings to determine qualified teams
    const standingsResult = await this.getCategoryStandings(categoryId);
    const standings = standingsResult.data;

    // Map teamId → groupName using match.groupName
    const groupMatches = await this.prisma.match.findMany({
      where: {
        eventCategoryId: categoryId,
        stageType: 'GROUP',
        status: MatchStatus.COMPLETED,
      },
      select: { homeTeamId: true, awayTeamId: true, groupName: true },
    });

    const teamGroup = new Map<string, string>();
    for (const m of groupMatches) {
      if (m.groupName) {
        teamGroup.set(m.homeTeamId, m.groupName);
        teamGroup.set(m.awayTeamId, m.groupName);
      }
    }

    // Separate standings by group
    const standingsByGroup = new Map<string, typeof standings>();
    for (const s of standings) {
      const group = teamGroup.get(s.teamId) || 'default';
      if (!standingsByGroup.has(group)) standingsByGroup.set(group, []);
      standingsByGroup.get(group)!.push(s);
    }

    // Pick top N from each group
    const qualifyPerGroup = groupStage.qualifyPerGroup ?? 2;
    const qualifiedTeams: string[] = [];
    const sortedGroups = Array.from(standingsByGroup.keys()).sort();

    for (const group of sortedGroups) {
      const groupStandings = standingsByGroup.get(group)!;
      const topTeams = groupStandings.slice(0, qualifyPerGroup);
      qualifiedTeams.push(...topTeams.map((s) => s.teamId));
    }

    if (qualifiedTeams.length < 2) {
      throw new BadRequestException(
        'Not enough qualified teams to create knockout matches',
      );
    }

    // Find the tournament linked to this category
    const tournament = await this.prisma.tournament.findFirst({
      where: { eventCategoryId: categoryId },
    });

    if (!tournament) {
      throw new BadRequestException(
        'No tournament linked to this category',
      );
    }

    // Generate knockout bracket
    const matchups: { homeTeamId: string; awayTeamId: string }[] = [];

    if (sortedGroups.length >= 2 && qualifyPerGroup <= 4) {
      // Cross-group pairing
      const groupA = standingsByGroup.get(sortedGroups[0])!.slice(0, qualifyPerGroup);
      const groupB = standingsByGroup.get(sortedGroups[1])!.slice(0, qualifyPerGroup);

      for (let i = 0; i < Math.min(groupA.length, groupB.length); i++) {
        matchups.push({
          homeTeamId: groupA[i].teamId,
          awayTeamId: groupB[groupB.length - 1 - i].teamId,
        });
      }

      // Handle more than 2 groups
      for (let g = 2; g < sortedGroups.length; g += 2) {
        const gA = standingsByGroup.get(sortedGroups[g])!.slice(0, qualifyPerGroup);
        const gB = g + 1 < sortedGroups.length
          ? standingsByGroup.get(sortedGroups[g + 1])!.slice(0, qualifyPerGroup)
          : gA;

        if (gB !== gA) {
          for (let i = 0; i < Math.min(gA.length, gB.length); i++) {
            matchups.push({
              homeTeamId: gA[i].teamId,
              awayTeamId: gB[gB.length - 1 - i].teamId,
            });
          }
        }
      }
    } else {
      // Single group or fallback: sequential pairing
      for (let i = 0; i < qualifiedTeams.length - 1; i += 2) {
        matchups.push({
          homeTeamId: qualifiedTeams[i],
          awayTeamId: qualifiedTeams[i + 1],
        });
      }
    }

    // Determine round numbers
    const totalFirst = matchups.length;
    let totalRounds = 1;
    let n = totalFirst;
    while (n > 1) {
      n = Math.ceil(n / 2);
      totalRounds++;
    }

    // Create first-round knockout matches
    const baseDate = new Date();
    const matchData = matchups.map((m, i) => ({
      tournamentId: tournament.id,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      eventCategoryId: categoryId,
      stageType: 'KNOCKOUT',
      round: 1,
      scheduledAt: new Date(baseDate.getTime() + (i + 1) * 86400000),
      status: MatchStatus.SCHEDULED as MatchStatus,
    }));

    await this.prisma.match.createMany({ data: matchData });

    // Mark group stage as completed, knockout as IN_PROGRESS
    await this.prisma.categoryStage.update({
      where: { id: groupStage.id },
      data: { status: 'COMPLETED' },
    });
    await this.prisma.categoryStage.update({
      where: { id: knockoutStage.id },
      data: { status: 'IN_PROGRESS' },
    });

    return {
      qualifiedTeams: qualifiedTeams.length,
      knockoutMatches: matchups.length,
      totalRounds,
    };
  }

  // ── Category Control Center: Seeding ──

  async updateSeeding(
    categoryId: string,
    teamIds: string[],
    userId: string,
    userRole: UserRole,
  ) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id: categoryId },
      include: { event: { select: { organizerId: true } } },
    });

    if (!category) throw new NotFoundException(`Category ${categoryId} not found`);
    if (category.event.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('No permission');
    }

    const updates = teamIds.map((teamId, index) =>
      this.prisma.eventCategoryTeam.updateMany({
        where: { eventCategoryId: categoryId, teamId },
        data: { seed: index + 1 },
      }),
    );
    await Promise.all(updates);

    return { success: true, count: teamIds.length };
  }

  // ── Category Control Center: Assign team to group ──

  async assignTeamGroup(
    categoryId: string,
    teamId: string,
    groupId: string | null,
    userId: string,
    userRole: UserRole,
  ) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id: categoryId },
      include: { event: { select: { organizerId: true } } },
    });

    if (!category) throw new NotFoundException(`Category ${categoryId} not found`);
    if (category.event.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('No permission');
    }

    // Validate group belongs to this category
    if (groupId) {
      const group = await this.prisma.categoryGroup.findFirst({
        where: { id: groupId, categoryId },
      });
      if (!group) throw new NotFoundException('Group not found in this category');
    }

    await this.prisma.eventCategoryTeam.updateMany({
      where: { eventCategoryId: categoryId, teamId },
      data: { groupId },
    });

    return { success: true };
  }

  // ── Category Control Center: Bulk schedule matches ──

  async bulkScheduleMatches(
    categoryId: string,
    updates: { matchId: string; scheduledAt?: string; venue?: string; matchDay?: number }[],
    userId: string,
    userRole: UserRole,
  ) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id: categoryId },
      include: { event: { select: { organizerId: true } } },
    });

    if (!category) throw new NotFoundException(`Category ${categoryId} not found`);
    if (category.event.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('No permission');
    }

    const ops = updates.map((u) => {
      const data: Record<string, unknown> = {};
      if (u.scheduledAt) data.scheduledAt = new Date(u.scheduledAt);
      if (u.venue !== undefined) data.venue = u.venue;
      if (u.matchDay !== undefined) data.matchDay = u.matchDay;
      return this.prisma.match.update({
        where: { id: u.matchId },
        data,
      });
    });

    await Promise.all(ops);
    return { success: true, count: updates.length };
  }

  // ── Category Control Center: Swap bracket slots ──

  async swapBracketSlots(
    categoryId: string,
    matchId: string,
    slot: 'home' | 'away',
    teamId: string,
    userId: string,
    userRole: UserRole,
  ) {
    const category = await this.prisma.eventCategory.findUnique({
      where: { id: categoryId },
      include: { event: { select: { organizerId: true } } },
    });

    if (!category) throw new NotFoundException(`Category ${categoryId} not found`);
    if (category.event.organizerId !== userId && userRole !== UserRole.ADMIN) {
      throw new ForbiddenException('No permission');
    }

    const match = await this.prisma.match.findFirst({
      where: { id: matchId, eventCategoryId: categoryId },
    });

    if (!match) throw new NotFoundException('Match not found in this category');

    const data = slot === 'home' ? { homeTeamId: teamId } : { awayTeamId: teamId };
    await this.prisma.match.update({ where: { id: matchId }, data });

    return { success: true };
  }
}
