import {
    Body,
    Controller,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
} from '@nestjs/common';
import { MatchLineupsService } from './match-lineups.service';
import { CreateMatchLineupDto } from './dto/create-match-lineup.dto';
import { UpdateMatchLineupDto } from './dto/update-match-lineup.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('matches/:matchId/lineups')
export class MatchLineupsController {
    constructor(private readonly matchLineupsService: MatchLineupsService) { }

    /**
     * Get all lineups for a match (both teams).
     * Accessible by: ORGANIZER (match owner), TEAM_MANAGER (in this match), ADMIN.
     */
    @Roles(UserRole.ORGANIZER, UserRole.TEAM_MANAGER, UserRole.ADMIN)
    @Get()
    async findByMatch(
        @Param('matchId', ParseUUIDPipe) matchId: string,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole,
    ) {
        return this.matchLineupsService.findByMatch(matchId, userId, userRole);
    }

    /**
     * Get lineup for a specific team in a match.
     * Accessible by: ORGANIZER (match owner), TEAM_MANAGER (in this match), ADMIN.
     */
    @Roles(UserRole.ORGANIZER, UserRole.TEAM_MANAGER, UserRole.ADMIN)
    @Get(':teamId')
    async findByMatchAndTeam(
        @Param('matchId', ParseUUIDPipe) matchId: string,
        @Param('teamId', ParseUUIDPipe) teamId: string,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole,
    ) {
        return this.matchLineupsService.findByMatchAndTeam(
            matchId,
            teamId,
            userId,
            userRole,
        );
    }

    /**
     * Create a lineup for a team in a match.
     * Only TEAM_MANAGER (for their own team) and ADMIN can create lineups.
     * H-3 rule enforced server-side.
     */
    @Roles(UserRole.TEAM_MANAGER, UserRole.ADMIN)
    @Post()
    async create(
        @Param('matchId', ParseUUIDPipe) matchId: string,
        @Body() dto: CreateMatchLineupDto,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole,
    ) {
        return this.matchLineupsService.create(matchId, dto, userId, userRole);
    }

    /**
     * Update (replace) lineup players for a team in a match.
     * Only TEAM_MANAGER (for their own team) and ADMIN can update lineups.
     * H-3 rule enforced server-side.
     */
    @Roles(UserRole.TEAM_MANAGER, UserRole.ADMIN)
    @Patch(':teamId')
    async update(
        @Param('matchId', ParseUUIDPipe) matchId: string,
        @Param('teamId', ParseUUIDPipe) teamId: string,
        @Body() dto: UpdateMatchLineupDto,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole,
    ) {
        return this.matchLineupsService.update(
            matchId,
            teamId,
            dto,
            userId,
            userRole,
        );
    }

    /**
     * Get category-registered players eligible for lineup selection.
     * Accessible by: ORGANIZER, TEAM_MANAGER, ADMIN.
     */
    @Roles(UserRole.ORGANIZER, UserRole.TEAM_MANAGER, UserRole.ADMIN)
    @Get(':teamId/available-players')
    async getAvailablePlayers(
        @Param('matchId', ParseUUIDPipe) matchId: string,
        @Param('teamId', ParseUUIDPipe) teamId: string,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole,
    ) {
        return this.matchLineupsService.getAvailablePlayers(
            matchId,
            teamId,
            userId,
            userRole,
        );
    }

    /**
     * Get category officials for a team in a match.
     * Accessible by: ORGANIZER, TEAM_MANAGER, ADMIN.
     */
    @Roles(UserRole.ORGANIZER, UserRole.TEAM_MANAGER, UserRole.ADMIN)
    @Get(':teamId/officials')
    async getAvailableOfficials(
        @Param('matchId', ParseUUIDPipe) matchId: string,
        @Param('teamId', ParseUUIDPipe) teamId: string,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole,
    ) {
        return this.matchLineupsService.getAvailableOfficials(
            matchId,
            teamId,
            userId,
            userRole,
        );
    }
}
