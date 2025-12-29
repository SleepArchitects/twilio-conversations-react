import { NextRequest, NextResponse } from "next/server";
import { verifyUserContextToken } from "@/lib/jwt-utils";

/**
 * GET /api/auth/profile
 *
 * Returns user profile from the x-sax-user-context JWT cookie.
 * This cookie is set by SleepConnect's middleware and contains user session data.
 */
export async function GET(request: NextRequest) {
  // Get the user context JWT from the cookie (REQUIRED)
  const userContextCookie = request.cookies.get("x-sax-user-context");

  if (!userContextCookie?.value) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Verify and decode the JWT
  const userContext = await verifyUserContextToken(userContextCookie.value);

  if (!userContext) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  // Return user profile in Auth0 format
  return NextResponse.json({
    email: userContext.email,
    name: userContext.name,
    sub: userContext.sax_id,
    sax_id: userContext.sax_id,
    tenant_id: userContext.tenant_id,
    practice_id: userContext.practice_id,
    practice_name: userContext.practice_name,
  });
}
