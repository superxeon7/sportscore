import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Parameter decorator that extracts the authenticated user from the request object.
 * Optionally accepts a property name to return a specific field from the user.
 *
 * @example
 * ```ts
 * // Get the full user object
 * @Get('profile')
 * getProfile(@CurrentUser() user: User) { ... }
 *
 * // Get only the user's id
 * @Get('profile')
 * getProfile(@CurrentUser('id') userId: string) { ... }
 * ```
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
