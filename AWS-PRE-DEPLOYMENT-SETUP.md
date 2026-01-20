# AWS Pre-Deployment Setup Guide

**CRITICAL: Complete these steps BEFORE first deployment**

**Date**: December 17, 2025  
**Project**: Twilio Conversations SMS Outreach  
**Deployment Method**: OpenNext → AWS Lambda + S3

---

## ⚠️ Important Notes

1. **Use `deploy-outreach.cjs` script** - The bash scripts (setup-aws-infrastructure.sh, deploy-to-aws.sh) are reference documentation only
2. **Multi-zone deployment** - This app runs at `dev.mydreamconnect.com/outreach` (NOT as standalone `outreach.mydreamconnect.com`)
3. **Requires SleepConnect** - Must be deployed after SleepConnect is updated with CloudFront configuration
4. **Backend API required** - Verify backend API Gateway is deployed and accessible

---

## 📋 Prerequisites Checklist

Before starting, ensure you have:

- [ ] AWS CLI installed and configured (`aws configure`)
- [ ] Node.js 18+ installed
- [ ] Access to SleepConnect repository and AWS account
- [ ] Auth0 credentials (same as SleepConnect uses)
- [ ] Twilio credentials
- [ ] Backend API Gateway deployed and URL known

---

## Step 1: Create S3 Assets Bucket

```bash
ENVIRONMENT="develop"  # or staging, production
BUCKET="sax-nextjs-us-east-1-${ENVIRONMENT}-outreach-assets"
REGION="us-east-1"

# Create bucket
aws s3 mb "s3://${BUCKET}" --region ${REGION}

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket "${BUCKET}" \
  --versioning-configuration Status=Enabled

# Block public access (CloudFront will use OAC)
aws s3api put-public-access-block \
  --bucket "${BUCKET}" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"

# Enable encryption
aws s3api put-bucket-encryption \
  --bucket "${BUCKET}" \
  --server-side-encryption-configuration '{
    "Rules": [{
      "ApplyServerSideEncryptionByDefault": {
        "SSEAlgorithm": "AES256"
      },
      "BucketKeyEnabled": true
    }]
  }'

echo "✅ S3 bucket created: ${BUCKET}"
```

**Verify:**

```bash
aws s3 ls | grep outreach-assets
```

---

## Step 2: Create Lambda IAM Execution Role

```bash
ROLE_NAME="sax-lambda-outreach-execution-role"

# Create trust policy
cat > /tmp/lambda-trust-policy.json <<'EOF'
{
  "Version": "2012-10-17",
  "Statement": [{
    "Effect": "Allow",
    "Principal": {
      "Service": "lambda.amazonaws.com"
    },
    "Action": "sts:AssumeRole"
  }]
}
EOF

# Create role
aws iam create-role \
  --role-name "${ROLE_NAME}" \
  --assume-role-policy-document file:///tmp/lambda-trust-policy.json \
  --description "Execution role for Outreach Lambda functions"

# Attach AWS managed policy for basic Lambda execution
aws iam attach-role-policy \
  --role-name "${ROLE_NAME}" \
  --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole

# Optional: Add custom policy for additional permissions (S3, DynamoDB, etc.)
# aws iam attach-role-policy --role-name "${ROLE_NAME}" --policy-arn arn:aws:iam::aws:policy/...

# Get the role ARN for next step
ROLE_ARN=$(aws iam get-role --role-name "${ROLE_NAME}" --query 'Role.Arn' --output text)
echo "✅ IAM Role created: ${ROLE_ARN}"
echo "Save this ARN for the next step!"
```

**Verify:**

```bash
aws iam get-role --role-name sax-lambda-outreach-execution-role
```

---

## Step 3: Create Lambda Function (Placeholder)

```bash
ENVIRONMENT="develop"  # develop, staging, or production
FUNCTION_NAME="sax-lambda-us-east-1-0x-d-outreach-server_${ENVIRONMENT}"
ROLE_ARN="arn:aws:iam::YOUR_ACCOUNT_ID:role/sax-lambda-outreach-execution-role"  # From Step 2
REGION="us-east-1"

# Create a minimal placeholder handler
cat > /tmp/placeholder-handler.mjs <<'EOF'
export const handler = async (event) => {
  return {
    statusCode: 200,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ 
      message: 'Awaiting OpenNext deployment',
      timestamp: new Date().toISOString()
    })
  };
};
EOF

# Zip the placeholder
cd /tmp && zip -q placeholder-function.zip placeholder-handler.mjs

# Create Lambda function
aws lambda create-function \
  --function-name "${FUNCTION_NAME}" \
  --runtime nodejs20.x \
  --role "${ROLE_ARN}" \
  --handler placeholder-handler.handler \
  --zip-file fileb://placeholder-function.zip \
  --timeout 30 \
  --memory-size 1024 \
  --region "${REGION}" \
  --description "Outreach SMS App (OpenNext)" \
  --environment Variables="{NODE_ENV=production,ENVIRONMENT=${ENVIRONMENT}}"

echo "✅ Lambda function created: ${FUNCTION_NAME}"

# Cleanup
rm /tmp/placeholder-handler.mjs /tmp/placeholder-function.zip
```

**Verify:**

```bash
aws lambda get-function --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop
```

---

## Step 4: Create Lambda Function URL

```bash
ENVIRONMENT="develop"
FUNCTION_NAME="sax-lambda-us-east-1-0x-d-outreach-server_${ENVIRONMENT}"
REGION="us-east-1"

# Create Function URL with public access
FUNCTION_URL=$(aws lambda create-function-url-config \
  --function-name "${FUNCTION_NAME}" \
  --auth-type NONE \
  --cors '{
    "AllowOrigins": ["https://dev.mydreamconnect.com"],
    "AllowMethods": ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
    "AllowHeaders": ["*"],
    "ExposeHeaders": ["*"],
    "MaxAge": 86400
  }' \
  --region "${REGION}" \
  --query 'FunctionUrl' \
  --output text)

# Add permission for public invocation
aws lambda add-permission \
  --function-name "${FUNCTION_NAME}" \
  --statement-id FunctionURLAllowPublicAccess \
  --action lambda:InvokeFunctionUrl \
  --principal "*" \
  --function-url-auth-type NONE \
  --region "${REGION}"

echo ""
echo "✅ Lambda Function URL created:"
echo "${FUNCTION_URL}"
echo ""
echo "⚠️  SAVE THIS URL - You'll need it for:"
echo "   1. SleepConnect's OUTREACH_APP_URL environment variable"
echo "   2. Testing the deployment"
echo ""

# Save to file
echo "${FUNCTION_URL}" > .outreach-lambda-url-${ENVIRONMENT}.txt
echo "Saved to: .outreach-lambda-url-${ENVIRONMENT}.txt"
```

**Verify:**

```bash
curl $(cat .outreach-lambda-url-develop.txt)
# Should return: {"message":"Awaiting OpenNext deployment",...}
```

---

## Step 5: Set Lambda Environment Variables

**CRITICAL:** Lambda needs these environment variables to function correctly.

```bash
ENVIRONMENT="develop"
FUNCTION_NAME="sax-lambda-us-east-1-0x-d-outreach-server_${ENVIRONMENT}"
REGION="us-east-1"

# Get secrets from SleepConnect or create new ones
# These should match what SleepConnect uses for multi-zone integration

aws lambda update-function-configuration \
  --function-name "${FUNCTION_NAME}" \
  --region "${REGION}" \
  --environment "Variables={
    NODE_ENV=production,
    ENVIRONMENT=${ENVIRONMENT},
    MULTI_ZONE_MODE=true,
    AUTH0_SECRET=YOUR_AUTH0_CLIENT_SECRET_HERE,
    AUTH0_CLIENT_SECRET=YOUR_AUTH0_CLIENT_SECRET_HERE,
    AUTH0_CLIENT_ID=YOUR_AUTH0_CLIENT_ID_HERE,
    AUTH0_DOMAIN=your-tenant.auth0.com,
    AUTH0_ISSUER_BASE_URL=https://your-tenant.auth0.com,
    AUTH0_BASE_URL=https://dev.mydreamconnect.com/outreach,
    API_BASE_URL=https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev,
    TWILIO_ACCOUNT_SID=YOUR_TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN=YOUR_TWILIO_AUTH_TOKEN,
    TWILIO_MESSAGING_SERVICE_SID=YOUR_TWILIO_MESSAGING_SERVICE_SID,
    NEXT_PUBLIC_WS_API_URL=wss://vfb5l5uxak.execute-api.us-east-1.amazonaws.com/dev,
    NEXT_PUBLIC_APP_BASE_URL=https://dev.mydreamconnect.com,
    NEXT_PUBLIC_SLEEPCONNECT_URL=https://dev.mydreamconnect.com,
    NEXT_PUBLIC_BASE_PATH=/outreach,
    NEXT_PUBLIC_API_BASE_URL=https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev
  }"

echo "✅ Lambda environment variables updated"
```

**Get secrets from SleepConnect:**

```bash
# From sleepconnect/.env.local
cd ../sleepconnect
grep -E "AUTH0|TWILIO" .env.local
```

**Verify:**

```bash
aws lambda get-function-configuration \
  --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --query 'Environment.Variables' \
  --output json
```

---

## Step 6: Configure GitHub Secrets

Add these secrets to your GitHub repository:

**Go to**: Repository → Settings → Secrets and variables → Actions → New repository secret

```yaml
Required Secrets:
  - AWS_ACCESS_KEY_ID
  - AWS_SECRET_ACCESS_KEY
  - AUTH0_CLIENT_SECRET
  - AUTH0_CLIENT_ID
  - AUTH0_DOMAIN
  - AUTH0_BASE_URL (https://dev.mydreamconnect.com/outreach)
  - API_BASE_URL (https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev)
  - WS_API_URL (wss://vfb5l5uxak.execute-api.us-east-1.amazonaws.com/dev)
  - TWILIO_ACCOUNT_SID
  - TWILIO_AUTH_TOKEN
  - TWILIO_MESSAGING_SERVICE_SID
  - APP_BASE_URL (https://dev.mydreamconnect.com)
  - SLEEPCONNECT_URL (https://dev.mydreamconnect.com)
```

---

## Step 7: Update SleepConnect CloudFront

**This is CRITICAL for multi-zone to work!**

### 7.1: Add S3 Origin for Outreach Assets

```bash
# Get CloudFront distribution ID for SleepConnect
DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Aliases.Items[?@=='dev.mydreamconnect.com']].Id" \
  --output text)

echo "SleepConnect CloudFront Distribution: ${DIST_ID}"

# Create Origin Access Control (OAC) for S3 access
# This replaces the older OAI method
```

**Steps in AWS Console:**

1. Go to CloudFront → Distributions → Select SleepConnect distribution
2. **Origins** tab → **Create origin**
   - **Origin domain**: `sax-nextjs-us-east-1-develop-outreach-assets.s3.us-east-1.amazonaws.com`
   - **Name**: `outreach-assets-s3`
   - **Origin access**: Origin access control settings (recommended)
   - **Create new OAC**: Yes, create with default settings
   - Save
3. **Copy the S3 bucket policy** from the warning message
4. Apply policy to S3 bucket:

   ```bash
   # Policy will look like this (get actual from CloudFront):
   aws s3api put-bucket-policy \
     --bucket sax-nextjs-us-east-1-develop-outreach-assets \
     --policy '{
       "Version": "2012-10-17",
       "Statement": [{
         "Sid": "AllowCloudFrontServicePrincipal",
         "Effect": "Allow",
         "Principal": {
           "Service": "cloudfront.amazonaws.com"
         },
         "Action": "s3:GetObject",
         "Resource": "arn:aws:s3:::sax-nextjs-us-east-1-develop-outreach-assets/*",
         "Condition": {
           "StringEquals": {
             "AWS:SourceArn": "arn:aws:cloudfront::ACCOUNT_ID:distribution/DIST_ID"
           }
         }
       }]
     }'
   ```

### 7.2: Add Cache Behavior for Static Assets

**In CloudFront Console:**

1. **Behaviors** tab → **Create behavior**
2. Configure:
   - **Path pattern**: `/outreach-static/*`
   - **Origin**: `outreach-assets-s3` (created in 7.1)
   - **Viewer protocol policy**: Redirect HTTP to HTTPS
   - **Allowed HTTP methods**: GET, HEAD, OPTIONS
   - **Cache policy**: CachingOptimized
   - **Origin request policy**: None needed
   - **Response headers policy**: SimpleCORS (or custom)
   - **Compress objects automatically**: Yes
   - **Precedence**: Set higher than default (e.g., 0)
3. Save

### 7.3: Update SleepConnect Environment Variables

```bash
cd ../sleepconnect

# Add to .env.local or via AWS Systems Manager Parameter Store
echo "OUTREACH_APP_URL=$(cat ../twilio-conversations-react/.outreach-lambda-url-develop.txt)" >> .env.local

# Verify
grep OUTREACH_APP_URL .env.local
```

### 7.4: Update SleepConnect next.config.js (if needed)

Check if `sleepconnect/next.config.js` has the rewrites for `/outreach/*`:

```javascript
// Should already exist, but verify:
async rewrites() {
  return [
    {
      source: '/outreach/:path*',
      destination: `${process.env.OUTREACH_APP_URL}/:path*`,
    },
  ];
}
```

### 7.5: Redeploy SleepConnect

```bash
cd ../sleepconnect

# Deploy to develop environment
pnpm deploy:dev

# Wait for deployment to complete
# Monitor CloudFormation in AWS Console
```

---

## Step 8: Test Backend API

Before deploying Outreach, verify the backend API is working:

```bash
API_URL="https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev"

# Test health endpoint (if exists)
curl "${API_URL}/health"

# Test conversations endpoint (requires auth)
# This might return 401, but should not return 404
curl -I "${API_URL}/outreach/conversations"
```

**Expected:** HTTP 200 or 401 (not 404 or 502)

---

## Step 9: Deploy Outreach for First Time

```bash
cd twilio-conversations-react

# Install dependencies
npm install

# Build with OpenNext
npm run build:open-next

# Verify build output
ls -la .open-next/server-functions/default/

# Deploy to Lambda + S3
node scripts/deploy-outreach.cjs develop

# Watch for successful deployment message
```

**Expected output:**

```
✅ Lambda function code updated
✅ Static assets deployed to S3
✅ CloudFront cache invalidated (if dist ID provided)
🎉 Deployment complete!
```

---

## Step 10: Test Deployment

### 10.1: Test Lambda Function URL Directly

```bash
FUNCTION_URL=$(cat .outreach-lambda-url-develop.txt)

# Test root
curl "${FUNCTION_URL}"

# Test with /outreach path
curl "${FUNCTION_URL}/outreach"
```

### 10.2: Test via SleepConnect Multi-Zone

```bash
# This requires:
# 1. Valid Auth0 session cookie
# 2. SleepConnect deployed with OUTREACH_APP_URL
# 3. CloudFront behavior for /outreach-static/*

# Open in browser (requires login)
open https://dev.mydreamconnect.com/outreach
```

### 10.3: Check CloudWatch Logs

```bash
# Stream Lambda logs
aws logs tail /aws/lambda/sax-lambda-us-east-1-0x-d-outreach-server_develop --follow

# Check for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --filter-pattern "ERROR" \
  --max-items 20
```

---

## ✅ Post-Deployment Checklist

After successful first deployment:

- [ ] Lambda function updated with OpenNext build
- [ ] Static assets visible in S3 bucket
- [ ] Lambda Function URL returns HTML (not placeholder)
- [ ] SleepConnect proxy to Outreach working
- [ ] CloudFront serves `/outreach-static/*` from S3
- [ ] Authentication working (JWT cookie validation)
- [ ] API calls to backend working
- [ ] WebSocket connection established
- [ ] No errors in CloudWatch Logs
- [ ] All environment variables set correctly

---

## 🐛 Troubleshooting

### Lambda returns 500 error

```bash
# Check logs
aws logs tail /aws/lambda/sax-lambda-us-east-1-0x-d-outreach-server_develop --follow

# Common issues:
# - Missing environment variable (AUTH0_CLIENT_SECRET, etc.)
# - Incorrect NODE_ENV setting
# - Module import error (check OpenNext build)
```

### Static assets 404

```bash
# Verify S3 upload
aws s3 ls s3://sax-nextjs-us-east-1-develop-outreach-assets/ --recursive | head

# Check CloudFront behavior
# - Path pattern must be /outreach-static/*
# - Origin must point to correct S3 bucket
# - OAC must be configured with bucket policy
```

### Authentication fails

```bash
# Verify environment variables match SleepConnect
cd ../sleepconnect
grep AUTH0 .env.local

# Compare with Lambda config
aws lambda get-function-configuration \
  --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --query 'Environment.Variables' | grep AUTH0
```

### CloudFront not routing to Outreach

```bash
# Verify SleepConnect has OUTREACH_APP_URL
aws ssm get-parameter --name /sleepconnect/develop/OUTREACH_APP_URL

# Check SleepConnect CloudFront behaviors
aws cloudfront get-distribution-config --id YOUR_DIST_ID
```

---

## 📚 Next Steps

1. ✅ Complete all steps above
2. Test thoroughly in develop environment
3. Repeat for staging environment
4. Set up monitoring and alerting
5. Create CloudFormation/CDK templates (optional)
6. Document operational procedures

---

## 🔗 Related Documentation

- [AWS-DEPLOYMENT-GUIDE.md](./AWS-DEPLOYMENT-GUIDE.md) - Complete deployment guide
- [AWS-QUICK-REFERENCE.md](./AWS-QUICK-REFERENCE.md) - Quick command reference
- [DEPLOYMENT-HANDOVER.md](./DEPLOYMENT-HANDOVER.md) - Multi-zone architecture
- [scripts/deploy-outreach.cjs](./scripts/deploy-outreach.cjs) - Deployment script

---

**Questions or issues?** Check CloudWatch Logs first, then review the troubleshooting section above.
