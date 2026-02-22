import {
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Shared service for resource ownership validation.
 *
 * Resolves the ownership chain:
 *   Match → Tournament → Event → User (organizerId)
 *
 * ADMINs bypass all ownership checks.
 */
@Injectable()
export class OwnershipService {
    constructor(private readonly prisma: PrismaService) { }

    /**
     * Assert that `userId` owns the Event (or is ADMIN).
     * Throws ForbiddenException if not.
     */
    async assertEventOwner(
        eventId: string,
        userId: string,
        userRole: UserRole,
    ): Promise<void> {
        if (userRole === UserRole.ADMIN) return;

        const event = await this.prisma.event.findUnique({
            where: { id: eventId },
            select: { organizerId: true },
        });

        if (!event) {
            throw new NotFoundException(`Event with id ${eventId} not found`);
        }

        if (event.organizerId !== userId) {
            throw new ForbiddenException(
                'You do not have permission to access this event',
            );
        }
    }

    /**
     * Assert that `userId` owns the Event that contains this Tournament (or is ADMIN).
     * Throws ForbiddenException if not.
     */
    async assertTournamentOwner(
        tournamentId: string,
        userId: string,
        userRole: UserRole,
    ): Promise<void> {
        if (userRole === UserRole.ADMIN) return;

        const tournament = await this.prisma.tournament.findUnique({
            where: { id: tournamentId },
            select: {
                event: { select: { organizerId: true } },
            },
        });

        if (!tournament) {
            throw new NotFoundException(
                `Tournament with id ${tournamentId} not found`,
            );
        }

        if (tournament.event.organizerId !== userId) {
            throw new ForbiddenException(
                'You do not have permission to access this tournament',
            );
        }
    }

    /**
     * Assert that `userId` owns the Event that contains this Match (or is ADMIN).
     *
     * Resolves: Match → Tournament → Event → organizerId
     *
     * Throws ForbiddenException if not.
     */
    async assertMatchOwner(
        matchId: string,
        userId: string,
        userRole: UserRole,
    ): Promise<void> {
        if (userRole === UserRole.ADMIN) return;

        const match = await this.prisma.match.findUnique({
            where: { id: matchId },
            select: {
                tournament: {
                    select: {
                        event: { select: { organizerId: true } },
                    },
                },
            },
        });

        if (!match) {
            throw new NotFoundException(`Match with id ${matchId} not found`);
        }

        if (match.tournament.event.organizerId !== userId) {
            throw new ForbiddenException(
                'You do not have permission to access this match',
            );
        }
    }

    /**
     * Assert that `userId` is the Team Manager of one of the teams in this Match.
     *
     * Resolves: Match → homeTeam / awayTeam → Team.managerId
     *
     * Returns the teamId that the user manages.
     * ADMINs bypass — returns the provided `forTeamId` if given, otherwise homeTeamId.
     *
     * Throws ForbiddenException if the user doesn't manage either team.
     */
    async assertTeamManagerOfMatch(
        matchId: string,
        userId: string,
        userRole: UserRole,
        forTeamId?: string,
    ): Promise<string | null> {
        const match = await this.prisma.match.findUnique({
            where: { id: matchId },
            select: {
                homeTeamId: true,
                awayTeamId: true,
                homeTeam: { select: { managerId: true } },
                awayTeam: { select: { managerId: true } },
            },
        });

        if (!match) {
            throw new NotFoundException(`Match with id ${matchId} not found`);
        }

        if (userRole === UserRole.ADMIN) {
            return forTeamId ?? match.homeTeamId ?? null;
        }

        // Check which team the user manages
        const managesHome = match.homeTeam?.managerId === userId;
        const managesAway = match.awayTeam?.managerId === userId;

        if (!managesHome && !managesAway) {
            throw new ForbiddenException(
                'You do not manage any team in this match',
            );
        }

        const managedTeamId = managesHome ? match.homeTeamId : match.awayTeamId;

        // If a specific teamId was requested, verify it matches their team
        if (forTeamId && forTeamId !== managedTeamId) {
            throw new ForbiddenException(
                'You can only manage lineup for your own team',
            );
        }

        return managedTeamId ?? null;
    }
}
