#!/bin/bash
# Fix Staging CloudFront Configuration for Outreach Zone
# 
# Problems identified:
# 1. CloudFront (E29AZJ8V99WM0C) missing /outreach/* behaviors
# 2. Lambda InvokeMode is BUFFERED (needs RESPONSE_STREAM)
# 3. S3 origin missing OAC (Origin Access Control)
# 4. S3 bucket policy references wrong CloudFront distribution
#
# This script fixes all of the above.

set -euo pipefail

# Configuration
DISTRIBUTION_ID="E29AZJ8V99WM0C"
LAMBDA_FUNCTION="sax-lam-us-east-1-0x-s-outreach"
LAMBDA_URL="3lthlclr266k34nqfgvwlptzpm0yxpbb.lambda-url.us-east-1.on.aws"
S3_BUCKET_NAME="sax-s3-us-east-1-0x-s-outreach-assets"
S3_BUCKET_DOMAIN="${S3_BUCKET_NAME}.s3.us-east-1.amazonaws.com"
OAC_ID="E3O4D825ESRBE8"
REGION="us-east-1"
AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

echo "=== Fix Staging CloudFront for Outreach ==="
echo "AWS Account: $AWS_ACCOUNT_ID"
echo ""

# Step 1: Fix Lambda InvokeMode
echo "[1/5] Fixing Lambda InvokeMode (BUFFERED -> RESPONSE_STREAM)..."
aws lambda update-function-url-config \
  --function-name "$LAMBDA_FUNCTION" \
  --invoke-mode RESPONSE_STREAM \
  --region "$REGION" \
  --output json | jq '{InvokeMode: .InvokeMode, FunctionUrl: .FunctionUrl}'
echo "✅ Lambda InvokeMode updated"
echo ""

# Step 2: Fix S3 bucket policy to allow staging CloudFront distribution
echo "[2/5] Updating S3 bucket policy for staging CloudFront..."
cat > /tmp/s3-bucket-policy.json << EOF
{
    "Version": "2012-10-17",
    "Statement": [
        {
            "Sid": "AllowCloudFrontServicePrincipal",
            "Effect": "Allow",
            "Principal": {
                "Service": "cloudfront.amazonaws.com"
            },
            "Action": "s3:GetObject",
            "Resource": "arn:aws:s3:::${S3_BUCKET_NAME}/*",
            "Condition": {
                "StringEquals": {
                    "AWS:SourceArn": "arn:aws:cloudfront::${AWS_ACCOUNT_ID}:distribution/${DISTRIBUTION_ID}"
                }
            }
        }
    ]
}
EOF

aws s3api put-bucket-policy \
  --bucket "$S3_BUCKET_NAME" \
  --policy file:///tmp/s3-bucket-policy.json
echo "✅ S3 bucket policy updated to allow CloudFront $DISTRIBUTION_ID"
echo ""

# Step 3: Get current CloudFront config
echo "[3/5] Fetching current CloudFront distribution config..."
ETAG=$(aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" --query 'ETag' --output text)
aws cloudfront get-distribution-config --id "$DISTRIBUTION_ID" --query 'DistributionConfig' > /tmp/cf-config.json
echo "✅ Config fetched (ETag: $ETAG)"
echo ""

# Step 4: Add/update origins and behaviors using jq
echo "[4/5] Adding Outreach origins (with OAC) and cache behaviors..."

jq --arg lambda_url "$LAMBDA_URL" --arg s3_bucket "$S3_BUCKET_DOMAIN" --arg oac_id "$OAC_ID" '
# Remove existing outreach origins if they exist (to update them)
.Origins.Items = [.Origins.Items[] | select(.Id != "outreach-lambda-staging" and .Id != "outreach-assets-staging")] |

# Add Lambda origin
.Origins.Items += [{
  "Id": "outreach-lambda-staging",
  "DomainName": $lambda_url,
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
}] |

# Add S3 origin WITH OAC (critical for 403 fix)
.Origins.Items += [{
  "Id": "outreach-assets-staging",
  "DomainName": $s3_bucket,
  "OriginPath": "",
  "CustomHeaders": {"Quantity": 0},
  "S3OriginConfig": {"OriginAccessIdentity": ""},
  "OriginAccessControlId": $oac_id,
  "ConnectionAttempts": 3,
  "ConnectionTimeout": 10,
  "OriginShield": {"Enabled": false}
}] |
.Origins.Quantity = (.Origins.Items | length) |

# Remove existing outreach behaviors (to ensure correct order)
.CacheBehaviors.Items = [.CacheBehaviors.Items[] | select(.PathPattern != "/outreach" and .PathPattern != "/outreach/*" and .PathPattern != "/outreach-static/*")] |

# Add behaviors in correct priority order (most specific first)
.CacheBehaviors.Items = [
  # /outreach exact path
  {
    "PathPattern": "/outreach",
    "TargetOriginId": "outreach-lambda-staging",
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
  },
  # /outreach-static/* (assets from S3)
  {
    "PathPattern": "/outreach-static/*",
    "TargetOriginId": "outreach-assets-staging",
    "TrustedSigners": {"Enabled": false, "Quantity": 0},
    "TrustedKeyGroups": {"Enabled": false, "Quantity": 0},
    "ViewerProtocolPolicy": "redirect-to-https",
    "AllowedMethods": {
      "Quantity": 2,
      "Items": ["GET", "HEAD"],
      "CachedMethods": {"Quantity": 2, "Items": ["GET", "HEAD"]}
    },
    "SmoothStreaming": false,
    "Compress": true,
    "LambdaFunctionAssociations": {"Quantity": 0},
    "FunctionAssociations": {"Quantity": 0},
    "FieldLevelEncryptionId": "",
    "CachePolicyId": "658327ea-f89d-4fab-a63d-7e88639e58f6",
    "OriginRequestPolicyId": "88a5eaf4-2fd4-4709-b370-b4c650ea3fcf"
  },
  # /outreach/* (all other outreach routes to Lambda)
  {
    "PathPattern": "/outreach/*",
    "TargetOriginId": "outreach-lambda-staging",
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
  }
] + .CacheBehaviors.Items |
.CacheBehaviors.Quantity = (.CacheBehaviors.Items | length)
' /tmp/cf-config.json > /tmp/cf-config-updated.json

echo "✅ Config updated with:"
echo "   - outreach-lambda-staging origin (Lambda URL)"
echo "   - outreach-assets-staging origin (S3 with OAC: $OAC_ID)"
echo "   - /outreach, /outreach/*, /outreach-static/* behaviors"
echo ""

# Step 5: Apply the updated config
echo "[5/5] Applying updated CloudFront configuration..."
aws cloudfront update-distribution \
  --id "$DISTRIBUTION_ID" \
  --if-match "$ETAG" \
  --distribution-config file:///tmp/cf-config-updated.json \
  --output json | jq '{Status: .Distribution.Status, Id: .Distribution.Id}'

echo ""
echo "=== Done ==="
echo ""
echo "CloudFront distribution is updating. This may take 5-15 minutes."
echo ""
echo "Monitor status:"
echo "  aws cloudfront get-distribution --id $DISTRIBUTION_ID --query 'Distribution.Status'"
echo ""
echo "Test after deployment completes:"
echo "  curl -sI https://stage.mydreamconnect.com/outreach | head -5"
echo "  curl -sI https://stage.mydreamconnect.com/outreach-static/_next/static/chunks/webpack.js | head -5"
