import {
  BadRequestException,
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
import { EventsService } from './events.service';
import { CreateEventDto } from './dto/create-event.dto';
import { UpdateEventDto } from './dto/update-event.dto';
import { EventQueryDto } from './dto/event-query.dto';
import { EventMatchesQueryDto } from './dto/event-matches-query.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { EventStatus, UserRole } from '@prisma/client';


@Controller('events')
export class EventsController {
  constructor(private readonly eventsService: EventsService) { }

  // ─── Public endpoints (no auth required) ─────────────────────────
  // These MUST be defined before :id routes to avoid NestJS route conflicts.

  @Public()
  @Get('public')
  async findAllPublic(@Query() query: EventQueryDto) {
    return this.eventsService.findAllPublic(query);
  }

  @Public()
  @Get('by-slug/:slug/tournament-data')
  async getPublicTournamentData(@Param('slug') slug: string) {
    return this.eventsService.getPublicTournamentData(slug);
  }

  @Public()
  @Get('by-slug/:slug')
  async findBySlug(@Param('slug') slug: string) {
    return this.eventsService.findBySlug(slug);
  }

  @Public()
  @Get('public/:id')
  async findByIdPublic(@Param('id', ParseUUIDPipe) id: string) {
    return this.eventsService.findByIdPublic(id);
  }

  @Public()
  @Get('public/:id/teams')
  async getTeamsPublic(@Param('id', ParseUUIDPipe) eventId: string) {
    return this.eventsService.getEventTeamsPublic(eventId);
  }

  @Public()
  @Get('public/:id/matches')
  async getMatchesPublic(@Param('id', ParseUUIDPipe) eventId: string) {
    return this.eventsService.getEventMatchesPublic(eventId);
  }

  // ─── Organizer / Admin endpoints (auth required) ─────────────────

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Get()
  async findAll(
    @Query() query: EventQueryDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.eventsService.findAll(query, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.eventsService.findById(id, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Post()
  async create(
    @Body() dto: CreateEventDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.eventsService.create(dto, userId);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { status: string },
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    if (body.status !== 'DRAFT' && body.status !== 'PUBLISHED') {
      throw new BadRequestException('Status must be DRAFT or PUBLISHED');
    }
    return this.eventsService.updateStatus(
      id,
      body.status as EventStatus,
      userId,
      userRole,
    );
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.eventsService.update(id, dto, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Delete(':id')
  async softDelete(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.eventsService.softDelete(id, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Get(':id/teams')
  async getTeams(
    @Param('id', ParseUUIDPipe) eventId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.eventsService.getEventTeams(eventId, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Get(':id/matches')
  async getMatches(
    @Param('id', ParseUUIDPipe) eventId: string,
    @Query() query: EventMatchesQueryDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.eventsService.getEventMatches(eventId, userId, userRole, query);
  }
}
