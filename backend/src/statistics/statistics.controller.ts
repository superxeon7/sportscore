import {
  Controller,
  DefaultValuePipe,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Query,
} from '@nestjs/common';
import { StatisticsService } from './statistics.service';
import { Public } from '../common/decorators/public.decorator';

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly statisticsService: StatisticsService) {}

  @Public()
  @Get('players/:playerId')
  async getPlayerStats(
    @Param('playerId', ParseUUIDPipe) playerId: string,
  ) {
    return this.statisticsService.getPlayerStats(playerId);
  }

  @Public()
  @Get('teams/:teamId')
  async getTeamStats(
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ) {
    return this.statisticsService.getTeamStats(teamId);
  }

  @Public()
  @Get('teams/:teamId/divisions')
  async getTeamDivisionStats(
    @Param('teamId', ParseUUIDPipe) teamId: string,
  ) {
    return this.statisticsService.getTeamDivisionStats(teamId);
  }

  @Public()
  @Get('tournaments/:tournamentId/top-scorers')
  async getTopScorers(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
  ) {
    return this.statisticsService.getTopScorers(tournamentId, limit);
  }

  @Public()
  @Get('tournaments/:tournamentId/summary')
  async getTournamentSummary(
    @Param('tournamentId', ParseUUIDPipe) tournamentId: string,
  ) {
    return this.statisticsService.getTournamentSummary(tournamentId);
  }
}
