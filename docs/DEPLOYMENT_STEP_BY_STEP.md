# Outreach Multi-Zone Deployment Guide - Production Ready

**Status:** ✅ Production Ready  
**Environment:** Multi-Zone Integration Only (develop/staging/production)  
**Architecture:** SleepConnect → Outreach Lambda → API Gateway  
**Last Updated:** December 16, 2025

---

## 📋 Consolidated Prerequisites

> **Cross-Repository Alignment** - These prerequisites are synchronized with SleepConnect's `docs/OUTREACH_BACKEND_DEPLOYMENT.md`. Both documents share the same requirements.

### Quick Reference: All Required Prerequisites

| Category | Items | Status Check |
|----------|-------|--------------|
| **Tools** | node 20+, npm, aws, psql, zip, jq, dig | Run validation script below |
| **AWS Account** | Account 597088017323, us-east-1 | `aws sts get-caller-identity` |
| **Infrastructure** | Route53, ACM, CloudFront, S3, Lambda, API Gateway | See infrastructure table |
| **Build-time Env** | OUTREACH_APP_URL, OUTREACH_API_URL, NEXT_PUBLIC_OUTREACH_WS_URL | Must set before build |
| **Runtime Env** | AUTH0_*, MULTI_ZONE_MODE, NODE_ENV | Lambda configuration |
| **Auth0** | Shared secrets with SleepConnect | Load from SC `.env.local` |

### Prerequisites Validation Script

```bash
#!/bin/bash
# Run this before any deployment attempt

echo "🔍 Outreach Prerequisites Check"
echo "════════════════════════════════"

ERRORS=0

# Tools
for tool in node npm aws zip jq dig; do
  command -v $tool &>/dev/null && echo "✅ $tool" || { echo "❌ $tool missing"; ERRORS=$((ERRORS+1)); }
done

# Node version
NODE_VER=$(node -v | cut -d'.' -f1 | tr -d 'v')
[ "$NODE_VER" -ge 20 ] && echo "✅ Node.js $NODE_VER" || { echo "❌ Node.js 20+ required"; ERRORS=$((ERRORS+1)); }

# AWS
aws sts get-caller-identity &>/dev/null && echo "✅ AWS credentials" || { echo "❌ AWS credentials"; ERRORS=$((ERRORS+1)); }

# Build-time variables
[ -n "$OUTREACH_API_URL" ] && echo "✅ OUTREACH_API_URL" || echo "⚠️ OUTREACH_API_URL not set"
[ -n "$NEXT_PUBLIC_OUTREACH_WS_URL" ] && echo "✅ WS_URL" || echo "⚠️ NEXT_PUBLIC_OUTREACH_WS_URL not set"

# SleepConnect .env.local
SC_ENV="~/code/SAX/sleepconnect/.env.local"
[ -f "$SC_ENV" ] && echo "✅ SleepConnect .env.local found" || { echo "❌ SleepConnect .env.local missing"; ERRORS=$((ERRORS+1)); }

echo ""
[ $ERRORS -eq 0 ] && echo "✅ Prerequisites OK" || echo "❌ Fix $ERRORS error(s) before proceeding"
```

### Infrastructure Prerequisites Matrix

| Resource | Owner | Required Before | How to Verify |
|----------|-------|-----------------|---------------|
| Route53 Zone (`mydreamconnect.com`) | Platform | Any deployment | `aws route53 list-hosted-zones` |
| ACM Certificate (us-east-1) | Platform | CloudFront setup | `aws acm list-certificates --region us-east-1` |
| SleepConnect CloudFront | SleepConnect | Outreach integration | Check CloudFront console |
| SleepConnect Lambda | SleepConnect | Outreach integration | `aws lambda get-function --function-name sax-lambda-*-sleep-connect-server_develop` |
| **Outreach S3 Bucket** | **Outreach** | First deployment | Created by this guide |
| **Outreach Lambda** | **Outreach** | First deployment | Created by this guide |
| **Lambda Function URL** | **Outreach** | SleepConnect build | Created by this guide |
| `/outreach-static/*` CF Behavior | SleepConnect | Static assets | **Manual config in SleepConnect CloudFront** |
| API Gateway REST | Backend | API calls | `aws apigateway get-rest-apis` |
| API Gateway WebSocket | Backend | Real-time | `aws apigatewayv2 get-apis` |

### Environment Variables Quick Reference

**Build-time (set before `npm build`):**
```bash
export OUTREACH_API_URL="https://<REST_API_ID>.execute-api.us-east-1.amazonaws.com/dev"
export NEXT_PUBLIC_OUTREACH_WS_URL="wss://<WS_API_ID>.execute-api.us-east-1.amazonaws.com/dev"
```

**Runtime (Lambda env vars):**
```bash
NODE_ENV=production
MULTI_ZONE_MODE=true
AUTH0_SECRET=<from-sleepconnect>
AUTH0_CLIENT_SECRET=<from-sleepconnect>
AUTH0_CLIENT_ID=<from-sleepconnect>
AUTH0_ISSUER_BASE_URL=https://<tenant>.auth0.com
AUTH0_BASE_URL=https://dev.mydreamconnect.com/outreach
API_BASE_URL=https://<REST_API_ID>.execute-api.us-east-1.amazonaws.com/dev
```

---

## ⚠️ CRITICAL: Multi-Zone Architecture Only

This guide deploys Outreach as an **integrated zone within SleepConnect**. There is NO standalone deployment option.

**Required Architecture Flow:**
```
CloudFront (dev.mydreamconnect.com)
    ↓
SleepConnect Lambda (Main App)
    ↓  (proxy: /outreach/*)
Outreach Lambda (This App)
    ↓  (API routes with middleware)
Lambda API Gateway (Backend)
```

**Why This Matters:**
- API routes MUST execute in Outreach Lambda to decode JWT and transform headers
- Direct CloudFront → Outreach bypasses authentication middleware
- Requests without proper headers will fail with "Invalid or missing tenant_id"

---

## AWS Platform Reality Check (What This Guide Creates vs Assumes)

This guide is **multi-zone only**. It deploys **Outreach Lambda + assets**, and integrates it into **SleepConnect**.

**✅ Created/updated by this guide (Outreach-owned):**
- IAM role for Outreach Lambda execution (CloudWatch logs)
- Outreach Lambda function (OpenNext-built Next.js)
- Lambda runtime environment variables (Auth0 + API URLs)
- S3 bucket for Outreach static assets (uploads under `outreach-static/`)
- (Optional) Lambda Function URL (used as the internal origin SleepConnect proxies to)

**⚠️ Assumed to already exist (SleepConnect/platform-owned):**
- Route53 records and ACM certs for the multi-zone domain:
  - develop: `dev.mydreamconnect.com`
  - staging: `staging.mydreamconnect.com`
  - production: `dreamconnect.health`
- CloudFront distribution serving SleepConnect for the multi-zone domain
- CloudFront configured to:
  - forward `/outreach/*` requests to SleepConnect (so rewrites can proxy to Outreach)
  - serve `/outreach-static/*` from the Outreach S3 bucket (or another configured origin)
- API Gateway (backend) for Outreach data

**Before proceeding, verify the multi-zone domain is live:**
```bash
dig +short $MULTIZONE_DOMAIN
curl -I https://${MULTIZONE_DOMAIN}/
```

If the domain doesn’t resolve or TLS fails, stop and fix SleepConnect’s CloudFront/Route53/ACM first.

## Prerequisites Validation

Run this validation script before starting:

```bash
#!/bin/bash
# Deployment Prerequisites Check

echo "🔍 Validating deployment prerequisites..."
echo ""

ERRORS=0

# Check AWS CLI
if ! command -v aws &> /dev/null; then
  echo "❌ AWS CLI not installed"
  ERRORS=$((ERRORS+1))
else
  AWS_VERSION=$(aws --version 2>&1 | cut -d' ' -f1 | cut -d'/' -f2)
  echo "✅ AWS CLI installed (${AWS_VERSION})"
fi

# Check AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
  echo "❌ AWS credentials not configured or invalid"
  ERRORS=$((ERRORS+1))
else
  ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
  echo "✅ AWS credentials valid (Account: ${ACCOUNT_ID})"
fi

# Check Node.js
if ! command -v node &> /dev/null; then
  echo "❌ Node.js not installed"
  ERRORS=$((ERRORS+1))
else
  NODE_VERSION=$(node --version)
  NODE_MAJOR=$(echo $NODE_VERSION | cut -d'.' -f1 | tr -d 'v')
  if [ "$NODE_MAJOR" -lt 20 ]; then
    echo "❌ Node.js version too old ($NODE_VERSION). Need 20+"
    ERRORS=$((ERRORS+1))
  else
    echo "✅ Node.js $NODE_VERSION"
  fi
fi

# Check npm
if ! command -v npm &> /dev/null; then
  echo "❌ npm not installed"
  ERRORS=$((ERRORS+1))
else
  NPM_VERSION=$(npm --version)
  echo "✅ npm $NPM_VERSION"
fi

# Check jq
if ! command -v jq &> /dev/null; then
  echo "❌ jq not installed (required for JSON parsing)"
  echo "   Install: sudo apt-get install jq  OR  brew install jq"
  ERRORS=$((ERRORS+1))
else
  echo "✅ jq installed"
fi

# Check dig
if ! command -v dig &> /dev/null; then
  echo "❌ dig not installed (required for DNS validation)"
  echo "   Install: sudo apt-get install dnsutils  OR  brew install bind"
  ERRORS=$((ERRORS+1))
else
  echo "✅ dig installed"
fi

# Check zip
if ! command -v zip &> /dev/null; then
  echo "❌ zip not installed"
  ERRORS=$((ERRORS+1))
else
  echo "✅ zip installed"
fi

# Check repositories
SLEEPCONNECT_DIR="~/code/SAX/sleepconnect"
OUTREACH_DIR="~/code/SAX/twilio-conversations-react"

if [ ! -d "$SLEEPCONNECT_DIR" ]; then
  echo "❌ SleepConnect repository not found at $SLEEPCONNECT_DIR"
  ERRORS=$((ERRORS+1))
else
  echo "✅ SleepConnect repository found"
fi

if [ ! -d "$OUTREACH_DIR" ]; then
  echo "❌ Outreach repository not found at $OUTREACH_DIR"
  ERRORS=$((ERRORS+1))
else
  echo "✅ Outreach repository found"
fi

echo ""
if [ $ERRORS -gt 0 ]; then
  echo "❌ Prerequisites validation FAILED with $ERRORS error(s)"
  echo "   Fix the errors above before proceeding"
  exit 1
else
  echo "✅ All prerequisites validated"
  exit 0
fi
```

**Save as:** `/tmp/validate-deployment-prereqs.sh`

**Run:**
```bash
chmod +x /tmp/validate-deployment-prereqs.sh
/tmp/validate-deployment-prereqs.sh
```

**Expected Output:**
```
✅ All prerequisites validated
```

**⚠️ STOP if validation fails. Fix issues before continuing.**

---

## Part 1: Environment Configuration

### Step 1: Set Environment Variables

```bash
# Choose environment: develop, staging, or production
export ENV=develop
export AWS_REGION=us-east-1

# Set domains based on environment
if [ "$ENV" = "develop" ]; then
  export DOMAIN=mydreamconnect.com
  export MULTIZONE_DOMAIN=dev.$DOMAIN
  export API_GATEWAY_URL=https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev
elif [ "$ENV" = "staging" ]; then
  export DOMAIN=mydreamconnect.com
  export MULTIZONE_DOMAIN=staging.$DOMAIN
  # Get API Gateway ID from AWS (or set manually if known)
  STAGING_API_GW=$(aws apigatewayv2 get-apis --query "Items[?Name=='sleepconnect-staging-api'].ApiId" --output text)
  if [ -z "$STAGING_API_GW" ]; then
    echo "❌ ERROR: Could not find staging API Gateway"
    echo "   Set manually: export API_GATEWAY_URL=https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/staging"
    exit 1
  fi
  export API_GATEWAY_URL=https://${STAGING_API_GW}.execute-api.us-east-1.amazonaws.com/staging
elif [ "$ENV" = "production" ]; then
  export DOMAIN=dreamconnect.health
  export MULTIZONE_DOMAIN=$DOMAIN
  # Get API Gateway ID from AWS (or set manually if known)
  PROD_API_GW=$(aws apigatewayv2 get-apis --query "Items[?Name=='sleepconnect-production-api'].ApiId" --output text)
  if [ -z "$PROD_API_GW" ]; then
    echo "❌ ERROR: Could not find production API Gateway"
    echo "   Set manually: export API_GATEWAY_URL=https://YOUR_API_ID.execute-api.us-east-1.amazonaws.com/prod"
    exit 1
  fi
  export API_GATEWAY_URL=https://${PROD_API_GW}.execute-api.us-east-1.amazonaws.com/prod
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Environment Configuration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Environment:      $ENV"
echo "Multi-zone URL:   https://$MULTIZONE_DOMAIN/outreach"
echo "API Gateway:      $API_GATEWAY_URL"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

**Expected Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Environment Configuration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Environment:      develop
Multi-zone URL:   https://dev.mydreamconnect.com/outreach
API Gateway:      https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 2: Set Lambda Configuration

```bash
# Set Lambda function name based on environment
if [ "$ENV" = "develop" ]; then
  export LAMBDA_FUNCTION=sax-lambda-us-east-1-0x-d-outreach-server_develop
  export LAMBDA_MEMORY=1024
elif [ "$ENV" = "staging" ]; then
  export LAMBDA_FUNCTION=sax-lambda-us-east-1-0x-s-outreach-server_staging
  export LAMBDA_MEMORY=1024
elif [ "$ENV" = "production" ]; then
  export LAMBDA_FUNCTION=sax-lambda-us-east-1-0x-p-outreach-server_production
  export LAMBDA_MEMORY=2048
fi

export LAMBDA_TIMEOUT=30

echo "Lambda Configuration:"
echo "  Function: $LAMBDA_FUNCTION"
echo "  Memory:   ${LAMBDA_MEMORY}MB"
echo "  Timeout:  ${LAMBDA_TIMEOUT}s"
```

**Expected Output:**
```
Lambda Configuration:
  Function: sax-lambda-us-east-1-0x-d-outreach-server_develop
  Memory:   1024MB
  Timeout:  30s
```

### Step 3: Set S3 Bucket for Static Assets

```bash
# Set S3 bucket name
if [ "$ENV" = "production" ]; then
  export S3_BUCKET=sax-nextjs-us-east-1-production-outreach-assets
else
  export S3_BUCKET=sax-nextjs-us-east-1-${ENV}-outreach-assets
fi

echo "S3 Assets Bucket: $S3_BUCKET"
```

### Step 4: Load Auth0 Credentials

```bash
# These MUST match SleepConnect's .env.local
echo ""
echo "⚠️  REQUIRED: Set Auth0 credentials (must match SleepConnect)"
echo ""

# Check if SleepConnect .env.local exists
SLEEPCONNECT_ENV="~/code/SAX/sleepconnect/.env.local"

if [ -f "$SLEEPCONNECT_ENV" ]; then
  echo "Loading Auth0 credentials from SleepConnect..."
  
  export AUTH0_SECRET=$(grep "^AUTH0_SECRET=" "$SLEEPCONNECT_ENV" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  export AUTH0_CLIENT_SECRET=$(grep "^AUTH0_CLIENT_SECRET=" "$SLEEPCONNECT_ENV" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  export AUTH0_CLIENT_ID=$(grep "^AUTH0_CLIENT_ID=" "$SLEEPCONNECT_ENV" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  export AUTH0_ISSUER_BASE_URL=$(grep "^AUTH0_ISSUER_BASE_URL=" "$SLEEPCONNECT_ENV" | cut -d'=' -f2- | tr -d '"' | tr -d "'")
  
  if [ -z "$AUTH0_SECRET" ] || [ -z "$AUTH0_CLIENT_SECRET" ]; then
    echo "❌ ERROR: Auth0 credentials not found in SleepConnect .env.local"
    exit 1
  fi
  
  echo "✅ Auth0 credentials loaded"
  echo "   Client ID: ${AUTH0_CLIENT_ID:0:20}..."
  echo "   Secret:    ${AUTH0_SECRET:0:20}..."
else
  echo "❌ ERROR: SleepConnect .env.local not found at $SLEEPCONNECT_ENV"
  exit 1
fi
```

**Expected Output:**
```
Loading Auth0 credentials from SleepConnect...
✅ Auth0 credentials loaded
   Client ID: abc123xyz...
   Secret:    secret123...
```

### Step 5: Set Lambda Environment Variables

```bash
# Set AUTH0_BASE_URL based on environment
if [ "$ENV" = "develop" ]; then
  export AUTH0_BASE_URL=https://dev.mydreamconnect.com/outreach
elif [ "$ENV" = "staging" ]; then
  export AUTH0_BASE_URL=https://staging.mydreamconnect.com/outreach
elif [ "$ENV" = "production" ]; then
  export AUTH0_BASE_URL=https://dreamconnect.health/outreach
fi

# Create environment variables JSON for Lambda
LAMBDA_ENV_VARS=$(cat <<EOF
{
  "Variables": {
    "NODE_ENV": "production",
    "MULTI_ZONE_MODE": "true",
    "AUTH0_SECRET": "${AUTH0_SECRET}",
    "AUTH0_CLIENT_SECRET": "${AUTH0_CLIENT_SECRET}",
    "AUTH0_CLIENT_ID": "${AUTH0_CLIENT_ID}",
    "AUTH0_ISSUER_BASE_URL": "${AUTH0_ISSUER_BASE_URL}",
    "AUTH0_BASE_URL": "${AUTH0_BASE_URL}",
    "API_BASE_URL": "${API_GATEWAY_URL}",
    "NEXT_PUBLIC_API_BASE_URL": "https://${MULTIZONE_DOMAIN}/outreach",
    "NEXT_TELEMETRY_DISABLED": "1"
  }
}
EOF
)

echo "Lambda Environment Variables:"
echo "$LAMBDA_ENV_VARS" | jq '.'

# Save to file for Lambda creation/update
echo "$LAMBDA_ENV_VARS" > /tmp/lambda-env-vars-${ENV}.json
echo ""
echo "✅ Environment variables saved to: /tmp/lambda-env-vars-${ENV}.json"
```

**Expected Output:**
```
Lambda Environment Variables:
{
  "Variables": {
    "NODE_ENV": "production",
    "MULTI_ZONE_MODE": "true",
    "AUTH0_SECRET": "...",
    ...
  }
}
✅ Environment variables saved to: /tmp/lambda-env-vars-develop.json
```

### Step 6: Save Complete Configuration

```bash
# Save all configuration for reference
CONFIG_FILE="/tmp/outreach-${ENV}-config.env"

cat > $CONFIG_FILE << EOF
# Outreach Multi-Zone Deployment Configuration
# Generated: $(date)
# Environment: $ENV

# AWS Configuration
ENV=$ENV
AWS_REGION=$AWS_REGION
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)

# Domain Configuration
DOMAIN=$DOMAIN
MULTIZONE_DOMAIN=$MULTIZONE_DOMAIN
API_GATEWAY_URL=$API_GATEWAY_URL

# Lambda Configuration
LAMBDA_FUNCTION=$LAMBDA_FUNCTION
LAMBDA_MEMORY=$LAMBDA_MEMORY
LAMBDA_TIMEOUT=$LAMBDA_TIMEOUT

# S3 Configuration
S3_BUCKET=$S3_BUCKET

# Auth0 Configuration (from SleepConnect)
AUTH0_SECRET=$AUTH0_SECRET
AUTH0_CLIENT_SECRET=$AUTH0_CLIENT_SECRET
AUTH0_CLIENT_ID=$AUTH0_CLIENT_ID
AUTH0_ISSUER_BASE_URL=$AUTH0_ISSUER_BASE_URL
AUTH0_BASE_URL=$AUTH0_BASE_URL

# To reload this configuration:
# source $CONFIG_FILE
EOF

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Configuration Complete"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📋 Saved to: $CONFIG_FILE"
echo ""
echo "To reload: source $CONFIG_FILE"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

---

## Part 2: One-Time Infrastructure Setup

These steps create AWS resources that persist across deployments.

### Step 7: Create IAM Role for Lambda

```bash
echo "Creating/verifying IAM role for Lambda..."

# Check if role exists
ROLE_EXISTS=$(aws iam get-role \
  --role-name sax-lambda-outreach-execution-role \
  2>/dev/null || echo "NOT_FOUND")

if [[ "$ROLE_EXISTS" == "NOT_FOUND" ]]; then
  echo "Creating IAM role..."
  
  # Create role
  aws iam create-role \
    --role-name sax-lambda-outreach-execution-role \
    --assume-role-policy-document '{
      "Version": "2012-10-17",
      "Statement": [{
        "Effect": "Allow",
        "Principal": {"Service": "lambda.amazonaws.com"},
        "Action": "sts:AssumeRole"
      }]
    }' \
    --description "Execution role for Outreach Lambda function"
  
  # Attach basic execution policy for CloudWatch logs
  aws iam attach-role-policy \
    --role-name sax-lambda-outreach-execution-role \
    --policy-arn arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole
  
  echo "✅ IAM role created. Waiting 10 seconds for propagation..."
  sleep 10
else
  echo "✅ IAM role already exists"
fi

# Get role ARN
export LAMBDA_ROLE_ARN=$(aws iam get-role \
  --role-name sax-lambda-outreach-execution-role \
  --query 'Role.Arn' \
  --output text)

echo "Role ARN: $LAMBDA_ROLE_ARN"
```

**Expected Output:**
```
✅ IAM role already exists
Role ARN: arn:aws:iam::123456789012:role/sax-lambda-outreach-execution-role
```

### Step 8: Create S3 Bucket for Static Assets

```bash
echo "Creating/verifying S3 bucket for static assets..."

# Check if bucket exists
BUCKET_EXISTS=$(aws s3 ls s3://$S3_BUCKET 2>/dev/null || echo "NOT_FOUND")

if [[ "$BUCKET_EXISTS" == "NOT_FOUND" ]]; then
  echo "Creating S3 bucket: $S3_BUCKET"
  
  # Create bucket
  aws s3 mb s3://$S3_BUCKET --region $AWS_REGION
  
  # Block public access (CloudFront access must be configured separately via OAC/OAI + bucket policy)
  aws s3api put-public-access-block \
    --bucket $S3_BUCKET \
    --public-access-block-configuration \
      "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
  
  # Enable versioning for asset tracking
  aws s3api put-bucket-versioning \
    --bucket $S3_BUCKET \
    --versioning-configuration Status=Enabled
  
  echo "✅ S3 bucket created with versioning enabled"
else
  echo "✅ S3 bucket already exists"
fi
```

**Expected Output:**
```
✅ S3 bucket already exists
```

### Step 9: Create Lambda Function

```bash
echo "Creating/verifying Lambda function..."

# Check if function exists
FUNCTION_EXISTS=$(aws lambda get-function \
  --function-name $LAMBDA_FUNCTION \
  --region $AWS_REGION \
  2>/dev/null || echo "NOT_FOUND")

if [[ "$FUNCTION_EXISTS" == "NOT_FOUND" ]]; then
  echo "Creating Lambda function: $LAMBDA_FUNCTION"
  
  # Create placeholder code
  mkdir -p /tmp/lambda-placeholder-outreach
  cat > /tmp/lambda-placeholder-outreach/index.mjs << 'EOFCODE'
export const handler = async (event) => {
  return {
    statusCode: 200,
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*'
    },
    body: JSON.stringify({ 
      message: 'Placeholder - awaiting first deployment',
      timestamp: new Date().toISOString()
    })
  };
};
EOFCODE
  
  # Create zip
  cd /tmp/lambda-placeholder-outreach
  zip -q placeholder.zip index.mjs
  
  # Create Lambda function
  aws lambda create-function \
    --function-name $LAMBDA_FUNCTION \
    --runtime nodejs20.x \
    --role $LAMBDA_ROLE_ARN \
    --handler index.handler \
    --zip-file fileb://placeholder.zip \
    --timeout $LAMBDA_TIMEOUT \
    --memory-size $LAMBDA_MEMORY \
    --region $AWS_REGION \
    --description "Outreach SMS App - Multi-Zone ($ENV)"
  
  echo "✅ Lambda function created"
  
  # Clean up
  rm -rf /tmp/lambda-placeholder-outreach
  
  # Wait for function to be active
  echo "Waiting for Lambda to be active..."
  aws lambda wait function-active \
    --function-name $LAMBDA_FUNCTION \
    --region $AWS_REGION
else
  echo "✅ Lambda function already exists"
fi
```

**Expected Output:**
```
✅ Lambda function already exists
```

### Step 10: Update Lambda Environment Variables

```bash
echo "Updating Lambda environment variables..."

aws lambda update-function-configuration \
  --function-name $LAMBDA_FUNCTION \
  --environment file:///tmp/lambda-env-vars-${ENV}.json \
  --region $AWS_REGION \
  --output json > /dev/null

# Wait for update to complete
echo "Waiting for configuration update..."
aws lambda wait function-updated \
  --function-name $LAMBDA_FUNCTION \
  --region $AWS_REGION

echo "✅ Lambda environment variables updated"

# Verify environment variables
echo ""
echo "Verifying Lambda configuration..."
LAMBDA_CONFIG=$(aws lambda get-function-configuration \
  --function-name $LAMBDA_FUNCTION \
  --region $AWS_REGION)

echo "Lambda Status: $(echo $LAMBDA_CONFIG | jq -r '.State')"
echo "Last Updated: $(echo $LAMBDA_CONFIG | jq -r '.LastModified')"
echo ""
echo "Environment Variables Set:"
echo $LAMBDA_CONFIG | jq -r '.Environment.Variables | keys[]' | sed 's/^/  - /'
```

**Expected Output:**
```
✅ Lambda environment variables updated

Verifying Lambda configuration...
Lambda Status: Active
Last Updated: 2025-12-16T...
Environment Variables Set:
  - API_BASE_URL
  - AUTH0_BASE_URL
  - AUTH0_CLIENT_ID
  - AUTH0_CLIENT_SECRET
  - AUTH0_ISSUER_BASE_URL
  - AUTH0_SECRET
  - MULTI_ZONE_MODE
  - NEXT_PUBLIC_API_BASE_URL
  - NEXT_TELEMETRY_DISABLED
  - NODE_ENV
```

### Step 11: Create Lambda Function URL

```bash
echo "Creating/verifying Lambda Function URL..."

echo ""
echo "⚠️  SECURITY NOTE"
echo "This Function URL is intended as an internal origin that SleepConnect proxies to."
echo "It is NOT a user-facing standalone deployment."
echo "If you enable public access (auth NONE), ensure monitoring/rate limiting and confirm"
echo "the app does not serve sensitive data without Auth0 cookies."
echo ""

# Check if function URL exists
FUNCTION_URL=$(aws lambda get-function-url-config \
  --function-name $LAMBDA_FUNCTION \
  --region $AWS_REGION \
  --query 'FunctionUrl' \
  --output text \
  2>/dev/null || echo "")

if [ -z "$FUNCTION_URL" ]; then
  echo "Creating function URL..."
  
  # Create function URL with public access
  FUNCTION_URL=$(aws lambda create-function-url-config \
    --function-name $LAMBDA_FUNCTION \
    --auth-type NONE \
    --region $AWS_REGION \
    --query 'FunctionUrl' \
    --output text)
  
  # Add permission for public invocation
  aws lambda add-permission \
    --function-name $LAMBDA_FUNCTION \
    --statement-id FunctionURLAllowPublicAccess \
    --action lambda:InvokeFunctionUrl \
    --principal "*" \
    --function-url-auth-type NONE \
    --region $AWS_REGION \
    2>/dev/null || echo "(Permission may already exist)"
  
  echo "✅ Function URL created"
else
  echo "✅ Function URL already exists"
fi

echo "Function URL: $FUNCTION_URL"
export FUNCTION_URL

# Update config file
echo "FUNCTION_URL=$FUNCTION_URL" >> $CONFIG_FILE
```

**Expected Output:**
```
✅ Function URL already exists
Function URL: https://abc123xyz.lambda-url.us-east-1.on.aws/
```

**⚠️ CHECKPOINT:** Outreach-owned infrastructure is created (Lambda + S3 + env vars). SleepConnect-owned resources (CloudFront/Route53/ACM/API Gateway) must already exist.

---

## Part 3: Build and Deploy Outreach Lambda

### Step 12: Install Outreach Dependencies

```bash
cd ~/code/SAX/twilio-conversations-react

echo "Installing Outreach dependencies..."
npm install

if [ $? -eq 0 ]; then
  echo "✅ Dependencies installed"
else
  echo "❌ Failed to install dependencies"
  exit 1
fi
```

### Step 13: Update Deployment Script Configuration

```bash
cd ~/code/SAX/twilio-conversations-react

echo "Verifying deployment script configuration..."

# Check if deploy-outreach.cjs exists
if [ ! -f "scripts/deploy-outreach.cjs" ]; then
  echo "❌ ERROR: scripts/deploy-outreach.cjs not found"
  exit 1
fi

# Display current configuration for this environment
echo ""
echo "Current deployment script configuration for $ENV:"
echo ""
node -e "
const fs = require('fs');
const content = fs.readFileSync('scripts/deploy-outreach.cjs', 'utf8');
const envMatch = content.match(new RegExp('${ENV}\\s*:\\s*{[^}]+}', 's'));
if (envMatch) {
  console.log(envMatch[0]);
} else {
  console.log('Environment ${ENV} not found in deployment script');
}
"

echo ""
echo "Expected configuration:"
echo "  ${ENV}: {"
echo "    lambdaFunction: '${LAMBDA_FUNCTION}',"
echo "    lambdaFunctionUrl: process.env.FUNCTION_URL || '',  # informational only"
echo "    cloudfrontDistribution: process.env.SLEEPCONNECT_CLOUDFRONT_DISTRIBUTION_ID || '',  # optional invalidation"
echo "    s3AssetsBucket: '${S3_BUCKET}',"
echo "    region: '${AWS_REGION}',"
echo "    memory: ${LAMBDA_MEMORY},   # not applied by deploy script"
echo "    timeout: ${LAMBDA_TIMEOUT}, # not applied by deploy script"
echo "  }"
echo ""

echo "Note: The deploy script reads optional runtime values from the environment:"
echo "  - FUNCTION_URL (optional; printed by script)"
echo "  - SLEEPCONNECT_CLOUDFRONT_DISTRIBUTION_ID (optional; enables script invalidation)"
echo "If you want the deploy script to invalidate cache, export the CloudFront ID:"
echo "  export SLEEPCONNECT_CLOUDFRONT_DISTRIBUTION_ID=\"E3ABC123XYZ\""
echo ""

# Verify deployment script has correct configuration
SCRIPT_LAMBDA=$(node -e "const fs = require('fs'); const content = fs.readFileSync('scripts/deploy-outreach.cjs', 'utf8'); const match = content.match(/\b${ENV}\s*:\s*{[^}]*lambdaFunction:\s*['\"]([^'\"]+)['\"]/); console.log(match ? match[1] : 'NOT_FOUND');" 2>/dev/null)

if [ "$SCRIPT_LAMBDA" = "NOT_FOUND" ] || [ -z "$SCRIPT_LAMBDA" ]; then
  echo "⚠️  WARNING: Could not validate deployment script configuration"
  echo "   Manually verify scripts/deploy-outreach.cjs has correct values"
elif [ "$SCRIPT_LAMBDA" != "$LAMBDA_FUNCTION" ]; then
  echo "❌ ERROR: Deployment script Lambda function mismatch"
  echo "   Expected: $LAMBDA_FUNCTION"
  echo "   Found:    $SCRIPT_LAMBDA"
  echo "   Update scripts/deploy-outreach.cjs before continuing"
  exit 1
else
  echo "✅ Deployment script Lambda function verified: $SCRIPT_LAMBDA"
fi

echo "✅ Deployment script verified"
```

### Step 14: Set Build Environment

```bash
cd ~/code/SAX/twilio-conversations-react

# Load configuration if not already loaded
if [ -z "$LAMBDA_FUNCTION" ]; then
  source /tmp/outreach-${ENV}-config.env
fi

# Set Node.js build options
export NODE_ENV=production
export NODE_OPTIONS="--max-old-space-size=4096"

# Create .env.local for build (using internal Lambda URL)
cat > .env.local << EOF
# Build-time environment variables
NODE_ENV=production
MULTI_ZONE_MODE=true

# API Configuration (Lambda will use these)
API_BASE_URL=${API_GATEWAY_URL}
NEXT_PUBLIC_API_BASE_URL=https://${MULTIZONE_DOMAIN}/outreach

# Auth0 Configuration
AUTH0_SECRET=${AUTH0_SECRET}
AUTH0_CLIENT_SECRET=${AUTH0_CLIENT_SECRET}
AUTH0_CLIENT_ID=${AUTH0_CLIENT_ID}
AUTH0_ISSUER_BASE_URL=${AUTH0_ISSUER_BASE_URL}
AUTH0_BASE_URL=${AUTH0_BASE_URL}

# Telemetry
NEXT_TELEMETRY_DISABLED=1
EOF

echo "✅ Build environment configured"
echo ""
echo "Build configuration:"
cat .env.local | grep -v "SECRET" | grep -v "^#"
```

**Expected Output:**
```
✅ Build environment configured

Build configuration:
NODE_ENV=production
MULTI_ZONE_MODE=true
API_BASE_URL=https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev
NEXT_PUBLIC_API_BASE_URL=https://dev.mydreamconnect.com/outreach
...
```

### Step 15: Deploy Outreach to Lambda

```bash
cd ~/code/SAX/twilio-conversations-react

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Deploying Outreach to Lambda"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Environment: $ENV"
echo "Lambda:      $LAMBDA_FUNCTION"
echo ""

# Run deployment script
node scripts/deploy-outreach.cjs $ENV

DEPLOY_EXIT_CODE=$?

if [ $DEPLOY_EXIT_CODE -eq 0 ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ Outreach Deployment Complete"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "❌ Deployment Failed"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Check errors above"
  exit 1
fi
```

**Expected Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Deploying Outreach to Lambda
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

🚀 Outreach SMS App Deployment
📦 Environment:   develop
λ  Lambda:        sax-lambda-us-east-1-0x-d-outreach-server_develop

[Build steps...]

✅ Lambda function updated successfully
✅ S3 assets uploaded: 245 files
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Outreach Deployment Complete
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

### Step 16: Verify Lambda Deployment

```bash
echo "Verifying Lambda deployment..."
echo ""

# Get Lambda info
LAMBDA_INFO=$(aws lambda get-function \
  --function-name $LAMBDA_FUNCTION \
  --region $AWS_REGION)

CODE_SIZE=$(echo $LAMBDA_INFO | jq -r '.Configuration.CodeSize')
LAST_MODIFIED=$(echo $LAMBDA_INFO | jq -r '.Configuration.LastModified')
RUNTIME=$(echo $LAMBDA_INFO | jq -r '.Configuration.Runtime')

echo "Lambda Function Details:"
echo "  Name:         $LAMBDA_FUNCTION"
echo "  Runtime:      $RUNTIME"
echo "  Code Size:    $((CODE_SIZE / 1024 / 1024))MB"
echo "  Memory:       ${LAMBDA_MEMORY}MB"
echo "  Timeout:      ${LAMBDA_TIMEOUT}s"
echo "  Last Updated: $LAST_MODIFIED"

# Test Lambda function URL
echo ""
echo "Testing Lambda Function URL..."
HTTP_CODE=$(curl -s -o /tmp/lambda-test-output.html -w "%{http_code}" $FUNCTION_URL)

if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Lambda responding (HTTP $HTTP_CODE)"
  
  # Check if it's the Next.js app (not placeholder)
  if grep -q "next" /tmp/lambda-test-output.html; then
    echo "✅ Next.js app deployed successfully"
  else
    echo "⚠️  Response received but may not be Next.js app"
  fi
else
  echo "⚠️  Unexpected HTTP code: $HTTP_CODE"
fi

rm -f /tmp/lambda-test-output.html
```

**Expected Output:**
```
Lambda Function Details:
  Name:         sax-lambda-us-east-1-0x-d-outreach-server_develop
  Runtime:      nodejs20.x
  Code Size:    45MB
  Memory:       1024MB
  Timeout:      30s
  Last Updated: 2025-12-16T...

Testing Lambda Function URL...
✅ Lambda responding (HTTP 200)
✅ Next.js app deployed successfully
```

**⚠️ CHECKPOINT:** Outreach Lambda deployed and responding.

---

## Part 4: SleepConnect Multi-Zone Integration

### Step 17: Verify SleepConnect Configuration

```bash
cd ~/code/SAX/sleepconnect

echo "Verifying SleepConnect configuration for multi-zone..."
echo ""

# Check if SleepConnect is deployed
if [ ! -f ".sst/stage" ]; then
  echo "❌ ERROR: SleepConnect not deployed (no .sst/stage file)"
  echo "   Deploy SleepConnect first before integrating Outreach"
  exit 1
fi

SLEEPCONNECT_STAGE=$(cat .sst/stage)
echo "SleepConnect Stage: $SLEEPCONNECT_STAGE"

if [ "$SLEEPCONNECT_STAGE" != "$ENV" ]; then
  echo "⚠️  WARNING: SleepConnect stage ($SLEEPCONNECT_STAGE) != Outreach env ($ENV)"
  echo "   Ensure you're deploying to matching environments"
  read -p "Press ENTER to continue or Ctrl+C to abort..."
fi
```

### Step 18: Update SleepConnect Environment Variables

```bash
cd ~/code/SAX/sleepconnect

echo "Updating SleepConnect .env.local for Outreach integration..."

# Backup existing .env.local
if [ -f .env.local ]; then
  cp .env.local .env.local.backup.$(date +%Y%m%d-%H%M%S)
  echo "✅ Backed up .env.local"
fi

# Check if OUTREACH_APP_URL exists
if grep -q "^OUTREACH_APP_URL=" .env.local 2>/dev/null; then
  echo "Updating existing OUTREACH_APP_URL..."
  
  # Update using sed
  sed -i.tmp "s|^OUTREACH_APP_URL=.*|OUTREACH_APP_URL=${FUNCTION_URL}|" .env.local
  rm -f .env.local.tmp
else
  echo "Adding OUTREACH_APP_URL to .env.local..."
  
  # Add new configuration
  cat >> .env.local << EOF

# Outreach Multi-Zone Configuration
OUTREACH_APP_URL=${FUNCTION_URL}
OUTREACH_API_URL=${API_GATEWAY_URL}
EOF
fi

# Verify configuration
echo ""
echo "Current Outreach configuration in SleepConnect:"
grep "^OUTREACH" .env.local

echo ""
echo "✅ SleepConnect environment updated"
```

**Expected Output:**
```
✅ Backed up .env.local
Updating existing OUTREACH_APP_URL...

Current Outreach configuration in SleepConnect:
OUTREACH_APP_URL=https://abc123xyz.lambda-url.us-east-1.on.aws/
OUTREACH_API_URL=https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev

✅ SleepConnect environment updated
```

### Step 19: Verify SleepConnect Rewrites Configuration

```bash
cd ~/code/SAX/sleepconnect

echo "Verifying SleepConnect next.config.js rewrites..."
echo ""

# Check for correct rewrite pattern
if grep -q 'destination: `${outreachUrl}/outreach/api/outreach' next.config.js; then
  echo "✅ API route rewrite is CORRECT (routes through Outreach app)"
  echo ""
  echo "Current configuration:"
  grep -A 3 "source: '/outreach/api/outreach" next.config.js | head -4
else
  echo "❌ ERROR: Rewrites configuration is INCORRECT"
  echo ""
  echo "CRITICAL: next.config.js must route API requests through Outreach app"
  echo ""
  echo "Required configuration:"
  echo "  {"
  echo "    source: '/outreach/api/outreach/:path*',"
  echo "    destination: \`\${outreachUrl}/outreach/api/outreach/:path*\`,"
  echo "  },"
  echo ""
  echo "Current configuration:"
  grep -A 5 "source: '/outreach" next.config.js || echo "(No rewrites found)"
  echo ""
  echo "Fix next.config.js before continuing"
  exit 1
fi

echo ""
echo "✅ Rewrites configuration verified"
```

**Expected Output:**
```
✅ API route rewrite is CORRECT (routes through Outreach app)

Current configuration:
      {
        source: '/outreach/api/outreach/:path*',
        destination: `${outreachUrl}/outreach/api/outreach/:path*`,
      },

✅ Rewrites configuration verified
```

### Step 20: Verify Shared JWT Secret

```bash
cd ~/code/SAX/sleepconnect

echo "Verifying AUTH0_CLIENT_SECRET consistency..."
echo ""

# Get SleepConnect secret
SLEEPCONNECT_SECRET=$(grep "^AUTH0_CLIENT_SECRET=" .env.local | cut -d'=' -f2- | tr -d '"' | tr -d "'" | head -1)

# Get Lambda secret (from our config)
LAMBDA_SECRET=$AUTH0_CLIENT_SECRET

if [ "$SLEEPCONNECT_SECRET" = "$LAMBDA_SECRET" ]; then
  echo "✅ AUTH0_CLIENT_SECRET matches between SleepConnect and Outreach Lambda"
  echo "   Secret: ${SLEEPCONNECT_SECRET:0:20}..."
else
  echo "❌ ERROR: AUTH0_CLIENT_SECRET MISMATCH!"
  echo ""
  echo "   SleepConnect: ${SLEEPCONNECT_SECRET:0:20}..."
  echo "   Outreach:     ${LAMBDA_SECRET:0:20}..."
  echo ""
  echo "   CRITICAL: Secrets must be identical for JWT verification"
  echo "   Update Lambda environment variables and redeploy"
  exit 1
fi
```

**Expected Output:**
```
✅ AUTH0_CLIENT_SECRET matches between SleepConnect and Outreach Lambda
   Secret: abc123xyz...
```

### Step 21: Deploy SleepConnect with Updated Configuration

```bash
cd ~/code/SAX/sleepconnect

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Deploying SleepConnect with Outreach Integration"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "This will:"
echo "  1. Update SleepConnect Lambda with new environment variables"
echo "  2. Enable multi-zone routing to Outreach Lambda"
echo "  3. Ensure API routes execute through Outreach (not direct to API Gateway)"
echo ""
read -p "Press ENTER to deploy SleepConnect, or Ctrl+C to abort..."

# Deploy using SST
npx sst deploy --stage $ENV

SLEEPCONNECT_DEPLOY_EXIT=$?

if [ $SLEEPCONNECT_DEPLOY_EXIT -eq 0 ]; then
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ SleepConnect Deployed Successfully"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
else
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "❌ SleepConnect Deployment Failed"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Check errors above"
  exit 1
fi

# Get SleepConnect URL
echo ""
echo "Getting SleepConnect deployment info..."
SLEEPCONNECT_URL=$(npx sst env get --stage $ENV SST_SITE_URL 2>/dev/null || echo "https://${MULTIZONE_DOMAIN}")
echo "SleepConnect URL: $SLEEPCONNECT_URL"

# Invalidate CloudFront cache
echo ""
echo "Invalidating CloudFront cache for /outreach/*..."

# Get CloudFront distribution ID for multi-zone domain
CF_DIST_ID=$(aws cloudfront list-distributions \
  --query "DistributionList.Items[?Aliases.Items[?contains(@, '${MULTIZONE_DOMAIN}')]].Id" \
  --output text 2>/dev/null | head -1)

if [ -n "$CF_DIST_ID" ]; then
  INVALIDATION_ID=$(aws cloudfront create-invalidation \
    --distribution-id $CF_DIST_ID \
    --paths "/outreach/*" "/outreach-static/*" \
    --query 'Invalidation.Id' \
    --output text)
  
  echo "✅ CloudFront cache invalidation started: $INVALIDATION_ID"
  echo "   Cache will be cleared in 1-2 minutes"
else
  echo "⚠️  Could not find CloudFront distribution for $MULTIZONE_DOMAIN"
  echo "   Users may see cached content until TTL expires"
fi
```

**Expected Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 Deploying SleepConnect with Outreach Integration
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

[SST deployment output...]

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SleepConnect Deployed Successfully
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SleepConnect URL: https://dev.mydreamconnect.com
```

**⚠️ CHECKPOINT:** Multi-zone integration complete. Ready for testing.

---

## Part 5: Multi-Zone Verification and Testing

### Step 22: Wait for DNS/Deployment Propagation

```bash
echo "Checking DNS and deployment propagation..."
echo ""

# Check DNS resolution
echo "Testing DNS: $MULTIZONE_DOMAIN"
DNS_RESULT=$(dig +short $MULTIZONE_DOMAIN A | head -1)

if [ -z "$DNS_RESULT" ]; then
  echo "⚠️  DNS not resolving yet"
  echo "   Waiting 30 seconds..."
  sleep 30
  DNS_RESULT=$(dig +short $MULTIZONE_DOMAIN A | head -1)
fi

if [ -z "$DNS_RESULT" ]; then
  echo "❌ DNS still not resolving for $MULTIZONE_DOMAIN"
  echo "   Check Route 53 configuration"
  exit 1
else
  echo "✅ DNS resolving: $MULTIZONE_DOMAIN -> $DNS_RESULT"
fi

# Wait a bit for CloudFront to pick up new origin
echo ""
echo "Waiting 10 seconds for deployment propagation..."
sleep 10
```

### Step 23: Test Multi-Zone Routing (CRITICAL)

```bash
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🧪 CRITICAL TEST: Multi-Zone API Routing"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "Testing: https://${MULTIZONE_DOMAIN}/outreach/api/outreach/templates"
echo ""
echo "Expected behavior:"
echo "  ✅ CORRECT: HTTP 401 with {\"code\":\"UNAUTHORIZED\"}"
echo "  ❌ WRONG:   HTTP 400 with \"Invalid or missing tenant_id\""
echo ""

# Make request
RESPONSE=$(curl -s -w "\n%{http_code}" https://${MULTIZONE_DOMAIN}/outreach/api/outreach/templates)
HTTP_CODE=$(echo "$RESPONSE" | tail -1)
BODY=$(echo "$RESPONSE" | head -n -1)

echo "HTTP Status: $HTTP_CODE"
echo "Response Body:"
echo "$BODY" | jq '.' 2>/dev/null || echo "$BODY"
echo ""

# Validate response
if [ "$HTTP_CODE" = "401" ] && echo "$BODY" | grep -q "UNAUTHORIZED"; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "✅ PASS: API Route Middleware Executing"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "This confirms:"
  echo "  ✓ Request flows through SleepConnect"
  echo "  ✓ SleepConnect proxies to Outreach Lambda"
  echo "  ✓ Outreach API route handler executes"
  echo "  ✓ JWT authentication middleware runs"
  echo ""
elif echo "$BODY" | grep -q "Invalid or missing tenant_id"; then
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "❌ FAIL: Request Bypassed Outreach Lambda"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo ""
  echo "PROBLEM: Request went directly to API Gateway"
  echo "ROOT CAUSE: SleepConnect rewrites are incorrect"
  echo ""
  echo "Check SleepConnect next.config.js rewrites"
  exit 1
else
  echo "⚠️  Unexpected Response"
  echo "   Check deployment status and logs"
fi
```

**Expected Output (Success):**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧪 CRITICAL TEST: Multi-Zone API Routing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Testing: https://dev.mydreamconnect.com/outreach/api/outreach/templates

HTTP Status: 401
Response Body:
{
  "code": "UNAUTHORIZED",
  "message": "Missing user context"
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ PASS: API Route Middleware Executing
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

This confirms:
  ✓ Request flows through SleepConnect
  ✓ SleepConnect proxies to Outreach Lambda
  ✓ Outreach API route handler executes
  ✓ JWT authentication middleware runs
```

### Step 24: Check Lambda Logs for API Execution

```bash
echo "Checking Outreach Lambda logs for API route execution..."
echo ""

# Get log group name
LOG_GROUP="/aws/lambda/$LAMBDA_FUNCTION"

echo "Tailing logs from: $LOG_GROUP"
echo "Looking for: [TEMPLATES API] or similar API route logs"
echo ""

# Tail recent logs
aws logs tail $LOG_GROUP \
  --since 5m \
  --region $AWS_REGION \
  --format short \
  --filter-pattern "TEMPLATES API" || echo "(No matching logs in last 5 minutes)"

echo ""
echo "Expected log entries:"
echo "  [TEMPLATES API] START"
echo "  [TEMPLATES API] Calling Lambda { tenant: ..., practice: ..., saxId: ... }"
echo ""
echo "If you see these logs, it confirms API routes are executing correctly"
```

### Step 25: Test Static Assets

```bash
echo "Verifying static assets end-to-end (S3 upload + CloudFront delivery)..."
echo ""

if [ -z "$S3_BUCKET" ] || [ -z "$MULTIZONE_DOMAIN" ]; then
  echo "❌ ERROR: Missing required variables. Ensure S3_BUCKET and MULTIZONE_DOMAIN are set."
  exit 1
fi

echo "1) Verify S3 has uploaded assets under outreach-static/"
S3_FILE_COUNT=$(aws s3 ls "s3://$S3_BUCKET/outreach-static/" --recursive 2>/dev/null | wc -l | tr -d ' ')
echo "   S3 file count: $S3_FILE_COUNT"
if [ "$S3_FILE_COUNT" -eq 0 ]; then
  echo "❌ No files found under s3://$S3_BUCKET/outreach-static/"
  echo "   Re-run the deploy script (it uploads assets) and verify your S3 bucket is correct."
  exit 1
fi

echo ""
echo "2) Pick a real uploaded asset key (from S3)"
SAMPLE_KEY=$(aws s3api list-objects-v2 \
  --bucket "$S3_BUCKET" \
  --prefix "outreach-static/_next/static/" \
  --max-items 1 \
  --query 'Contents[0].Key' \
  --output text 2>/dev/null)

if [ -z "$SAMPLE_KEY" ] || [ "$SAMPLE_KEY" = "None" ]; then
  SAMPLE_KEY=$(aws s3api list-objects-v2 \
    --bucket "$S3_BUCKET" \
    --prefix "outreach-static/" \
    --max-items 1 \
    --query 'Contents[0].Key' \
    --output text 2>/dev/null)
fi

if [ -z "$SAMPLE_KEY" ] || [ "$SAMPLE_KEY" = "None" ]; then
  echo "❌ Could not find any objects in s3://$S3_BUCKET/outreach-static/"
  exit 1
fi

echo "   Sample S3 key: $SAMPLE_KEY"

echo ""
echo "3) Verify the object exists (head-object)"
aws s3api head-object \
  --bucket "$S3_BUCKET" \
  --key "$SAMPLE_KEY" \
  --query '{ETag:ETag,Size:ContentLength,LastModified:LastModified,CacheControl:CacheControl,ContentType:ContentType}' \
  --output table || { echo "❌ head-object failed"; exit 1; }

echo ""
echo "4) Fetch the same object via the multi-zone domain (CloudFront delivery)"
URL_PATH="/${SAMPLE_KEY#outreach-static/}"
STATIC_URL="https://${MULTIZONE_DOMAIN}/outreach-static${URL_PATH}"
echo "   URL: $STATIC_URL"
echo ""

HTTP_CODE=$(curl -sS -o /dev/null -w "%{http_code}" -I "$STATIC_URL" || echo "000")
echo "   HTTP status: $HTTP_CODE"
echo ""
echo "   Response headers:"
curl -sS -I "$STATIC_URL" | sed -n '1,25p'

echo ""
if [ "$HTTP_CODE" = "200" ]; then
  echo "✅ Static asset delivered through CloudFront (HTTP 200)"
  echo "   Expect to see Cache-Control / Age / Via / X-Cache headers in the output above."
elif [ "$HTTP_CODE" = "404" ]; then
  echo "❌ 404 from CloudFront for an object that exists in S3"
  echo "   This usually means SleepConnect CloudFront behavior/origin for /outreach-static/* is misconfigured"
  echo "   (wrong origin, missing origin path, or pointing at the wrong bucket/prefix)."
  exit 1
elif [ "$HTTP_CODE" = "403" ]; then
  echo "❌ 403 from CloudFront"
  echo "   This usually means origin access to the Outreach assets bucket is not permitted"
  echo "   (OAC/OAI + bucket policy). This is SleepConnect/platform-owned configuration."
  exit 1
elif [ "$HTTP_CODE" = "000" ]; then
  echo "❌ curl failed (DNS/TLS/network). Verify $MULTIZONE_DOMAIN resolves and TLS works."
  exit 1
else
  echo "⚠️  Unexpected static asset status: $HTTP_CODE"
  echo "   Check CloudFront origin/behavior, and confirm the request is reaching the correct distribution."
fi

echo ""
echo "Optional (troubleshooting): list CloudFront distributions matching the alias"
echo "NOTE: This does NOT create or modify CloudFront; it only helps you identify the correct distribution."
aws cloudfront list-distributions \
  --query "DistributionList.Items[?Aliases.Items && contains(Aliases.Items, '${MULTIZONE_DOMAIN}')].[Id,DomainName,Origins.Items[0].DomainName]" \
  --output table 2>/dev/null || echo "(No permission to list CloudFront distributions; skip.)"
```

### Step 26: Browser Testing Instructions

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "📋 Manual Browser Testing"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "1. Open browser to:"
echo "   https://${MULTIZONE_DOMAIN}/outreach/templates"
echo ""
echo "2. Log in with Auth0 credentials"
echo ""
echo "3. Verify templates page loads correctly"
echo ""
echo "4. Open Browser DevTools > Network tab"
echo ""
echo "5. Check API request:"
echo "   URL: /outreach/api/outreach/templates"
echo "   Status: Should be 200 (after login)"
echo "   Response: Should contain template data"
echo ""
echo "6. Check for server-side logs in Lambda:"
echo "   Run: aws logs tail $LOG_GROUP --follow"
echo "   Expected: [TEMPLATES API] logs appear"
echo ""
echo "7. Verify navigation:"
echo "   - Templates page"
echo "   - Campaigns page"  
echo "   - Messages page"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

### Step 27: Final Verification Checklist

```bash
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "✅ Deployment Verification Checklist"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

CHECKS_PASSED=0
CHECKS_TOTAL=6

# Check 1: Lambda deployed
if aws lambda get-function --function-name $LAMBDA_FUNCTION --region $AWS_REGION &>/dev/null; then
  echo "✅ Lambda function deployed"
  CHECKS_PASSED=$((CHECKS_PASSED+1))
else
  echo "❌ Lambda function not found"
fi

# Check 2: Lambda environment variables
LAMBDA_ENV_COUNT=$(aws lambda get-function-configuration \
  --function-name $LAMBDA_FUNCTION \
  --region $AWS_REGION \
  --query 'length(Environment.Variables)' \
  --output text)

if [ "$LAMBDA_ENV_COUNT" -ge 9 ]; then
  echo "✅ Lambda environment variables configured ($LAMBDA_ENV_COUNT vars)"
  CHECKS_PASSED=$((CHECKS_PASSED+1))
else
  echo "❌ Missing Lambda environment variables (only $LAMBDA_ENV_COUNT)"
fi

# Check 3: S3 assets uploaded
S3_FILE_COUNT=$(aws s3 ls s3://$S3_BUCKET/outreach-static/ --recursive 2>/dev/null | wc -l)

if [ "$S3_FILE_COUNT" -gt 0 ]; then
  echo "✅ S3 static assets uploaded ($S3_FILE_COUNT files)"
  CHECKS_PASSED=$((CHECKS_PASSED+1))
else
  echo "❌ No S3 static assets found"
fi

# Check 4: SleepConnect configuration
if grep -q "OUTREACH_APP_URL=$FUNCTION_URL" ~/code/SAX/sleepconnect/.env.local 2>/dev/null; then
  echo "✅ SleepConnect configured with Outreach Lambda URL"
  CHECKS_PASSED=$((CHECKS_PASSED+1))
else
  echo "❌ SleepConnect not configured correctly"
fi

# Check 5: DNS resolution
if dig +short $MULTIZONE_DOMAIN A | grep -q .; then
  echo "✅ DNS resolving for $MULTIZONE_DOMAIN"
  CHECKS_PASSED=$((CHECKS_PASSED+1))
else
  echo "❌ DNS not resolving"
fi

# Check 6: API route test
API_TEST=$(curl -s https://${MULTIZONE_DOMAIN}/outreach/api/outreach/templates 2>/dev/null)
if echo "$API_TEST" | grep -q "UNAUTHORIZED"; then
  echo "✅ API routes executing through Outreach Lambda"
  CHECKS_PASSED=$((CHECKS_PASSED+1))
else
  echo "❌ API routes not executing correctly"
fi

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "Checks Passed: $CHECKS_PASSED / $CHECKS_TOTAL"

if [ "$CHECKS_PASSED" -eq "$CHECKS_TOTAL" ]; then
  echo "Status: ✅ DEPLOYMENT SUCCESSFUL"
else
  echo "Status: ⚠️  DEPLOYMENT INCOMPLETE"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
```

**Expected Output:**
```
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ Deployment Verification Checklist
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

✅ Lambda function deployed
✅ Lambda environment variables configured (10 vars)
✅ S3 static assets uploaded (245 files)
✅ SleepConnect configured with Outreach Lambda URL
✅ DNS resolving for dev.mydreamconnect.com
✅ API routes executing through Outreach Lambda

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Checks Passed: 6 / 6
Status: ✅ DEPLOYMENT SUCCESSFUL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

---

## Part 6: Rollback Procedures

### Rollback Lambda Code

```bash
# Get previous version
VERSIONS=$(aws lambda list-versions-by-function \
  --function-name $LAMBDA_FUNCTION \
  --region $AWS_REGION \
  --query 'Versions[?Version!=`$LATEST`].Version' \
  --output text)

PREVIOUS_VERSION=$(echo $VERSIONS | awk '{print $(NF-1)}')

echo "Previous versions available: $VERSIONS"
echo "Latest numbered version: $PREVIOUS_VERSION"
echo ""
echo "To rollback Lambda code to a specific version:"
echo ""
echo "# First, create an alias pointing to the stable version"
echo "aws lambda update-alias \\"
echo "  --function-name $LAMBDA_FUNCTION \\"
echo "  --name stable \\"
echo "  --function-version $PREVIOUS_VERSION \\"
echo "  --region $AWS_REGION"
```

### Rollback SleepConnect Configuration

```bash
echo "To rollback SleepConnect configuration:"
echo ""
echo "1. List available backups:"
echo "   cd ~/code/SAX/sleepconnect"
echo "   ls -la .env.local.backup.*"
echo ""
echo "2. Restore backup:"
echo "   cp .env.local.backup.YYYYMMDD-HHMMSS .env.local"
echo ""
echo "3. Redeploy SleepConnect:"
echo "   npx sst deploy --stage $ENV"
```

### Rollback Lambda Environment Variables

```bash
# Create backup of current environment variables
BACKUP_FILE="/tmp/lambda-env-backup-$(date +%Y%m%d-%H%M%S).json"

aws lambda get-function-configuration \
  --function-name $LAMBDA_FUNCTION \
  --region $AWS_REGION \
  --query 'Environment.Variables' > $BACKUP_FILE

echo "Environment variables backed up to: $BACKUP_FILE"
echo ""
echo "To restore previous environment:"
echo "aws lambda update-function-configuration \\"
echo "  --function-name $LAMBDA_FUNCTION \\"
echo "  --environment file://$BACKUP_FILE \\"
echo "  --region $AWS_REGION"
```

---

## Part 7: Troubleshooting

### Check Lambda Status

```bash
aws lambda get-function-configuration \
  --function-name $LAMBDA_FUNCTION \
  --region $AWS_REGION \
  --query '{State:State,LastUpdateStatus:LastUpdateStatus,Runtime:Runtime,Memory:MemorySize,Timeout:Timeout}'
```

### View Lambda Logs (Live)

```bash
aws logs tail /aws/lambda/$LAMBDA_FUNCTION \
  --follow \
  --region $AWS_REGION
```

### Test Lambda Function URL Directly

```bash
curl -v $FUNCTION_URL
```

### Check SleepConnect Rewrites

```bash
cd ~/code/SAX/sleepconnect
grep -A 10 "async rewrites" next.config.js
```

### Verify Environment Variable Consistency

```bash
# Compare secrets
echo "SleepConnect AUTH0_CLIENT_SECRET:"
grep "AUTH0_CLIENT_SECRET" ~/code/SAX/sleepconnect/.env.local

echo ""
echo "Outreach Lambda AUTH0_CLIENT_SECRET:"
aws lambda get-function-configuration \
  --function-name $LAMBDA_FUNCTION \
  --region $AWS_REGION \
  --query 'Environment.Variables.AUTH0_CLIENT_SECRET' \
  --output text
```

### Check S3 Static Assets

```bash
aws s3 ls s3://$S3_BUCKET/outreach-static/ --recursive --human-readable
```

### Test API Route with Context

```bash
# This requires a valid x-sax-user-context cookie
# Get it from browser DevTools after logging in

COOKIE="x-sax-user-context=eyJ..."

curl -H "Cookie: $COOKIE" \
  https://${MULTIZONE_DOMAIN}/outreach/api/outreach/templates
```

---

## Summary

**Deployment Type:** Multi-Zone Integration Only  
**Total Steps:** 27  
**Estimated Time:**
- First deployment: 30-40 minutes
- Subsequent deployments: 10-15 minutes

**Critical Architecture:**
```
User → CloudFront (dev.mydreamconnect.com)
      → SleepConnect Lambda
      → Outreach Lambda (API routes execute here)
      → Lambda API Gateway (backend)
```

**Success Criteria:**
1. ✅ Lambda deployed with all environment variables
2. ✅ SleepConnect proxies requests to Outreach Lambda
3. ✅ API routes return 401 UNAUTHORIZED (not 400 tenant_id error)
4. ✅ Lambda logs show API route execution
5. ✅ Browser access works after Auth0 login

**Key Files:**
- Configuration: `/tmp/outreach-${ENV}-config.env`
- Lambda env vars: `/tmp/lambda-env-vars-${ENV}.json`
- SleepConnect: `~/code/SAX/sleepconnect/.env.local`
- Outreach: `~/code/SAX/twilio-conversations-react/.env.local`

---

**Version:** 2.0 (Multi-Zone Only)  
**Last Updated:** December 16, 2025  
**Status:** ✅ Production Ready
