import { NextRequest, NextResponse } from "next/server";
import { ApiError, api } from "@/lib/api";
import { type UserContext, withUserContext } from "@/lib/auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lambda API base path for SMS outreach
 */
const LAMBDA_API_BASE = "/sms";

// =============================================================================
// Types
// =============================================================================

/**
 * API error response format
 */
interface ErrorResponse {
  error: {
    code: string;
    message: string;
  };
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Create standardized error response
 */
function errorResponse(
  code: string,
  message: string,
  status: number,
): NextResponse<ErrorResponse> {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Get headers for Lambda API calls with user context
 */
function getLambdaHeaders(userContext: UserContext): Record<string, string> {
  return {
    "X-Tenant-Id": userContext.tenantId,
    "X-Practice-Id": userContext.practiceId,
    "X-Sax-Id": String(userContext.saxId),
  };
}

/**
 * Check if running in mock mode (for local development without Lambda backend)
 */
function isMockMode(): boolean {
  return process.env.DISABLE_AUTH === "true" && !process.env.API_BASE_URL;
}

// =============================================================================
// POST Handler - Mark Conversation as Read
// =============================================================================

/**
 * POST /api/outreach/conversations/[conversationId]/read
 *
 * Mark a conversation as read.
 *
 * @returns { success: true }
 */
async function handlePost(
  req: NextRequest,
  userContext: UserContext,
  conversationId: string,
): Promise<NextResponse> {
  try {
    // Mock mode for local development without Lambda backend
    if (isMockMode()) {
      console.log(`[MOCK] Marking conversation ${conversationId} as read`);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Call Lambda API to mark conversation as read
    await api.post(
      `${LAMBDA_API_BASE}/conversations/${conversationId}/read`,
      {},
      {
        headers: getLambdaHeaders(userContext),
      },
    );

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Error marking conversation as read:", error);

    if (error instanceof ApiError) {
      if (error.status === 404) {
        return errorResponse("NOT_FOUND", "Conversation not found", 404);
      }
      if (error.status === 403) {
        return errorResponse(
          "FORBIDDEN",
          "You don't have permission to update this conversation",
          403,
        );
      }
      return errorResponse("LAMBDA_ERROR", error.message, error.status);
    }

    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}

// =============================================================================
// Route Exports
// =============================================================================

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
): Promise<NextResponse> {
  const { conversationId } = await params;

  const handler = withUserContext(async (request, userContext) => {
    return handlePost(request as NextRequest, userContext, conversationId);
  });

  return handler(req) as Promise<NextResponse>;
}
