import { NextResponse } from "next/server";
import { ApiError } from "@/lib/api";
import { type UserContext, withUserContext } from "@/lib/auth";
import { processMediaUploads, validateMessageBody } from "@/lib/media";
import {
  fetchWithRetry,
  validateConversationAccess,
  parsePaginationParams,
  completeSlaTracking,
  trackTemplateUsage,
  transformMessage,
  sendMessageViaTwilio,
  storeMessageInLambda,
  type LambdaMessagesResponse,
} from "@/lib/messages";
import type {
  Message,
  PaginatedResponse,
  SendMessageRequest,
} from "@/types/sms";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const LAMBDA_API_BASE = "/outreach";

export const GET = withUserContext(
  async (req: Request, userContext: UserContext) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const conversationId = pathParts[pathParts.indexOf("conversations") + 1];

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 },
      );
    }

    try {
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

      const { limit, offset, order } = parsePaginationParams(url.searchParams);

      const lambdaResponse = await fetchWithRetry(() =>
        fetch(
          `${process.env.API_BASE_URL}${LAMBDA_API_BASE}/conversations/${conversationId}/messages?limit=${limit}&offset=${offset}&order=${order}`,
          {
            headers: {
              "x-tenant-id": userContext.tenantId,
              "x-practice-id": userContext.practiceId,
              "x-coordinator-sax-id": String(userContext.saxId),
            },
          },
        ).then((r) => r.json() as Promise<LambdaMessagesResponse>),
      );

      const messages = (lambdaResponse.messages || []).map((msg) =>
        transformMessage(msg, userContext.tenantId, userContext.practiceId),
      );

      return NextResponse.json(
        {
          data: messages,
          pagination: {
            total: lambdaResponse.pagination?.total || 0,
            limit: lambdaResponse.pagination?.limit || limit,
            offset: lambdaResponse.pagination?.offset || offset,
            hasMore: lambdaResponse.pagination?.has_more || false,
          },
        } as PaginatedResponse<Message>,
        { status: 200 },
      );
    } catch (error) {
      console.error("Failed to fetch messages", {
        conversationId,
        error: error instanceof Error ? error.name : "Unknown",
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

export const POST = withUserContext(
  async (req: Request, userContext: UserContext) => {
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const conversationId = pathParts[pathParts.indexOf("conversations") + 1];

    if (!conversationId) {
      return NextResponse.json(
        { error: "Conversation ID is required" },
        { status: 400 },
      );
    }

    try {
      let body: SendMessageRequest;
      try {
        body = await req.json();
      } catch {
        return NextResponse.json(
          { error: "Invalid JSON body" },
          { status: 400 },
        );
      }

      const hasMediaKeys =
        Array.isArray(body.mediaKeys) && body.mediaKeys.length > 0;

      const bodyValidation = validateMessageBody(body.body, hasMediaKeys);
      if (!bodyValidation.valid) {
        return NextResponse.json(
          { error: bodyValidation.error },
          { status: 400 },
        );
      }

      const mediaProcessing = await processMediaUploads(body.mediaKeys ?? []);
      if (!mediaProcessing.valid) {
        return NextResponse.json(
          { error: mediaProcessing.error },
          { status: 400 },
        );
      }

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

      if (conversation.optedOut) {
        return NextResponse.json(
          { error: "Cannot send message: patient has opted out" },
          { status: 403 },
        );
      }

      const messageBody = bodyValidation.trimmedBody ?? "";
      const twilioMessage = await sendMessageViaTwilio(
        conversation,
        messageBody,
        mediaProcessing.presignedUrls,
      );

      const effectivePracticeId = userContext.isSAXUser
        ? (conversation.practiceId ??
          (conversation as { practice_id?: string }).practice_id)
        : userContext.practiceId;

      const lambdaMessage = await storeMessageInLambda(
        conversationId,
        {
          practiceId: effectivePracticeId,
          twilioSid: twilioMessage.sid,
          saxId: userContext.saxId,
          body: messageBody,
          segmentCount: Math.ceil(messageBody.length / 160) || 1,
          templateId: body.templateId,
          mediaKeys: mediaProcessing.mediaKeys,
        },
        userContext,
      );

      const storedMessage = transformMessage(
        lambdaMessage,
        userContext.tenantId,
        userContext.practiceId,
      );

      completeSlaTracking(conversation, twilioMessage.sid, userContext);

      console.info("Message sent", {
        messageId: storedMessage.id,
        conversationId,
        segmentCount: storedMessage.segmentCount,
        hasTemplate: !!body.templateId,
        hasMedia: !!mediaProcessing.mediaKeys?.length,
      });

      if (body.templateId) {
        trackTemplateUsage(body.templateId, userContext);
      }

      return NextResponse.json(storedMessage, { status: 201 });
    } catch (error) {
      console.error("Failed to send message", {
        conversationId,
        error: error instanceof Error ? error.message : "Unknown",
      });

      if (error instanceof ApiError) {
        return NextResponse.json(
          { error: error.message, code: error.code },
          { status: error.status },
        );
      }

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
