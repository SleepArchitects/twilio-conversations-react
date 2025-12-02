import { withMiddlewareAuthRequired } from "@auth0/nextjs-auth0/edge";
import { NextResponse } from "next/server";
import type { NextRequest, NextFetchEvent } from "next/server";

/**
 * Auth0 middleware for route protection
 *
 * This middleware protects all routes except:
 * - /api/auth/* - Auth0 authentication routes
 * - /api/outreach/webhook - Twilio webhook callbacks (must be public)
 * - Static files and Next.js internals
 */

// Public paths that don't require authentication
const PUBLIC_PATHS = [
	"/api/auth", // Auth0 routes
	"/api/outreach/webhook", // Twilio webhook callbacks
	"/api/outreach/test-sms", // Test SMS endpoint (development only)
	"/demo", // Demo page for testing (development only)
];

/**
 * Check if the request path is public (doesn't require authentication)
 */
function isPublicPath(pathname: string): boolean {
	return PUBLIC_PATHS.some((path) => pathname.startsWith(path));
}

/**
 * Custom middleware that wraps Auth0's withMiddlewareAuthRequired
 * Allows public access to specific paths while protecting everything else
 */
export default async function middleware(
	request: NextRequest,
	event: NextFetchEvent,
) {
	const { pathname } = request.nextUrl;

	// Allow public paths without authentication
	if (isPublicPath(pathname)) {
		return NextResponse.next();
	}

	// Apply Auth0 authentication for all other routes
	return withMiddlewareAuthRequired()(request, event);
}

/**
 * Matcher configuration for Next.js middleware
 *
 * Match all request paths except:
 * - _next/static (static files)
 * - _next/image (image optimization files)
 * - favicon.ico, sitemap.xml, robots.txt (metadata files)
 * - Public assets in /public folder
 */
export const config = {
	matcher: [
		/*
		 * Match all request paths except for the ones starting with:
		 * - _next/static (static files)
		 * - _next/image (image optimization files)
		 * - favicon.ico, sitemap.xml, robots.txt (metadata files)
		 */
		"/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
	],
};
