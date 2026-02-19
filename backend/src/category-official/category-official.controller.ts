import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseUUIDPipe,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { CategoryOfficialService } from './category-official.service';
import { CreateOfficialDto } from './dto/create-official.dto';
import { UpdateOfficialDto } from './dto/update-official.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('event-categories/:categoryId/officials')
export class CategoryOfficialController {
    constructor(private readonly officialService: CategoryOfficialService) { }

    @Roles(UserRole.ORGANIZER, UserRole.TEAM_MANAGER, UserRole.ADMIN)
    @Get()
    async getOfficials(
        @Param('categoryId', ParseUUIDPipe) categoryId: string,
        @Query('teamId') teamId: string | undefined, // optional
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole,
    ) {
        return this.officialService.getOfficials(categoryId, teamId, userId, userRole);
    }

    @Roles(UserRole.TEAM_MANAGER, UserRole.ADMIN)
    @Post()
    async addOfficial(
        @Param('categoryId', ParseUUIDPipe) categoryId: string,
        @Body() dto: CreateOfficialDto,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole,
    ) {
        return this.officialService.addOfficial(categoryId, dto, userId, userRole);
    }

    @Roles(UserRole.TEAM_MANAGER, UserRole.ADMIN)
    @Patch(':id')
    async updateOfficial(
        @Param('categoryId', ParseUUIDPipe) categoryId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @Body() dto: UpdateOfficialDto,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole,
    ) {
        return this.officialService.updateOfficial(id, dto, userId, userRole);
    }

    @Roles(UserRole.TEAM_MANAGER, UserRole.ADMIN)
    @Delete(':id')
    async removeOfficial(
        @Param('categoryId', ParseUUIDPipe) categoryId: string,
        @Param('id', ParseUUIDPipe) id: string,
        @CurrentUser('id') userId: string,
        @CurrentUser('role') userRole: UserRole,
    ) {
        return this.officialService.removeOfficial(id, userId, userRole);
    }
}
