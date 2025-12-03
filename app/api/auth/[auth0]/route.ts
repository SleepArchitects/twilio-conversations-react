import { handleAuth } from "@auth0/nextjs-auth0";

/**
 * Auth0 authentication route handler
 *
 * Handles all Auth0 authentication flows:
 * - /api/auth/login - Initiates login flow
 * - /api/auth/logout - Logs out user
 * - /api/auth/callback - Handles OAuth callback
 * - /api/auth/me - Returns current user session
 */
export const GET = handleAuth();
export const POST = handleAuth();
