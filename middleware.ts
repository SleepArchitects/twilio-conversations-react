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
 * Verifies JWT token from x-sax-user-context header or cookie
 */
async function hasValidSession(request: NextRequest): Promise<boolean> {
  // 1. Check for x-sax-user-context header (forwarded via proxy)
  let userContextToken = request.headers.get('x-sax-user-context');
  
  // 2. Fallback to cookie if header is not present
  if (!userContextToken) {
    const userContextCookie = request.cookies.get('x-sax-user-context');
    userContextToken = userContextCookie?.value || null;
  }
  
  if (!userContextToken) {
    return false;
  }
  
  // Verify and decode JWT
  const userContext = await verifyUserContextToken(userContextToken);
  
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
  
  // 🔍 DIAGNOSTIC: Log every request that hits middleware
  console.log(`[OUTREACH MIDDLEWARE] 🔍 Request to: ${pathname}`);
  console.log(`[OUTREACH MIDDLEWARE] 🍪 Cookies:`, Array.from(request.cookies.getAll()).map(c => `${c.name}=${c.value.substring(0, 20)}...`));
  console.log(`[OUTREACH MIDDLEWARE] 📥 Headers: x-sax-user-context present: ${!!request.headers.get('x-sax-user-context')}`);
  
  // Auth routes are handled internally by this app (via proxy to /api/auth/profile)
  // Only redirect actual Auth0 login/logout/callback routes to sleepconnect
  if (pathname.startsWith('/outreach/auth/login') ||
      pathname.startsWith('/outreach/auth/logout') ||
      pathname.startsWith('/outreach/auth/callback')) {
    console.log(`[OUTREACH MIDDLEWARE] ✅ Redirecting Auth0 route: ${pathname}`);
    const newPathname = pathname.replace('/outreach', '');
    const sleepconnectUrl = process.env.NEXT_PUBLIC_SLEEPCONNECT_URL || 'http://localhost:3000';
    const redirectUrl = `${sleepconnectUrl}${newPathname}${request.nextUrl.search}`;
    
    console.log(`[OUTREACH MIDDLEWARE] 🔀 Redirect: ${pathname} -> ${redirectUrl}`);
    return NextResponse.redirect(redirectUrl);
  }
  
  // Skip auth check if disabled (development only)
  if (isAuthDisabled()) {
    console.log('[OUTREACH MIDDLEWARE] ⚠️  Auth disabled - bypassing authentication');
    return NextResponse.next();
  }
  
  // Check for valid session cookie or header
  const hasSession = await hasValidSession(request);
  console.log(`[OUTREACH MIDDLEWARE] 🔐 Has valid session: ${hasSession}`);
  
  if (!hasSession) {
    console.log(`[OUTREACH MIDDLEWARE] ❌ No valid session - redirecting to login: ${pathname}`);
    
    // Redirect to sleepconnect login with return URL
    const sleepconnectUrl = process.env.NEXT_PUBLIC_SLEEPCONNECT_URL || 'http://localhost:3000';
    const returnTo = encodeURIComponent(`/outreach${pathname}`);
    const loginUrl = `${sleepconnectUrl}/login?returnTo=${returnTo}`;
    
    return NextResponse.redirect(loginUrl);
  }
  
  // Valid session - pass through
  console.log(`[OUTREACH MIDDLEWARE] ✅ Valid session - allowing request to: ${pathname}`);
  return NextResponse.next();
}

// Configure which routes this middleware runs on
export const config = {
  matcher: [
    /*
     * Match all /outreach/* routes EXCEPT:
     * - /outreach/auth/* (any auth UI routes)
     * - /outreach/api/auth/* (API authentication endpoints)
     *
     * The pattern below uses negative lookahead to exclude these paths.
     * This is critical to prevent circular authentication dependencies!
     */
    '/outreach/((?!auth|api/auth).)*'
  ],
};
