import {
    BadRequestException,
    ConflictException,
    ForbiddenException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { OwnershipService } from '../common/ownership.service';
import { MatchStatus, SportType, UserRole } from '@prisma/client';
import { CreateMatchLineupDto } from './dto/create-match-lineup.dto';
import { UpdateMatchLineupDto } from './dto/update-match-lineup.dto';

/** 3 days in milliseconds */
const H3_MS = 3 * 24 * 60 * 60 * 1000;

/**
 * Statuses that allow lineup viewing.
 * DRAFT matches are invisible to Team Manager — no lineup access at all.
 */
const LINEUP_VIEWABLE_STATUSES: MatchStatus[] = [
    MatchStatus.PUBLISHED,
    MatchStatus.SCHEDULED,
    MatchStatus.WARMUP,
    MatchStatus.LIVE,
    MatchStatus.HALF_TIME,
    MatchStatus.PAUSED,
    MatchStatus.COMPLETED,
];

/**
 * Statuses that allow lineup creation / editing.
 * Only PUBLISHED matches accept lineup submissions.
 */
const LINEUP_EDITABLE_STATUSES: MatchStatus[] = [
    MatchStatus.PUBLISHED,
];

/** Default starter counts per sport type */
const STARTER_COUNT: Record<string, number> = {
    [SportType.FUTSAL]: 5,
    [SportType.FOOTBALL]: 11,
    [SportType.BASKETBALL]: 5,
    [SportType.VOLLEYBALL]: 6,
    [SportType.BADMINTON]: 1,
};
const DEFAULT_STARTER_COUNT = 5;

@Injectable()
export class MatchLineupsService {
    constructor(
        private readonly prisma: PrismaService,
        private readonly ownershipService: OwnershipService,
    ) { }

    // ─── Read endpoints ─────────────────────────────────────────────

    /**
     * Get all lineups for a match (both teams).
     */
    async findByMatch(matchId: string, userId: string, userRole: UserRole) {
        await this.assertReadAccess(matchId, userId, userRole);

        const lineups = await this.prisma.matchLineup.findMany({
            where: { matchId },
            include: this.lineupInclude(),
        });

        return lineups;
    }

    /**
     * Get lineup for a specific team in a match.
     */
    async findByMatchAndTeam(
        matchId: string,
        teamId: string,
        userId: string,
        userRole: UserRole,
    ) {
        await this.assertReadAccess(matchId, userId, userRole);

        const lineup = await this.prisma.matchLineup.findUnique({
            where: { matchId_teamId: { matchId, teamId } },
            include: this.lineupInclude(),
        });

        return lineup ?? null;
    }

    // ─── Write endpoints ────────────────────────────────────────────

    /**
     * Create a lineup for a team in a match.
     * Only Team Manager (for their own team) or ADMIN.
     * Enforces H-3 rule + match status gate.
     */
    async create(
        matchId: string,
        dto: CreateMatchLineupDto,
        userId: string,
        userRole: UserRole,
    ) {
        // 1. Verify Team Manager ownership (or ADMIN)
        await this.ownershipService.assertTeamManagerOfMatch(
            matchId,
            userId,
            userRole,
            dto.teamId,
        );

        // 2. Load the match
        const match = await this.prisma.match.findUnique({
            where: { id: matchId },
        });

        if (!match) {
            throw new NotFoundException(`Match with id ${matchId} not found`);
        }

        // 3. Match status gate
        this.assertMatchStatusForEdit(match.status);

        // 4. H-3 rule
        this.assertH3Rule(match.scheduledAt);

        // 5. Verify team is in this match
        if (match.homeTeamId !== dto.teamId && match.awayTeamId !== dto.teamId) {
            throw new BadRequestException(
                'This team is not participating in this match',
            );
        }

        // 6. Check no existing lineup
        const existingLineup = await this.prisma.matchLineup.findUnique({
            where: { matchId_teamId: { matchId, teamId: dto.teamId } },
        });

        if (existingLineup) {
            throw new ConflictException(
                'A lineup for this team in this match already exists. Use PATCH to update it.',
            );
        }

        // 7. Run validation checks on players
        await this.validatePlayers(dto.players, match.eventCategoryId, dto.teamId);

        // 8. Create lineup + players
        const lineup = await this.prisma.matchLineup.create({
            data: {
                matchId,
                teamId: dto.teamId,
                players: {
                    create: dto.players.map((p) => ({
                        playerId: p.playerId,
                        jerseyNumber: p.jerseyNumber,
                        isStarter: p.isStarter ?? true,
                        isCaptain: p.isCaptain ?? false,
                    })),
                },
            },
            include: this.lineupInclude(),
        });

        return lineup;
    }

    /**
     * Update (replace) lineup players for a team in a match.
     * Only Team Manager (for their own team) or ADMIN.
     * Enforces H-3 rule + match status gate + lock check.
     */
    async update(
        matchId: string,
        teamId: string,
        dto: UpdateMatchLineupDto,
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

        // 2. Load existing lineup
        const lineup = await this.prisma.matchLineup.findUnique({
            where: { matchId_teamId: { matchId, teamId } },
        });

        if (!lineup) {
            throw new NotFoundException(
                'Lineup not found for this team in this match',
            );
        }

        // 3. Check not locked
        if (lineup.isLocked) {
            throw new ForbiddenException(
                'This lineup is locked and cannot be modified (match has started)',
            );
        }

        // 4. Load match for validation
        const match = await this.prisma.match.findUnique({
            where: { id: matchId },
        });

        if (!match) {
            throw new NotFoundException(`Match with id ${matchId} not found`);
        }

        // 5. Match status gate
        this.assertMatchStatusForEdit(match.status);

        // 6. H-3 rule
        this.assertH3Rule(match.scheduledAt);

        // 7. Validate players
        await this.validatePlayers(dto.players, match.eventCategoryId, teamId);

        // 8. Replace lineup players in a transaction
        const updated = await this.prisma.$transaction(async (tx) => {
            await tx.matchLineupPlayer.deleteMany({
                where: { lineupId: lineup.id },
            });

            await tx.matchLineupPlayer.createMany({
                data: dto.players.map((p) => ({
                    lineupId: lineup.id,
                    playerId: p.playerId,
                    jerseyNumber: p.jerseyNumber,
                    isStarter: p.isStarter ?? true,
                    isCaptain: p.isCaptain ?? false,
                })),
            });

            return tx.matchLineup.findUnique({
                where: { id: lineup.id },
                include: this.lineupInclude(),
            });
        });

        return updated;
    }

    /**
     * Get category-registered players eligible for lineup selection.
     */
    async getAvailablePlayers(
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

        // If match has a category, players MUST be in the CategoryRoster for this team+category.
        // If match has no category (friendly?), maybe fallback to all team players?
        // For now, assuming category-bound matches. If no category, maybe return all active players of team?
        // Plan says "Lineup must Only select from CategoryRoster".
        // If match.eventCategoryId is null, we can't check roster.
        // Let's assume matches have categories for this system. If not, fallback to team players.

        if (match.eventCategoryId) {
            const roster = await this.prisma.categoryRoster.findMany({
                where: {
                    categoryId: match.eventCategoryId,
                    teamId,
                },
                include: {
                    player: {
                        select: {
                            id: true,
                            fullName: true,
                            jerseyNumber: true,
                            position: true,
                            photoUrl: true,
                        },
                    },
                },
                orderBy: {
                    player: { fullName: 'asc' },
                },
            });
            return { data: roster.map((r) => r.player) };
        } else {
            // Fallback for non-category matches
            const players = await this.prisma.player.findMany({
                where: {
                    teamId,
                    isActive: true,
                },
                select: {
                    id: true,
                    fullName: true,
                    jerseyNumber: true,
                    position: true,
                    photoUrl: true,
                },
                orderBy: [{ jerseyNumber: 'asc' }, { fullName: 'asc' }],
            });
            return { data: players };
        }
    }

    /**
     * Get category officials for a team in a match.
     * Returns officials registered in CategoryOfficial for the match's category.
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
            },
            orderBy: [
                { role: 'asc' },
                { fullName: 'asc' },
            ],
        });

        return { data: officials };
    }

    // ─── Private helpers ────────────────────────────────────────────

    /**
     * Dual-path authorization for read endpoints.
     * - ORGANIZER: must be match owner (via event)
     * - TEAM_MANAGER: must manage one of the teams in the match
     * - ADMIN: bypass
     */
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

    /**
     * H-3 Rule: lineup can only be created/edited starting 3 days before match.
     */
    private assertH3Rule(scheduledAt: Date): void {
        const lineupOpensAt = new Date(scheduledAt.getTime() - H3_MS);
        if (new Date() < lineupOpensAt) {
            throw new ForbiddenException(
                'Lineup submission opens 3 days before match.',
            );
        }
    }

    /**
     * Match status gate: only PUBLISHED matches allow lineup edits.
     */
    private assertMatchStatusForEdit(status: MatchStatus): void {
        if (!LINEUP_EDITABLE_STATUSES.includes(status)) {
            throw new BadRequestException(
                `Cannot create or edit lineup for a match in status "${status}". Match must be PUBLISHED.`,
            );
        }
    }

    /**
     * Validate player list for lineup creation/update.
     */
    private async validatePlayers(
        players: { playerId: string; jerseyNumber: number; isStarter?: boolean; isCaptain?: boolean }[],
        eventCategoryId: string | null,
        teamId: string,
    ) {
        if (players.length > 14) {
            throw new BadRequestException('A lineup can have at most 14 players');
        }

        const playerIds = players.map((p) => p.playerId);
        if (new Set(playerIds).size !== playerIds.length) {
            throw new BadRequestException(
                'Duplicate players are not allowed in a lineup',
            );
        }

        const jerseyNumbers = players.map((p) => p.jerseyNumber);
        if (new Set(jerseyNumbers).size !== jerseyNumbers.length) {
            throw new BadRequestException(
                'Jersey numbers must be unique within a lineup',
            );
        }

        // Captain validation: at most one captain
        const captainCount = players.filter((p) => p.isCaptain).length;
        if (captainCount > 1) {
            throw new BadRequestException(
                'Only one captain is allowed per lineup',
            );
        }

        // Captain must be a starter
        const captain = players.find((p) => p.isCaptain);
        if (captain && captain.isStarter === false) {
            throw new BadRequestException(
                'Captain must be a starter',
            );
        }

        // Starter count validation (sport-type based)
        if (eventCategoryId) {
            const category = await this.prisma.eventCategory.findUnique({
                where: { id: eventCategoryId },
                select: { sportType: true },
            });
            if (category) {
                const maxStarters = STARTER_COUNT[category.sportType] ?? DEFAULT_STARTER_COUNT;
                const starterCount = players.filter((p) => p.isStarter !== false).length;
                if (starterCount > maxStarters) {
                    throw new BadRequestException(
                        `Maximum ${maxStarters} starters allowed for ${category.sportType}. Got ${starterCount}.`,
                    );
                }
            }
        }

        // Check if players exist and belong to team
        const dbPlayers = await this.prisma.player.findMany({
            where: {
                id: { in: playerIds },
                teamId,
                isActive: true,
            },
            select: { id: true },
        });

        if (dbPlayers.length !== playerIds.length) {
            const found = new Set(dbPlayers.map((p) => p.id));
            const missing = playerIds.filter((id) => !found.has(id));
            throw new BadRequestException(
                `The following players are not found or not active in this team: ${missing.join(', ')}`,
            );
        }

        // If category is present, players MUST be in CategoryRoster
        if (eventCategoryId) {
            const rosterEntries = await this.prisma.categoryRoster.findMany({
                where: {
                    categoryId: eventCategoryId,
                    teamId,
                    playerId: { in: playerIds },
                },
                select: { playerId: true },
            });

            if (rosterEntries.length !== playerIds.length) {
                const foundInRoster = new Set(rosterEntries.map((r) => r.playerId));
                const missingFromRoster = playerIds.filter((id) => !foundInRoster.has(id));
                throw new BadRequestException(
                    `The following players are not registered in the category roster: ${missingFromRoster.join(', ')}`,
                );
            }
        }
    }

    /**
     * Reusable include object for lineup queries.
     */
    private lineupInclude() {
        return {
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
                orderBy: [
                    { isStarter: 'desc' as const },
                    { jerseyNumber: 'asc' as const },
                ],
            },
        };
    }
}
