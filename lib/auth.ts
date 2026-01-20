import { auth0 } from "./auth0";
import { NextRequest, NextResponse } from "next/server";
import { headers, cookies } from "next/headers";
import { verifyUserContextToken } from "./jwt-utils";

/**
 * The role name that identifies SAX employees/staff
 * We look this up dynamically from the roles API instead of hardcoding the ID
 */
export const SAX_ROLE_NAME = "Sax";

// Re-export types
export type Session = unknown;
export type Claims = Record<string, unknown>;

/**
 * Cache for user roles to avoid repeated API calls
 * Key: saxId, Value: { roles: string[], timestamp: number }
 */
const userRolesCache = new Map<
  number,
  { roles: string[]; isSAXUser: boolean; timestamp: number }
>();

/**
 * Cache for all roles (to look up role names)
 */
let allRolesCache: { roles: Role[]; timestamp: number } | null = null;

/**
 * Cache TTL in milliseconds (5 minutes)
 */
const ROLES_CACHE_TTL = 5 * 60 * 1000;

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
  /** True if user has SAX role - grants admin access across all tenants */
  isSAXUser: boolean;
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

  // Multi-zone mode: read from forwarded cookie (REQUIRED)
  if (isMultiZoneMode()) {
    // console.debug("[AUTH] Multi-zone mode - looking for forwarded cookie");
    const user = await getUserFromForwardedCookie();
    if (user) {
      // console.debug("[AUTH] Found user from forwarded cookie:", user.sax_id);
      return { user };
    }
    // No user context found in multi-zone mode - return null (unauthenticated)
    console.debug(
      "[AUTH] Multi-zone mode but no user context found - returning null",
    );
    return null;
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

    // Multi-zone mode: validate forwarded cookie (REQUIRED)
    if (isMultiZoneMode()) {
      // console.debug("[AUTH] Multi-zone mode - checking forwarded cookie");
      const user = await getUserFromForwardedCookie();
      if (!user) {
        console.debug(
          "[AUTH] Multi-zone: missing user context - returning 401",
        );
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      // console.debug("[AUTH] Multi-zone: found user context:", user.sax_id);
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

    // Check if user has SAX role (cached, 5 min TTL)
    const { isSAXUser } = await fetchUserRolesServerSide(user.sax_id);

    return {
      saxId: user.sax_id,
      tenantId: user.tenant_id,
      practiceId: user.practice_id,
      isSAXUser,
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
 * User role interface matching the SleepConnect API response
 */
interface UserRole {
  sax_id: string;
  role_id: string;
  active: boolean;
}

/**
 * Role interface matching the SleepConnect API response
 */
interface Role {
  role_id: string;
  name: string;
  active: boolean;
}

/**
 * Fetch all roles from SleepConnect API (cached)
 * Used to look up SAX role ID by name
 */
async function fetchAllRolesServerSide(): Promise<Role[]> {
  // Check cache first
  if (allRolesCache && Date.now() - allRolesCache.timestamp < ROLES_CACHE_TTL) {
    console.debug("[AUTH] Using cached all roles");
    return allRolesCache.roles;
  }

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_SLEEPCONNECT_URL ||
      process.env.NEXT_PUBLIC_APP_BASE_URL ||
      "http://localhost:3000";

    const rolesUrl = `${baseUrl}/api/roles`;
    console.debug("[AUTH] Fetching all roles from:", rolesUrl);

    const headersList = headers();
    const cookieHeader = headersList.get("cookie") || "";

    const response = await fetch(rolesUrl, {
      method: "GET",
      headers: {
        cookie: cookieHeader,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(
        "[AUTH] Failed to fetch all roles, status:",
        response.status,
      );
      return [];
    }

    const roles: Role[] = await response.json();
    console.debug("[AUTH] Fetched all roles:", roles.length);

    // Cache the result
    allRolesCache = { roles, timestamp: Date.now() };
    return roles;
  } catch (error) {
    console.error("[AUTH] Error fetching all roles:", error);
    return [];
  }
}

/**
 * Get the SAX role ID by looking up the role name from the roles API
 * Returns null if role not found
 */
async function getSAXRoleId(): Promise<string | null> {
  const allRoles = await fetchAllRolesServerSide();
  const saxRole = allRoles.find(
    (r) => r.name.toLowerCase() === SAX_ROLE_NAME.toLowerCase() && r.active,
  );
  return saxRole?.role_id ?? null;
}

/**
 * Fetch user roles from SleepConnect API and check for SAX role
 * Results are cached for 5 minutes to minimize API overhead
 *
 * @param saxId - The user's SAX ID
 * @returns Object with roles array and isSAXUser boolean
 */
async function fetchUserRolesServerSide(
  saxId: number,
): Promise<{ roles: string[]; isSAXUser: boolean }> {
  // Check cache first
  const cached = userRolesCache.get(saxId);
  if (cached && Date.now() - cached.timestamp < ROLES_CACHE_TTL) {
    console.debug("[AUTH] Using cached roles for saxId:", saxId);
    return { roles: cached.roles, isSAXUser: cached.isSAXUser };
  }

  try {
    const baseUrl =
      process.env.NEXT_PUBLIC_SLEEPCONNECT_URL ||
      process.env.NEXT_PUBLIC_APP_BASE_URL ||
      "http://localhost:3000";

    const rolesUrl = `${baseUrl}/api/users/${saxId}/roles`;
    console.debug("[AUTH] Fetching roles from:", rolesUrl);

    const headersList = headers();
    const cookieHeader = headersList.get("cookie") || "";

    const response = await fetch(rolesUrl, {
      method: "POST",
      headers: {
        cookie: cookieHeader,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      console.warn(
        "[AUTH] Failed to fetch user roles, status:",
        response.status,
      );
      // Cache empty result to avoid repeated failed requests
      const emptyResult = { roles: [], isSAXUser: false };
      userRolesCache.set(saxId, { ...emptyResult, timestamp: Date.now() });
      return emptyResult;
    }

    const roles: UserRole[] = await response.json();

    // Extract active role IDs
    const activeRoleIds = roles.filter((r) => r.active).map((r) => r.role_id);

    // Get SAX role ID dynamically from roles API
    const saxRoleId = await getSAXRoleId();

    // Check if user has SAX role
    const isSAXUser = saxRoleId ? activeRoleIds.includes(saxRoleId) : false;

    console.debug("[AUTH] Fetched roles for saxId:", saxId, {
      roleCount: activeRoleIds.length,
      saxRoleId,
      isSAXUser,
    });

    // Cache the result
    const result = { roles: activeRoleIds, isSAXUser };
    userRolesCache.set(saxId, { ...result, timestamp: Date.now() });

    return result;
  } catch (error) {
    console.error("[AUTH] Error fetching user roles:", error);
    // Cache empty result on error to avoid repeated failed requests
    const emptyResult = { roles: [], isSAXUser: false };
    userRolesCache.set(saxId, { ...emptyResult, timestamp: Date.now() });
    return emptyResult;
  }
}

/**
 * Check if a user has the SAX role (cached)
 * @param saxId - The user's SAX ID
 * @returns true if user has SAX role
 */
export async function checkIsSAXUser(saxId: number): Promise<boolean> {
  const { isSAXUser } = await fetchUserRolesServerSide(saxId);
  return isSAXUser;
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

      // Check if user has SAX role (cached, 5 min TTL)
      const { isSAXUser } = await fetchUserRolesServerSide(user.sax_id);
      console.debug("[AUTH] withUserContext - isSAXUser:", isSAXUser);

      // console.debug("[AUTH] withUserContext - calling handler with context");
      return handler(
        req,
        {
          saxId: user.sax_id,
          tenantId: user.tenant_id,
          practiceId: user.practice_id,
          isSAXUser,
        },
        routeContext,
      );
    },
  );
}
