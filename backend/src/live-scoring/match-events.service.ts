import { Injectable, NotFoundException } from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMatchEventDto } from './dto/create-match-event.dto';
import { OwnershipService } from '../common/ownership.service';

@Injectable()
export class MatchEventsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ownershipService: OwnershipService,
  ) { }

  /**
   * List all events for a match, ordered chronologically.
   */
  async findByMatch(matchId: string) {
    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
    });

    if (!match) {
      throw new NotFoundException(`Match with id ${matchId} not found`);
    }

    return this.prisma.matchEvent.findMany({
      where: { matchId },
      orderBy: [{ minute: 'asc' }, { createdAt: 'asc' }],
      include: {
        player: {
          select: {
            id: true,
            fullName: true,
            jerseyNumber: true,
          },
        },
      },
    });
  }

  /**
   * Create a match event via REST (fallback for non-WebSocket clients).
   */
  async create(
    matchId: string,
    dto: CreateMatchEventDto,
    userId: string,
    userRole: UserRole,
  ) {
    // Verify the user owns the match
    await this.ownershipService.assertMatchOwner(matchId, userId, userRole);

    const match = await this.prisma.match.findUnique({
      where: { id: matchId },
      include: { matchScore: true },
    });

    if (!match) {
      throw new NotFoundException(`Match with id ${matchId} not found`);
    }

    const event = await this.prisma.matchEvent.create({
      data: {
        matchId,
        type: dto.type,
        minute: dto.minute,
        period: dto.period ?? match.currentPeriod,
        playerId: dto.playerId,
        teamId: dto.teamId,
        description: dto.description,
        data: (dto.data as any) ?? {},
        homeScoreSnapshot: match.matchScore?.homeScore ?? 0,
        awayScoreSnapshot: match.matchScore?.awayScore ?? 0,
      },
      include: {
        player: {
          select: {
            id: true,
            fullName: true,
            jerseyNumber: true,
          },
        },
      },
    });

    return event;
  }

  /**
   * Delete the most recent event for a match (undo support).
   */
  async deleteLastEvent(matchId: string) {
    const lastEvent = await this.prisma.matchEvent.findFirst({
      where: { matchId },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastEvent) {
      throw new NotFoundException(
        `No events found for match ${matchId}`,
      );
    }

    await this.prisma.matchEvent.delete({
      where: { id: lastEvent.id },
    });

    return lastEvent;
  }
}
