import {
  getSession as auth0GetSession,
  withApiAuthRequired as auth0WithApiAuthRequired,
  Session,
  Claims,
} from "@auth0/nextjs-auth0";
import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";

// Re-export types
export type { Session, Claims };

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
 */
function getMockUser(): SaxClaims {
  return {
    sax_id: 1,
    tenant_id: "dev-tenant",
    practice_id: "dev-practice",
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
 * Get user context from forwarded cookie (multi-zone mode)
 * SleepConnect forwards user context via x-sax-user-context cookie
 */
function getUserFromForwardedCookie(): SaxClaims | null {
  try {
    const headersList = headers();
    const cookieHeader = headersList.get("cookie") || "";

    // Parse the x-sax-user-context cookie
    const match = cookieHeader.match(/x-sax-user-context=([^;]+)/);
    if (!match) {
      console.log("[AUTH] No x-sax-user-context cookie found");
      return null;
    }

    const decoded = decodeURIComponent(match[1]);
    const userContext = JSON.parse(decoded);

    if (
      !userContext.sax_id ||
      !userContext.tenant_id ||
      !userContext.practice_id
    ) {
      console.log(
        "[AUTH] Missing required fields in user context",
        userContext,
      );
      return null;
    }

    console.log("[AUTH] User context from cookie:", userContext.sax_id);

    return {
      sax_id: userContext.sax_id,
      tenant_id: userContext.tenant_id,
      practice_id: userContext.practice_id,
      email: userContext.email || "",
      name: userContext.name || "",
      sub: String(userContext.sax_id),
    };
  } catch (error) {
    console.error("[AUTH] Error parsing user context cookie:", error);
    return null;
  }
}

/**
 * Get session - works in both standalone and multi-zone modes
 */
export async function getSession(): Promise<{ user: SaxClaims } | null> {
  // Dev mode: return mock user when auth is disabled
  if (isAuthDisabled()) {
    console.log("[AUTH] Auth disabled - using mock user");
    return { user: getMockUser() };
  }

  // Multi-zone mode: read from forwarded cookie
  if (isMultiZoneMode()) {
    const user = getUserFromForwardedCookie();
    if (user) {
      return { user };
    }
    console.log("[AUTH] Multi-zone mode but no user context found");
    return null;
  }

  // Standalone mode: use Auth0 session
  try {
    const session = await auth0GetSession();
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
  handler: (req: NextRequest) => Promise<NextResponse>,
): (req: NextRequest) => Promise<NextResponse> {
  return async (req: NextRequest) => {
    // Dev mode: bypass auth when disabled
    if (isAuthDisabled()) {
      console.log("[AUTH] Auth disabled - bypassing authentication");
      return handler(req);
    }

    // Multi-zone mode: validate forwarded cookie
    if (isMultiZoneMode()) {
      const user = getUserFromForwardedCookie();
      if (!user) {
        console.log("[AUTH] Unauthorized - no user context in cookie");
        return NextResponse.json(
          { error: "Unauthorized - missing user context" },
          { status: 401 },
        );
      }
      return handler(req);
    }

    // Standalone mode: use Auth0 auth wrapper
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return auth0WithApiAuthRequired(
      handler as (req: NextRequest) => Promise<Response>,
    )(req, {} as Record<string, never>) as Promise<NextResponse>;
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
  handler: (req: Request, context: UserContext) => Promise<Response>,
) {
  return withApiAuthRequired(async (req: Request): Promise<Response> => {
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const user = session.user as SaxClaims;
    if (!user.sax_id || !user.tenant_id || !user.practice_id) {
      return NextResponse.json(
        { error: "Invalid user context" },
        { status: 403 },
      );
    }
    return handler(req, {
      saxId: user.sax_id,
      tenantId: user.tenant_id,
      practiceId: user.practice_id,
    });
  });
}
