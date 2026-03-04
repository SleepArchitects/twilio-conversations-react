import { NextRequest, NextResponse } from "next/server";
import { SignJWT } from "jose";
import { auth0 } from "@/lib/auth0";

export const dynamic = "force-dynamic";

/**
 * SleepConnect auth callback - receives user context via query params or Auth0 session,
 * creates JWT cookie, and redirects to the original page.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const redirect = searchParams.get("redirect") || "/outreach";

  let sax_id: string | null = searchParams.get("sax_id");
  let tenant_id: string | null = searchParams.get("tenant_id");
  let practice_id: string | null = searchParams.get("practice_id");
  let email: string = searchParams.get("email") || "";
  let name: string = searchParams.get("name") || "";

  // If query params not provided by SleepConnect, try Auth0 session
  if (!sax_id || !tenant_id || !practice_id) {
    try {
      const session = await auth0.getSession();
      if (session?.user) {
        const user = session.user;
        sax_id = sax_id || user.sax_id?.toString();
        tenant_id = tenant_id || user.tenant_id;
        practice_id = practice_id || user.practice_id;
        email = email || user.email || "";
        name = name || user.name || "";
      }
    } catch (e) {
      console.error("[Auth Callback] No Auth0 session available", e);
    }
  }

  if (!sax_id || !tenant_id || !practice_id) {
    console.error("[Auth Callback] Missing required fields", {
      sax_id: !!sax_id,
      tenant_id: !!tenant_id,
      practice_id: !!practice_id,
    });
    return NextResponse.json(
      { error: "Invalid authentication data" },
      { status: 400 },
    );
  }

  try {
    const secret = process.env.AUTH0_CLIENT_SECRET;
    if (!secret) {
      throw new Error("AUTH0_CLIENT_SECRET not configured");
    }

    const encoder = new TextEncoder();
    const jwtToken = await new SignJWT({
      sax_id: Number(sax_id),
      tenant_id,
      practice_id,
      email,
      name,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setIssuer("sleepconnect")
      .setAudience("outreach")
      .setExpirationTime("7d")
      .sign(encoder.encode(secret));

    const response = NextResponse.redirect(redirect);

    response.cookies.set("x-sax-user-context", jwtToken, {
      httpOnly: true,
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    console.log("[Auth Callback] Auth successful:", {
      sax_id,
      tenant_id,
      practice_id,
      redirect,
    });

    return response;
  } catch (error) {
    console.error("[Auth Callback] Error:", error);
    return NextResponse.json(
      { error: "Authentication failed" },
      { status: 500 },
    );
  }
}
