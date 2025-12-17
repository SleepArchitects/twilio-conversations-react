import { NextRequest, NextResponse } from "next/server";

/**
 * GET /auth/logout
 * Proxy logout requests to SleepConnect's Auth0 logout endpoint
 */
export async function GET(request: NextRequest) {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_BASE_URL || "http://localhost:3000";
    const searchParams = request.nextUrl.searchParams;

    // Forward the logout request to SleepConnect's Auth0 handler
    const logoutUrl = new URL("/auth/logout", baseUrl);

    // Copy query parameters (if any)
    searchParams.forEach((value, key) => {
      logoutUrl.searchParams.set(key, value);
    });

    console.log("[Proxy /auth/logout] Forwarding to:", logoutUrl.toString());

    const response = await fetch(logoutUrl.toString(), {
      method: "GET",
      headers: {
        cookie: request.headers.get("cookie") || "",
      },
      redirect: "manual", // Don't follow redirects, pass them through
    });

    console.log("[Proxy /auth/logout] Response status:", response.status);

    // If it's a redirect (which Auth0 logout typically is), pass it through
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      console.log("[Proxy /auth/logout] Redirecting to:", location);

      if (location) {
        return NextResponse.redirect(location);
      }
    }

    // For non-redirect responses, proxy the response
    const data = await response.text();
    return new NextResponse(data, {
      status: response.status,
      headers: {
        "content-type": response.headers.get("content-type") || "text/html",
      },
    });
  } catch (error) {
    console.error("[Proxy /auth/logout] Error:", error);
    return NextResponse.json({ error: "Failed to logout" }, { status: 500 });
  }
}
