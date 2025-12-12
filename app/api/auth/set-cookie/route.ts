import { NextResponse } from "next/server";
import { headers, cookies } from "next/headers";

/**
 * Set x-sax-user-context cookie from header
 * This is needed because middleware rewrites don't forward response cookies
 */
export async function GET() {
  try {
    const headersList = headers();
    const cookieStore = cookies();

    // Get JWT from header (set by sleepconnect middleware)
    const jwtToken = headersList.get("x-sax-user-context");

    if (!jwtToken) {
      return NextResponse.json(
        { error: "No JWT token in headers" },
        { status: 400 },
      );
    }

    // Set as cookie
    cookieStore.set("x-sax-user-context", jwtToken, {
      httpOnly: true,
      maxAge: 60 * 60, // 1 hour
      path: "/",
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("[Set Cookie API] Error:", error);
    return NextResponse.json(
      { error: "Failed to set cookie" },
      { status: 500 },
    );
  }
}
