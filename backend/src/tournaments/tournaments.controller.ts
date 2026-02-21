import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { TournamentsService } from './tournaments.service';
import { CreateTournamentDto } from './dto/create-tournament.dto';
import { UpdateTournamentDto } from './dto/update-tournament.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { SwissSystemService } from './swiss-system.service';

@Controller()
export class TournamentsController {
  constructor(
    private readonly tournamentsService: TournamentsService,
    private readonly swissSystemService: SwissSystemService,
  ) { }

  // ─── Public endpoints ───────────────────────────────────────────

  @Public()
  @Get('events/:eventId/tournaments/public')
  async findByEventPublic(
    @Param('eventId', ParseUUIDPipe) eventId: string,
  ) {
    return this.tournamentsService.findByEventPublic(eventId);
  }

  @Public()
  @Get('tournaments/:id/public')
  async findByIdPublic(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tournamentsService.findByIdPublic(id);
  }

  // ─── Organizer / Admin endpoints ────────────────────────────────

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Get('events/:eventId/tournaments')
  async findByEvent(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.tournamentsService.findByEvent(eventId, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Get('tournaments/:id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.tournamentsService.findById(id, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Post('events/:eventId/tournaments')
  async create(
    @Param('eventId', ParseUUIDPipe) eventId: string,
    @Body() dto: CreateTournamentDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.tournamentsService.create(eventId, dto, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Patch('tournaments/:id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTournamentDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.tournamentsService.update(id, dto, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Post('tournaments/:id/generate-fixtures')
  async generateFixtures(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.tournamentsService.generateFixtures(id, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Patch('tournaments/:id/update-seeding')
  async updateSeeding(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('seedingOrder') seedingOrder: string[],
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.tournamentsService.updateSeeding(id, seedingOrder, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Post('tournaments/:id/reset-bracket')
  async resetBracket(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.tournamentsService.resetBracket(id, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Post('tournaments/:id/regenerate-double-elim')
  async regenerateDoubleElim(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    await this.tournamentsService.resetBracket(id, userId, userRole);
    return this.tournamentsService.generateFixtures(id, userId, userRole);
  }

  // ─── Swiss System endpoints ─────────────────────────────────────

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Post('tournaments/:id/swiss/generate-round')
  async generateSwissRound(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.swissSystemService.generateRound(id, userId, userRole);
  }

  @Public()
  @Get('tournaments/:id/swiss/rounds')
  async getSwissRounds(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.swissSystemService.getRounds(id);
  }

  @Public()
  @Get('tournaments/:id/swiss/standings')
  async getSwissStandings(
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.swissSystemService.getStandings(id);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Post('tournaments/:id/swiss/generate-playoff')
  async generateSwissPlayoff(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.swissSystemService.generatePlayoff(id, userId, userRole);
  }
}

