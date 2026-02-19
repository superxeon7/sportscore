import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateDivisionDto } from './dto/create-division.dto';
import { UpdateDivisionDto } from './dto/update-division.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class TeamDivisionsService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Helpers ──

  private async resolveTeamId(userId: string): Promise<string> {
    const team = await this.prisma.team.findUnique({
      where: { managerId: userId },
      select: { id: true },
    });
    if (!team) {
      throw new NotFoundException('Anda belum memiliki tim');
    }
    return team.id;
  }

  private async assertTeamOwnership(
    teamId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<void> {
    if (userRole === UserRole.ADMIN) return;
    const team = await this.prisma.team.findUnique({
      where: { id: teamId },
      select: { managerId: true },
    });
    if (!team) throw new NotFoundException('Tim tidak ditemukan');
    if (team.managerId !== userId) {
      throw new ForbiddenException('Anda tidak memiliki akses ke tim ini');
    }
  }

  // ── CRUD ──

  async findAll(userId: string, userRole: UserRole) {
    const teamId = await this.resolveTeamId(userId);
    return this.prisma.teamDivision.findMany({
      where: { teamId },
      include: {
        _count: { select: { players: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  async findOne(id: string, userId: string, userRole: UserRole) {
    const division = await this.prisma.teamDivision.findUnique({
      where: { id },
      include: {
        players: {
          select: {
            id: true,
            fullName: true,
            jerseyNumber: true,
            position: true,
            dateOfBirth: true,
            photoUrl: true,
            isActive: true,
          },
        },
        _count: { select: { players: true } },
      },
    });

    if (!division) {
      throw new NotFoundException('Divisi tidak ditemukan');
    }

    await this.assertTeamOwnership(division.teamId, userId, userRole);
    return division;
  }

  async create(dto: CreateDivisionDto, userId: string, userRole: UserRole) {
    const teamId = await this.resolveTeamId(userId);
    return this.prisma.teamDivision.create({
      data: {
        ...dto,
        teamId,
      },
    });
  }

  async update(
    id: string,
    dto: UpdateDivisionDto,
    userId: string,
    userRole: UserRole,
  ) {
    const division = await this.prisma.teamDivision.findUnique({
      where: { id },
      select: { teamId: true },
    });
    if (!division) throw new NotFoundException('Divisi tidak ditemukan');

    await this.assertTeamOwnership(division.teamId, userId, userRole);

    return this.prisma.teamDivision.update({
      where: { id },
      data: dto,
    });
  }

  async remove(id: string, userId: string, userRole: UserRole) {
    const division = await this.prisma.teamDivision.findUnique({
      where: { id },
      select: { teamId: true },
    });
    if (!division) throw new NotFoundException('Divisi tidak ditemukan');

    await this.assertTeamOwnership(division.teamId, userId, userRole);

    return this.prisma.teamDivision.delete({ where: { id } });
  }
}
