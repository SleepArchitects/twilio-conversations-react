// Auth0 session fetching is disabled here because calling auth0.getSession
// may throw when upstream sets cookies/headers with characters that violate
// Web header validation. This endpoint now only reports cookies/env to avoid
// generating 500s during diagnostics.
import { NextRequest, NextResponse } from "next/server";

/**
 * Diagnostic endpoint to check Auth0 session and cookies
 * Access at /api/debug/auth to see current auth state
 */
export async function GET(req: NextRequest) {
  try {
    const cookies = req.cookies.getAll();

    return NextResponse.json({
      hasSession: false,
      user: null,
      cookies: cookies.map((c) => ({
        name: c.name,
        value:
          typeof c.value === "string"
            ? `${c.value.substring(0, 20)}...`
            : "<non-string>",
      })),
      env: {
        AUTH0_BASE_URL: process.env.AUTH0_BASE_URL,
        AUTH0_DOMAIN: process.env.AUTH0_DOMAIN,
        NEXT_PUBLIC_APP_BASE_URL: process.env.NEXT_PUBLIC_APP_BASE_URL,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unknown error",
        hasSession: false,
      },
      { status: 500 },
    );
  }
}
