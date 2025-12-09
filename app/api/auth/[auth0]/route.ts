import { auth0 } from "@/lib/auth0";

/**
 * Auth0 authentication route handler
 *
 * Handles all Auth0 authentication flows:
 * - /api/auth/login - Initiates login flow
 * - /api/auth/logout - Logs out user
 * - /api/auth/callback - Handles OAuth callback
 * - /api/auth/me - Returns current user session
 *
 * Uses shared auth0 instance to ensure session compatibility with SleepConnect
 */
export const GET = auth0.handleAuth();
export const POST = auth0.handleAuth();
