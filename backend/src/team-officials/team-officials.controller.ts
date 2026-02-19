import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { TeamOfficialsService } from './team-officials.service';
import { CreateTeamOfficialDto } from './dto/create-team-official.dto';
import { UpdateTeamOfficialDto } from './dto/update-team-official.dto';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';

@Controller('team-officials')
@Roles(UserRole.TEAM_MANAGER, UserRole.ADMIN)
export class TeamOfficialsController {
  constructor(private readonly service: TeamOfficialsService) {}

  @Get()
  findAll(
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.service.findAll(userId, userRole);
  }

  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.service.findOne(id, userId, userRole);
  }

  @Post()
  create(
    @Body() dto: CreateTeamOfficialDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.service.create(dto, userId, userRole);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamOfficialDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.service.update(id, dto, userId, userRole);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.service.remove(id, userId, userRole);
  }
}
