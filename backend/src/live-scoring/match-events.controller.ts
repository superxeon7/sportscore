import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
} from '@nestjs/common';
import { UserRole } from '@prisma/client';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { MatchEventsService } from './match-events.service';
import { CreateMatchEventDto } from './dto/create-match-event.dto';

/**
 * REST fallback controller for match events.
 *
 * The primary interface for live scoring is the WebSocket gateway,
 * but these endpoints allow clients that cannot use WebSockets
 * to read and create match events via HTTP.
 */
@Controller('matches/:matchId/events')
export class MatchEventsController {
  constructor(private readonly matchEventsService: MatchEventsService) { }

  /**
   * List all events for a match, ordered chronologically.
   * Public endpoint – no authentication required.
   */
  @Public()
  @Get()
  async findByMatch(
    @Param('matchId', ParseUUIDPipe) matchId: string,
  ) {
    return this.matchEventsService.findByMatch(matchId);
  }

  /**
   * Create a match event via REST.
   * Restricted to ORGANIZER and ADMIN roles.
   * Validates that the user owns the match.
   */
  @Roles(UserRole.ORGANIZER, UserRole.ADMIN)
  @Post()
  async create(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Body() dto: CreateMatchEventDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.matchEventsService.create(matchId, dto, userId, userRole);
  }
}
