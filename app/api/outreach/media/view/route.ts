import { NextRequest, NextResponse } from "next/server";
import { type UserContext, withUserContext } from "@/lib/auth";
import { ApiError, api, buildPath } from "@/lib/api";
import {
  MEDIA_BUCKET_NAME,
  generateViewPresignedUrl,
  isValidS3Key,
} from "@/lib/s3";
import type { Conversation } from "@/types/sms";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

const LAMBDA_API_BASE = "/outreach";
const VIEW_URL_TTL_SECONDS = 604800;
const MAX_BATCH_SIZE = 50;

interface ViewRequest {
  keys: string[];
}

interface ViewResponse {
  urls: Record<string, string>;
}

const UUID_RE =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

function extractConversationIdFromKey(key: string): string | null {
  const parts = key.split("/");

  if (parts.length < 4 || parts[0] !== "media") return null;
  if (parts[1] !== "pending" && parts[1] !== "committed") return null;

  if (UUID_RE.test(parts[2])) return parts[2];

  if (
    parts.length >= 5 &&
    (parts[2] === "inbound" || parts[2] === "outbound")
  ) {
    return UUID_RE.test(parts[3]) ? parts[3] : null;
  }

  return null;
}

async function validateKeyAccess(
  key: string,
  userContext: UserContext,
): Promise<boolean> {
  const conversationId = extractConversationIdFromKey(key);
  if (!conversationId) return false;

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
    if (!conversation?.id) return false;

    if (userContext.isSAXUser) return true;

    if (
      conversation.tenantId !== userContext.tenantId ||
      conversation.practiceId !== userContext.practiceId
    ) {
      return false;
    }

    if (Number(conversation.coordinatorSaxId) !== Number(userContext.saxId)) {
      return false;
    }

    return true;
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return false;
    throw error;
  }
}

function parseViewRequest(body: unknown): ViewRequest | null {
  if (!body || typeof body !== "object") return null;

  const { keys } = body as Record<string, unknown>;

  if (!Array.isArray(keys)) return null;
  if (!keys.every((k) => typeof k === "string")) return null;

  return { keys };
}

/**
 * POST /api/outreach/media/view
 *
 * Generate presigned GET URLs for viewing media in S3.
 * Accepts a batch of S3 keys and returns presigned URLs for each.
 *
 * Request Body:
 * - keys: string[] (required, array of S3 keys, max 50)
 *
 * @returns ViewResponse with presigned URLs mapped by S3 key
 */
export const POST = withUserContext(
  async (req: NextRequest, userContext: UserContext) => {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const viewRequest = parseViewRequest(body);
    if (!viewRequest) {
      return NextResponse.json(
        { error: "Invalid request body. Required: keys (array of strings)" },
        { status: 400 },
      );
    }

    const { keys } = viewRequest;

    if (keys.length === 0) {
      return NextResponse.json(
        { error: "At least one key is required" },
        { status: 400 },
      );
    }

    if (keys.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Maximum ${MAX_BATCH_SIZE} keys allowed per request` },
        { status: 400 },
      );
    }

    const invalidKeys = keys.filter((key) => !isValidS3Key(key));
    if (invalidKeys.length > 0) {
      return NextResponse.json(
        { error: "Invalid S3 key format", invalidKeys },
        { status: 400 },
      );
    }

    const accessChecks = await Promise.allSettled(
      keys.map(async (key) => {
        const hasAccess = await validateKeyAccess(key, userContext);
        return { key, hasAccess };
      }),
    );

    const authorizedKeys: string[] = [];

    for (const result of accessChecks) {
      if (result.status === "fulfilled" && result.value.hasAccess) {
        authorizedKeys.push(result.value.key);
      }
    }

    if (authorizedKeys.length !== keys.length) {
      return NextResponse.json(
        { error: "One or more media items not found or access denied" },
        { status: 404 },
      );
    }

    const urlPromises = authorizedKeys.map(async (key) => {
      const url = await generateViewPresignedUrl(
        MEDIA_BUCKET_NAME,
        key,
        VIEW_URL_TTL_SECONDS,
      );
      return { key, url };
    });

    const urlResults = await Promise.all(urlPromises);

    const urls: Record<string, string> = {};
    for (const { key, url } of urlResults) {
      urls[key] = url;
    }

    const response: ViewResponse = { urls };

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

/**
 * GET /api/outreach/media/view?s3Key=<key>
 *
 * Generate a presigned GET URL for viewing a single media file in S3.
 *
 * Query Parameters:
 * - s3Key: string (required, the S3 key for the media file)
 *
 * @returns { presignedUrl: string } on success (200)
 */
export const GET = withUserContext(
  async (request: NextRequest, userContext: UserContext) => {
    const s3Key = request.nextUrl.searchParams.get("s3Key");

    if (!s3Key) {
      return NextResponse.json(
        { error: "Missing required query parameter: s3Key" },
        { status: 400 },
      );
    }

    if (!isValidS3Key(s3Key)) {
      return NextResponse.json(
        { error: "Invalid S3 key format" },
        { status: 400 },
      );
    }

    let hasAccess: boolean;
    try {
      hasAccess = await validateKeyAccess(s3Key, userContext);
    } catch {
      return NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: "Media item not found or access denied" },
        { status: 404 },
      );
    }

    let presignedUrl: string;
    try {
      presignedUrl = await generateViewPresignedUrl(
        MEDIA_BUCKET_NAME,
        s3Key,
        VIEW_URL_TTL_SECONDS,
      );
    } catch {
      return NextResponse.json(
        { error: "Failed to generate presigned URL" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { presignedUrl },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store, no-cache, must-revalidate, proxy-revalidate",
          Pragma: "no-cache",
          Expires: "0",
        },
      },
    );
  },
);
