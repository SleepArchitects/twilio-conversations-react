import { NextRequest, NextResponse } from "next/server";
import { verifyUserContextToken } from "@/lib/jwt-utils";

/**
 * GET /auth/profile
 *
 * Returns user profile from the x-sax-user-context JWT cookie.
 * This is a direct implementation (not a proxy) to avoid self-referential loops.
 */
export async function GET(request: NextRequest) {
  const userContextCookie = request.cookies.get("x-sax-user-context");

  if (!userContextCookie?.value) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const userContext = await verifyUserContextToken(userContextCookie.value);

  if (!userContext) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

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
