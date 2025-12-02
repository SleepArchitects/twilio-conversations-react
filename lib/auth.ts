import {
  getSession,
  withApiAuthRequired,
  Session,
  Claims,
} from "@auth0/nextjs-auth0";
import { NextResponse } from "next/server";

// Re-export for convenience
export { getSession, withApiAuthRequired };
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
