import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import { PlayersService } from './players.service';
import { CreatePlayerDto } from './dto/create-player.dto';
import { UpdatePlayerDto } from './dto/update-player.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller()
export class PlayersController {
  constructor(private readonly playersService: PlayersService) { }

  @Public()
  @Get('players')
  findAllPublic(
    @Query('search') search?: string,
    @Query('teamId') teamId?: string,
    @Query('position') position?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.playersService.findAllPublic({
      search,
      teamId,
      position,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? Math.min(parseInt(limit, 10), 50) : 24,
    });
  }

  @Public()
  @Get('teams/:teamId/players')
  findAllByTeam(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.playersService.findAllByTeam(teamId, userId, userRole);
  }

  @Public()
  @Get('players/:id/profile')
  getPublicProfile(@Param('id', ParseUUIDPipe) id: string) {
    return this.playersService.getPublicProfile(id);
  }

  @Get('players/:id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.playersService.findOne(id, userId, userRole);
  }

  @Post('teams/:teamId/players')
  create(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @Body() dto: CreatePlayerDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.playersService.create(teamId, dto, userId, userRole);
  }

  @Patch('players/:id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePlayerDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.playersService.update(id, dto, userId, userRole);
  }

  @Delete('players/:id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.playersService.remove(id, userId, userRole);
  }
}
