import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UserRole } from '@prisma/client';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { UpdateUserDto } from './dto/update-user.dto';
import { UsersService } from './users.service';
import { UploadsService } from '../uploads/uploads.service';
import { createMulterImageOptions } from '../uploads/multer.config';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly uploadsService: UploadsService,
  ) {}

  /**
   * GET /users/me - Get the currently authenticated user's profile.
   */
  @Get('me')
  async getMe(@CurrentUser('id') userId: string) {
    return this.usersService.findById(userId);
  }

  /**
   * PATCH /users/me - Update the currently authenticated user's own profile.
   * Users cannot change their own role or isActive status through this endpoint.
   */
  @Patch('me')
  async updateMe(
    @CurrentUser('id') userId: string,
    @Body() dto: UpdateUserDto,
  ) {
    // Strip admin-only fields from self-update
    delete dto.role;
    delete dto.isActive;
    return this.usersService.update(userId, dto);
  }

  /**
   * POST /users/me/avatar - Upload or replace the current user's avatar.
   */
  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', createMulterImageOptions('avatars')))
  async uploadAvatar(
    @CurrentUser('id') userId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    const user = await this.usersService.findById(userId);

    // Delete old avatar if it is a locally stored file
    if (user.avatarUrl) {
      const match = (user.avatarUrl as string).match(/\/storage\/(.+)$/);
      if (match) {
        this.uploadsService.deleteFile(match[1]);
      }
    }

    const { url } = this.uploadsService.handleImageUpload(file, 'avatars');
    return this.usersService.update(userId, { avatarUrl: url });
  }

  /**
   * GET /users - List all users with pagination (admin only).
   */
  @Get()
  @Roles(UserRole.ADMIN)
  async findAll(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 20;
    return this.usersService.findAll(pageNum, limitNum);
  }

  /**
   * GET /users/:id - Get a specific user by ID (admin only).
   */
  @Get(':id')
  @Roles(UserRole.ADMIN)
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.findById(id);
  }

  /**
   * PATCH /users/:id - Update a specific user (admin only).
   */
  @Patch(':id')
  @Roles(UserRole.ADMIN)
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateUserDto,
  ) {
    return this.usersService.update(id, dto);
  }

  /**
   * DELETE /users/:id - Soft delete a user by setting isActive to false (admin only).
   */
  @Delete(':id')
  @Roles(UserRole.ADMIN)
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.usersService.softDelete(id);
  }
}
