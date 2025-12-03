import { NextResponse } from "next/server";
import { ApiError, api } from "@/lib/api";
import { type UserContext, withUserContext } from "@/lib/auth";
import type {
  Conversation,
  ConversationStatus,
  CreateConversationRequest,
  Pagination,
  SlaStatus,
} from "@/types/sms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Constants
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const US_E164_PATTERN = /^\+1[0-9]{10}$/;

/**
 * Lambda API base path for SMS outreach
 */
const LAMBDA_API_BASE = "/sms";

// =============================================================================
// Types
// =============================================================================

/**
 * Conversation summary for list responses
 */
interface ConversationSummary {
  id: string;
  patientPhone: string;
  friendlyName: string;
  status: ConversationStatus;
  slaStatus: SlaStatus;
  unreadCount: number;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
}

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
 * Lambda API response for conversation list
 */
interface LambdaConversationsResponse {
  conversations: Conversation[];
  total: number;
}

/**
 * Lambda API response for conversation by phone lookup
 */
interface LambdaConversationByPhoneResponse {
  conversation: Conversation | null;
}

// =============================================================================
// Helpers
// =============================================================================

/**
 * Sanitize patient name for friendly name field.
 * Strips HTML, removes URLs, escapes special characters, and appends practice name.
 */
function sanitizeFriendlyName(name: string, practiceName?: string): string {
  // 1. Strip HTML tags
  let sanitized = name.replace(/<[^>]*>/g, "");
  // 2. Remove URLs
  sanitized = sanitized.replace(/https?:\/\/[^\s]+/gi, "");
  sanitized = sanitized.replace(/www\.[^\s]+/gi, "");
  // 3. Escape HTML entities
  sanitized = sanitized
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
  // 4. Trim and limit length
  sanitized = sanitized.trim().slice(0, 200);
  // 5. Append practice name
  if (practiceName) {
    const suffix = ` (${practiceName})`;
    if (sanitized.length + suffix.length <= 255) {
      sanitized += suffix;
    } else {
      sanitized = sanitized.slice(0, 255 - suffix.length) + suffix;
    }
  }
  return sanitized;
}

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
 * Validate US E.164 phone format (+1XXXXXXXXXX)
 */
function isValidUSPhone(phone: string): boolean {
  return US_E164_PATTERN.test(phone);
}

/**
 * Parse and validate query parameters for list endpoint
 */
function parseListParams(searchParams: URLSearchParams): {
  status?: ConversationStatus;
  slaStatus?: SlaStatus;
  limit: number;
  offset: number;
  phone?: string;
} {
  // Parse limit with default and max
  let limit = parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10);
  if (Number.isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;

  // Parse offset with default
  let offset = parseInt(searchParams.get("offset") || "0", 10);
  if (Number.isNaN(offset) || offset < 0) offset = 0;

  // Parse status filter
  const statusParam = searchParams.get("status");
  const status =
    statusParam === "active" || statusParam === "archived"
      ? statusParam
      : undefined;

  // Parse SLA status filter
  const slaStatusParam = searchParams.get("slaStatus");
  const slaStatus =
    slaStatusParam === "ok" ||
    slaStatusParam === "warning" ||
    slaStatusParam === "breached"
      ? slaStatusParam
      : undefined;

  // Parse phone for duplicate detection
  const phone = searchParams.get("phone") || undefined;

  return { status, slaStatus, limit, offset, phone };
}

/**
 * Map full Conversation to ConversationSummary for list responses
 */
function toConversationSummary(conv: Conversation): ConversationSummary {
  return {
    id: conv.id,
    patientPhone: conv.patientPhone,
    friendlyName: conv.friendlyName,
    status: conv.status,
    slaStatus: conv.slaStatus,
    unreadCount: conv.unreadCount,
    lastMessageAt: conv.lastMessageAt,
    lastMessagePreview: conv.lastMessagePreview,
  };
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
 * Check for existing active conversation with the given phone number
 */
async function findActiveConversationByPhone(
  phone: string,
  userContext: UserContext,
): Promise<Conversation | null> {
  try {
    const response = await api.get<LambdaConversationByPhoneResponse>(
      `${LAMBDA_API_BASE}/conversations/by-phone`,
      {
        params: {
          tenant_id: userContext.tenantId,
          practice_id: userContext.practiceId,
          coordinator_sax_id: userContext.saxId,
          patient_phone: phone,
        },
        headers: getLambdaHeaders(userContext),
      },
    );
    return response.conversation;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

// =============================================================================
// GET Handler - List Conversations
// =============================================================================

/**
 * GET /api/outreach/conversations
 *
 * List conversations for the authenticated coordinator.
 * Supports filtering by status, SLA status, and phone number lookup.
 *
 * Query Parameters:
 * - status: 'active' | 'archived' (optional)
 * - slaStatus: 'ok' | 'warning' | 'breached' (optional)
 * - limit: number (default 50, max 100)
 * - offset: number (default 0)
 * - phone: string (optional, for duplicate detection)
 *
 * @returns { data: ConversationSummary[], pagination: Pagination }
 */
/**
 * Check if running in mock mode (for local development without Lambda backend)
 */
function isMockMode(): boolean {
  return process.env.DISABLE_AUTH === "true" && !process.env.API_BASE_URL;
}

/**
 * Mock conversations data for local development
 */
function getMockConversations(): Conversation[] {
  const now = new Date().toISOString();
  const yesterday = new Date(Date.now() - 86400000).toISOString();
  const twoDaysAgo = new Date(Date.now() - 172800000).toISOString();
  const oneHourAgo = new Date(Date.now() - 3600000).toISOString();

  return [
    {
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
    {
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
  ];
}

async function handleGet(
  req: Request,
  userContext: UserContext,
): Promise<NextResponse> {
  try {
    const { searchParams } = new URL(req.url);
    const { status, slaStatus, limit, offset, phone } =
      parseListParams(searchParams);

    // Mock mode for local development without Lambda backend
    if (isMockMode()) {
      console.log("[MOCK] Returning mock conversations data");
      const mockConversations = getMockConversations();
      const data = mockConversations.map(toConversationSummary);
      const pagination: Pagination = {
        total: mockConversations.length,
        limit,
        offset: 0,
        hasMore: false,
      };
      return NextResponse.json({ data, pagination }, { status: 200 });
    }

    // If phone is provided, check for existing active conversation (duplicate detection)
    if (phone) {
      // Validate phone format
      if (!isValidUSPhone(phone)) {
        return errorResponse(
          "INVALID_PHONE_FORMAT",
          "Phone number must be in US E.164 format (+1XXXXXXXXXX)",
          400,
        );
      }

      const existingConversation = await findActiveConversationByPhone(
        phone,
        userContext,
      );

      if (existingConversation) {
        // Return existing conversation for duplicate detection
        const data = [toConversationSummary(existingConversation)];
        const pagination: Pagination = {
          total: 1,
          limit,
          offset: 0,
          hasMore: false,
        };
        return NextResponse.json({ data, pagination }, { status: 200 });
      }

      // No existing conversation found
      const pagination: Pagination = {
        total: 0,
        limit,
        offset: 0,
        hasMore: false,
      };
      return NextResponse.json({ data: [], pagination }, { status: 200 });
    }

    // Build query parameters for Lambda API
    const queryParams: Record<string, string | number | undefined> = {
      tenant_id: userContext.tenantId,
      practice_id: userContext.practiceId,
      coordinator_sax_id: userContext.saxId,
      limit,
      offset,
    };

    if (status) {
      queryParams.status = status;
    }

    if (slaStatus) {
      queryParams.sla_status = slaStatus;
    }

    // Call Lambda API to list conversations
    const response = await api.get<LambdaConversationsResponse>(
      `${LAMBDA_API_BASE}/conversations`,
      {
        params: queryParams,
        headers: getLambdaHeaders(userContext),
      },
    );

    // Map to summary format
    const data = response.conversations.map(toConversationSummary);

    // Build pagination response
    const pagination: Pagination = {
      total: response.total,
      limit,
      offset,
      hasMore: offset + data.length < response.total,
    };

    return NextResponse.json({ data, pagination }, { status: 200 });
  } catch (error) {
    console.error("Error listing conversations:", error);

    if (error instanceof ApiError) {
      if (error.status === 401) {
        return errorResponse("UNAUTHORIZED", "Authentication required", 401);
      }
      if (error.status === 403) {
        return errorResponse(
          "FORBIDDEN",
          "Access denied to this resource",
          403,
        );
      }
      return errorResponse(
        error.code || "API_ERROR",
        error.message || "Failed to list conversations",
        error.status,
      );
    }

    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}

// =============================================================================
// POST Handler - Create Conversation
// =============================================================================

/**
 * POST /api/outreach/conversations
 *
 * Create a new conversation with a patient.
 * Validates phone format, checks for duplicates, and optionally sends initial message.
 *
 * Request Body:
 * - patientPhone: string (required, E.164 format +1XXXXXXXXXX)
 * - patientName: string (optional, max 255 chars)
 * - initialMessage: string (optional)
 * - metadata: object (optional)
 *
 * @returns Created Conversation (201) or error
 */
async function handlePost(
  req: Request,
  userContext: UserContext,
): Promise<NextResponse> {
  try {
    // Parse request body
    let body: CreateConversationRequest;
    try {
      body = await req.json();
    } catch {
      return errorResponse(
        "INVALID_JSON",
        "Request body must be valid JSON",
        400,
      );
    }

    // Validate required fields
    if (!body.patientPhone) {
      return errorResponse(
        "MISSING_PATIENT_PHONE",
        "patientPhone is required",
        400,
      );
    }

    // Validate phone format (US E.164)
    if (!isValidUSPhone(body.patientPhone)) {
      return errorResponse(
        "INVALID_PHONE_FORMAT",
        "patientPhone must be in US E.164 format (+1XXXXXXXXXX)",
        400,
      );
    }

    // Validate patientName length if provided
    if (body.patientName && body.patientName.length > 255) {
      return errorResponse(
        "PATIENT_NAME_TOO_LONG",
        "patientName must be 255 characters or less",
        400,
      );
    }

    // Validate initialMessage is non-empty if provided
    if (
      body.initialMessage !== undefined &&
      body.initialMessage.trim() === ""
    ) {
      return errorResponse(
        "EMPTY_INITIAL_MESSAGE",
        "initialMessage cannot be empty if provided",
        400,
      );
    }

    // Mock mode for local development without Lambda backend
    if (isMockMode()) {
      console.log("[MOCK] Creating mock conversation");
      const mockId = `mock-conv-${Date.now()}`;
      const now = new Date().toISOString();

      // Sanitize patient name for friendly name
      const friendlyName = body.patientName
        ? sanitizeFriendlyName(body.patientName)
        : body.patientPhone;

      const mockConversation: Conversation = {
        id: mockId,
        twilioSid: `CH${mockId.replace(/-/g, "").slice(0, 32).padEnd(32, "0")}`,
        tenantId: userContext.tenantId,
        practiceId: userContext.practiceId,
        coordinatorSaxId: userContext.saxId,
        patientPhone: body.patientPhone,
        friendlyName,
        status: "active" as ConversationStatus,
        slaStatus: "ok" as SlaStatus,
        unreadCount: 0,
        lastMessageAt: body.initialMessage ? now : null,
        lastMessagePreview: body.initialMessage?.slice(0, 160) || null,
        createdOn: now,
        createdBy: userContext.saxId,
        updatedOn: now,
        updatedBy: userContext.saxId,
        archivedOn: null,
        archivedBy: null,
        active: true,
      };

      return NextResponse.json(mockConversation, { status: 201 });
    }

    // Check for existing active conversation with this phone (duplicate detection)
    const existingConversation = await findActiveConversationByPhone(
      body.patientPhone,
      userContext,
    );

    if (existingConversation) {
      return errorResponse(
        "CONVERSATION_EXISTS",
        "An active conversation already exists for this phone number",
        409,
      );
    }

    // Sanitize patient name for friendly name
    const friendlyName = body.patientName
      ? sanitizeFriendlyName(body.patientName)
      : body.patientPhone;

    // Create conversation via Lambda API
    // Note: Twilio conversation creation will be done in T032
    // For now, we call the Lambda API which will handle Twilio creation
    const createPayload = {
      tenant_id: userContext.tenantId,
      practice_id: userContext.practiceId,
      coordinator_sax_id: userContext.saxId,
      patient_phone: body.patientPhone,
      friendly_name: friendlyName,
      metadata: body.metadata,
    };

    const createdConversation = await api.post<Conversation>(
      `${LAMBDA_API_BASE}/conversations`,
      createPayload,
      {
        headers: getLambdaHeaders(userContext),
      },
    );

    // If initial message is provided, send it
    if (body.initialMessage && body.initialMessage.trim()) {
      try {
        await api.post(
          `${LAMBDA_API_BASE}/conversations/${createdConversation.id}/messages`,
          {
            body: body.initialMessage.trim(),
          },
          {
            headers: getLambdaHeaders(userContext),
          },
        );
      } catch (msgError) {
        // Log the error but don't fail the conversation creation
        console.error(
          "Failed to send initial message for conversation:",
          createdConversation.id,
          msgError,
        );
      }
    }

    return NextResponse.json(createdConversation, { status: 201 });
  } catch (error) {
    console.error("Error creating conversation:", error);

    if (error instanceof ApiError) {
      if (error.status === 401) {
        return errorResponse("UNAUTHORIZED", "Authentication required", 401);
      }
      if (error.status === 403) {
        return errorResponse(
          "FORBIDDEN",
          "Access denied to this resource",
          403,
        );
      }
      if (error.status === 409) {
        return errorResponse(
          "CONVERSATION_EXISTS",
          "An active conversation already exists for this phone number",
          409,
        );
      }
      return errorResponse(
        error.code || "API_ERROR",
        error.message || "Failed to create conversation",
        error.status,
      );
    }

    return errorResponse("INTERNAL_ERROR", "An unexpected error occurred", 500);
  }
}

// =============================================================================
// Exports
// =============================================================================

export const GET = withUserContext(handleGet);
export const POST = withUserContext(handlePost);
