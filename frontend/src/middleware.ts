import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// Routes that require authentication
const protectedPrefixes = ['/admin', '/organizer', '/team-manager'];

// Role-based route restrictions
const roleRouteMap: Record<string, string[]> = {
  '/admin': ['ADMIN'],
  '/organizer': ['ADMIN', 'ORGANIZER'],
  '/team-manager': ['ADMIN', 'TEAM_MANAGER'],
};

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if the route requires authentication
  const isProtected = protectedPrefixes.some((prefix) =>
    pathname.startsWith(prefix),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  // Check for access token in cookies
  // Note: In a full implementation, the token would be stored in an httpOnly cookie
  // set by the server. For now we check a client-readable cookie as a fallback.
  const accessToken =
    request.cookies.get('sportscore_access_token')?.value || null;

  if (!accessToken) {
    // Redirect to login with a return URL
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('returnTo', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Optional: Decode JWT to check role (without verification - server will verify)
  // This is a lightweight client-side check; real authorization happens on the API
  try {
    const payload = JSON.parse(
      Buffer.from(accessToken.split('.')[1], 'base64').toString(),
    );
    const userRole = payload.role;

    if (userRole) {
      for (const [prefix, allowedRoles] of Object.entries(roleRouteMap)) {
        if (pathname.startsWith(prefix) && !allowedRoles.includes(userRole)) {
          // User doesn't have the right role - redirect to their dashboard
          const redirectMap: Record<string, string> = {
            ADMIN: '/admin',
            ORGANIZER: '/organizer',
            TEAM_MANAGER: '/team-manager',
          };
          const redirectTo = redirectMap[userRole] || '/';
          return NextResponse.redirect(new URL(redirectTo, request.url));
        }
      }
    }
  } catch {
    // If JWT decode fails, let the request through and let the API handle it
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/admin/:path*', '/organizer/:path*', '/team-manager/:path*'],
};
