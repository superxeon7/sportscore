import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTeamOfficialDto } from './dto/create-team-official.dto';
import { UpdateTeamOfficialDto } from './dto/update-team-official.dto';
import { UserRole } from '@prisma/client';

@Injectable()
export class TeamOfficialsService {
  constructor(private readonly prisma: PrismaService) {}

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

  async findAll(userId: string, userRole: UserRole) {
    const teamId = await this.resolveTeamId(userId);
    return this.prisma.teamOfficial.findMany({
      where: { teamId, isActive: true },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    });
  }

  async findOne(id: string, userId: string, userRole: UserRole) {
    const official = await this.prisma.teamOfficial.findUnique({
      where: { id },
    });

    if (!official) {
      throw new NotFoundException('Ofisial tidak ditemukan');
    }

    await this.assertTeamOwnership(official.teamId, userId, userRole);
    return official;
  }

  async create(
    dto: CreateTeamOfficialDto,
    userId: string,
    userRole: UserRole,
  ) {
    const teamId = await this.resolveTeamId(userId);
    return this.prisma.teamOfficial.create({
      data: {
        teamId,
        fullName: dto.fullName,
        dateOfBirth: new Date(dto.dateOfBirth),
        placeOfBirth: dto.placeOfBirth,
        nationality: dto.nationality,
        role: dto.role,
        photoUrl: dto.photoUrl,
      },
    });
  }

  async update(
    id: string,
    dto: UpdateTeamOfficialDto,
    userId: string,
    userRole: UserRole,
  ) {
    const official = await this.prisma.teamOfficial.findUnique({
      where: { id },
      select: { teamId: true },
    });
    if (!official) throw new NotFoundException('Ofisial tidak ditemukan');

    await this.assertTeamOwnership(official.teamId, userId, userRole);

    return this.prisma.teamOfficial.update({
      where: { id },
      data: {
        ...dto,
        dateOfBirth: dto.dateOfBirth ? new Date(dto.dateOfBirth) : undefined,
      },
    });
  }

  async remove(id: string, userId: string, userRole: UserRole) {
    const official = await this.prisma.teamOfficial.findUnique({
      where: { id },
      select: { teamId: true },
    });
    if (!official) throw new NotFoundException('Ofisial tidak ditemukan');

    await this.assertTeamOwnership(official.teamId, userId, userRole);

    return this.prisma.teamOfficial.update({
      where: { id },
      data: { isActive: false },
    });
  }
}
