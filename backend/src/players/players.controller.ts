import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
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
  @Get('teams/:teamId/players')
  findAllByTeam(
    @Param('teamId', ParseUUIDPipe) teamId: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.playersService.findAllByTeam(teamId, userId, userRole);
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
