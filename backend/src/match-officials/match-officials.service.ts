import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OwnershipService } from '../common/ownership.service';
import { MatchStatus, UserRole } from '@prisma/client';
import { SetMatchOfficialsDto } from './dto/set-match-officials.dto';

/** 3 days in milliseconds */
const H3_MS = 3 * 24 * 60 * 60 * 1000;

const EDITABLE_STATUSES: MatchStatus[] = [MatchStatus.PUBLISHED, MatchStatus.SCHEDULED];

@Injectable()
export class MatchOfficialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownershipService: OwnershipService,
  ) {}

  /**
   * Get selected officials for a team in a match.
   */
  async getMatchOfficials(
    matchId: string,
    teamId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.assertReadAccess(matchId, userId, userRole);

    const officials = await this.prisma.matchOfficial.findMany({
      where: { matchId, teamId },
      include: {
        official: {
          select: {
            id: true,
            fullName: true,
            role: true,
            photoUrl: true,
            dateOfBirth: true,
            nationality: true,
          },
        },
      },
      orderBy: [{ isHeadCoach: 'desc' }, { createdAt: 'asc' }],
    });

    return { data: officials };
  }

  /**
   * Get team officials available for selection in a match.
   */
  async getAvailableOfficials(
    matchId: string,
    teamId: string,
    userId: string,
    userRole: UserRole,
  ) {
    await this.assertReadAccess(matchId, userId, userRole);

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException(`Match with id ${matchId} not found`);
    }

    if (match.homeTeamId !== teamId && match.awayTeamId !== teamId) {
      throw new BadRequestException(
        'This team is not participating in this match',
      );
    }

    const officials = await this.prisma.teamOfficial.findMany({
      where: {
        teamId,
        isActive: true,
      },
      select: {
        id: true,
        fullName: true,
        role: true,
        photoUrl: true,
        dateOfBirth: true,
        nationality: true,
      },
      orderBy: [{ role: 'asc' }, { fullName: 'asc' }],
    });

    return { data: officials };
  }

  /**
   * Set/replace officials selection for a team in a match.
   */
  async setMatchOfficials(
    matchId: string,
    teamId: string,
    dto: SetMatchOfficialsDto,
    userId: string,
    userRole: UserRole,
  ) {
    // 1. Verify Team Manager ownership (or ADMIN)
    await this.ownershipService.assertTeamManagerOfMatch(
      matchId,
      userId,
      userRole,
      teamId,
    );

    // 2. Load match
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException(`Match with id ${matchId} not found`);
    }

    // 3. Match status gate
    if (!EDITABLE_STATUSES.includes(match.status)) {
      throw new BadRequestException(
        `Cannot modify officials for a match in status "${match.status}". Match must be PUBLISHED.`,
      );
    }

    // 4. H-3 rule
    const lineupOpensAt = new Date(match.scheduledAt.getTime() - H3_MS);
    if (new Date() < lineupOpensAt) {
      throw new ForbiddenException(
        'Official submission opens 3 days before match.',
      );
    }

    // 5. Verify team is in match
    if (match.homeTeamId !== teamId && match.awayTeamId !== teamId) {
      throw new BadRequestException(
        'This team is not participating in this match',
      );
    }

    // 6. Validate max 1 head coach
    const headCoachCount = dto.officials.filter((o) => o.isHeadCoach).length;
    if (headCoachCount > 1) {
      throw new BadRequestException('Only one head coach is allowed');
    }

    // 7. Validate all officials belong to the team
    const officialIds = dto.officials.map((o) => o.officialId);
    if (new Set(officialIds).size !== officialIds.length) {
      throw new BadRequestException('Duplicate officials are not allowed');
    }

    if (officialIds.length > 0) {
      const dbOfficials = await this.prisma.teamOfficial.findMany({
        where: {
          id: { in: officialIds },
          teamId,
          isActive: true,
        },
        select: { id: true },
      });

      if (dbOfficials.length !== officialIds.length) {
        const found = new Set(dbOfficials.map((o) => o.id));
        const missing = officialIds.filter((id) => !found.has(id));
        throw new BadRequestException(
          `The following officials are not found or not active in this team: ${missing.join(', ')}`,
        );
      }
    }

    // 8. Replace in transaction
    await this.prisma.$transaction(async (tx) => {
      await tx.matchOfficial.deleteMany({
        where: { matchId, teamId },
      });

      if (dto.officials.length > 0) {
        await tx.matchOfficial.createMany({
          data: dto.officials.map((o) => ({
            matchId,
            teamId,
            officialId: o.officialId,
            isHeadCoach: o.isHeadCoach ?? false,
          })),
        });
      }
    });

    // Return updated list
    return this.getMatchOfficials(matchId, teamId, userId, userRole);
  }

  // ── Private helpers ──

  private async assertReadAccess(
    matchId: string,
    userId: string,
    userRole: UserRole,
  ): Promise<void> {
    if (userRole === UserRole.ADMIN) return;

    if (userRole === UserRole.ORGANIZER) {
      await this.ownershipService.assertMatchOwner(matchId, userId, userRole);
      return;
    }

    if (userRole === UserRole.TEAM_MANAGER) {
      await this.ownershipService.assertTeamManagerOfMatch(
        matchId,
        userId,
        userRole,
      );
      return;
    }

    throw new ForbiddenException('Insufficient permissions');
  }
}
