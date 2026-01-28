#!/bin/bash
# Fix Production CloudFront Configuration for Outreach Zone
# 
# Problems identified:
# 1. SleepConnect CloudFront (EZCEVIJQBKJTG) missing /outreach and /outreach/* behaviors
#    (currently falling through to SleepConnect default behavior -> 404)
# 2. Lambda InvokeMode is BUFFERED (needs RESPONSE_STREAM)
#
# This script fixes these issues.

set -euo pipefail

# Configuration
DISTRIBUTION_ID="EZCEVIJQBKJTG" # SleepConnect Prod Distribution
LAMBDA_FUNCTION="sax-lam-us-east-1-0x-p-outreach"
LAMBDA_URL_ID="sax-lam-p-outreach-url" # CloudFront Origin ID we will create/use
LAMBDA_DOMAIN="544462676572.lambda-url.us-east-1.on.aws" # Need to fetch this dynamically to be safe
REGION="us-east-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "=== Fix Production CloudFront for Outreach ==="
echo "AWS Account: $AWS_ACCOUNT_ID"
echo "Distribution: $DISTRIBUTION_ID"
echo ""

# Step 1: Get Lambda URL and Fix InvokeMode
echo "[1/4] Fixing Lambda InvokeMode (BUFFERED -> RESPONSE_STREAM)..."
LAMBDA_CONFIG=$(aws lambda update-function-url-config \
  --function-name "$LAMBDA_FUNCTION" \
  --invoke-mode RESPONSE_STREAM \
  --region "$REGION" \
  --output json)

# Extract full Lambda URL domain (removing https:// and /)
LAMBDA_FULL_URL=$(echo "$LAMBDA_CONFIG" | jq -r '.FunctionUrl')
LAMBDA_DOMAIN=$(echo "$LAMBDA_FULL_URL" | sed -e 's|^https://||' -e 's|/$||')

echo "✅ Lambda InvokeMode updated"
echo "ℹ️  Lambda Domain: $LAMBDA_DOMAIN"
echo ""

# Step 2: Get current CloudFront config
echo "[2/4] Fetching current CloudFront distribution config..."
ETAG=$(aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" --query 'ETag' --output text)
aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" --query 'DistributionConfig' > /tmp/cf-prod-config.json
echo "✅ Config fetched (ETag: $ETAG)"
echo ""

# Step 3: Add/update origins and behaviors using jq
echo "[3/4] Adding Outreach origins and cache behaviors..."

jq --arg lambda_domain "$LAMBDA_DOMAIN" --arg origin_id "$LAMBDA_URL_ID" '
# 1. Add Lambda origin if missing
.Origins.Items += (
  if any(.Origins.Items[]; .Id == $origin_id) then [] else [{
    "Id": $origin_id,
    "DomainName": $lambda_domain,
    "OriginPath": "",
    "CustomHeaders": {"Quantity": 0},
    "CustomOriginConfig": {
      "HTTPPort": 80,
      "HTTPSPort": 443,
      "OriginProtocolPolicy": "https-only",
      "OriginSslProtocols": {"Quantity": 1, "Items": ["TLSv1.2"]},
      "OriginReadTimeout": 30,
      "OriginKeepaliveTimeout": 5
    },
    "ConnectionAttempts": 3,
    "ConnectionTimeout": 10,
    "OriginShield": {"Enabled": false}
  }] end
) |
.Origins.Quantity = (.Origins.Items | length) |

# 2. Add behaviors for /outreach and /outreach/*
# We prepend them to ensure they take precedence over default behavior
.CacheBehaviors.Items = (
  # /outreach exact path behavior
  (if any(.CacheBehaviors.Items[]; .PathPattern == "/outreach") then [] else [{
    "PathPattern": "/outreach",
    "TargetOriginId": $origin_id,
    "TrustedSigners": {"Enabled": false, "Quantity": 0},
    "TrustedKeyGroups": {"Enabled": false, "Quantity": 0},
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 7,
      "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
      "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}
    },
    "SmoothStreaming": false,
    "Compress": true,
    "LambdaFunctionAssociations": {"Quantity": 0},
    "FunctionAssociations": {"Quantity": 0},
    "FieldLevelEncryptionId": "",
    # Use same cache/origin policies as other API routes or standard Next.js app
    # CachingDisabled (4135ea2d-6df8-44a3-9df3-4b5a84be39ad)
    "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
    # AllViewer (b689b0a8-53d0-40ab-baf2-68738e2966ac)
    "OriginRequestPolicyId": "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  }] end) +
  # /outreach/* behavior
  (if any(.CacheBehaviors.Items[]; .PathPattern == "/outreach/*") then [] else [{
    "PathPattern": "/outreach/*",
    "TargetOriginId": $origin_id,
    "TrustedSigners": {"Enabled": false, "Quantity": 0},
    "TrustedKeyGroups": {"Enabled": false, "Quantity": 0},
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 7,
      "Items": ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"],
      "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}
    },
    "SmoothStreaming": false,
    "Compress": true,
    "LambdaFunctionAssociations": {"Quantity": 0},
    "FunctionAssociations": {"Quantity": 0},
    "FieldLevelEncryptionId": "",
    "CachePolicyId": "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
    "OriginRequestPolicyId": "b689b0a8-53d0-40ab-baf2-68738e2966ac"
  }] end) +
  .CacheBehaviors.Items
) |
.CacheBehaviors.Quantity = (.CacheBehaviors.Items | length)

' /tmp/cf-prod-config.json > /tmp/cf-prod-config-updated.json

echo "✅ Config updated with Outreach Lambda origin and behaviors"
echo ""

# Step 4: Apply the updated config
echo "[4/4] Applying updated CloudFront configuration..."
aws cloudfront update-distribution \
  --id "$DISTRIBUTION_ID" \
  --if-match "$ETAG" \
  --distribution-config file:///tmp/cf-prod-config-updated.json \
  --output json | jq '{Status: .Distribution.Status, Id: .Distribution.Id}'

echo ""
echo "=== Done ==="
echo ""
echo "CloudFront distribution is updating. This may take 5-15 minutes."
echo "Monitor status:"
echo "  aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.Status'"
