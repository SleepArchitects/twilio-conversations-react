import { NextRequest, NextResponse } from "next/server";
import twilio from "twilio";
import { api } from "@/lib/api";
import type { MessageStatus } from "@/types/sms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lambda API base path for SMS outreach
 */
const LAMBDA_API_BASE = "/sms";

/**
 * Environment variables
 */
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN!;
const WEBHOOK_BASE_URL = process.env.WEBHOOK_BASE_URL;

/**
 * Twilio Webhook Event Types
 */
type TwilioEventType =
  | "onMessageAdded"
  | "onMessageUpdated"
  | "onMessageRemoved"
  | "onConversationAdded"
  | "onConversationUpdated"
  | "onConversationRemoved"
  | "onParticipantAdded"
  | "onParticipantUpdated"
  | "onParticipantRemoved";

/**
 * Twilio message status values
 */
type TwilioMessageStatus =
  | "accepted"
  | "queued"
  | "sending"
  | "sent"
  | "delivered"
  | "read"
  | "failed"
  | "undelivered";

/**
 * STOP/opt-out keywords per TCPA/CTIA guidelines
 */
const OPT_OUT_KEYWORDS = [
  "STOP",
  "STOPALL",
  "UNSUBSCRIBE",
  "CANCEL",
  "END",
  "QUIT",
];

/**
 * Parsed webhook payload from Twilio
 */
interface TwilioWebhookPayload {
  /** Twilio Conversation SID */
  ConversationSid?: string;
  /** Twilio Message SID */
  MessageSid?: string;
  /** Message body (inbound messages) */
  Body?: string;
  /** Author identifier (phone number for inbound) */
  Author?: string;
  /** Event type */
  EventType?: TwilioEventType;
  /** Message status (for status callbacks) */
  MessageStatus?: TwilioMessageStatus;
  /** Error code (for failed messages) */
  ErrorCode?: string;
  /** Error message (for failed messages) */
  ErrorMessage?: string;
  /** Account SID */
  AccountSid?: string;
  /** Source (for identifying callback type) */
  Source?: string;
  /** Participant SID */
  ParticipantSid?: string;
  /** Date created */
  DateCreated?: string;
  /** Index of the message in conversation */
  Index?: string;
  // Raw SMS webhook fields (when not using Conversations)
  /** From phone number (raw SMS webhook) */
  From?: string;
  /** To phone number (raw SMS webhook) */
  To?: string;
  /** SMS Message SID (raw SMS webhook) */
  SmsSid?: string;
  /** SMS Status (raw SMS webhook) */
  SmsStatus?: string;
  /** Number of segments (raw SMS webhook) */
  NumSegments?: string;
}

/**
 * Request payload for storing inbound messages via Lambda API
 */
interface StoreInboundMessageRequest {
  twilioConversationSid: string;
  twilioMessageSid: string;
  body: string;
  authorPhone: string;
  dateCreated: string;
}

/**
 * Request payload for updating message status via Lambda API
 */
interface UpdateMessageStatusRequest {
  twilioMessageSid: string;
  status: MessageStatus;
  errorCode?: string;
  errorMessage?: string;
}

/**
 * Request payload for marking conversation as opted out via Lambda API
 */
interface OptOutConversationRequest {
  twilioConversationSid: string;
  optedOut: boolean;
}

/**
 * Construct the full webhook URL for signature validation
 */
function getWebhookUrl(request: NextRequest): string {
  // Use configured base URL if available, otherwise construct from request
  if (WEBHOOK_BASE_URL) {
    return `${WEBHOOK_BASE_URL}/api/outreach/webhook`;
  }

  // Construct from request headers (less reliable but works for development)
  const protocol = request.headers.get("x-forwarded-proto") || "https";
  const host =
    request.headers.get("x-forwarded-host") || request.headers.get("host");

  if (!host) {
    throw new Error("Unable to determine webhook URL: missing host header");
  }

  return `${protocol}://${host}/api/outreach/webhook`;
}

/**
 * Validate the Twilio signature from the X-Twilio-Signature header
 * CRITICAL: Must be called before processing any webhook data
 *
 * NOTE: Signature validation is skipped in development when using ngrok/tunnels
 * because the URL mismatch causes validation to fail.
 */
function validateTwilioSignature(
  request: NextRequest,
  params: Record<string, string>,
): boolean {
  // Skip validation in development mode for local testing with ngrok
  const isDevelopment = process.env.NODE_ENV === "development";
  const skipValidation =
    process.env.SKIP_TWILIO_SIGNATURE_VALIDATION === "true";

  if (isDevelopment || skipValidation) {
    console.log("[Webhook] Skipping signature validation (development mode)");
    return true;
  }

  const signature = request.headers.get("x-twilio-signature");

  if (!signature) {
    console.error("[Webhook] Missing X-Twilio-Signature header");
    return false;
  }

  if (!TWILIO_AUTH_TOKEN) {
    console.error("[Webhook] Missing TWILIO_AUTH_TOKEN environment variable");
    return false;
  }

  try {
    const url = getWebhookUrl(request);

    // Use Twilio's validateRequest to verify signature
    const isValid = twilio.validateRequest(
      TWILIO_AUTH_TOKEN,
      signature,
      url,
      params,
    );

    if (!isValid) {
      console.error("[Webhook] Invalid Twilio signature");
    }

    return isValid;
  } catch (error) {
    console.error("[Webhook] Error validating signature:", error);
    return false;
  }
}

/**
 * Parse form data from request body
 */
async function parseFormData(
  request: NextRequest,
): Promise<Record<string, string>> {
  const formData = await request.formData();
  const params: Record<string, string> = {};

  formData.forEach((value, key) => {
    // Only include string values
    if (typeof value === "string") {
      params[key] = value;
    }
  });

  return params;
}

/**
 * Check if message body contains opt-out keywords
 */
function isOptOutMessage(body: string | undefined): boolean {
  if (!body) return false;

  const normalizedBody = body.trim().toUpperCase();
  return OPT_OUT_KEYWORDS.includes(normalizedBody);
}

/**
 * Map Twilio message status to our MessageStatus type
 */
function mapMessageStatus(twilioStatus: TwilioMessageStatus): MessageStatus {
  switch (twilioStatus) {
    case "accepted":
    case "queued":
    case "sending":
      return "sending";
    case "sent":
      return "sent";
    case "delivered":
      return "delivered";
    case "read":
      return "read";
    case "failed":
    case "undelivered":
      return "failed";
    default:
      return "sending";
  }
}

/**
 * Handle inbound message event (onMessageAdded from patient)
 */
async function handleInboundMessage(
  payload: TwilioWebhookPayload,
): Promise<void> {
  const { ConversationSid, MessageSid, Body, Author, DateCreated } = payload;

  if (!ConversationSid || !MessageSid || !Author) {
    console.error("[Webhook] Missing required fields for inbound message");
    return;
  }

  // Log event without PHI (no message body)
  console.log("[Webhook] Processing inbound message", {
    conversationSid: ConversationSid,
    messageSid: MessageSid,
    hasBody: !!Body,
    authorType: Author.startsWith("+") ? "phone" : "identity",
  });

  // Check for opt-out message
  if (isOptOutMessage(Body)) {
    console.log("[Webhook] Opt-out keyword detected", {
      conversationSid: ConversationSid,
    });

    try {
      // Mark conversation as opted out
      await api.post<void>(`${LAMBDA_API_BASE}/conversations/opt-out`, {
        twilioConversationSid: ConversationSid,
        optedOut: true,
      } as OptOutConversationRequest);

      console.log("[Webhook] Conversation marked as opted out", {
        conversationSid: ConversationSid,
      });
    } catch (error) {
      console.error(
        "[Webhook] Failed to mark conversation as opted out:",
        error,
      );
      // Continue processing - still store the message
    }
  }

  // Store the inbound message via Lambda API
  try {
    await api.post<void>(`${LAMBDA_API_BASE}/messages/inbound`, {
      twilioConversationSid: ConversationSid,
      twilioMessageSid: MessageSid,
      body: Body || "",
      authorPhone: Author,
      dateCreated: DateCreated || new Date().toISOString(),
    } as StoreInboundMessageRequest);

    console.log("[Webhook] Inbound message stored successfully", {
      conversationSid: ConversationSid,
      messageSid: MessageSid,
    });
  } catch (error) {
    console.error("[Webhook] Failed to store inbound message:", error);
    throw error;
  }
}

/**
 * Handle raw SMS inbound message (when not using Twilio Conversations)
 * This is triggered when the phone number's webhook receives an SMS directly
 */
async function handleRawSmsInbound(
  payload: TwilioWebhookPayload,
): Promise<void> {
  const { From, To, Body, MessageSid, SmsSid, NumSegments } = payload;
  const messageSid = MessageSid || SmsSid;

  if (!From || !messageSid) {
    console.error("[Webhook] Missing required fields for raw SMS inbound");
    return;
  }

  // Log event without PHI (no message body)
  console.log("[Webhook] Processing raw SMS inbound", {
    from: From,
    to: To,
    messageSid,
    numSegments: NumSegments,
    hasBody: !!Body,
  });

  // Check for opt-out message
  if (isOptOutMessage(Body)) {
    console.log("[Webhook] Opt-out keyword detected (raw SMS)", {
      from: From,
    });
    // In raw SMS mode, we would need to track opt-outs differently
    // For now, just log it
  }

  // For raw SMS, we don't have a conversation context
  // This would need to be integrated with your conversation lookup logic
  console.log("[Webhook] Raw SMS received successfully", {
    from: From,
    to: To,
    messageSid,
    body: Body, // Log body for testing (remove in production)
  });

  // TODO: Look up or create conversation based on From phone number
  // TODO: Store message in database via Lambda API
}

/**
 * Check if this is a raw SMS webhook (not Twilio Conversations)
 */
function isRawSmsWebhook(payload: TwilioWebhookPayload): boolean {
  // Raw SMS webhooks have From/To/SmsSid but no EventType or ConversationSid
  return !!(
    payload.From &&
    payload.To &&
    (payload.SmsSid || payload.MessageSid) &&
    !payload.EventType &&
    !payload.ConversationSid
  );
}

/**
 * Handle message status callback (sent, delivered, read, failed)
 */
async function handleStatusCallback(
  payload: TwilioWebhookPayload,
): Promise<void> {
  const {
    MessageSid,
    MessageStatus,
    ErrorCode,
    ErrorMessage,
    ConversationSid,
  } = payload;

  if (!MessageSid || !MessageStatus) {
    console.error("[Webhook] Missing required fields for status callback");
    return;
  }

  const mappedStatus = mapMessageStatus(MessageStatus);

  // Log event without PHI
  console.log("[Webhook] Processing status callback", {
    messageSid: MessageSid,
    conversationSid: ConversationSid,
    status: mappedStatus,
    hasError: !!ErrorCode,
  });

  // Update message status via Lambda API
  try {
    const updateRequest: UpdateMessageStatusRequest = {
      twilioMessageSid: MessageSid,
      status: mappedStatus,
    };

    // Include error details if status is failed
    if (mappedStatus === "failed" && ErrorCode) {
      updateRequest.errorCode = ErrorCode;
      updateRequest.errorMessage = ErrorMessage;
    }

    await api.patch<void>(`${LAMBDA_API_BASE}/messages/status`, updateRequest);

    console.log("[Webhook] Message status updated successfully", {
      messageSid: MessageSid,
      status: mappedStatus,
    });
  } catch (error) {
    console.error("[Webhook] Failed to update message status:", error);
    throw error;
  }
}

/**
 * POST /api/outreach/webhook
 *
 * Receives Twilio webhook events for:
 * - Inbound messages (onMessageAdded)
 * - Message status callbacks (sent, delivered, read, failed)
 *
 * Security:
 * - Validates X-Twilio-Signature header before processing
 * - No Auth0 authentication (uses Twilio signature validation)
 *
 * @returns 200 OK on success, 403 for invalid signature, 500 for errors
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // Parse form data first (needed for signature validation)
    const params = await parseFormData(request);

    // CRITICAL: Validate Twilio signature before processing ANY data
    if (!validateTwilioSignature(request, params)) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 403 });
    }

    // Cast to typed payload
    const payload = params as unknown as TwilioWebhookPayload;
    const eventType = payload.EventType;

    // Log received event (no PHI)
    console.log("[Webhook] Received event", {
      eventType,
      conversationSid: payload.ConversationSid,
      messageSid: payload.MessageSid || payload.SmsSid,
      source: payload.Source,
      isRawSms: isRawSmsWebhook(payload),
    });

    // Handle raw SMS webhook (not Twilio Conversations)
    if (isRawSmsWebhook(payload)) {
      await handleRawSmsInbound(payload);
      return NextResponse.json({ success: true }, { status: 200 });
    }

    // Route by event type (Twilio Conversations webhooks)
    switch (eventType) {
      case "onMessageAdded": {
        // Check if this is an inbound message (from phone number, not identity)
        const author = payload.Author;
        if (author && author.startsWith("+")) {
          // Inbound message from patient
          await handleInboundMessage(payload);
        } else {
          // Outbound message - may still need to track for status
          console.log("[Webhook] Outbound message event (no action needed)", {
            conversationSid: payload.ConversationSid,
            messageSid: payload.MessageSid,
          });
        }
        break;
      }

      case "onMessageUpdated": {
        // Handle status callbacks (message status changes)
        if (payload.MessageStatus) {
          await handleStatusCallback(payload);
        }
        break;
      }

      case "onConversationAdded":
      case "onConversationUpdated":
      case "onConversationRemoved":
      case "onParticipantAdded":
      case "onParticipantUpdated":
      case "onParticipantRemoved":
      case "onMessageRemoved": {
        // Log but don't process these events currently
        console.log("[Webhook] Unhandled event type (acknowledged)", {
          eventType,
          conversationSid: payload.ConversationSid,
        });
        break;
      }

      default: {
        // Check for status callback without EventType (direct message status webhook)
        if (payload.MessageStatus && payload.MessageSid) {
          await handleStatusCallback(payload);
        } else {
          console.log("[Webhook] Unknown event type", {
            eventType,
            payload: Object.keys(params),
          });
        }
      }
    }

    // Return success - Twilio expects 200 OK
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    // Log error without exposing internal details
    console.error("[Webhook] Error processing webhook:", error);

    // Return 500 to signal Twilio to retry (for transient errors)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

/**
 * GET /api/outreach/webhook
 *
 * Health check endpoint for webhook verification.
 * Twilio may send GET requests to verify the webhook URL.
 */
export async function GET(): Promise<NextResponse> {
  return NextResponse.json(
    {
      status: "ok",
      endpoint: "Twilio Conversations Webhook",
      timestamp: new Date().toISOString(),
    },
    { status: 200 },
  );
}
