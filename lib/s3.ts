import "server-only";

import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

export const MEDIA_BUCKET_NAME = process.env.MEDIA_BUCKET_NAME ?? "";

export const s3 = new S3Client({ region: "us-east-1" });

/** Browser PUT upload – default 15 min TTL */
export async function generateUploadPresignedUrl(
  bucket: string,
  key: string,
  contentType: string,
  ttlSeconds = 900,
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3, command, { expiresIn: ttlSeconds });
}

/** Twilio media fetch GET – default 60 min TTL */
export async function generateTwilioFetchUrl(
  bucket: string,
  key: string,
  ttlSeconds = 3600,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn: ttlSeconds });
}

/** User-facing view GET – default 7-day TTL */
export async function generateViewPresignedUrl(
  bucket: string,
  key: string,
  ttlSeconds = 604_800,
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return getSignedUrl(s3, command, { expiresIn: ttlSeconds });
}

export function getPendingKey(
  conversationId: string,
  uuid: string,
  filename: string,
): string {
  return `media/pending/${conversationId}/${uuid}-${filename}`;
}

export function getCommittedKey(
  conversationId: string,
  uuid: string,
  filename: string,
): string {
  return `media/committed/${conversationId}/${uuid}-${filename}`;
}

// Regex: media/(pending|committed)/{path up to 400 chars}.{image ext}
const S3_KEY_RE =
  /^media\/(pending|committed)\/[a-zA-Z0-9/_-]{1,400}\.(jpg|jpeg|png|gif)$/;

export function isValidS3Key(key: string): boolean {
  return S3_KEY_RE.test(key);
}
