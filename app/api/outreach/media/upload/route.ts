import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { type UserContext, withUserContext } from "@/lib/auth";
import { ApiError, api, buildPath } from "@/lib/api";
import {
  MEDIA_BUCKET_NAME,
  generateUploadPresignedUrl,
  getPendingKey,
} from "@/lib/s3";
import type { Conversation } from "@/types/sms";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const LAMBDA_API_BASE = "/outreach";
const VALID_IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif"];
const MAX_FILENAME_LENGTH = 255;
const UPLOAD_URL_TTL_SECONDS = 900;

interface UploadRequest {
  filename: string;
  contentType: string;
  conversationId: string;
}

interface UploadResponse {
  presignedUrl: string;
  s3Key: string;
  bucket: string;
  expiresAt: string;
}

async function validateConversationOwnership(
  conversationId: string,
  userContext: UserContext,
): Promise<Conversation | null> {
  try {
    const params: Record<string, string> = { id: conversationId };

    if (!userContext.isSAXUser) {
      params.tenant_id = userContext.tenantId;
      params.practice_id = userContext.practiceId;
      params.coordinator_sax_id = String(userContext.saxId);
    }

    const headers: Record<string, string> = {
      "x-tenant-id": userContext.tenantId,
      "x-practice-id": userContext.practiceId,
      "x-coordinator-sax-id": String(userContext.saxId),
    };

    if (userContext.isSAXUser) {
      delete headers["x-practice-id"];
      headers["x-sax-admin"] = "true";
    }

    const response = await api.get<{ conversation: Conversation }>(
      buildPath(LAMBDA_API_BASE, "conversations", conversationId),
      { params, headers },
    );

    const conversation = response.conversation;
    if (!conversation?.id) return null;

    if (userContext.isSAXUser) return conversation;

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
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

function parseUploadRequest(body: unknown): UploadRequest | null {
  if (!body || typeof body !== "object") return null;

  const { filename, contentType, conversationId } = body as Record<
    string,
    unknown
  >;

  if (
    typeof filename !== "string" ||
    typeof contentType !== "string" ||
    typeof conversationId !== "string"
  ) {
    return null;
  }

  return { filename, contentType, conversationId };
}

function validateFilenameExtension(filename: string): boolean {
  if (filename.length === 0 || filename.length > MAX_FILENAME_LENGTH) {
    return false;
  }

  const extension = filename.split(".").pop()?.toLowerCase();
  if (!extension) return false;

  return VALID_IMAGE_EXTENSIONS.includes(extension);
}

function validateContentType(contentType: string): boolean {
  return contentType.startsWith("image/");
}

/**
 * POST /api/outreach/media/upload
 *
 * Generate a presigned PUT URL for uploading media to S3.
 * The uploaded file will be stored in the pending state.
 *
 * Request Body:
 * - filename: string (required, jpg/jpeg/png/gif only)
 * - contentType: string (required, must start with 'image/')
 * - conversationId: string (required, must be a valid conversation ID)
 *
 * @returns UploadResponse with presigned URL and S3 key
 */
export const POST = withUserContext(
  async (req: NextRequest, userContext: UserContext) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const uploadRequest = parseUploadRequest(body);
    if (!uploadRequest) {
      return NextResponse.json(
        {
          error:
            "Invalid request body. Required: filename, contentType, conversationId",
        },
        { status: 400 },
      );
    }

    const { filename, contentType, conversationId } = uploadRequest;

    if (!validateFilenameExtension(filename)) {
      const allowedExtensions = VALID_IMAGE_EXTENSIONS.join(", ");
      return NextResponse.json(
        { error: "Invalid file extension. Allowed: " + allowedExtensions },
        { status: 400 },
      );
    }

    if (!validateContentType(contentType)) {
      return NextResponse.json(
        { error: "Content type must be an image type (image/*)" },
        { status: 400 },
      );
    }

    const conversation = await validateConversationOwnership(
      conversationId,
      userContext,
    );
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found or access denied" },
        { status: 404 },
      );
    }

    const uuid = randomUUID();
    const s3Key = getPendingKey(conversationId, uuid, filename);
    const uploadUrl = await generateUploadPresignedUrl(
      MEDIA_BUCKET_NAME,
      s3Key,
      contentType,
      UPLOAD_URL_TTL_SECONDS,
    );

    const expiresAt = new Date(
      Date.now() + UPLOAD_URL_TTL_SECONDS * 1000,
    ).toISOString();

    const response: UploadResponse = {
      presignedUrl: uploadUrl,
      s3Key: s3Key,
      bucket: MEDIA_BUCKET_NAME,
      expiresAt,
    };

    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Cache-Control":
          "no-store, no-cache, must-revalidate, proxy-revalidate",
        Pragma: "no-cache",
        Expires: "0",
      },
    });
  },
);
