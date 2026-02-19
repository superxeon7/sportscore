import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { PaginationDto, buildPaginationMeta } from '../common/dto/pagination.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) { }

  async create(dto: CreateTeamDto, managerId: string) {
    // Enforce one manager → one team constraint
    const existingTeam = await this.prisma.team.findUnique({
      where: { managerId },
    });

    if (existingTeam) {
      throw new ConflictException(
        'You already manage a team. A manager can only manage one team.',
      );
    }

    return this.prisma.team.create({
      data: {
        name: dto.name,
        shortName: dto.shortName,
        slug: dto.slug,
        city: dto.city,
        country: dto.country,
        foundedYear: dto.foundedYear,
        sportType: dto.sportType,
        ageGroup: dto.ageGroup,
        gender: dto.gender,
        managerId,
      },
    });
  }

  /**
   * Returns the manager's single team, or null if they haven't created one.
   */
  async findMyTeam(managerId: string) {
    const team = await this.prisma.team.findUnique({
      where: { managerId },
      include: {
        players: {
          where: { isActive: true },
          orderBy: { jerseyNumber: 'asc' },
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        categoryTeams: {
          include: {
            eventCategory: {
              include: {
                event: {
                  select: {
                    id: true,
                    name: true,
                    slug: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    return team;
  }

  /**
   * Returns tournament categories where the manager's team is registered.
   */
  async findTournamentCategories(managerId: string) {
    const team = await this.prisma.team.findUnique({
      where: { managerId },
      select: { id: true },
    });

    if (!team) {
      throw new NotFoundException('Anda belum memiliki tim');
    }

    return this.prisma.eventCategory.findMany({
      where: {
        categoryTeams: {
          some: { teamId: team.id },
        },
      },
      include: {
        event: {
          select: {
            id: true,
            name: true,
            slug: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        categoryTeams: {
          where: { teamId: team.id },
          select: { registeredAt: true, seed: true, groupId: true },
        },
        _count: {
          select: {
            matches: true,
            categoryTeams: true,
            categoryRosters: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findAll(
    pagination: PaginationDto,
    search?: string,
    userId?: string,
    userRole?: UserRole,
  ) {
    const where: any = { isActive: true };

    // Scope to manager's own team only
    if (userRole === UserRole.TEAM_MANAGER && userId) {
      where.managerId = userId;
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { country: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [teams, total] = await Promise.all([
      this.prisma.team.findMany({
        where,
        skip: pagination.skip,
        take: pagination.limit,
        orderBy: pagination.orderBy,
      }),
      this.prisma.team.count({ where }),
    ]);

    return {
      data: teams,
      meta: buildPaginationMeta(pagination.page, pagination.limit, total),
    };
  }

  async findBySlug(slug: string) {
    const team = await this.prisma.team.findUnique({
      where: { slug },
      include: {
        players: {
          where: { isActive: true },
          orderBy: { jerseyNumber: 'asc' },
          include: { division: true },
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        teamOfficials: {
          where: { isActive: true },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Team with slug "${slug}" not found`);
    }

    return team;
  }

  async findOne(id: string, userId?: string, userRole?: UserRole) {
    const team = await this.prisma.team.findUnique({
      where: { id },
      include: {
        players: {
          where: { isActive: true },
          orderBy: { jerseyNumber: 'asc' },
        },
        manager: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID "${id}" not found`);
    }

    // Manager can only view their own team
    if (userRole === UserRole.TEAM_MANAGER && userId) {
      if (team.managerId !== userId) {
        throw new ForbiddenException(
          'You do not have permission to view this team',
        );
      }
    }

    return team;
  }

  async update(
    id: string,
    dto: UpdateTeamDto,
    userId: string,
    userRole: UserRole,
  ) {
    const team = await this.findOneBasic(id);
    this.assertOwnerOrAdmin(team.managerId, userId, userRole);

    return this.prisma.team.update({
      where: { id },
      data: { ...dto },
    });
  }

  async remove(id: string, userId: string, userRole: UserRole) {
    const team = await this.findOneBasic(id);
    this.assertOwnerOrAdmin(team.managerId, userId, userRole);

    return this.prisma.team.update({
      where: { id },
      data: { isActive: false },
    });
  }

  /**
   * Fetch a team without relations (used for ownership checks).
   */
  async findOneBasic(id: string) {
    const team = await this.prisma.team.findUnique({
      where: { id },
    });

    if (!team) {
      throw new NotFoundException(`Team with ID "${id}" not found`);
    }

    return team;
  }

  /**
   * Throws ForbiddenException unless the user is the team manager or an ADMIN.
   */
  assertOwnerOrAdmin(
    managerId: string,
    userId: string,
    userRole: UserRole,
  ): void {
    if (userRole === UserRole.ADMIN) {
      return;
    }
    if (managerId !== userId) {
      throw new ForbiddenException(
        'You do not have permission to modify this team',
      );
    }
  }
}
