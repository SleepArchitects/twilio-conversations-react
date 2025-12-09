import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/auth/token
 * Proxy token requests to SleepConnect's token endpoint
 *
 * In multi-zone setup, the Outreach zone doesn't have the Auth0 session,
 * only the forwarded user context. The actual access token must come from
 * SleepConnect's Auth0 session.
 */
export async function GET(request: NextRequest) {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:3000";
    const tokenUrl = `${baseUrl}/api/auth/token`;

    console.log("[Proxy /api/auth/token] Forwarding to:", tokenUrl);

    const response = await fetch(tokenUrl, {
      method: "GET",
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
    });

    console.log("[Proxy /api/auth/token] Response status:", response.status);

    if (!response.ok) {
      const errorText = await response.text();
      console.error("[Proxy /api/auth/token] Error response:", errorText);
      return NextResponse.json(
        { error: "Failed to get access token from SleepConnect" },
        { status: response.status },
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("[Proxy /api/auth/token] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch access token" },
      { status: 500 },
    );
  }
}
