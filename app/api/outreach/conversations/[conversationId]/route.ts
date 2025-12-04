import { NextRequest, NextResponse } from "next/server";
import { ApiError, api } from "@/lib/api";
import { type UserContext, withUserContext } from "@/lib/auth";
import type { Conversation, ConversationStatus, SlaStatus } from "@/types/sms";

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

/**
 * Mock conversations data for local development
 */
function getMockConversation(conversationId: string): Conversation | null {
  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 172800000).toISOString();
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

  const mockConversations: Record<string, Conversation> = {
    "mock-conv-1": {
      id: "mock-conv-1",
      twilioSid: "CH00000000000000000000000000000001",
      tenantId: "dev-tenant",
      practiceId: "dev-practice",
      coordinatorSaxId: 1,
      patientPhone: "+15551234567",
      friendlyName: "John Doe (Test Practice)",
      status: "active" as ConversationStatus,
      slaStatus: "ok" as SlaStatus,
      unreadCount: 2,
      lastMessageAt: now,
      lastMessagePreview: "This is a test message",
      createdOn: yesterday,
      createdBy: 1,
      updatedOn: now,
      updatedBy: 1,
      archivedOn: null,
      archivedBy: null,
      active: true,
    },
    "mock-conv-2": {
      id: "mock-conv-2",
      twilioSid: "CH00000000000000000000000000000002",
      tenantId: "dev-tenant",
      practiceId: "dev-practice",
      coordinatorSaxId: 1,
      patientPhone: "+15559876543",
      friendlyName: "Jane Smith (Test Practice)",
      status: "active" as ConversationStatus,
      slaStatus: "warning" as SlaStatus,
      unreadCount: 0,
      lastMessageAt: oneHourAgo,
      lastMessagePreview: "Thanks for the reminder!",
      createdOn: twoDaysAgo,
      createdBy: 1,
      updatedOn: oneHourAgo,
      updatedBy: 1,
      archivedOn: null,
      archivedBy: null,
      active: true,
    },
  };

  return mockConversations[conversationId] || null;
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
    // Mock mode for local development without Lambda backend
    if (isMockMode()) {
      console.log(`[MOCK] Returning mock conversation for ${conversationId}`);
      const mockConversation = getMockConversation(conversationId);

      if (!mockConversation) {
        return errorResponse("NOT_FOUND", "Conversation not found", 404);
      }

      return NextResponse.json({ data: mockConversation }, { status: 200 });
    }

    // Call Lambda API to get conversation
    const response = await api.get<LambdaConversationResponse>(
      `${LAMBDA_API_BASE}/conversations/${conversationId}`,
      {
        headers: getLambdaHeaders(userContext),
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
