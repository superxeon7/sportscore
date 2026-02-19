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
