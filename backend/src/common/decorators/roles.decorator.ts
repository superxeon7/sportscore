import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/**
 * Decorator that specifies which roles are allowed to access a route.
 *
 * @example
 * ```ts
 * @Roles(UserRole.ADMIN, UserRole.ORGANIZER)
 * @Get('admin-only')
 * getAdminData() { ... }
 * ```
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
