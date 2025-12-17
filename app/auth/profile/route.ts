import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy /outreach/auth/profile to /outreach/api/auth/profile
 *
 * This is needed because Auth0's useUser() hook fetches from /auth/profile,
 * which gets prefixed with /outreach due to basePath config.
 * This route proxies the request to our actual API endpoint.
 */
export async function GET(request: NextRequest) {
  try {
    // Get the base URL for this app
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:3001";

    // Forward to our own API endpoint
    const profileUrl = `${baseUrl}/outreach/api/auth/profile`;

    const response = await fetch(profileUrl, {
      method: "GET",
      headers: {
        // Forward all cookies
        cookie: request.headers.get("cookie") || "",
      },
      credentials: "include",
    });

    // Get the response text first to check if it's valid JSON
    const text = await response.text();

    if (!text || text.trim() === "") {
      return NextResponse.json(
        { error: "Not authenticated", user: null },
        { status: 401 },
      );
    }

    // Parse the response data
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      console.error(
        "[Auth Profile Proxy] Failed to parse response:",
        text.substring(0, 200),
      );
      return NextResponse.json(
        { error: "Invalid response from auth server", user: null },
        { status: 502 },
      );
    }

    // Return the response with the same status
    return NextResponse.json(data, {
      status: response.status,
    });
  } catch (error) {
    console.error("[Auth Profile Proxy] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch profile" },
      { status: 500 },
    );
  }
}
