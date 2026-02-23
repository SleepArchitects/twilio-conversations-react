import "server-only";

import { ApiError, api, buildPath } from "@/lib/api";
import { type UserContext, getAccessToken } from "@/lib/auth";
import type { Conversation, Message } from "@/types/sms";

const LAMBDA_API_BASE = "/outreach";

export interface LambdaMessageResponse {
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
  sentiment_score: Record<string, number> | null;
  error_code: string | null;
  error_message: string | null;
  created_on: string;
  created_by: number | null;
  sent_at: string | null;
  delivered_at: string | null;
  read_at: string | null;
  active?: boolean;
  media_keys?: string[] | null;
}

export type LambdaMessage = LambdaMessageResponse;

export interface LambdaMessagesResponse {
  messages: LambdaMessage[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    has_more: boolean;
  };
}

export function transformMessage(
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
    hasMedia: !!(msg.media_keys && msg.media_keys.length > 0),
    media: msg.media_keys
      ? msg.media_keys.map((key) => ({
          s3Key: key,
          contentType: "image/jpeg", // Fallback for type compatibility
          size: 0, // Fallback for type compatibility
          originalFilename: key.split("/").pop() || key,
        }))
      : null,
  };
}

export async function fetchWithRetry<T>(
  fetchFn: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 300,
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetchFn();
    } catch (error) {
      const isLastAttempt = i === maxRetries - 1;
      const isRetryableError =
        error instanceof ApiError &&
        error.status === 404 &&
        error.code === "NOT_FOUND";

      if (isLastAttempt || !isRetryableError) {
        throw error;
      }

      await new Promise((resolve) => setTimeout(resolve, baseDelay * (i + 1)));
    }
  }
  throw new Error("Max retries exceeded");
}

interface LambdaConversationResponse {
  conversation: Conversation;
}

export async function validateConversationAccess(
  conversationId: string,
  userContext: UserContext,
): Promise<Conversation | null> {
  try {
    const accessToken = await getAccessToken();
    const headers: Record<string, string> = {
      "x-tenant-id": userContext.tenantId,
      "x-practice-id": userContext.practiceId,
      "x-coordinator-sax-id": String(userContext.saxId),
    };

    if (userContext.isSAXUser) {
      delete headers["x-practice-id"];
      headers["x-sax-admin"] = "true";
    }

    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    const params: Record<string, string> = { id: conversationId };

    if (!userContext.isSAXUser) {
      params.tenant_id = userContext.tenantId;
      params.practice_id = userContext.practiceId;
      params.coordinator_sax_id = String(userContext.saxId);
    }

    const response = await api.get<LambdaConversationResponse>(
      buildPath(LAMBDA_API_BASE, "conversations", conversationId),
      { params, headers },
    );

    const conversation =
      response.conversation || (response as unknown as Conversation);

    if (!conversation || !conversation.id) {
      return null;
    }

    if (userContext.isSAXUser) {
      return conversation;
    }

    if (
      conversation.tenantId !== userContext.tenantId ||
      conversation.practiceId !== userContext.practiceId
    ) {
      return null;
    }

    if (Number(conversation.coordinatorSaxId) !== Number(userContext.saxId)) {
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

export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaultLimit = 50,
  maxLimit = 100,
): { limit: number; offset: number; order: "asc" | "desc" } {
  let limit = parseInt(searchParams.get("limit") || String(defaultLimit), 10);
  let offset = parseInt(searchParams.get("offset") || "0", 10);
  const orderParam = searchParams.get("order") || "asc";

  if (Number.isNaN(limit) || limit < 1) limit = defaultLimit;
  if (limit > maxLimit) limit = maxLimit;
  if (Number.isNaN(offset) || offset < 0) offset = 0;

  const order = orderParam === "desc" ? "desc" : "asc";

  return { limit, offset, order };
}

const ENABLE_SLA_MONITORING =
  process.env.ENABLE_SLA_MONITORING === "true" ||
  process.env.NEXT_PUBLIC_ENABLE_SLA_MONITORING === "true";

export function shouldCompleteSla(conversation: Conversation): boolean {
  return ENABLE_SLA_MONITORING && conversation.slaStatus === "warning";
}

export interface SendMessageResult {
  twilioSid: string;
  lambdaMessage: LambdaMessageResponse;
}

export async function sendMessageViaTwilio(
  conversation: Conversation,
  messageBody: string,
  mediaUrls: string[] | undefined,
): Promise<{ sid: string }> {
  const { getTwilioClient } = await import("@/lib/twilio");
  const twilioClient = getTwilioClient();

  return twilioClient.messages.create({
    to: conversation.patientPhone,
    body: messageBody || undefined,
    from: process.env.TWILIO_FROM_NUMBER,
    mediaUrl: mediaUrls,
  });
}

export async function storeMessageInLambda(
  conversationId: string,
  messageData: {
    practiceId: string;
    twilioSid: string;
    saxId: number;
    body: string;
    segmentCount: number;
    templateId?: string;
    mediaKeys?: string[];
  },
  userContext: UserContext,
): Promise<LambdaMessageResponse> {
  const accessToken = await getAccessToken();
  const headers: Record<string, string> = {
    "x-tenant-id": userContext.tenantId,
    "x-practice-id": messageData.practiceId,
    "x-coordinator-sax-id": String(userContext.saxId),
  };

  if (accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  }

  const lambdaResponse = await api.post<
    { message: LambdaMessageResponse } | LambdaMessageResponse
  >(
    buildPath(LAMBDA_API_BASE, "conversations", conversationId, "messages"),
    {
      practice_id: messageData.practiceId,
      twilio_sid: messageData.twilioSid,
      direction: "outbound",
      author_sax_id: messageData.saxId,
      body: messageData.body,
      status: "sending",
      segment_count: messageData.segmentCount,
      template_id: messageData.templateId,
      media_keys: messageData.mediaKeys,
    },
    { headers },
  );

  return "message" in lambdaResponse ? lambdaResponse.message : lambdaResponse;
}

export async function completeSlaTracking(
  conversation: Conversation,
  outboundMessageId: string,
  userContext: UserContext,
): Promise<void> {
  if (!shouldCompleteSla(conversation)) {
    return;
  }

  const accessToken = await getAccessToken();
  const slaHeaders: Record<string, string> = {
    "x-tenant-id": userContext.tenantId,
    "x-practice-id": userContext.practiceId,
    "x-coordinator-sax-id": String(userContext.saxId),
  };

  if (accessToken) {
    slaHeaders["Authorization"] = `Bearer ${accessToken}`;
  }

  api
    .post(
      buildPath(LAMBDA_API_BASE, "sla", "complete-tracking"),
      {
        conversationId: conversation.twilioSid,
        outboundMessageId,
      },
      { headers: slaHeaders },
    )
    .catch((error) => {
      console.error("[SLA] Failed to complete response metric", {
        conversationTwilioSid: conversation.twilioSid,
        outboundMessageId,
        errorType: error instanceof Error ? error.name : "Unknown",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    });
}

export async function trackTemplateUsage(
  templateId: string,
  userContext: UserContext,
): Promise<void> {
  const accessToken = await getAccessToken();
  const usageHeaders: Record<string, string> = {
    "x-tenant-id": userContext.tenantId,
    "x-practice-id": userContext.practiceId,
    "x-coordinator-sax-id": String(userContext.saxId),
  };

  if (accessToken) {
    usageHeaders["Authorization"] = `Bearer ${accessToken}`;
  }

  api
    .post(
      buildPath(LAMBDA_API_BASE, "templates", templateId, "usage"),
      { tenant_id: userContext.tenantId },
      { headers: usageHeaders },
    )
    .catch((error) => {
      console.error("Failed to track template usage", {
        templateId,
        errorType: error instanceof Error ? error.name : "Unknown",
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    });
}
