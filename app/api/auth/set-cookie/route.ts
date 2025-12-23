import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { auth0 } from "@/lib/auth0";
import { SignJWT } from "jose";

/**
 * Set x-sax-user-context cookie from header OR Auth0 session (fallback)
 *
 * PREFERRED: Get JWT from x-sax-user-context header (set by SleepConnect middleware)
 * FALLBACK: Read Auth0 session directly and create JWT ourselves
 *
 * This endpoint bridges the gap between SleepConnect's Auth0 session
 * and the Outreach zone's JWT-based authentication.
 */
export async function GET() {
  try {
    const headersList = headers();
    const cookieStore = cookies();

    // 🔍 DIAGNOSTIC: Log all headers to see what's being forwarded
    console.log("[Set Cookie API] 🔍 Checking for user context...");

    // ATTEMPT 1: Try to get JWT from header (preferred method)
    let jwtToken = headersList.get("x-sax-user-context");

    if (jwtToken) {
      console.log(
        "[Set Cookie API] ✅ Found x-sax-user-context header (preferred method)",
      );
    } else {
      console.warn(
        "[Set Cookie API] ⚠️  No x-sax-user-context header - falling back to Auth0 session",
      );
      console.warn(
        "[Set Cookie API] ⚠️  TODO: SleepConnect should forward this header!",
      );

      // ATTEMPT 2: Fallback to reading Auth0 session directly
      try {
        const session = await auth0.getSession();

        if (!session?.user) {
          console.error("[Set Cookie API] ❌ No Auth0 session found");
          return NextResponse.json(
            { error: "Not authenticated - no session or JWT header" },
            { status: 401 },
          );
        }

        const user = session.user as any;
        console.log(
          "[Set Cookie API] ✅ Found Auth0 session, creating JWT token",
        );

        // Use snake_case properties which is the standard for SAX claims
        const sax_id = user.sax_id || user.saxId;
        const tenant_id = user.tenant_id || user.tenantId;
        const practice_id = user.practice_id || user.practiceId;

        console.log("[Set Cookie API] 📋 User data:", {
          sax_id,
          email: user.email,
          tenant_id,
          practice_id,
        });

        // Create JWT token ourselves (same format SleepConnect should create)
        const secret = process.env.AUTH0_CLIENT_SECRET;
        if (!secret) {
          throw new Error("AUTH0_CLIENT_SECRET not configured");
        }

        // Use jose (Edge Runtime compatible) to create JWT
        const encoder = new TextEncoder();
        jwtToken = await new SignJWT({
          sax_id,
          tenant_id,
          practice_id,
          email: user.email || "",
          name: user.name || "",
        })
          .setProtectedHeader({ alg: "HS256" })
          .setIssuedAt()
          .setIssuer("sleepconnect")
          .setAudience("outreach")
          .setExpirationTime("1h")
          .sign(encoder.encode(secret));

        console.log(
          "[Set Cookie API] ✅ Created JWT token from Auth0 session (fallback)",
        );
      } catch (fallbackError) {
        console.error("[Set Cookie API] ❌ Fallback failed:", fallbackError);
        return NextResponse.json(
          {
            error: "Authentication failed",
            details: "No JWT header and unable to read Auth0 session",
          },
          { status: 401 },
        );
      }
    }

    // Ensure we have a valid token (TypeScript guard)
    if (!jwtToken) {
      console.error("[Set Cookie API] ❌ Failed to obtain JWT token");
      return NextResponse.json(
        { error: "Failed to obtain authentication token" },
        { status: 500 },
      );
    }

    // Set the JWT as a cookie
    console.log("[Set Cookie API] ✅ Setting x-sax-user-context cookie");
    cookieStore.set("x-sax-user-context", jwtToken, {
      httpOnly: true,
      maxAge: 60 * 60, // 1 hour
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    console.log("[Set Cookie API] ✅ Cookie set successfully");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Set Cookie API] ❌ Error:", error);
    return NextResponse.json(
      { error: "Failed to set cookie" },
      { status: 500 },
    );
  }
}
