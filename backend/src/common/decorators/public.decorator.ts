import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/**
 * Decorator that marks a route as public, bypassing JWT authentication.
 *
 * @example
 * ```ts
 * @Public()
 * @Get('health')
 * healthCheck() { return { status: 'ok' }; }
 * ```
 */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
