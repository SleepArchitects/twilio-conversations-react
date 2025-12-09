import { NextResponse } from "next/server";
import { ApiError, api, buildPath } from "@/lib/api";
import { type UserContext, withUserContext } from "@/lib/auth";
import { isValidUSPhoneNumber } from "@/lib/validation";
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

/**
 * Lambda API base path for SMS outreach
 */
const LAMBDA_API_BASE = "/outreach";

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
 * Validate phone number (US or international depending on env config)
 * Uses lib/validation.ts which respects ALLOW_INTERNATIONAL_PHONES env var
 */
function isValidPhone(phone: string): boolean {
  return isValidUSPhoneNumber(phone);
}

/**
 * Parse and validate query parameters for list endpoint
 */
function parseListParams(searchParams: URLSearchParams): {
  status?: ConversationStatus;
  slaStatus?: SlaStatus;
  filterStatus?: string;
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

  // Parse filterStatus (FR-014c) - new unified filter parameter
  const filterStatusParam = searchParams.get("filterStatus");
  const filterStatus =
    filterStatusParam === "all" ||
    filterStatusParam === "unread" ||
    filterStatusParam === "sla_risk" ||
    filterStatusParam === "archived"
      ? filterStatusParam
      : undefined;

  // Parse status filter (legacy, for backward compatibility)
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

  return { status, slaStatus, filterStatus, limit, offset, phone };
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
 * Note: Headers are sent in lowercase to match what API Gateway forwards to Lambda
 */
function getLambdaHeaders(userContext: UserContext): Record<string, string> {
  return {
    "x-tenant-id": userContext.tenantId,
    "x-practice-id": userContext.practiceId,
    "x-sax-id": String(userContext.saxId),
    "x-coordinator-sax-id": String(userContext.saxId),
  };
}

/**
 * Response from Lambda check-duplicate endpoint
 */
interface LambdaCheckDuplicateResponse {
  exists: boolean;
  conversation?: Conversation;
}

/**
 * Check for existing active conversation with the given phone number
 * Uses the Lambda /conversations/check-duplicate endpoint
 * Returns null if not found or if check fails (allowing creation to proceed)
 */
async function findActiveConversationByPhone(
  phone: string,
  userContext: UserContext,
): Promise<Conversation | null> {
  try {
    const response = await api.get<LambdaCheckDuplicateResponse>(
      buildPath(LAMBDA_API_BASE, "conversations", "check-duplicate"),
      {
        params: {
          patient_phone: phone,
          // Include context as query params since API Gateway may not forward headers
          tenant_id: userContext.tenantId,
          practice_id: userContext.practiceId,
          coordinator_sax_id: String(userContext.saxId),
        },
        headers: getLambdaHeaders(userContext),
      },
    );
    return response.exists ? (response.conversation ?? null) : null;
  } catch (error) {
    // If check fails for any reason (404, network error, etc.),
    // return null to allow conversation creation to proceed
    console.log("Duplicate check failed, proceeding with creation:", error);
    return null;
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
 * - filterStatus: 'all' | 'unread' | 'sla_risk' | 'archived' (optional, per FR-014c)
 * - status: 'active' | 'archived' (optional, legacy)
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
  console.debug(`Start conv handler`);
  try {
    const { searchParams } = new URL(req.url);
    const { status, slaStatus, filterStatus, limit, offset, phone } =
      parseListParams(searchParams);

    // Mock mode for local development without Lambda backend
    if (isMockMode()) {
      console.log("[MOCK] Returning mock conversations data");
      let mockConversations = getMockConversations();

      // Apply filterStatus filtering (FR-014c)
      if (filterStatus) {
        mockConversations = mockConversations.filter((conv) => {
          switch (filterStatus) {
            case "all":
              return conv.status === "active" && !conv.archivedOn;
            case "unread":
              return conv.unreadCount > 0;
            case "sla_risk":
              return (
                conv.slaStatus === "breached" || conv.slaStatus === "warning"
              );
            case "archived":
              return conv.archivedOn !== null;
            default:
              return true;
          }
        });
      }

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
      if (!isValidPhone(phone)) {
        return errorResponse(
          "INVALID_PHONE_FORMAT",
          "Phone number must be in valid E.164 format (e.g., +1XXXXXXXXXX)",
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

    // Handle filterStatus parameter (FR-014c)
    // Map filterStatus to appropriate Lambda API parameters
    if (filterStatus) {
      switch (filterStatus) {
        case "all":
          // Show active conversations only (not archived)
          queryParams.status = "active";
          break;
        case "unread":
          // Lambda API should support unread_only parameter
          // For now, we'll filter client-side after response
          queryParams.status = "active";
          queryParams.unread_only = "true";
          break;
        case "sla_risk":
          // Filter for warning or breached SLA status
          queryParams.status = "active";
          queryParams.sla_risk_only = "true";
          break;
        case "archived":
          queryParams.status = "archived";
          break;
      }
    } else {
      // Fallback to legacy status filter
      if (status) {
        queryParams.status = status;
      }

      if (slaStatus) {
        queryParams.sla_status = slaStatus;
      }
    }

    // Call Lambda API to list conversations
    const response = await api.get<LambdaConversationsResponse>(
      buildPath(LAMBDA_API_BASE, "conversations"),
      {
        params: queryParams,
        headers: getLambdaHeaders(userContext),
      },
    );

    // Client-side filtering for unread and sla_risk if Lambda doesn't support it yet
    let filteredConversations = response.conversations;
    if (filterStatus === "unread") {
      filteredConversations = filteredConversations.filter(
        (conv) => conv.unreadCount > 0,
      );
    } else if (filterStatus === "sla_risk") {
      filteredConversations = filteredConversations.filter(
        (conv) => conv.slaStatus === "breached" || conv.slaStatus === "warning",
      );
    }

    // Map to summary format
    const data = filteredConversations.map(toConversationSummary);

    // Build pagination response
    const pagination: Pagination = {
      total:
        filterStatus === "unread" || filterStatus === "sla_risk"
          ? data.length // Use filtered count for client-side filters
          : response.total,
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

    // Validate phone format
    if (!isValidPhone(body.patientPhone)) {
      return errorResponse(
        "INVALID_PHONE_FORMAT",
        "patientPhone must be in valid E.164 format (e.g., +1XXXXXXXXXX)",
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
    // The Lambda will check for existing conversations and return them if found,
    // or create a new Twilio conversation automatically
    const createPayload = {
      tenant_id: userContext.tenantId,
      practice_id: userContext.practiceId,
      coordinator_sax_id: userContext.saxId,
      patient_phone: body.patientPhone,
      friendly_name: friendlyName,
      metadata: body.metadata,
    };

    let conversation: Conversation & { existing?: boolean };
    let isExisting = false;
    try {
      conversation = await api.post<Conversation & { existing?: boolean }>(
        buildPath(LAMBDA_API_BASE, "conversations"),
        createPayload,
        {
          headers: getLambdaHeaders(userContext),
        },
      );
      isExisting = conversation.existing === true;
      if (isExisting) {
        console.log("Using existing conversation:", conversation.id);
      }
    } catch (error) {
      console.error("Failed to create conversation:", error);
      if (error instanceof ApiError) {
        // Check if it's a Twilio duplicate binding error
        if (
          error.message?.includes("binding") &&
          error.message?.includes("already exists")
        ) {
          return errorResponse(
            "CONVERSATION_EXISTS",
            "An active conversation already exists for this phone number in Twilio",
            409,
          );
        }
        return errorResponse(
          error.code || "CREATE_FAILED",
          error.message || "Failed to create conversation",
          error.status,
        );
      }
      throw error;
    }

    // If initial message is provided and this is a new conversation, send it
    // (Don't send initial message for existing conversations - user should do that explicitly)
    if (body.initialMessage && body.initialMessage.trim() && !isExisting) {
      try {
        await api.post(
          buildPath(
            LAMBDA_API_BASE,
            "conversations",
            conversation.id,
            "messages",
          ),
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
          conversation.id,
          msgError,
        );
      }
    }

    // Return 201 for new conversations, 200 for existing ones
    return NextResponse.json(conversation, { status: isExisting ? 200 : 201 });
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
