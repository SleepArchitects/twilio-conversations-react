import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { verifyUserContextToken } from './lib/jwt-utils';

/**
 * Check if auth is disabled for development
 */
function isAuthDisabled(): boolean {
  return process.env.DISABLE_AUTH === "true";
}

/**
 * Check if user has a valid session from sleepconnect
 * Verifies JWT token from x-sax-user-context cookie
 */
async function hasValidSession(request: NextRequest): Promise<boolean> {
  // Check for x-sax-user-context cookie (JWT token from sleepconnect)
  const userContextCookie = request.cookies.get('x-sax-user-context');
  
  if (!userContextCookie?.value) {
    return false;
  }
  
  // Verify and decode JWT
  const userContext = await verifyUserContextToken(userContextCookie.value);
  
  return userContext !== null;
}

/**
 * Middleware for the Outreach zone
 * 
 * Auth routes need to be handled by SleepConnect (not this zone) to share cookies.
 * When a request comes to /outreach/auth/*, redirect to /auth/* so SleepConnect handles it.
 * 
 * All other routes require authentication via valid session cookie from sleepconnect.
 */
export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Auth routes are handled internally by this app (via proxy to /api/auth/profile)
  // Only redirect actual Auth0 login/logout/callback routes to sleepconnect
  if (pathname.startsWith('/outreach/auth/login') || 
      pathname.startsWith('/outreach/auth/logout') ||
      pathname.startsWith('/outreach/auth/callback')) {
    console.log(`MIDDLEWARE]] [OUTREACH] Redirecting Auth0 route`);
    const newPathname = pathname.replace('/outreach', '');
    const sleepconnectUrl = process.env.NEXT_PUBLIC_SLEEPCONNECT_URL || 'http://localhost:3000';
    const redirectUrl = `${sleepconnectUrl}${newPathname}${request.nextUrl.search}`;
    
    console.log(`[OUTREACH MIDDLEWARE] Redirecting auth route: ${pathname} -> ${redirectUrl}`);
    return NextResponse.redirect(redirectUrl);
  }
  
  // Skip auth check if disabled (development only)
  if (isAuthDisabled()) {
    console.log('[OUTREACH MIDDLEWARE] Auth disabled - bypassing authentication');
    return NextResponse.next();
  }
  
  // Check for valid session cookie
  if (!(await hasValidSession(request))) {
    console.log(`[OUTREACH MIDDLEWARE] No valid session - redirecting to login: ${pathname}`);
    
    // Redirect to sleepconnect login with return URL
    const sleepconnectUrl = process.env.NEXT_PUBLIC_SLEEPCONNECT_URL || 'http://localhost:3000';
    const returnTo = encodeURIComponent(`/outreach${pathname}`);
    const loginUrl = `${sleepconnectUrl}/login?returnTo=${returnTo}`;
    
    return NextResponse.redirect(loginUrl);
  }
  
  // Valid session - pass through
  return NextResponse.next();
}

// Configure which routes this middleware runs on
export const config = {
  matcher: [
    /*
     * Match all /outreach/* routes except /outreach/auth/*
     */
    '/outreach/((?!auth).)*'
  ],
};
