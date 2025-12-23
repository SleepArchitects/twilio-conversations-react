import { NextRequest, NextResponse } from "next/server";
import { verifyUserContextToken } from "@/lib/jwt-utils";

/**
 * Catch-all API proxy for Outreach Lambda backend
 *
 * This route proxies all requests from /api/outreach/* to the backend Lambda API.
 * This avoids CORS issues by making backend calls same-origin from the browser's perspective.
 */
async function proxyRequest(
  request: NextRequest,
  { params }: { params: { path?: string[] } },
) {
  try {
    console.log("\n========================================");
    console.log("[API Proxy] ===== DIAGNOSTIC START =====");
    console.log("========================================");

    const apiBaseUrl =
      process.env.API_BASE_URL ||
      "https://develop-api.mydreamconnect.com/develop";

    // DIAGNOSTIC: Log incoming request details
    const pathString = params.path?.join("/") || "";
    console.log("[API Proxy] Incoming request:");
    console.log("[API Proxy]   Method:", request.method);
    console.log("[API Proxy]   Path segments:", params.path);
    console.log("[API Proxy]   Path string:", pathString);
    console.log("[API Proxy]   API Base URL:", apiBaseUrl);

    // Construct the backend URL
    // ✅ FIX: Remove duplicate /outreach/ segment and /api/ segment
    // Backend expects: /develop/outreach/conversations
    // NOT: /develop/outreach/api/conversations
    const url = new URL(`${apiBaseUrl}/outreach/${pathString}`);
    console.log("[API Proxy] Constructed URL:", url.toString());

    // Forward query parameters
    request.nextUrl.searchParams.forEach((value, key) => {
      url.searchParams.append(key, value);
    });

    console.log(`[API Proxy] Final URL: ${url.toString()}`);

    // DIAGNOSTIC: Try to extract user context from JWT cookie
    console.log("\n[API Proxy] ===== USER CONTEXT EXTRACTION =====");
    const cookies = request.headers.get("cookie") || "";
    console.log("[API Proxy] Cookies present:", cookies ? "YES" : "NO");

    let userContext = null;
    const cookieMatch = cookies.match(/x-sax-user-context=([^;]+)/);
    if (cookieMatch) {
      const token = cookieMatch[1];
      console.log("[API Proxy] Found x-sax-user-context cookie");
      console.log(
        "[API Proxy] Token (first 50 chars):",
        token.substring(0, 50) + "...",
      );

      try {
        userContext = await verifyUserContextToken(token);
        if (userContext) {
          console.log("[API Proxy] ✅ Successfully decoded user context:");
          console.log("[API Proxy]   tenant_id:", userContext.tenant_id);
          console.log("[API Proxy]   practice_id:", userContext.practice_id);
          console.log("[API Proxy]   sax_id:", userContext.sax_id);
          console.log("[API Proxy]   email:", userContext.email);
        } else {
          console.error(
            "[API Proxy] ❌ JWT verification failed - token invalid",
          );
        }
      } catch (error) {
        console.error("[API Proxy] ❌ Error decoding JWT:", error);
      }
    } else {
      console.warn("[API Proxy] ⚠️  No x-sax-user-context cookie found");
    }

    // Prepare headers
    const headers = new Headers();
    request.headers.forEach((value, key) => {
      // Skip host and other headers that might interfere with the proxy
      if (["host", "connection", "content-length"].includes(key.toLowerCase()))
        return;
      headers.set(key, value);
    });

    console.log("\n[API Proxy] ===== AUTHENTICATION STRATEGY =====");

    // STRATEGY 1: Use user context headers (recommended by documentation)
    if (userContext) {
      console.log("[API Proxy] Using STRATEGY 1: User context headers");
      headers.set("x-tenant-id", userContext.tenant_id);
      headers.set("x-practice-id", userContext.practice_id);
      headers.set("x-coordinator-sax-id", String(userContext.sax_id));
      headers.set("x-user-sax-id", String(userContext.sax_id));
      headers.set("x-sax-id", String(userContext.sax_id));
      console.log("[API Proxy] Added headers:");
      console.log("[API Proxy]   x-tenant-id:", userContext.tenant_id);
      console.log("[API Proxy]   x-practice-id:", userContext.practice_id);
      console.log("[API Proxy]   x-coordinator-sax-id:", userContext.sax_id);
    } else {
      // STRATEGY 2: Try Auth0 access token as fallback
      console.log("[API Proxy] Using STRATEGY 2: Auth0 token fallback");
      if (!headers.has("authorization")) {
        try {
          const baseUrl = request.nextUrl.origin;
          const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
          const tokenUrl = `${baseUrl}${basePath}/api/auth/token`;

          console.log(
            "[API Proxy] Fetching Auth0 access token from:",
            tokenUrl,
          );

          const tokenResponse = await fetch(tokenUrl, {
            headers: {
              cookie: request.headers.get("cookie") || "",
            },
          });

          if (tokenResponse.ok) {
            const tokenData = await tokenResponse.json();
            // SleepConnect returns 'accessToken' (camelCase), not 'access_token' (snake_case)
            const token = tokenData.accessToken || tokenData.access_token;
            if (token) {
              console.log("[API Proxy] ✅ Obtained Auth0 access token");
              headers.set("authorization", `Bearer ${token}`);
            } else {
              console.warn(
                "[API Proxy] ⚠️  Token response missing accessToken/access_token",
              );
            }
          } else {
            console.warn(
              "[API Proxy] ⚠️  Failed to fetch access token, status:",
              tokenResponse.status,
            );
          }
        } catch (error) {
          console.error("[API Proxy] ❌ Error fetching access token:", error);
        }
      }
    }

    // DIAGNOSTIC: Log outgoing request
    console.log("\n[API Proxy] ===== OUTGOING REQUEST =====");
    console.log("[API Proxy] URL:", url.toString());
    console.log("[API Proxy] Method:", request.method);
    console.log("[API Proxy] Headers:");
    headers.forEach((value, key) => {
      // Don't log full auth tokens for security
      if (key.toLowerCase() === "authorization") {
        console.log(`[API Proxy]   ${key}: Bearer [REDACTED]`);
      } else if (key.toLowerCase().includes("cookie")) {
        console.log(`[API Proxy]   ${key}: [REDACTED]`);
      } else {
        console.log(`[API Proxy]   ${key}: ${value}`);
      }
    });

    // Perform the fetch to the backend
    const startTime = Date.now();
    const response = await fetch(url.toString(), {
      method: request.method,
      headers,
      body:
        request.method !== "GET" && request.method !== "HEAD"
          ? await request.blob()
          : undefined,
      cache: "no-store",
    });
    const duration = Date.now() - startTime;

    console.log("\n[API Proxy] ===== BACKEND RESPONSE =====");
    console.log(
      `[API Proxy] Status: ${response.status} ${response.statusText}`,
    );
    console.log(`[API Proxy] Duration: ${duration}ms`);
    console.log("[API Proxy] Response Headers:");
    response.headers.forEach((value, key) => {
      console.log(`[API Proxy]   ${key}: ${value}`);
    });

    // Log response body for errors
    if (!response.ok) {
      try {
        const responseText = await response.text();
        console.error("[API Proxy] ❌ Error Response Body:", responseText);
        // Create new response with the text we just read
        const responseHeaders = new Headers();
        response.headers.forEach((value, key) => {
          if (!key.toLowerCase().startsWith("access-control-")) {
            responseHeaders.set(key, value);
          }
        });
        console.log("========================================");
        console.log("[API Proxy] ===== DIAGNOSTIC END =====");
        console.log("========================================\n");
        return new NextResponse(responseText, {
          status: response.status,
          headers: responseHeaders,
        });
      } catch (e) {
        console.error("[API Proxy] ❌ Could not read error response:", e);
      }
    }

    console.log("[API Proxy] ✅ Success!");
    console.log("========================================");
    console.log("[API Proxy] ===== DIAGNOSTIC END =====");
    console.log("========================================\n");

    // Create the response object
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      // Strip CORS headers from backend to avoid conflicts with local origin
      if (key.toLowerCase().startsWith("access-control-")) return;
      responseHeaders.set(key, value);
    });

    return new NextResponse(response.body, {
      status: response.status,
      headers: responseHeaders,
    });
  } catch (error) {
    console.error("[API Proxy] Error:", error);
    return NextResponse.json(
      { error: "Failed to proxy request to backend" },
      { status: 500 },
    );
  }
}

export const GET = proxyRequest;
export const POST = proxyRequest;
export const PUT = proxyRequest;
export const PATCH = proxyRequest;
export const DELETE = proxyRequest;
export const HEAD = proxyRequest;
export const OPTIONS = proxyRequest;
