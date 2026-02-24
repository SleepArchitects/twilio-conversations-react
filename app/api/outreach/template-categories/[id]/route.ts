import { NextRequest, NextResponse } from "next/server";
import { ApiError, api, buildPath } from "@/lib/api";
import { type UserContext, withUserContext, getAccessToken } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lambda API base path for SMS outreach
 */
const LAMBDA_API_BASE = "/outreach";

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
 * DELETE /api/outreach/template-categories/[id]
 *
 * Delete a template category by ID.
 * Calls Lambda `delete-category`.
 *
 * @returns { success: boolean }
 */
async function handleDelete(
  req: NextRequest,
  userContext: UserContext,
  id: string,
): Promise<NextResponse> {
  console.log(`[TEMPLATE CATEGORIES API] DELETE ${id}`);
  try {
    if (!id) {
      return errorResponse("INVALID_REQUEST", "Category ID is required", 400);
    }

    // Get access token for Authorization header
    const accessToken = await getAccessToken();
    const headers: Record<string, string> = getLambdaHeaders(userContext);
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    // Call Lambda API to delete category
    await api.delete(buildPath(LAMBDA_API_BASE, "template-categories", id), {
      headers,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to delete template category", {
      saxId: userContext.saxId,
      tenantId: userContext.tenantId,
      categoryId: id,
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
      "Failed to delete template category",
      500,
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const handler = withUserContext(async (request, userContext) => {
    return handleDelete(request, userContext, id);
  });

  return handler(req) as Promise<NextResponse>;
}
