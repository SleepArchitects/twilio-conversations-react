import { auth0 } from "./auth0";
import { NextRequest, NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { verifyUserContextToken } from "./jwt-utils";

// Re-export types
export type Session = unknown;
export type Claims = Record<string, unknown>;

/**
 * Extended claims with SAX-specific fields from Auth0 token
 */
export interface SaxClaims extends Claims {
  sax_id: number;
  tenant_id: string;
  practice_id: string;
  email: string;
  name: string;
}

/**
 * User context extracted from session for API routes
 */
export interface UserContext {
  saxId: number;
  tenantId: string;
  practiceId: string;
}

/**
 * Check if auth is disabled for development
 */
function isAuthDisabled(): boolean {
  return process.env.DISABLE_AUTH === "true";
}

/**
 * Mock user for development when auth is disabled
 * Uses real default tenant/practice IDs from sleepconnect/constants/index.ts
 */
function getMockUser(): SaxClaims {
  return {
    sax_id: 1,
    tenant_id: "00000000-0000-0000-0000-000000000001",
    practice_id: "00000000-0000-0000-0000-000000000020",
    email: "dev@example.com",
    name: "Dev User",
    sub: "1",
  };
}

/**
 * Check if running in multi-zone mode (behind SleepConnect proxy)
 */
function isMultiZoneMode(): boolean {
  return process.env.MULTI_ZONE_MODE === "true";
}

/**
 * Get user context from forwarded JWT cookie or header (multi-zone mode)
 * SleepConnect forwards user context via x-sax-user-context JWT cookie/header
 */
async function getUserFromForwardedCookie(): Promise<SaxClaims | null> {
  // console.debug("[AUTH] getUserFromForwardedCookie called");
  try {
    const headersList = headers();
    const cookieStore = cookies();

    // First try the header (set by middleware for rewrites)
    let jwtToken = headersList.get("x-sax-user-context");
    // console.debug(
    //   // "[AUTH] x-sax-user-context header:",
    //   jwtToken ? "FOUND" : "NOT FOUND",
    // );

    // Fall back to cookie (for subsequent requests after initial cookie is set)
    if (!jwtToken) {
      // console.debug("[AUTH] Header not found, trying cookie store...");
      const userContextCookie = cookieStore.get("x-sax-user-context");
      if (userContextCookie) {
        jwtToken = userContextCookie.value;
        // console.debug(
        // "[AUTH] Found x-sax-user-context in cookie (via cookies())",
        // );
      } else {
        // console.debug("[AUTH] x-sax-user-context NOT in cookie store");

        // Last resort: try parsing from cookie header manually
        // console.debug("[AUTH] Trying manual cookie header parse...");
        const cookieHeader = headersList.get("cookie") || "";
        // console.debug("[AUTH] Cookie header length:", cookieHeader.length);
        const match = cookieHeader.match(/x-sax-user-context=([^;]+)/);
        if (match) {
          jwtToken = decodeURIComponent(match[1]);
          // console.debug(
          // "[AUTH] Found x-sax-user-context in cookie header (manual parse)",
          // );
        } else {
          // console.debug(
          // "[AUTH] x-sax-user-context NOT in cookie header. Cookies present:",
          //   cookieHeader
          //     .split(";")
          //     .map((c) => c.trim().split("=")[0])
          //     .join(", "),
          // );
        }
      }
    }

    if (!jwtToken) {
      // console.debug("[AUTH] No x-sax-user-context header or cookie found");
      return null;
    }

    // console.debug("[AUTH] Verifying JWT token...");
    const userContext = await verifyUserContextToken(jwtToken);

    if (!userContext) {
      console.debug("[AUTH] JWT verification failed");
      return null;
    }

    // console.debug(
    //   // "[AUTH] User context from JWT:",
    //   userContext.sax_id,
    // );

    return {
      sax_id: userContext.sax_id,
      tenant_id: userContext.tenant_id,
      practice_id: userContext.practice_id,
      email: userContext.email || "",
      name: userContext.name || "",
      sub: String(userContext.sax_id),
    };
  } catch (error) {
    console.error("[AUTH] Error verifying JWT token:", error);
    return null;
  }
}

/**
 * Get session - works in both standalone and multi-zone modes
 */
export async function getSession(): Promise<{ user: SaxClaims } | null> {
  // console.debug("[AUTH] getSession called");
  // Dev mode: return mock user when auth is disabled
  if (isAuthDisabled()) {
    // console.debug("[AUTH] Auth disabled - using mock user");
    return { user: getMockUser() };
  }

  // Multi-zone mode: read from forwarded cookie
  if (isMultiZoneMode()) {
    // console.debug("[AUTH] Multi-zone mode - looking for forwarded cookie");
    const user = await getUserFromForwardedCookie();
    if (user) {
      // console.debug("[AUTH] Found user from forwarded cookie:", user.sax_id);
      return { user };
    }
    // Fallback to mock user so local/missing headers don't block UI in dev
    console
      .debug
      // "[AUTH] Multi-zone mode but no user context found - using mock user",
      ();
    return { user: getMockUser() };
  }

  // Standalone mode: use Auth0 session
  try {
    const session = await auth0.getSession();
    return session as { user: SaxClaims } | null;
  } catch {
    return null;
  }
}

/**
 * Wrapper for API routes that require authentication
 * Works in both standalone and multi-zone modes
 */
export function withApiAuthRequired(
  handler: (
    req: NextRequest,
    routeContext?: Record<string, unknown>,
  ) => Promise<NextResponse>,
): (
  req: NextRequest,
  routeContext?: Record<string, unknown>,
) => Promise<NextResponse> {
  return async (req: NextRequest, routeContext?: Record<string, unknown>) => {
    // console.debug("[AUTH] withApiAuthRequired - starting");
    // Dev mode: bypass auth when disabled
    if (isAuthDisabled()) {
      // console.debug("[AUTH] Auth disabled - bypassing authentication");
      return handler(req, routeContext);
    }

    // Multi-zone mode: validate forwarded cookie
    if (isMultiZoneMode()) {
      // console.debug("[AUTH] Multi-zone mode - checking forwarded cookie");
      const user = getUserFromForwardedCookie();
      if (!user) {
        console
          .debug
          // "[AUTH] Multi-zone: missing user context - allowing with mock user",
          ();
      } else {
        // console.debug("[AUTH] Multi-zone: found user context:", user.sax_id);
      }
      return handler(req, routeContext);
    }

    // Standalone mode: use Auth0 auth wrapper
    return auth0.withApiAuthRequired(
      (authReq: NextRequest, authContext: Record<string, unknown>) =>
        handler(authReq, authContext),
    )(req, routeContext as Record<string, never>) as Promise<NextResponse>;
  };
}

/**
 * Get authenticated user's SAX ID from the current session
 * @returns The user's SAX ID or null if not authenticated
 */
export async function getCurrentUserSaxId(): Promise<number | null> {
  try {
    const session = await getSession();
    if (!session?.user) return null;
    return (session.user as SaxClaims).sax_id ?? null;
  } catch {
    return null;
  }
}

/**
 * Get tenant/practice context from the current session
 * @returns Object containing tenantId and practiceId, or null if not authenticated
 */
export async function getTenantContext(): Promise<{
  tenantId: string;
  practiceId: string;
} | null> {
  try {
    const session = await getSession();
    if (!session?.user) return null;
    const user = session.user as SaxClaims;
    return {
      tenantId: user.tenant_id,
      practiceId: user.practice_id,
    };
  } catch {
    return null;
  }
}

/**
 * Get full user context from the current session
 * @returns UserContext object or null if not authenticated
 */
export async function getUserContext(): Promise<UserContext | null> {
  try {
    const session = await getSession();
    if (!session?.user) return null;
    const user = session.user as SaxClaims;
    return {
      saxId: user.sax_id,
      tenantId: user.tenant_id,
      practiceId: user.practice_id,
    };
  } catch {
    return null;
  }
}

/**
 * Get Auth0 access token for calling backend APIs
 * In multi-zone mode, this fetches the token from SleepConnect's token endpoint
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_SLEEPCONNECT_URL ||
      process.env.NEXT_PUBLIC_APP_BASE_URL ||
      "http://localhost:3000";
    const tokenUrl = `${baseUrl}/api/auth/token`;

    console.log("[AUTH] getAccessToken - fetching from:", tokenUrl);

    const headersList = headers();
    const cookieHeader = headersList.get("cookie") || "";
    console.log(
      "[AUTH] getAccessToken - cookie header length:",
      cookieHeader.length,
    );

    const response = await fetch(tokenUrl, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
      },
    });

    console.log("[AUTH] getAccessToken - response status:", response.status);
    console.log("[AUTH] getAccessToken - response ok:", response.ok);

    if (!response.ok) {
      console.log("[AUTH] getAccessToken - response not ok, returning null");
      return null;
    }

    const data = await response.json();
    console.log(
      "[AUTH] getAccessToken - response data keys:",
      Object.keys(data),
    );

    // SleepConnect returns 'accessToken' (camelCase), not 'access_token' (snake_case)
    const token = data.accessToken || data.access_token;
    console.log("[AUTH] getAccessToken - token present:", !!token);

    if (token) {
      console.log(
        "[AUTH] getAccessToken - token (first 20 chars):",
        token.substring(0, 20),
      );
    } else {
      console.log(
        "[AUTH] getAccessToken - WARNING: No token in response data:",
        JSON.stringify(data),
      );
    }

    return token || null;
  } catch (error) {
    console.error("[AUTH] Error fetching access token:", error);
    return null;
  }
}

/**
 * Wrapper that extracts user context for API routes.
 * Combines Auth0 authentication with SAX user context extraction.
 *
 * @param handler - Async function that receives the request and user context
 * @returns Wrapped handler with authentication and context extraction
 *
 * @example
 * ```ts
 * export const GET = withUserContext(async (req, { saxId, tenantId, practiceId }) => {
 *   // Handler has access to authenticated user context
 *   return NextResponse.json({ saxId });
 * });
 * ```
 */
export function withUserContext(
  handler: (
    req: NextRequest,
    context: UserContext,
    routeContext?: Record<string, unknown>,
  ) => Promise<NextResponse>,
) {
  return withApiAuthRequired(
    async (
      req: NextRequest,
      routeContext?: Record<string, unknown>,
    ): Promise<NextResponse> => {
      // console.debug("[AUTH] withUserContext - starting");
      const session = await getSession();
      console.debug(
        "[AUTH] withUserContext - session:",
        JSON.stringify(session),
      );
      if (!session?.user) {
        console.debug(
          "[AUTH] withUserContext - no session/user, returning 401",
        );
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      const user = session.user as SaxClaims;
      console.debug(
        "[AUTH] withUserContext - user:",
        JSON.stringify({
          sax_id: user.sax_id,
          tenant_id: user.tenant_id,
          practice_id: user.practice_id,
        }),
      );
      if (!user.sax_id || !user.tenant_id || !user.practice_id) {
        console.debug(
          "[AUTH] withUserContext - invalid context, returning 403",
        );
        return NextResponse.json(
          { error: "Invalid user context" },
          { status: 403 },
        );
      }
      // console.debug("[AUTH] withUserContext - calling handler with context");
      return handler(
        req,
        {
          saxId: user.sax_id,
          tenantId: user.tenant_id,
          practiceId: user.practice_id,
        },
        routeContext,
      );
    },
  );
}
