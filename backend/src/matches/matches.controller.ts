import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { MatchesService } from './matches.service';
import { CreateMatchDto } from './dto/create-match.dto';
import { UpdateMatchDto } from './dto/update-match.dto';
import { MatchQueryDto } from './dto/match-query.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MatchStatus, UserRole } from '@prisma/client';

@Controller('matches')
export class MatchesController {
  constructor(private readonly matchesService: MatchesService) { }

  // ─── Public endpoints (no auth) ──────────────────────────────────
  // Static paths MUST be defined before :id to avoid route conflicts.

  @Public()
  @Get('public')
  async findAllPublic(@Query() query: MatchQueryDto) {
    return this.matchesService.findAllPublic(query);
  }

  @Public()
  @Get('public/:id')
  async findByIdPublic(@Param('id', ParseUUIDPipe) id: string) {
    return this.matchesService.findByIdPublic(id);
  }

  /**
   * Team Manager: get published matches for my team.
   */
  @Roles(UserRole.TEAM_MANAGER)
  @Get('my-team')
  async findMyTeamMatches(
    @CurrentUser('id') userId: string,
  ) {
    return this.matchesService.findMyTeamMatches(userId);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Get()
  async findAll(
    @Query() query: MatchQueryDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.matchesService.findAll(query, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Get(':id')
  async findById(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.matchesService.findById(id, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Post()
  async create(
    @Body() dto: CreateMatchDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.matchesService.create(dto, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Patch(':id')
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMatchDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.matchesService.update(id, dto, userId, userRole);
  }

  @Public()
  @Get(':id/time-config')
  async getTimeConfig(@Param('id', ParseUUIDPipe) id: string) {
    return this.matchesService.getMatchTimeConfig(id);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Patch(':id/status')
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('status', new ParseEnumPipe(MatchStatus)) status: MatchStatus,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.matchesService.updateStatus(id, status, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Patch('bulk-publish')
  async bulkPublish(
    @Body('eventId') eventId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.matchesService.bulkPublish(eventId, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Patch(':id/score')
  async setScore(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: {
      homeScore: number;
      awayScore: number;
      homePenaltyScore?: number | null;
      awayPenaltyScore?: number | null;
    },
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    if (body.homeScore === undefined || body.awayScore === undefined) {
      throw new BadRequestException('homeScore and awayScore are required');
    }
    return this.matchesService.setScore(
      id,
      body.homeScore,
      body.awayScore,
      body.homePenaltyScore ?? null,
      body.awayPenaltyScore ?? null,
      userId,
      userRole,
    );
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Patch(':id/publish')
  async publish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.matchesService.publish(id, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Patch(':id/unpublish')
  async unpublish(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.matchesService.unpublish(id, userId, userRole);
  }

  // ─── POTM endpoints ───────────────────────────────────────────────

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Get(':id/potm/candidates')
  async getPotmCandidates(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.matchesService.getPotmCandidates(id, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Patch(':id/potm')
  async updatePotm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body('playerId') playerId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.matchesService.updatePotm(id, playerId, userId, userRole);
  }

  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Patch(':id/potm/lock')
  async lockPotm(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.matchesService.lockPotm(id, userId, userRole);
  }
}
