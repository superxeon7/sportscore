import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Put,
} from '@nestjs/common';
import { MatchOfficialsService } from './match-officials.service';
import { SetMatchOfficialsDto } from './dto/set-match-officials.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('matches/:matchId/officials')
export class MatchOfficialsController {
  constructor(private readonly service: MatchOfficialsService) {}

  @Roles(UserRole.ORGANIZER, UserRole.TEAM_MANAGER, UserRole.ADMIN)
  @Get(':teamId')
  getMatchOfficials(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.service.getMatchOfficials(matchId, teamId, userId, userRole);
  }

  @Roles(UserRole.TEAM_MANAGER, UserRole.ADMIN)
  @Put(':teamId')
  setMatchOfficials(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() dto: SetMatchOfficialsDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.service.setMatchOfficials(
      matchId,
      teamId,
      dto,
      userId,
      userRole,
    );
  }

  @Roles(UserRole.ORGANIZER, UserRole.TEAM_MANAGER, UserRole.ADMIN)
  @Get(':teamId/available')
  getAvailableOfficials(
    @Param('matchId', ParseUUIDPipe) matchId: string,
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.service.getAvailableOfficials(
      matchId,
      teamId,
      userId,
      userRole,
    );
  }
}
