import { NextResponse } from "next/server";

/**
 * GET /api/auth/profile
 *
 * Mock profile endpoint for Auth0 useUser hook.
 * Returns null in dev mode since we don't use user UI in Outreach zone.
 *
 * Note: This prevents 404 errors from the useUser hook which the Auth0 SDK
 * calls automatically, even though we don't display user info in the UI.
 */
export async function GET() {
  // In dev mode with disabled auth, return null (no user)
  if (process.env.DISABLE_AUTH === "true") {
    return NextResponse.json(null, { status: 200 });
  }

  // In production/multi-zone mode, this endpoint shouldn't be called
  // since SleepConnect handles auth. Return 404 to indicate it's not available.
  return NextResponse.json(
    { error: "Profile endpoint not available in Outreach zone" },
    { status: 404 },
  );
}
