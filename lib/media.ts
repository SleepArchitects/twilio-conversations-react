import "server-only";

import {
  generateTwilioFetchUrl,
  isValidS3Key,
  MEDIA_BUCKET_NAME,
} from "@/lib/s3";

const MAX_MEDIA_ITEMS = 5;
const MAX_MESSAGE_LENGTH = 1600;
const ALLOWED_IMAGE_TYPES = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
];

function getContentTypeFromKey(key: string): string | null {
  const ext = key.split(".").pop()?.toLowerCase();
  const typeMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
  };
  return typeMap[ext ?? ""] ?? null;
}

function isAllowedContentType(contentType: string): boolean {
  return ALLOWED_IMAGE_TYPES.includes(contentType);
}

function validateMediaKey(
  key: string,
  index: number,
): { valid: boolean; error?: string } {
  if (!isValidS3Key(key)) {
    return {
      valid: false,
      error: `mediaKeys[${index}] is not a valid S3 key format`,
    };
  }

  const contentType = getContentTypeFromKey(key);
  if (!contentType || !isAllowedContentType(contentType)) {
    return {
      valid: false,
      error: `mediaKeys[${index}] has unsupported file type. Allowed: jpg, jpeg, png, gif`,
    };
  }

  return { valid: true };
}

export interface MediaProcessingResult {
  valid: boolean;
  error?: string;
  presignedUrls?: string[];
  mediaKeys?: string[];
}

export async function processMediaUploads(
  mediaKeys: string[],
): Promise<MediaProcessingResult> {
  if (!mediaKeys || mediaKeys.length === 0) {
    return { valid: true };
  }

  if (mediaKeys.length > MAX_MEDIA_ITEMS) {
    return {
      valid: false,
      error: `Maximum ${MAX_MEDIA_ITEMS} media attachments allowed`,
    };
  }

  for (let i = 0; i < mediaKeys.length; i++) {
    const validation = validateMediaKey(mediaKeys[i], i);
    if (!validation.valid) {
      return { valid: false, error: validation.error };
    }
  }

  const presignedUrls: string[] = [];
  for (const key of mediaKeys) {
    const url = await generateTwilioFetchUrl(MEDIA_BUCKET_NAME, key);
    presignedUrls.push(url);
  }

  return {
    valid: true,
    presignedUrls,
    mediaKeys,
  };
}

export async function transformMessageWithMedia<
  T extends { mediaKeys?: string[] | null },
>(message: T): Promise<Omit<T, "mediaKeys"> & { mediaUrls?: string[] }> {
  const { mediaKeys, ...rest } = message;

  if (!mediaKeys || mediaKeys.length === 0) {
    return rest as Omit<T, "mediaKeys"> & { mediaUrls?: string[] };
  }

  const { generateViewPresignedUrl } = await import("@/lib/s3");
  const mediaUrls = await Promise.all(
    mediaKeys.map((key) => generateViewPresignedUrl(MEDIA_BUCKET_NAME, key)),
  );

  return {
    ...rest,
    mediaUrls,
  };
}

export function validateMessageBody(
  body: string | undefined,
  hasMedia: boolean,
): { valid: boolean; error?: string; trimmedBody?: string } {
  const trimmedBody = body?.trim() ?? "";

  if (trimmedBody.length === 0 && !hasMedia) {
    return {
      valid: false,
      error: "Message body is required when no media is attached",
    };
  }

  if (trimmedBody.length > MAX_MESSAGE_LENGTH) {
    return {
      valid: false,
      error: `Message body exceeds maximum length of ${MAX_MESSAGE_LENGTH} characters`,
    };
  }

  return { valid: true, trimmedBody };
}
