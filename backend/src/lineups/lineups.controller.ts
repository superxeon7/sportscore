import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import { LineupsService } from './lineups.service';
import { Public } from '../common/decorators/public.decorator';

/**
 * Legacy lineups controller — kept for backward compatibility.
 * New lineup management uses MatchLineupsController at matches/:matchId/lineups.
 */
@Controller()
export class LineupsController {
  constructor(private readonly lineupsService: LineupsService) { }

  /**
   * @deprecated Use GET /matches/:matchId/lineups instead
   */
  @Public()
  @Get('legacy/matches/:matchId/lineups')
  async findByMatch(@Param('matchId', ParseUUIDPipe) matchId: string) {
    return this.lineupsService.findByMatch(matchId);
  }
}
