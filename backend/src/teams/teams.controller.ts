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
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { TeamsService } from './teams.service';
import { CreateTeamDto } from './dto/create-team.dto';
import { UpdateTeamDto } from './dto/update-team.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { Public } from '../common/decorators/public.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { UserRole } from '@prisma/client';
import { UploadsService } from '../uploads/uploads.service';
import { createMulterImageOptions } from '../uploads/multer.config';

@Controller('teams')
export class TeamsController {
  constructor(
    private readonly teamsService: TeamsService,
    private readonly uploadsService: UploadsService,
  ) { }

  /**
   * GET /teams/my — Returns the authenticated manager's single team (or null).
   * Must be defined BEFORE :id route to avoid conflict.
   */
  @Roles(UserRole.TEAM_MANAGER)
  @Get('my')
  findMyTeam(@CurrentUser('id') userId: string) {
    return this.teamsService.findMyTeam(userId);
  }

  /**
   * GET /teams/my/tournament-categories — Returns only tournament categories
   * where the team has an active registration (EventCategoryTeam exists).
   */
  @Roles(UserRole.TEAM_MANAGER)
  @Get('my/tournament-categories')
  findMyTournamentCategories(@CurrentUser('id') userId: string) {
    return this.teamsService.findTournamentCategories(userId);
  }

  @Public()
  @Get('by-slug/:slug')
  findBySlug(@Param('slug') slug: string) {
    return this.teamsService.findBySlug(slug);
  }

  /**
   * GET /teams — Public listing of teams.
   * When authenticated as TEAM_MANAGER: returns only their team.
   * Otherwise: returns all active teams.
   */
  @Public()
  @Get()
  findAll(
    @Query() pagination: PaginationDto,
    @Query('search') search?: string,
    @CurrentUser('id') userId?: string,
    @CurrentUser('role') userRole?: UserRole,
  ) {
    return this.teamsService.findAll(pagination, search, userId, userRole);
  }

  /**
   * GET /teams/:id — Public team detail.
   */
  @Public()
  @Get(':id')
  findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId?: string,
    @CurrentUser('role') userRole?: UserRole,
  ) {
    return this.teamsService.findOne(id, userId, userRole);
  }

  @Roles(UserRole.TEAM_MANAGER)
  @Post()
  create(
    @Body() dto: CreateTeamDto,
    @CurrentUser('id') userId: string,
  ) {
    return this.teamsService.create(dto, userId);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTeamDto,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.teamsService.update(id, dto, userId, userRole);
  }

  /**
   * POST /teams/:id/logo — Upload or replace the team logo image.
   * Only the team manager (or admin) can update the logo.
   */
  @Post(':id/logo')
  @UseInterceptors(FileInterceptor('file', createMulterImageOptions('team-logo')))
  async uploadLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const team = await this.teamsService.findOneBasic(id);
    this.teamsService.assertOwnerOrAdmin(team.managerId, userId, userRole);

    // Delete old logo if locally stored
    if (team.logoUrl) {
      const match = (team.logoUrl as string).match(/\/storage\/(.+)$/);
      if (match) {
        this.uploadsService.deleteFile(match[1]);
      }
    }

    const { url } = this.uploadsService.handleImageUpload(file, 'team-logo');
    return this.teamsService.update(id, { logoUrl: url }, userId, userRole);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser('id') userId: string,
    @CurrentUser('role') userRole: UserRole,
  ) {
    return this.teamsService.remove(id, userId, userRole);
  }
}
