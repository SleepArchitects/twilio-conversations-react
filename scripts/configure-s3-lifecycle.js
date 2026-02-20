#!/usr/bin/env node

/**
 * Adds an S3 lifecycle rule to expire objects under media/pending/ after 1 day.
 *
 * Usage: MEDIA_BUCKET_NAME=my-bucket node scripts/configure-s3-lifecycle.js
 */

const {
  S3Client,
  PutBucketLifecycleConfigurationCommand,
} = require("@aws-sdk/client-s3");

const BUCKET = process.env.MEDIA_BUCKET_NAME;
if (!BUCKET) {
  console.error("MEDIA_BUCKET_NAME env var is required");
  process.exit(1);
}

const s3 = new S3Client({ region: "us-east-1" });

async function main() {
  const command = new PutBucketLifecycleConfigurationCommand({
    Bucket: BUCKET,
    LifecycleConfiguration: {
      Rules: [
        {
          ID: "expire-pending-media",
          Filter: { Prefix: "media/pending/" },
          Status: "Enabled",
          Expiration: { Days: 1 },
        },
      ],
    },
  });

  await s3.send(command);
  console.log(
    `Lifecycle rule "expire-pending-media" applied to bucket "${BUCKET}"`,
  );
}

main().catch((err) => {
  console.error("Failed to configure lifecycle rule:", err);
  process.exit(1);
});
