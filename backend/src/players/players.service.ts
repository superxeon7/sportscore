import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { TeamsService } from '../teams/teams.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { UserRole } from '@prisma/client';

const DIVISION_SELECT = {
  select: {
    id: true,
    name: true,
    sportType: true,
    ageGroup: true,
    gender: true,
  },
} as const;

@Injectable()
export class PlayersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly teamsService: TeamsService,
  ) { }

  private async validateDivision(divisionId: string, teamId: string) {
    const division = await this.prisma.teamDivision.findUnique({
      where: { id: divisionId },
      select: { teamId: true },
    });
    if (!division) {
      throw new NotFoundException('Divisi tidak ditemukan');
    }
    if (division.teamId !== teamId) {
      throw new BadRequestException('Divisi tidak milik tim ini');
    }
  }

  async create(
    teamId: string,
    dto: CreatePlayerDto,
    userId: string,
    userRole: UserRole,
  ) {
    const team = await this.teamsService.findOneBasic(teamId);
    this.teamsService.assertOwnerOrAdmin(team.managerId, userId, userRole);

    if (dto.divisionId) {
      await this.validateDivision(dto.divisionId, teamId);
    }

    return this.prisma.player.create({
      data: {
        fullName: dto.fullName,
        jerseyNumber: dto.jerseyNumber,
        position: dto.position,
        dateOfBirth: new Date(dto.dateOfBirth),
        placeOfBirth: dto.placeOfBirth,
        nationality: dto.nationality,
        height: dto.height,
        weight: dto.weight,
        photoUrl: dto.photoUrl || null,
        teamId,
        divisionId: dto.divisionId || null,
      },
      include: {
        division: DIVISION_SELECT,
      },
    });
  }

  async findAllPublic(query: {
    search?: string;
    teamId?: string;
    position?: string;
    page: number;
    limit: number;
  }) {
    const { search, teamId, position, page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = { isActive: true };

    if (teamId) where.teamId = teamId;

    if (position) {
      where.position = { contains: position, mode: 'insensitive' };
    }

    if (search) {
      where.OR = [
        { fullName: { contains: search, mode: 'insensitive' } },
        { nationality: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [players, total] = await Promise.all([
      this.prisma.player.findMany({
        where,
        include: {
          team: {
            select: { id: true, name: true, shortName: true, slug: true, logoUrl: true },
          },
          division: {
            select: { id: true, name: true },
          },
        },
        orderBy: { fullName: 'asc' },
        take: limit,
        skip,
      }),
      this.prisma.player.count({ where }),
    ]);

    return {
      data: players,
      meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
    };
  }

  async findAllByTeam(teamId: string, userId?: string, userRole?: UserRole) {
    const team = await this.teamsService.findOneBasic(teamId);
    if (userRole === UserRole.TEAM_MANAGER && userId) {
      this.teamsService.assertOwnerOrAdmin(team.managerId, userId, userRole);
    }

    return this.prisma.player.findMany({
      where: {
        teamId,
        isActive: true,
      },
      include: {
        division: DIVISION_SELECT,
      },
      orderBy: { jerseyNumber: 'asc' },
    });
  }

  async findOne(id: string, userId?: string, userRole?: UserRole) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: {
        team: {
          select: {
            id: true,
            name: true,
            shortName: true,
            slug: true,
            logoUrl: true,
            managerId: true,
          },
        },
        division: DIVISION_SELECT,
      },
    });

    if (!player) {
      throw new NotFoundException(`Player with ID "${id}" not found`);
    }

    if (userRole === UserRole.TEAM_MANAGER && userId) {
      this.teamsService.assertOwnerOrAdmin(player.team.managerId, userId, userRole);
    }

    return player;
  }

  async update(
    id: string,
    dto: UpdatePlayerDto,
    userId: string,
    userRole: UserRole,
  ) {
    const player = await this.findOneWithTeam(id);
    this.teamsService.assertOwnerOrAdmin(
      player.team.managerId,
      userId,
      userRole,
    );

    if (dto.divisionId) {
      await this.validateDivision(dto.divisionId, player.team.id);
    }

    const { divisionId, ...rest } = dto;

    return this.prisma.player.update({
      where: { id },
      data: {
        ...rest,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
        divisionId: divisionId !== undefined ? (divisionId || null) : undefined,
      },
      include: {
        division: DIVISION_SELECT,
      },
    });
  }

  async remove(id: string, userId: string, userRole: UserRole) {
    const player = await this.findOneWithTeam(id);
    this.teamsService.assertOwnerOrAdmin(
      player.team.managerId,
      userId,
      userRole,
    );

    return this.prisma.player.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async getPublicProfile(id: string) {
    const player = await this.prisma.player.findUnique({
      where: { id, isActive: true },
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
        division: {
          select: {
            id: true,
            name: true,
            sportType: true,
            ageGroup: true,
            gender: true,
          },
        },
      },
    });

    if (!player) {
      throw new NotFoundException(`Player with ID "${id}" not found`);
    }

    // Fetch all match events for this player
    const matchEvents = await this.prisma.matchEvent.findMany({
      where: { playerId: id },
      include: {
        match: {
          include: {
            homeTeam: {
              select: { id: true, name: true, shortName: true, logoUrl: true },
            },
            awayTeam: {
              select: { id: true, name: true, shortName: true, logoUrl: true },
            },
            matchScore: { select: { homeScore: true, awayScore: true } },
            eventCategory: {
              select: { id: true, name: true, sportType: true, gender: true },
            },
            tournament: { select: { id: true, name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fetch POTM matches
    const potmMatches = await this.prisma.match.findMany({
      where: { playerOfTheMatchId: id, status: 'COMPLETED' },
      include: {
        homeTeam: {
          select: { id: true, name: true, shortName: true, logoUrl: true },
        },
        awayTeam: {
          select: { id: true, name: true, shortName: true, logoUrl: true },
        },
        matchScore: { select: { homeScore: true, awayScore: true } },
        eventCategory: { select: { id: true, name: true } },
        tournament: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: 'desc' },
    });

    // Aggregate stats per event category
    type CatStat = {
      categoryId: string;
      categoryName: string;
      sportType: string;
      goals: number;
      assists: number;
      yellowCards: number;
      redCards: number;
      appearances: Set<string>;
      ownGoals: number;
    };

    const categoryStatsMap = new Map<string, CatStat>();
    const allMatchIds = new Set<string>();

    for (const event of matchEvents) {
      const match = event.match;
      const category = match.eventCategory;
      const categoryId = category?.id ?? 'general';
      const categoryName = category?.name ?? 'Umum';
      const sportType = (category?.sportType as string) ?? 'FOOTBALL';

      if (!categoryStatsMap.has(categoryId)) {
        categoryStatsMap.set(categoryId, {
          categoryId,
          categoryName,
          sportType,
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
          appearances: new Set(),
          ownGoals: 0,
        });
      }

      const stats = categoryStatsMap.get(categoryId)!;

      if (match.status === 'COMPLETED') {
        stats.appearances.add(match.id);
        allMatchIds.add(match.id);
      }

      switch (event.type) {
        case 'GOAL': stats.goals++; break;
        case 'ASSIST': stats.assists++; break;
        case 'YELLOW_CARD': stats.yellowCards++; break;
        case 'RED_CARD': stats.redCards++; break;
        case 'OWN_GOAL': stats.ownGoals++; break;
      }
    }

    // POTM count per category
    const potmByCat = new Map<string, number>();
    for (const m of potmMatches) {
      const catId = m.eventCategory?.id ?? 'general';
      potmByCat.set(catId, (potmByCat.get(catId) ?? 0) + 1);
    }

    const categoryStats = Array.from(categoryStatsMap.values()).map((s) => ({
      categoryId: s.categoryId,
      categoryName: s.categoryName,
      sportType: s.sportType,
      goals: s.goals,
      assists: s.assists,
      yellowCards: s.yellowCards,
      redCards: s.redCards,
      appearances: s.appearances.size,
      ownGoals: s.ownGoals,
      potm: potmByCat.get(s.categoryId) ?? 0,
    }));

    // Build match history (deduplicated by matchId)
    type MatchHistoryItem = {
      matchId: string;
      scheduledAt: Date;
      homeTeam: { id: string; name: string; shortName: string | null; logoUrl: string | null } | null;
      awayTeam: { id: string; name: string; shortName: string | null; logoUrl: string | null } | null;
      homeScore: number | null;
      awayScore: number | null;
      categoryId: string;
      categoryName: string;
      tournamentName: string;
      goals: number;
      assists: number;
      yellowCards: number;
      redCards: number;
      ownGoals: number;
      isPotm: boolean;
      status: string;
    };

    const matchHistoryMap = new Map<string, MatchHistoryItem>();

    for (const event of matchEvents) {
      const match = event.match;
      const matchId = match.id;

      if (!matchHistoryMap.has(matchId)) {
        matchHistoryMap.set(matchId, {
          matchId,
          scheduledAt: match.scheduledAt,
          homeTeam: match.homeTeam ?? null,
          awayTeam: match.awayTeam ?? null,
          homeScore: match.matchScore?.homeScore ?? null,
          awayScore: match.matchScore?.awayScore ?? null,
          categoryId: match.eventCategory?.id ?? 'general',
          categoryName: match.eventCategory?.name ?? 'Umum',
          tournamentName: match.tournament?.name ?? '',
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
          ownGoals: 0,
          isPotm: match.playerOfTheMatchId === id,
          status: match.status,
        });
      }

      const mh = matchHistoryMap.get(matchId)!;
      switch (event.type) {
        case 'GOAL': mh.goals++; break;
        case 'ASSIST': mh.assists++; break;
        case 'YELLOW_CARD': mh.yellowCards++; break;
        case 'RED_CARD': mh.redCards++; break;
        case 'OWN_GOAL': mh.ownGoals++; break;
      }
    }

    const matchHistory = Array.from(matchHistoryMap.values())
      .sort(
        (a, b) =>
          new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
      )
      .slice(0, 30);

    const totals = {
      goals: categoryStats.reduce((s, c) => s + c.goals, 0),
      assists: categoryStats.reduce((s, c) => s + c.assists, 0),
      appearances: allMatchIds.size,
      yellowCards: categoryStats.reduce((s, c) => s + c.yellowCards, 0),
      redCards: categoryStats.reduce((s, c) => s + c.redCards, 0),
      potm: potmMatches.length,
      ownGoals: categoryStats.reduce((s, c) => s + c.ownGoals, 0),
    };

    return {
      player,
      totals,
      categoryStats,
      matchHistory,
      potmMatches: potmMatches.slice(0, 10),
    };
  }

  private async findOneWithTeam(id: string) {
    const player = await this.prisma.player.findUnique({
      where: { id },
      include: {
        team: {
          select: {
            id: true,
            managerId: true,
          },
        },
      },
    });

    if (!player) {
      throw new NotFoundException(`Player with ID "${id}" not found`);
    }

    return player;
  }
}
