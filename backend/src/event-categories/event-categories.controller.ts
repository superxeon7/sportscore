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
import { EventCategoriesService } from './event-categories.service';
import { CreateEventCategoryDto } from './dto/create-event-category.dto';
import { UpdateEventCategoryDto } from './dto/update-event-category.dto';
import { EventCategoryQueryDto } from './dto/event-category-query.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller()
export class EventCategoriesController {
  constructor(
    private readonly eventCategoriesService: EventCategoriesService,
  ) {}

  // ── List categories for an event ──

  @Public()
  @Get('events/:eventId/categories')
  async getEventCategories(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.eventCategoriesService.getEventCategories(eventId);
  }

  // ── Create a category for an event (Organizer / Admin) ──

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Post('events/:eventId/categories')
  async create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateEventCategoryDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.eventCategoriesService.create(eventId, dto, userId, userRole);
  }

  // ── Global query (e.g. for filtering) ──

  @Public()
  @Get('event-categories')
  async findAll(@Query() query: EventCategoryQueryDto) {
    return this.eventCategoriesService.findAll(query);
  }

  // ── Get single category ──

  @Public()
  @Get('event-categories/:id')
  async findById(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventCategoriesService.findById(id);
  }

  // ── Update category (Organizer / Admin) ──

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Patch('event-categories/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventCategoryDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.eventCategoriesService.update(id, dto, userId, userRole);
  }

  // ── Delete category (Organizer / Admin) ──

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Delete('event-categories/:id')
  async delete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.eventCategoriesService.delete(id, userId, userRole);
  }

  // ── Computed standings for category (public) ──

  @Public()
  @Get('event-categories/:id/standings')
  async getCategoryStandings(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventCategoriesService.getCategoryStandings(id);
  }

  // ── Bracket for knockout category (public) ──

  @Public()
  @Get('event-categories/:id/bracket')
  async getCategoryBracket(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventCategoriesService.getCategoryBracket(id);
  }

  // ── Stages for category (public) ──

  @Public()
  @Get('event-categories/:id/stages')
  async getCategoryStages(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventCategoriesService.getCategoryStages(id);
  }

  // ── Stage groups (read-only — used to populate group dropdown) ──

  @Public()
  @Get('event-categories/:id/stage-groups')
  async getStageGroups(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventCategoriesService.getStageGroups(id);
  }

  // ── Generate group stage fixtures (Organizer / Admin) ──

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Post('event-categories/:id/generate-group-fixtures')
  async generateGroupFixtures(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.eventCategoriesService.generateGroupFixtures(id, userId, userRole);
  }

  // ── Advance group stage → knockout (Organizer / Admin) ──

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Post('event-categories/:id/advance-knockout')
  async advanceToKnockout(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.eventCategoriesService.advanceToKnockout(id, userId, userRole);
  }

  // ── List teams in category (public) ──

  @Public()
  @Get('event-categories/:id/teams')
  async getCategoryTeams(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventCategoriesService.getCategoryTeams(id);
  }

  // ── Add team to category (Organizer / Admin) ──

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Post('event-categories/:id/teams')
  async addTeamToCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { teamId: string; groupId?: string },
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.eventCategoriesService.addTeamToCategory(
      id,
      body.teamId,
      userId,
      userRole,
      body.groupId,
    );
  }

  // ── Remove team from category (Organizer / Admin) ──

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Delete('event-categories/:id/teams/:teamId')
  async removeTeamFromCategory(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.eventCategoriesService.removeTeamFromCategory(id, teamId, userId, userRole);
  }

  // ── Team manager self-registers ──

  @Roles(UserRole.TEAM_MANAGER)
  @Post('event-categories/:id/register-team')
  async registerTeam(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser('id') userId: string,
  ) {
    return this.eventCategoriesService.registerTeam(id, teamId, userId);
  }
}
