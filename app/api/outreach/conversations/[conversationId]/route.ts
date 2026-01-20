import { NextRequest, NextResponse } from "next/server";
import { ApiError, api, buildPath } from "@/lib/api";
import { type UserContext, withUserContext, getAccessToken } from "@/lib/auth";
import type { Conversation } from "@/types/sms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lambda API base path for SMS outreach
 */
const LAMBDA_API_BASE = "/outreach";

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

/**
 * Lambda API response for single conversation
 */
interface LambdaConversationResponse {
  conversation: Conversation;
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
 * NOTE: AWS API Gateway converts headers to lowercase, so we use lowercase here
 */
function getLambdaHeaders(userContext: UserContext): Record<string, string> {
  return {
    "x-tenant-id": userContext.tenantId,
    "x-practice-id": userContext.practiceId,
    "x-coordinator-sax-id": String(userContext.saxId),
  };
}

// =============================================================================
// GET Handler - Get Single Conversation
// =============================================================================

/**
 * GET /api/outreach/conversations/[conversationId]
 *
 * Get a single conversation by ID.
 *
 * @returns { data: Conversation }
 */
async function handleGet(
  req: NextRequest,
  userContext: UserContext,
  conversationId: string,
): Promise<NextResponse> {
  try {
    // Call Lambda API to get conversation (REQUIRED)
    // Use params option to properly build query string (don't append to path)
    const queryParams = {
      id: conversationId,
      tenant_id: userContext.tenantId,
      practice_id: userContext.practiceId,
      coordinator_sax_id: String(userContext.saxId),
    };

    console.log("[GET CONVERSATION] User context:", {
      saxId: userContext.saxId,
      tenantId: userContext.tenantId,
      practiceId: userContext.practiceId,
    });
    console.log("[GET CONVERSATION] Query params:", queryParams);
    console.log(
      "[GET CONVERSATION] API_BASE_URL env:",
      process.env.API_BASE_URL,
    );

    // Get access token for Authorization header
    const accessToken = await getAccessToken();
    const headers: Record<string, string> = getLambdaHeaders(userContext);
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const response = await api.get<LambdaConversationResponse>(
      buildPath(LAMBDA_API_BASE, "conversations", conversationId),
      {
        params: queryParams,
        headers,
      },
    );

    return NextResponse.json({ data: response.conversation }, { status: 200 });
  } catch (error) {
    console.error("Error fetching conversation:", error);

    if (error instanceof ApiError) {
      if (error.status === 404) {
        return errorResponse("NOT_FOUND", "Conversation not found", 404);
      }
      if (error.status === 403) {
        return errorResponse(
          "FORBIDDEN",
          "You don't have permission to view this conversation",
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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
): Promise<NextResponse> {
  const { conversationId } = await params;

  const handler = withUserContext(async (request, userContext) => {
    return handleGet(request as NextRequest, userContext, conversationId);
  });

  return handler(req) as Promise<NextResponse>;
}
