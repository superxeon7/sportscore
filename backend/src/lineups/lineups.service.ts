import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Legacy LineupsService — delegates to the new MatchLineup model.
 * Kept for backward compatibility with any remaining references.
 */
@Injectable()
export class LineupsService {
  constructor(private readonly prisma: PrismaService) { }

  async findByMatch(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException(`Match with id ${matchId} not found`);
    }

    const lineups = await this.prisma.matchLineup.findMany({
      where: { matchId },
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
                photoUrl: true,
              },
            },
          },
          orderBy: { jerseyNumber: 'asc' },
        },
      },
    });

    return lineups;
  }
}
