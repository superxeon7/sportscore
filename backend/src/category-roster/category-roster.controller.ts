import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Post,
    Query,
} from '@nestjs/common';
import { CategoryRosterService } from './category-roster.service';
import { AddRosterPlayerDto } from './dto/add-roster-player.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('event-categories/:categoryId/roster')
export class CategoryRosterController {
    constructor(private readonly rosterService: CategoryRosterService) { }

    @Roles(UserRole.ORGANIZER, UserRole.TEAM_MANAGER, UserRole.ADMIN)
    @Get()
    async getRoster(
        @Param('categoryId', ParseUUIDPipe) categoryId: string,
        @Query('teamId') teamId: string | undefined, // optional query param
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole,
    ) {
        return this.rosterService.getRoster(categoryId, teamId, userId, userRole);
    }

    @Roles(UserRole.TEAM_MANAGER, UserRole.ADMIN)
    @Post()
    async addPlayer(
        @Param('categoryId', ParseUUIDPipe) categoryId: string,
        @Body() dto: AddRosterPlayerDto,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole,
    ) {
        return this.rosterService.addPlayer(categoryId, dto, userId, userRole);
    }

    @Roles(UserRole.TEAM_MANAGER, UserRole.ADMIN)
    @Delete(':playerId') // playerId is the actual player table ID
    async removePlayer(
        @Param('categoryId', ParseUUIDPipe) categoryId: string,
        @Param('playerId', ParseUUIDPipe) playerId: string,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole,
    ) {
        return this.rosterService.removePlayer(categoryId, playerId, userId, userRole);
    }
}
