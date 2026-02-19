import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
} from '@nestjs/common';
import { StandingsService } from './standings.service';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';

@Controller('tournaments/:tournamentId/standings')
export class StandingsController {
  constructor(private readonly standingsService: StandingsService) {}

  @Public()
  @Get()
  async findByTournament(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Query('group') group?: string,
  ) {
    return this.standingsService.findByTournament(tournamentId, group);
  }

  @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
  @Post('recalculate')
  async recalculate(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
  ) {
    return this.standingsService.recalculate(tournamentId);
  }
}
