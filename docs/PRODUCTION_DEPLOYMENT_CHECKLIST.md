# Production Deployment Checklist - Multi-Zone Outreach App

**Critical:** The deployment script alone is NOT sufficient for multi-zone production deployment. You must first set up infrastructure, then deploy both Outreach AND SleepConnect.

---

## Prerequisites

### First-Time Setup (One-Time Only)

**Before your first deployment, you MUST:**

1. **Create AWS Infrastructure** - See [INFRASTRUCTURE_SETUP.md](./INFRASTRUCTURE_SETUP.md)
   - Route 53 DNS records
   - ACM SSL/TLS certificates
   - S3 buckets for static assets
   - Lambda functions
   - CloudFront distributions
   - IAM roles and policies

2. **Update Deployment Script** - Add infrastructure IDs to [deploy-outreach.cjs](../scripts/deploy-outreach.cjs)
   - CloudFront Distribution IDs
   - Lambda Function URLs
   - S3 Bucket names

**⚠️ CRITICAL RULE:** Infrastructure is created ONCE, then UPDATED (never deleted). All operations must use update/upsert commands.

---

## ⚠️ Critical Issues: Multi-Zone Configuration

### Problem 1: Missing Infrastructure

The [deploy-outreach.cjs](../scripts/deploy-outreach.cjs) script assumes infrastructure already exists. It does **NOT** create:

- ❌ Route 53 DNS records (subdomains)
- ❌ ACM certificates for HTTPS
- ❌ CloudFront distributions
- ❌ S3 buckets
- ❌ Lambda functions (initial creation)

**Fix:** Follow [INFRASTRUCTURE_SETUP.md](./INFRASTRUCTURE_SETUP.md) before first deployment.

### Problem 2: SleepConnect Configuration

The script deploys the Outreach app but **does NOT configure SleepConnect** to route requests correctly. Without proper SleepConnect configuration, you'll experience the same issue we just fixed in development:

- ❌ API routes won't execute
- ❌ User context won't be extracted
- ❌ Lambda will receive 400 "Invalid or missing tenant_id" errors

**Fix:** Follow Step 2 below to update and redeploy SleepConnect.

### What the Deployment Script Does

✅ **Outreach App Updates Only:**

1. Builds Outreach Next.js app
2. Packages with OpenNext
3. **Updates** Lambda function code (does not create)
4. Uploads static assets to S3 (bucket must exist)
5. Invalidates CloudFront cache (distribution must exist)

❌ **Does NOT:**

- Create infrastructure (Route 53, ACM, CloudFront, S3, Lambda)
- Configure SleepConnect rewrites
- Update SleepConnect environment variables
- Deploy SleepConnect changes

---

## Pre-Deployment Requirements

### 0. Infrastructure Must Exist

**⚠️ FIRST-TIME DEPLOYMENT ONLY:**

Before your first deployment to any environment, complete the infrastructure setup:

```bash
# Follow the complete guide
see docs/INFRASTRUCTURE_SETUP.md

# This creates (ONE-TIME ONLY):
- Route 53 DNS records
- ACM SSL certificates
- S3 buckets
- Lambda functions (placeholder)
- CloudFront distributions
- IAM roles
```

**Save these values from infrastructure setup:**

- CloudFront Distribution ID
- Lambda Function URL
- S3 Bucket Name
- ACM Certificate ARN

**Update [deploy-outreach.cjs](../scripts/deploy-outreach.cjs) with these values** (remove `[UPDATE-AFTER-CREATION]` placeholders).

### 1. Update SleepConnect Environment Variables

**File:** `sleepconnect/.env.local` (and production equivalent)

```bash
# Production example for develop environment
OUTREACH_APP_URL=https://outreach.mydreamconnect.com
OUTREACH_API_URL=https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev

# Production example for production environment
OUTREACH_APP_URL=https://outreach.dreamconnect.health
OUTREACH_API_URL=https://api.dreamconnect.health/prod
```

**Critical:** `OUTREACH_APP_URL` must point to the **deployed Outreach app**, not localhost.

### 2. Verify SleepConnect Rewrites Configuration

**File:** `sleepconnect/next.config.js`

Ensure this configuration is present and uses the correct environment variables:

```javascript
async rewrites() {
  const outreachUrl = process.env.OUTREACH_APP_URL || 'http://localhost:3001';
  const apiGatewayUrl = process.env.OUTREACH_API_URL || 'https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev';

  return {
    beforeFiles: [
      // ✅ CRITICAL: Route API calls THROUGH the Outreach app (not direct to Gateway)
      {
        source: '/outreach/api/outreach/:path*',
        destination: `${outreachUrl}/outreach/api/outreach/:path*`,
      },
      // Route pages to Outreach app
      {
        source: '/outreach/:path*',
        destination: `${outreachUrl}/outreach/:path*`,
      },
    ],
  };
}
```

**Do NOT use this (broken):**

```javascript
// ❌ WRONG: Bypasses Outreach API routes
{
  source: '/outreach/api/outreach/:path*',
  destination: `${apiGatewayUrl}/outreach/:path*`,  // Direct to Lambda
}
```

### 3. Shared JWT Secret

**Critical:** Both apps must share the same `AUTH0_CLIENT_SECRET`:

```bash
# SleepConnect .env
AUTH0_CLIENT_SECRET=your-secret-here

# Outreach .env
AUTH0_CLIENT_SECRET=your-secret-here  # MUST BE IDENTICAL
AUTH0_SECRET=your-secret-here         # MUST BE IDENTICAL
```

---

## Deployment Steps

### Step 1: Deploy Outreach App

```bash
cd twilio-conversations-react

# Development
node scripts/deploy-outreach.cjs develop

# Staging
node scripts/deploy-outreach.cjs staging

# Production
node scripts/deploy-outreach.cjs production
```

**Output:** Note the Lambda Function URL and CloudFront distribution ID.

### Step 2: Update SleepConnect Configuration

After deploying Outreach, update SleepConnect's environment variables:

```bash
cd sleepconnect

# Update .env.local or .env.production with:
OUTREACH_APP_URL=<deployed-outreach-url>
```

**Options for OUTREACH_APP_URL:**

1. **Lambda Function URL** (fastest, direct):

   ```bash
   OUTREACH_APP_URL=https://abc123xyz.lambda-url.us-east-1.on.aws
   ```

2. **CloudFront Distribution** (recommended for production):

   ```bash
   OUTREACH_APP_URL=https://outreach.mydreamconnect.com
   ```

### Step 3: Deploy SleepConnect

```bash
cd sleepconnect

# Using SST
npx sst deploy --stage develop

# Or your deployment method
```

### Step 4: Verify Multi-Zone Routing

Test the complete flow:

```bash
# Test API route execution through SleepConnect proxy
curl https://dev.mydreamconnect.com/outreach/api/outreach/templates \
  -H "Cookie: x-sax-user-context=<jwt-token>" \
  -v

# Expected:
# 1. Request hits SleepConnect CloudFront
# 2. SleepConnect proxies to Outreach CloudFront/Lambda
# 3. Outreach API route executes (check Lambda logs)
# 4. API route calls Lambda API Gateway with headers
# 5. Success response returned
```

**Check Logs:**

```bash
# Outreach Lambda logs (should see "[TEMPLATES API] START")
aws logs tail /aws/lambda/sax-lambda-us-east-1-0x-d-outreach-server_develop --follow

# SleepConnect logs
aws logs tail /aws/lambda/sax-lambda-us-east-1-0x-d-sleepconnect-server_develop --follow
```

---

## Environment-Specific URLs

### Development

| Service | URL |
|---------|-----|
| Outreach Standalone | `https://outreach.mydreamconnect.com/outreach` |
| Outreach Multi-Zone | `https://dev.mydreamconnect.com/outreach` |
| Lambda Function | `https://[function-url].lambda-url.us-east-1.on.aws` |
| API Gateway | `https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev` |

**SleepConnect Config:**

```bash
OUTREACH_APP_URL=https://outreach.mydreamconnect.com
OUTREACH_API_URL=https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev
```

### Staging

| Service | URL |
|---------|-----|
| Outreach Standalone | `https://outreach-staging.mydreamconnect.com/outreach` |
| Outreach Multi-Zone | `https://staging.mydreamconnect.com/outreach` |
| Lambda Function | `https://[function-url].lambda-url.us-east-1.on.aws` |
| API Gateway | `https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/staging` |

**SleepConnect Config:**

```bash
OUTREACH_APP_URL=https://outreach-staging.mydreamconnect.com
OUTREACH_API_URL=https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/staging
```

### Production

| Service | URL |
|---------|-----|
| Outreach Standalone | `https://outreach.dreamconnect.health/outreach` |
| Outreach Multi-Zone | `https://dreamconnect.health/outreach` |
| Lambda Function | `https://[function-url].lambda-url.us-east-1.on.aws` |
| API Gateway | `https://api.dreamconnect.health/prod` |

**SleepConnect Config:**

```bash
OUTREACH_APP_URL=https://outreach.dreamconnect.health
OUTREACH_API_URL=https://api.dreamconnect.health/prod
```

---

## CloudFront Configuration

### Outreach CloudFront Distribution

Ensure these cache behaviors exist (in priority order):

#### 1. API Routes - `/outreach/api/*`

```yaml
PathPattern: /outreach/api/*
TargetOriginId: OutreachLambdaOrigin
ViewerProtocolPolicy: redirect-to-https
AllowedMethods: [GET, HEAD, OPTIONS, PUT, PATCH, POST, DELETE]
CachedMethods: [GET, HEAD, OPTIONS]
CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad  # CachingDisabled
OriginRequestPolicyId: 216adef6-5c7f-47e4-b989-5492eafa07d3  # AllViewer
Compress: true
```

**Critical:** Use `CachingDisabled` for API routes to ensure fresh data and proper auth.

#### 2. Static Assets - `/outreach-static/*`

```yaml
PathPattern: /outreach-static/*
TargetOriginId: OutreachS3AssetsOrigin
ViewerProtocolPolicy: redirect-to-https
AllowedMethods: [GET, HEAD, OPTIONS]
CachedMethods: [GET, HEAD, OPTIONS]
CachePolicyId: 658327ea-f89d-4fab-a63d-7e88639e58f3  # CachingOptimized
Compress: true
```

**Purpose:** Long-term caching for static assets (CSS, JS, images).

#### 3. Pages - `/outreach/*`

```yaml
PathPattern: /outreach/*
TargetOriginId: OutreachLambdaOrigin
ViewerProtocolPolicy: redirect-to-https
AllowedMethods: [GET, HEAD, OPTIONS]
CachedMethods: [GET, HEAD, OPTIONS]
CachePolicyId: 658327ea-f89d-4fab-a63d-7e88639e58f3  # CachingOptimized
OriginRequestPolicyId: 216adef6-5c7f-47e4-b989-5492eafa07d3  # AllViewer
Compress: true
```

### SleepConnect CloudFront Distribution

**Critical:** SleepConnect must forward requests to Outreach origin, not handle them directly.

#### Origin Configuration

Add Outreach as an origin:

```yaml
Origins:
  - Id: OutreachAppOrigin
    DomainName: outreach.mydreamconnect.com  # or Lambda Function URL
    CustomOriginConfig:
      HTTPPort: 80
      HTTPSPort: 443
      OriginProtocolPolicy: https-only
      OriginSSLProtocols: [TLSv1.2]
```

#### Cache Behavior for Multi-Zone

```yaml
PathPattern: /outreach/*
TargetOriginId: OutreachAppOrigin  # NOT SleepConnectLambda!
ViewerProtocolPolicy: redirect-to-https
AllowedMethods: [GET, HEAD, OPTIONS, PUT, PATCH, POST, DELETE]
CachedMethods: [GET, HEAD, OPTIONS]
CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad  # CachingDisabled (for API routes)
OriginRequestPolicyId: 216adef6-5c7f-47e4-b989-5492eafa07d3  # AllViewer
Compress: true
```

**Alternative:** Use SleepConnect Lambda with proper rewrites (current approach).

---

## Verification Tests

### Test 1: API Route Execution

```bash
# Request through SleepConnect multi-zone
curl https://dev.mydreamconnect.com/outreach/api/outreach/templates \
  -H "Cookie: __session__0=<auth0-session>; x-sax-user-context=<jwt>" \
  -v

# Check Outreach Lambda logs
aws logs tail /aws/lambda/sax-lambda-us-east-1-0x-d-outreach-server_develop --follow

# Should see:
# [TEMPLATES API] START
# [TEMPLATES API] Calling Lambda { tenant: '...', practice: '...', saxId: 1386 }
```

### Test 2: User Context Propagation

```bash
# Should return templates, not 400 error
# Response should include:
{
  "data": [
    {
      "id": "...",
      "tenantId": "00000000-0000-0000-0000-000000000001",
      "practiceId": "00000000-0000-0000-0000-000000000020",
      "name": "Welcome Message",
      ...
    }
  ]
}
```

### Test 3: Static Assets

```bash
# Should load without 404
curl https://dev.mydreamconnect.com/outreach-static/_next/static/chunks/main.js \
  -I

# Expected: 200 OK
```

### Test 4: Navigation

Open in browser and verify:

- [ ] Pages load correctly
- [ ] API calls succeed in Network tab
- [ ] No console errors
- [ ] Authentication works
- [ ] Templates list populates

---

## Common Deployment Issues

### Issue 1: API Routes Return 502 Bad Gateway

**Cause:** SleepConnect is routing `/outreach/api/outreach/*` directly to API Gateway instead of Outreach app.

**Fix:**

1. Verify SleepConnect `next.config.js` rewrites
2. Check `OUTREACH_APP_URL` environment variable
3. Redeploy SleepConnect

### Issue 2: 400 "Invalid or missing tenant_id"

**Cause:** Outreach API routes are bypassed, no headers added.

**Fix:**

1. Confirm API requests go through Outreach Lambda first
2. Check Outreach Lambda logs for `[TEMPLATES API] START`
3. Verify JWT secret matches in both apps

### Issue 3: 401 Unauthorized

**Cause:** JWT verification failing.

**Fix:**

1. Verify `AUTH0_CLIENT_SECRET` is identical in both apps
2. Check JWT expiration (`exp` claim)
3. Confirm cookie forwarding in CloudFront

### Issue 4: Static Assets 404

**Cause:** Incorrect `assetPrefix` or S3 upload path.

**Fix:**

1. Verify `assetPrefix: "/outreach-static"` in `next.config.mjs`
2. Check S3 bucket upload path matches CloudFront behavior
3. Confirm CloudFront behavior for `/outreach-static/*` points to S3

---

## Rollback Plan

If deployment fails:

### Rollback Outreach App

```bash
# List recent Lambda versions
aws lambda list-versions-by-function \
  --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop

# Publish alias to previous version
aws lambda update-alias \
  --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --name live \
  --function-version <previous-version>
```

### Rollback SleepConnect

```bash
cd sleepconnect
npx sst deploy --stage develop --rollback
```

---

## Monitoring

### Key Metrics

1. **Lambda Invocations**
   - Outreach Lambda invocations should increase
   - Check for errors/throttles

2. **CloudFront Cache Hit Rate**
   - Static assets should have high hit rate (>90%)
   - API routes should have low hit rate (caching disabled)

3. **Lambda Duration**
   - Cold starts: < 3 seconds
   - Warm starts: < 500ms

4. **Error Rates**
   - 4xx errors: < 1%
   - 5xx errors: < 0.1%

### CloudWatch Logs Insights Queries

**API Route Execution:**

```
fields @timestamp, @message
| filter @message like /TEMPLATES API/
| sort @timestamp desc
| limit 100
```

**Error Tracking:**

```
fields @timestamp, @message
| filter @message like /ERROR/ or @message like /Failed/
| sort @timestamp desc
| limit 50
```

---

## Summary Checklist

Before deploying to production:

- [ ] Update SleepConnect `OUTREACH_APP_URL` with deployed Outreach URL
- [ ] Verify SleepConnect `next.config.js` routes API calls through Outreach
- [ ] Confirm `AUTH0_CLIENT_SECRET` matches in both apps
- [ ] Deploy Outreach app using [deploy-outreach.cjs](../scripts/deploy-outreach.cjs)
- [ ] Deploy SleepConnect with updated configuration
- [ ] Test multi-zone API route execution
- [ ] Verify Lambda logs show `[TEMPLATES API] START`
- [ ] Confirm templates API returns data (not 400 error)
- [ ] Check CloudFront cache behaviors
- [ ] Monitor Lambda metrics for errors

**Most Important:** The fix we made locally (routing API calls through Outreach instead of direct to API Gateway) MUST be replicated in production SleepConnect configuration. The deployment script alone is NOT sufficient.

---

## Related Documentation

- [MULTI_ZONE_API_ROUTING_FIX.md](./MULTI_ZONE_API_ROUTING_FIX.md) - Detailed explanation of the fix
- [deploy-outreach.cjs](../scripts/deploy-outreach.cjs) - Outreach deployment script
- [LOCAL-DEV-QUICKSTART.md](./LOCAL-DEV-QUICKSTART.md) - Local development setup

---

**Last Updated:** December 16, 2025  
**Status:** ⚠️ Requires both Outreach AND SleepConnect deployment
