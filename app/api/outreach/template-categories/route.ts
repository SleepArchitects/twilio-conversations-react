import { NextResponse } from "next/server";
import { ApiError, api, buildPath } from "@/lib/api";
import { type UserContext, withUserContext, getAccessToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lambda API base path for SMS outreach
 */
const LAMBDA_API_BASE = "/outreach";

/**
 * Lambda category format from API response
 */
interface LambdaCategory {
  id: string;
  tenantId: string;
  name: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Lambda list-categories response format
 */
interface LambdaCategoriesResponse {
  data: LambdaCategory[];
}

/**
 * Get Lambda API headers with user context
 */
function getLambdaHeaders(userContext: UserContext): Record<string, string> {
  return {
    "x-tenant-id": userContext.tenantId,
    "x-practice-id": userContext.practiceId,
    "x-coordinator-sax-id": String(userContext.saxId),
    "x-user-sax-id": String(userContext.saxId),
    "x-sax-id": String(userContext.saxId),
  };
}

/**
 * Create standardized error response
 */
function errorResponse(
  code: string,
  message: string,
  status: number,
): NextResponse {
  return NextResponse.json(
    {
      code,
      message,
    },
    { status },
  );
}

/**
 * GET /api/outreach/template-categories
 *
 * List all template categories for the tenant.
 * Calls Lambda `list-categories`.
 *
 * @returns { data: LambdaCategory[] }
 */
export const GET = withUserContext(
  async (req: Request, userContext: UserContext) => {
    console.log(`[TEMPLATE CATEGORIES API] LIST`);
    try {
      // Get access token for Authorization header
      const accessToken = await getAccessToken();
      const headers: Record<string, string> = getLambdaHeaders(userContext);
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      // Call Lambda API to list categories
      const lambdaResponse = await api.get<LambdaCategoriesResponse>(
        buildPath(LAMBDA_API_BASE, "template-categories"),
        {
          headers,
        },
      );

      return NextResponse.json(
        { data: lambdaResponse.data || [] },
        { status: 200 },
      );
    } catch (error) {
      console.error("Failed to fetch template categories", {
        saxId: userContext.saxId,
        tenantId: userContext.tenantId,
        errorType: error instanceof Error ? error.name : "Unknown",
      });

      if (error instanceof ApiError) {
        return NextResponse.json(
          { code: error.code, message: error.message },
          { status: error.status },
        );
      }

      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to fetch template categories",
        500,
      );
    }
  },
);

/**
 * POST /api/outreach/template-categories
 *
 * Create a new template category.
 * Calls Lambda `create-category`.
 *
 * Request Body: { name: string }
 *
 * @returns { data: LambdaCategory }
 */
export const POST = withUserContext(
  async (req: Request, userContext: UserContext) => {
    console.log(`[TEMPLATE CATEGORIES API] CREATE`);
    try {
      const body = (await req.json()) as { name: string };

      // Basic validation
      if (!body.name) {
        return errorResponse("INVALID_REQUEST", "Name is required", 400);
      }

      // Get access token for Authorization header
      const accessToken = await getAccessToken();
      const headers: Record<string, string> = getLambdaHeaders(userContext);
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      // Call Lambda API to create category
      const lambdaResponse = await api.post<LambdaCategory>(
        buildPath(LAMBDA_API_BASE, "template-categories"),
        {
          name: body.name,
        },
        {
          headers,
        },
      );

      return NextResponse.json({ data: lambdaResponse }, { status: 201 });
    } catch (error) {
      console.error("Failed to create template category", {
        saxId: userContext.saxId,
        tenantId: userContext.tenantId,
        errorType: error instanceof Error ? error.name : "Unknown",
      });

      if (error instanceof ApiError) {
        // Map 409 Conflict to proper error response
        if (error.status === 409) {
          return NextResponse.json({ error: error.message }, { status: 409 });
        }

        return NextResponse.json(
          { code: error.code, message: error.message },
          { status: error.status },
        );
      }

      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to create template category",
        500,
      );
    }
  },
);
