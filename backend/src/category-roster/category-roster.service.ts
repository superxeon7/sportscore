import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OwnershipService } from '../common/ownership.service';
import { UserRole } from '@prisma/client';
import { AddRosterPlayerDto } from './dto/add-roster-player.dto';

@Injectable()
export class CategoryRosterService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly ownershipService: OwnershipService,
    ) { }

    /**
     * Get roster for a team in a category.
     * 
     * If user is ORGANIZER of the event -> can see all rosters for that category.
     * If user is TEAM_MANAGER -> can only see their own team's roster (unless explicitly requested via query param? No, let's keep it simple: get roster for MY team or specific team if organizer).
     * 
     * Actually, let's make this endpoint return roster for a specific team in the category.
     * GET /event-categories/:categoryId/teams/:teamId/roster
     * 
     * Or better: GET /event-categories/:categoryId/roster?teamId=...
     * If simple TM call without teamId -> get my team.
     */
    async getRoster(
        categoryId: string,
        teamId: string | undefined,
        userId: string,
        userRole: UserRole,
    ) {
        // If teamId not provided, try to find user's team in this category
        let targetTeamId = teamId;

        if (!targetTeamId) {
            if (userRole === UserRole.TEAM_MANAGER) {
                // Find team managed by user
                const team = await this.prisma.team.findUnique({
                    where: { managerId: userId },
                    select: { id: true },
                });
                if (!team) throw new NotFoundException('You do not manage any team');
                targetTeamId = team.id;
            } else {
                throw new BadRequestException('teamId is required for this role');
            }
        }

        // Validate access
        if (userRole === UserRole.TEAM_MANAGER) {
            // Can only view own team
            const managedTeam = await this.prisma.team.findUnique({
                where: { managerId: userId },
                select: { id: true },
            });
            if (!managedTeam || managedTeam.id !== targetTeamId) {
                throw new ForbiddenException('You can only view your own team roster');
            }
        } else if (userRole === UserRole.ORGANIZER) {
            // Check if user organizes the event of this category
            const category = await this.prisma.eventCategory.findUnique({
                where: { id: categoryId },
                include: { event: true },
            });
            if (!category) throw new NotFoundException('Category not found');
            if (category.event.organizerId !== userId) {
                throw new ForbiddenException('You are not the organizer of this event');
            }
        }

        const roster = await this.prisma.categoryRoster.findMany({
            where: {
                categoryId,
                teamId: targetTeamId,
            },
            include: {
                player: true,
            },
            orderBy: {
                player: { fullName: 'asc' },
            },
        });

        return roster;
    }

    async addPlayer(
        categoryId: string,
        dto: AddRosterPlayerDto,
        userId: string,
        userRole: UserRole,
    ) {
        if (userRole !== UserRole.TEAM_MANAGER && userRole !== UserRole.ADMIN) {
            throw new ForbiddenException('Only Team Managers can manage roster');
        }

        // 1. Resolve Team and check ownership
        let teamId: string;
        if (userRole === UserRole.TEAM_MANAGER) {
            const team = await this.prisma.team.findUnique({
                where: { managerId: userId },
            });
            if (!team) throw new ForbiddenException('You do not manage a team');
            teamId = team.id;
        } else {
            // Admin flow - not implemented in this scope, assume TM for now or fail
            throw new ForbiddenException('Admin roster management not strictly defined, use TM account');
        }

        // 2. Check category existence and max roster size
        const category = await this.prisma.eventCategory.findUnique({
            where: { id: categoryId },
        });
        if (!category) throw new NotFoundException('Category not found');

        // 3. Check if team is registered in category
        const registration = await this.prisma.eventCategoryTeam.findUnique({
            where: {
                eventCategoryId_teamId: {
                    eventCategoryId: categoryId,
                    teamId,
                },
            },
        });
        if (!registration) {
            throw new BadRequestException('Team is not registered in this category');
        }

        // 4. Check current roster size
        const currentCount = await this.prisma.categoryRoster.count({
            where: { categoryId, teamId },
        });

        if (currentCount >= category.maxRosterSize) {
            throw new BadRequestException(`Roster is full (max ${category.maxRosterSize} players)`);
        }

        // 5. Check player existence and ownership
        const player = await this.prisma.player.findUnique({
            where: { id: dto.playerId },
        });
        if (!player) throw new NotFoundException('Player not found');
        if (player.teamId !== teamId) {
            throw new BadRequestException('Player does not belong to your team');
        }

        // 6. Check if player already in roster
        const existing = await this.prisma.categoryRoster.findUnique({
            where: {
                categoryId_playerId: {
                    categoryId,
                    playerId: dto.playerId,
                },
            },
        });
        if (existing) {
            throw new ConflictException('Player is already in the roster for this category');
        }

        // 6.5 Prevent player from joining two categories in the same tournament/event
        const otherRosterInSameEvent = await this.prisma.categoryRoster.findFirst({
            where: {
                playerId: dto.playerId,
                categoryId: { not: categoryId },
                eventCategory: {
                    eventId: category.eventId,
                },
            },
            include: {
                eventCategory: { select: { name: true } },
            },
        });
        if (otherRosterInSameEvent) {
            throw new ConflictException(
                `Pemain sudah terdaftar di kategori "${otherRosterInSameEvent.eventCategory.name}" dalam event yang sama`,
            );
        }

        // 7. Add to roster
        return this.prisma.categoryRoster.create({
            data: {
                categoryId,
                teamId,
                playerId: dto.playerId,
            },
            include: { player: true },
        });
    }

    async removePlayer(
        categoryId: string,
        playerId: string, // actual player ID, not roster ID
        userId: string,
        userRole: UserRole,
    ) {
        if (userRole !== UserRole.TEAM_MANAGER && userRole !== UserRole.ADMIN) {
            throw new ForbiddenException('Only Team Managers can manage roster');
        }

        // Resolve Team
        let teamId: string;
        if (userRole === UserRole.TEAM_MANAGER) {
            const team = await this.prisma.team.findUnique({
                where: { managerId: userId },
            });
            if (!team) throw new ForbiddenException('You do not manage a team');
            teamId = team.id;
        } else {
            throw new ForbiddenException('Admin flow not implemented');
        }

        // Check if player is in roster
        const rosterEntry = await this.prisma.categoryRoster.findUnique({
            where: {
                categoryId_playerId: {
                    categoryId,
                    playerId,
                },
            },
        });

        if (!rosterEntry) {
            throw new NotFoundException('Player is not in the roster');
        }

        if (rosterEntry.teamId !== teamId) {
            throw new ForbiddenException('You cannot remove players from other teams');
        }

        return this.prisma.categoryRoster.delete({
            where: {
                categoryId_playerId: {
                    categoryId,
                    playerId,
                },
            },
        });
    }
}
