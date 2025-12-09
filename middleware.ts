import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Middleware for the Outreach zone
 * 
 * Auth routes need to be handled by SleepConnect (not this zone) to share cookies.
 * When a request comes to /outreach/auth/*, redirect to /auth/* so SleepConnect handles it.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // If the path contains /auth, redirect without /outreach prefix
  if (pathname.includes('/auth')) {
    console.log(`MIDDLEWARE]] [OUTREACH] Pathname contains auth`);
    const newPathname = pathname.replace('/outreach', '');
    const url = request.nextUrl.clone();
    url.pathname = newPathname;
    
    console.log(`[OUTREACH MIDDLEWARE] Redirecting auth route: ${pathname} -> ${newPathname}`);
    return NextResponse.redirect(url);
  }
  
  // All other /outreach/* routes - just pass through
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
