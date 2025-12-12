import { NextRequest, NextResponse } from "next/server";

/**
 * Proxy /outreach/auth/profile to http://localhost:3000/auth/profile
 *
 * This is needed because Auth0's useUser() hook fetches from a relative path,
 * which gets prefixed with /outreach due to basePath config.
 * This route proxies the request to the actual auth profile endpoint on SleepConnect.
 */
export async function GET(request: NextRequest) {
  try {
    // console.debug(
    //   `[AUTH PROFILE PROXY] Received request for /outreach/auth/profile`,
    // );
    // Get the base URL from env or construct it
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:3000";

    // Forward the request to the actual auth profile endpoint
    const profileUrl = `${baseUrl}/auth/profile`;

    // console.log(`[Auth Profile Proxy] Forwarding request to: ${profileUrl}`);

    const response = await fetch(profileUrl, {
      method: "GET",
      headers: {
        // Forward all cookies
        cookie: request.headers.get("cookie") || "",
      },
      credentials: "include",
    });

    // console.log(`[Auth Profile Proxy] Response status: ${response.status}`);

    // Get the response text first to check if it's valid JSON
    const text = await response.text();

    if (!text || text.trim() === "") {
      console.error(
        "[Auth Profile Proxy] Empty response from sleepconnect - user may not be authenticated",
      );
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
