import { NextRequest, NextResponse } from "next/server";
import { withUserContext } from "@/lib/auth";
import {
  generateUploadPresignedUrl,
  getPendingKey,
  MEDIA_BUCKET_NAME,
} from "@/lib/s3";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const runtime = "nodejs";

interface UploadRequest {
  filename: string;
  contentType: string;
  conversationId: string;
}

interface UploadResponse {
  uploadUrl: string;
  key: string;
  bucket: string;
}

async function handleUpload(request: NextRequest) {
  try {
    const body: UploadRequest = await request.json();
    const { filename, contentType, conversationId } = body;

    // Validate required fields
    if (!filename || !contentType || !conversationId) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Missing required fields: filename, contentType, conversationId",
          },
        },
        { status: 400 },
      );
    }

    // Validate content type (only allow images)
    const allowedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message:
              "Invalid content type. Only JPEG, PNG, GIF, and WebP images are allowed.",
          },
        },
        { status: 400 },
      );
    }

    // Validate filename (basic security check)
    if (filename.length > 255 || /[<>:;"|?*\x00-\x1f]/.test(filename)) {
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid filename",
          },
        },
        { status: 400 },
      );
    }

    // Generate S3 key and presigned URL
    const bucket = MEDIA_BUCKET_NAME;
    const uuid = crypto.randomUUID();
    const key = getPendingKey(conversationId, uuid, filename);

    const uploadUrl = await generateUploadPresignedUrl(
      bucket,
      key,
      contentType,
      3600,
    );

    const response: UploadResponse = {
      uploadUrl,
      key,
      bucket,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("[Media Upload] Error:", error);
    return NextResponse.json(
      {
        error: {
          code: "INTERNAL_ERROR",
          message: "Failed to generate upload URL",
        },
      },
      { status: 500 },
    );
  }
}

export const POST = withUserContext(handleUpload);
