import { NextResponse } from "next/server";
import { ApiError, api, buildPath } from "@/lib/api";
import { type UserContext, withUserContext } from "@/lib/auth";
import { getTwilioClient } from "@/lib/twilio";
import type {
  Conversation,
  Message,
  PaginatedResponse,
  SendMessageRequest,
} from "@/types/sms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

// Constants
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_MESSAGE_LENGTH = 1600;

/**
 * Lambda API base path for SMS outreach
 */
const LAMBDA_API_BASE = "/outreach";

/**
 * Lambda response wrapper for single conversation
 */
interface LambdaConversationResponse {
  conversation: Conversation;
}

/**
 * Lambda message format (snake_case from database)
 */
interface LambdaMessage {
  id: string;
  conversation_id: string;
  twilio_sid: string | null;
  direction: "inbound" | "outbound";
  author_sax_id: string | null;
  author_phone: string | null;
  body: string;
  status: string;
  segment_count: number | null;
  sentiment: string | null;
  // sentiment_score from Lambda might be JSON object or null
  sentiment_score: Record<string, number> | null;
  error_code: string | null;
  error_message: string | null;
  created_on: string;
  created_by: number | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  active?: boolean;
}

/**
 * Lambda messages response format
 */
interface LambdaMessagesResponse {
  messages: LambdaMessage[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

/**
 * Transform Lambda message (snake_case) to frontend Message (camelCase)
 */
function transformMessage(
  msg: LambdaMessage,
  tenantId: string,
  practiceId: string,
): Message {
  return {
    id: msg.id,
    conversationId: msg.conversation_id,
    twilioSid: msg.twilio_sid || "",
    direction: msg.direction,
    authorSaxId: msg.author_sax_id ? Number(msg.author_sax_id) : null,
    authorPhone: msg.author_phone,
    body: msg.body,
    status: msg.status as Message["status"],
    segmentCount: msg.segment_count || 1,
    sentiment: (msg.sentiment as Message["sentiment"]) || null,
    sentimentScore: msg.sentiment_score,
    errorCode: msg.error_code,
    errorMessage: msg.error_message,
    createdOn: msg.created_on,
    createdBy: msg.created_by,
    sentAt: msg.sent_at,
    deliveredAt: msg.delivered_at,
    readAt: msg.read_at,
    active: msg.active ?? true,
    tenantId: tenantId,
    practiceId: practiceId,
  };
}

/**
 * Validate that the conversation belongs to the user's tenant and is owned by them
 */
async function validateConversationAccess(
  conversationId: string,
  userContext: UserContext,
): Promise<Conversation | null> {
  try {
    const response = await api.get<LambdaConversationResponse>(
      buildPath(LAMBDA_API_BASE, "conversations", conversationId),
      {
        params: {
          id: conversationId,
          tenant_id: userContext.tenantId,
          practice_id: userContext.practiceId,
          coordinator_sax_id: String(userContext.saxId),
        },
        headers: {
          "x-tenant-id": userContext.tenantId,
          "x-practice-id": userContext.practiceId,
          "x-coordinator-sax-id": String(userContext.saxId),
        },
      },
    );

    // Handle both wrapped {conversation: ...} and unwrapped response formats
    const conversation =
      response.conversation || (response as unknown as Conversation);

    if (!conversation || !conversation.id) {
      console.error(
        "[validateConversationAccess] Invalid response format:",
        response,
      );
      return null;
    }

    // Verify tenant and practice match
    if (
      conversation.tenantId !== userContext.tenantId ||
      conversation.practiceId !== userContext.practiceId
    ) {
      console.log("[validateConversationAccess] Tenant/practice mismatch");
      return null;
    }

    // Verify coordinator owns this conversation (use loose equality for number/string comparison)
    if (Number(conversation.coordinatorSaxId) !== Number(userContext.saxId)) {
      console.log("[validateConversationAccess] Coordinator mismatch:", {
        expected: userContext.saxId,
        actual: conversation.coordinatorSaxId,
      });
      return null;
    }

    return conversation;
  } catch (error) {
    console.error("[validateConversationAccess] Error:", error);
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Parse and validate pagination parameters
 */
function parsePaginationParams(searchParams: URLSearchParams): {
  limit: number;
  offset: number;
  order: "asc" | "desc";
} {
  let limit = parseInt(searchParams.get("limit") || String(DEFAULT_LIMIT), 10);
  let offset = parseInt(searchParams.get("offset") || "0", 10);
  const orderParam = searchParams.get("order") || "asc";

  // Validate and clamp values
  if (Number.isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
  if (limit > MAX_LIMIT) limit = MAX_LIMIT;
  if (Number.isNaN(offset) || offset < 0) offset = 0;

  const order = orderParam === "desc" ? "desc" : "asc";

  return { limit, offset, order };
}

/**
 * GET /api/outreach/conversations/{conversationId}/messages
 *
 * List messages in a conversation with pagination.
 * Messages are returned in chronological order by default.
 *
 * Query Parameters:
 * - limit: number (default 50, max 100)
 * - offset: number (default 0)
 * - order: 'asc' | 'desc' (default 'asc')
 *
 * @returns { data: Message[], pagination: Pagination }
 */
export const GET = withUserContext(
  async (req: Request, userContext: UserContext) => {
    // Extract conversationId from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const conversationIdIndex = pathParts.indexOf("conversations") + 1;
    const conversationId = pathParts[conversationIdIndex];

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 },
      );
    }

    try {
      // Validate conversation access
      const conversation = await validateConversationAccess(
        conversationId,
        userContext,
      );

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found or access denied" },
          { status: 404 },
        );
      }

      // Parse pagination params
      const { limit, offset, order } = parsePaginationParams(url.searchParams);

      // Fetch messages from Lambda API
      console.log(
        "[GET MESSAGES] Fetching messages for conversation:",
        conversationId,
      );
      const lambdaResponse = await api.get<LambdaMessagesResponse>(
        buildPath(LAMBDA_API_BASE, "conversations", conversationId, "messages"),
        {
          params: {
            limit,
            offset,
            order,
            tenant_id: userContext.tenantId,
            practice_id: userContext.practiceId,
            coordinator_sax_id: String(userContext.saxId),
          },
          headers: {
            "x-tenant-id": userContext.tenantId,
            "x-practice-id": userContext.practiceId,
            "x-coordinator-sax-id": String(userContext.saxId),
          },
        },
      );

      console.log("[GET MESSAGES] Lambda response:", {
        messageCount: lambdaResponse.messages?.length,
        pagination: lambdaResponse.pagination,
      });

      // Transform Lambda response (snake_case) to frontend format (camelCase)
      const messages = (lambdaResponse.messages || []).map((msg) =>
        transformMessage(msg, userContext.tenantId, userContext.practiceId),
      );
      const response: PaginatedResponse<Message> = {
        data: messages,
        pagination: {
          total: lambdaResponse.pagination?.total || 0,
          limit: lambdaResponse.pagination?.limit || limit,
          offset: lambdaResponse.pagination?.offset || offset,
          hasMore: lambdaResponse.pagination?.has_more || false,
        },
      };

      return NextResponse.json(response, { status: 200 });
    } catch (error) {
      // Log error without PHI - only log IDs and error type
      console.error("Failed to fetch messages", {
        conversationId,
        saxId: userContext.saxId,
        errorType: error instanceof Error ? error.name : "Unknown",
      });

      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        );
      }

      return NextResponse.json(
        { error: "Failed to fetch messages" },
        { status: 500 },
      );
    }
  },
);

/**
 * POST /api/outreach/conversations/{conversationId}/messages
 *
 * Send a new message in a conversation.
 *
 * Request Body:
 * - body: string (required, max 1600 chars)
 * - templateId?: string (optional, for tracking template usage)
 * - mediaUrls?: string[] (optional, max 10 MMS attachments)
 *
 * @returns Message object with status "sending"
 */
export const POST = withUserContext(
  async (req: Request, userContext: UserContext) => {
    // Extract conversationId from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const conversationIdIndex = pathParts.indexOf("conversations") + 1;
    const conversationId = pathParts[conversationIdIndex];

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 },
      );
    }

    try {
      // Parse and validate request body
      let body: SendMessageRequest;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 },
        );
      }

      // Validate required fields
      if (!body.body || typeof body.body !== "string") {
        return NextResponse.json(
          { error: "Message body is required" },
          { status: 400 },
        );
      }

      const messageBody = body.body.trim();

      if (messageBody.length === 0) {
        return NextResponse.json(
          { error: "Message body cannot be empty" },
          { status: 400 },
        );
      }

      if (messageBody.length > MAX_MESSAGE_LENGTH) {
        return NextResponse.json(
          {
            error: `Message body exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
          },
          { status: 400 },
        );
      }

      // Validate mediaUrls if provided
      if (body.mediaUrls) {
        if (!Array.isArray(body.mediaUrls)) {
          return NextResponse.json(
            { error: "mediaUrls must be an array" },
            { status: 400 },
          );
        }
        if (body.mediaUrls.length > 10) {
          return NextResponse.json(
            { error: "Maximum 10 media URLs allowed" },
            { status: 400 },
          );
        }
        // Validate each URL
        for (const mediaUrl of body.mediaUrls) {
          if (typeof mediaUrl !== "string") {
            return NextResponse.json(
              { error: "Each media URL must be a string" },
              { status: 400 },
            );
          }
          try {
            new URL(mediaUrl);
          } catch {
            return NextResponse.json(
              { error: `Invalid media URL: ${mediaUrl}` },
              { status: 400 },
            );
          }
        }
      }

      // Validate conversation access
      const conversation = await validateConversationAccess(
        conversationId,
        userContext,
      );

      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found or access denied" },
          { status: 404 },
        );
      }

      // Check if patient has opted out
      if (conversation.optedOut) {
        return NextResponse.json(
          { error: "Cannot send message: patient has opted out" },
          { status: 403 },
        );
      }

      // Get Twilio client and send message via Messaging API
      const twilioClient = getTwilioClient();

      // Send message via Twilio Messaging API (direct SMS)
      const twilioMessage = await twilioClient.messages.create({
        to: conversation.patientPhone,
        body: messageBody,
        from: process.env.TWILIO_FROM_NUMBER,
      });

      // Calculate segment count (SMS segments are 160 chars for GSM-7, 70 for UCS-2)
      const segmentCount = Math.ceil(messageBody.length / 160);

      // Store message in database via Lambda
      const lambdaResponse = await api.post<
        { message: LambdaMessage } | LambdaMessage
      >(
        buildPath(LAMBDA_API_BASE, "conversations", conversationId, "messages"),
        {
          twilio_sid: twilioMessage.sid,
          direction: "outbound",
          author_sax_id: userContext.saxId,
          body: messageBody,
          status: "sending",
          segment_count: segmentCount,
          template_id: body.templateId,
          media_urls: body.mediaUrls,
        },
        {
          headers: {
            "x-tenant-id": userContext.tenantId,
            "x-practice-id": userContext.practiceId,
            "x-coordinator-sax-id": String(userContext.saxId),
          },
        },
      );

      // Lambda may return {message: ...} wrapper or direct message
      const lambdaMessage =
        "message" in lambdaResponse ? lambdaResponse.message : lambdaResponse;
      const storedMessage = transformMessage(
        lambdaMessage,
        userContext.tenantId,
        userContext.practiceId,
      );

      // Log audit event without PHI
      console.info("Message sent", {
        messageId: storedMessage.id,
        conversationId,
        saxId: userContext.saxId,
        tenantId: userContext.tenantId,
        segmentCount,
        hasTemplate: !!body.templateId,
        hasMedia: !!(body.mediaUrls && body.mediaUrls.length > 0),
      });

      // Track template usage (non-blocking, fire-and-forget)
      if (body.templateId) {
        // Call increment_sms_template_usage via Lambda API
        // This is non-blocking - we don't wait for it to complete
        api
          .post(
            buildPath(LAMBDA_API_BASE, "templates", body.templateId, "usage"),
            {
              tenant_id: userContext.tenantId,
            },
            {
              headers: {
                "x-tenant-id": userContext.tenantId,
                "x-practice-id": userContext.practiceId,
                "x-coordinator-sax-id": String(userContext.saxId),
              },
            },
          )
          .catch((error) => {
            // Log error but don't fail the request
            console.error("Failed to track template usage", {
              templateId: body.templateId,
              errorType: error instanceof Error ? error.name : "Unknown",
              errorMessage:
                error instanceof Error ? error.message : "Unknown error",
            });
          });
      }

      return NextResponse.json(storedMessage, { status: 201 });
    } catch (error) {
      // Log error without PHI
      console.error("Failed to send message", {
        conversationId,
        saxId: userContext.saxId,
        errorType: error instanceof Error ? error.name : "Unknown",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });

      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        );
      }

      // Handle Twilio-specific errors
      if (error instanceof Error && error.message.includes("Twilio")) {
        return NextResponse.json(
          { error: "Failed to send message via Twilio" },
          { status: 500 },
        );
      }

      return NextResponse.json(
        { error: "Failed to send message" },
        { status: 500 },
      );
    }
  },
);
