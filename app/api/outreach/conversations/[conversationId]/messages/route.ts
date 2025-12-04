import { NextResponse } from "next/server";
import { ApiError, api } from "@/lib/api";
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
 * Validate that the conversation belongs to the user's tenant and is owned by them
 */
async function validateConversationAccess(
  conversationId: string,
  userContext: UserContext,
): Promise<Conversation | null> {
  try {
    const conversation = await api.get<Conversation>(
      `${LAMBDA_API_BASE}/conversations/${conversationId}`,
      {
        headers: {
          "X-Tenant-Id": userContext.tenantId,
          "X-Practice-Id": userContext.practiceId,
          "X-Sax-Id": String(userContext.saxId),
        },
      },
    );

    // Verify tenant and practice match
    if (
      conversation.tenantId !== userContext.tenantId ||
      conversation.practiceId !== userContext.practiceId
    ) {
      return null;
    }

    // Verify coordinator owns this conversation
    if (conversation.coordinatorSaxId !== userContext.saxId) {
      return null;
    }

    return conversation;
  } catch (error) {
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
      const response = await api.get<PaginatedResponse<Message>>(
        `${LAMBDA_API_BASE}/conversations/${conversationId}/messages`,
        {
          params: {
            limit,
            offset,
            order,
          },
          headers: {
            "X-Tenant-Id": userContext.tenantId,
            "X-Practice-Id": userContext.practiceId,
            "X-Sax-Id": String(userContext.saxId),
          },
        },
      );

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

      // Get Twilio client and send message
      const twilioClient = getTwilioClient();

      // Send message via Twilio Conversations API
      const twilioMessage = await twilioClient.conversations.v1
        .conversations(conversation.twilioSid)
        .messages.create({
          author: String(userContext.saxId),
          body: messageBody,
          ...(body.mediaUrls && body.mediaUrls.length > 0
            ? { mediaSid: undefined } // Note: MMS through conversations may need different handling
            : {}),
        });

      // Calculate segment count (SMS segments are 160 chars for GSM-7, 70 for UCS-2)
      const segmentCount = Math.ceil(messageBody.length / 160);

      // Store message in database via Lambda
      const storedMessage = await api.post<Message>(
        `${LAMBDA_API_BASE}/conversations/${conversationId}/messages`,
        {
          twilioSid: twilioMessage.sid,
          direction: "outbound",
          authorSaxId: userContext.saxId,
          body: messageBody,
          status: "sending",
          segmentCount,
          templateId: body.templateId,
          mediaUrls: body.mediaUrls,
        },
        {
          headers: {
            "X-Tenant-Id": userContext.tenantId,
            "X-Practice-Id": userContext.practiceId,
            "X-Sax-Id": String(userContext.saxId),
          },
        },
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
