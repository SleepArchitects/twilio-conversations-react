import { NextRequest } from "next/server";
import { GET as getProfileHandler } from "../../api/auth/profile/route";

/**
 * Proxy /outreach/auth/profile to /outreach/api/auth/profile
 *
 * This is needed because Auth0's useUser() hook fetches from /auth/profile,
 * which gets prefixed with /outreach due to basePath config.
 * This route calls the actual API endpoint handler directly (no HTTP fetch).
 *
 * IMPORTANT: This uses a direct function call instead of an HTTP fetch to avoid
 * self-referential proxy loops in production where NEXT_PUBLIC_APP_BASE_URL
 * points to the same domain.
 */
export async function GET(request: NextRequest) {
  // Call the actual API route handler directly
  // This avoids the self-referential fetch loop that occurs in production
  return getProfileHandler(request);
}
