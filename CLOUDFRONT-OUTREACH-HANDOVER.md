# CloudFront Multi-Zone Outreach Integration - Handover Document

**Date:** 2025-12-22  
**Status:** UPDATED - basePath restored, CloudFront Function removal required  
**Issue:** `https://dev.mydreamconnect.com/outreach/conversations` returns blank page

---

## UPDATED SOLUTION (2025-12-22 22:38 UTC)

### ✅ Fixed: basePath Configuration Restored

The proper solution has been implemented:

1. **Restored `basePath: "/outreach"` in next.config.mjs**
   - Next.js now correctly handles `/outreach/*` routing with basePath
   - Templates button and other navigation now work correctly
   - Asset prefix updated to `/outreach/outreach-static` for proper asset loading

2. **CloudFront Function Removal Required** 
   - **Function:** `strip-outreach-prefix` (ARN: `arn:aws:cloudfront::597088017323:function/strip-outreach-prefix`)
   - **Distribution:** E2CJ0SW11QUMP8
   - **Behavior:** `/outreach/*`
   - **Action Required:** Disassociate this function from the `/outreach/*` behavior

3. **How It Works Now:**
   - CloudFront forwards `/outreach/conversations` AS-IS to Lambda
   - Next.js with `basePath: "/outreach"` handles the path correctly
   - No path manipulation needed at CloudFront level

---

## Required Actions to Complete Fix

### 🚨 CRITICAL: Remove CloudFront Function

The CloudFront Function `strip-outreach-prefix` must be **disassociated** from the `/outreach/*` behavior:

1. **Access AWS CloudFront Console**
   - Distribution ID: `E2CJ0SW11QUMP8`
   - Navigate to: Behaviors tab

2. **Edit `/outreach/*` Behavior**
   - Select the `/outreach/*` behavior
   - Click "Edit"
   - **Remove CloudFront Function association:**
     - Find "Function associations" section
     - Remove `strip-outreach-prefix` from "Viewer request" field
     - Leave blank or set to "None"

3. **Save and Deploy**
   - Click "Save changes"
   - Wait for deployment (2-5 minutes)

4. **Verify Fix**
   ```bash
   curl -v "https://dev.mydreamconnect.com/outreach/templates"
   # Should redirect to /outreach/templates correctly
   ```

### 📋 Updated next.config.mjs

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
	// Output standalone for OpenNext deployment
	output: "standalone",

	// Multi-zone configuration for sleepconnect integration
	// basePath restored - CloudFront now forwards /outreach/* AS-IS to Lambda
	// CloudFront Function 'strip-outreach-prefix' must be removed from /outreach/* behavior
	// Use /outreach-static for assets (handled by CloudFront S3 origin)
	basePath: "/outreach",
	assetPrefix: process.env.NODE_ENV === "production" ? "/outreach/outreach-static" : "",

	// ... rest of config
};
```

---

## Problem Summary

Multi-zone deployment where SleepConnect proxies `/outreach/*` to Outreach Lambda is returning empty responses (200 OK but 0 bytes).

### Root Cause Identified

1. **Lambda Function URL Host Header Issue** (RESOLVED)
   - Lambda function URLs reject requests where `Host` header doesn't match their domain
   - CloudFront was forwarding `Host: outreach-dev.mydreamconnect.com`
   - Lambda expected its own domain: `psiqwcczfy5q4bsmljhyycwnbi0ynixx.lambda-url.us-east-1.on.aws`
   - **Fix:** Updated Outreach CloudFront (E8BMOBRWCCCO2) to forward specific headers (NOT Host)

2. **Content Encoding Mismatch** (ATTEMPTED FIX)
   - CloudFront stripping response body: `x-amzn-remapped-content-length: 10842` but `content-length: 0`
   - Lambda returns `content-encoding: identity`
   - CloudFront behavior has `Compress: true` but cache policy has compression disabled
   - **Fix Attempted:** Disabled `Compress` on `/outreach/*` behavior in E2CJ0SW11QUMP8

3. **basePath Routing Conflict** (CURRENT FIX IN PROGRESS)
   - Outreach app has `basePath: "/outreach"` in next.config.mjs
   - CloudFront forwards full path: `/outreach/conversations`
   - Next.js with basePath expects path relative to basePath
   - Result: Next.js looks for `/outreach/outreach/conversations` (404)
   - **Fix In Progress:** Created CloudFront Function `strip-outreach-prefix` to strip `/outreach` before forwarding to Lambda

---

## Infrastructure Overview

### CloudFront Distributions

1. **Outreach Standalone** (E8BMOBRWCCCO2)
   - Domain: `outreach-dev.mydreamconnect.com`
   - Origin: Outreach Lambda URL
   - Status: ✅ WORKING (returns 200)
   - Headers: Now forwards specific headers (Accept, Authorization, Content-Type, etc.) - NOT Host

2. **SleepConnect Multi-Zone** (E2CJ0SW11QUMP8)
   - Domain: `dev.mydreamconnect.com`
   - Behaviors:
     - `/outreach/*` → Outreach Lambda (origin: `outreach-lambda-dev`)
     - `/outreach-static/*` → S3 assets
   - Status: ⏳ UPDATING - CloudFront Function being deployed
   - Current Issue: Empty response body despite 200 status

### Lambda Functions

- **Outreach Lambda:** `sax-lambda-us-east-1-0x-d-outreach-server_develop`
  - Function URL: `https://psiqwcczfy5q4bsmljhyycwnbi0ynixx.lambda-url.us-east-1.on.aws/`
  - IAM Role: `outreach-lambda-role-develop`
  - Status: ✅ Deployed successfully
  - Direct access: ✅ Works via function URL

- **SleepConnect Lambda:** `sax-lambda-us-east-1-0x-d-sleep-connect-server_develop`
  - Function URL: `https://cdsxyco4q2tkjxhkl7dohtabpu0prxfo.lambda-url.us-east-1.on.aws/`
  - Status: ✅ Working

---

## Changes Made This Session

### 1. SleepConnect Repository (`/home/dan/code/SAX/sleepconnect`)

**File:** `scripts/deploy-nextjs.cjs`

- Fixed JSON escaping for Lambda env var updates (use temp file instead of inline JSON)
- Added `os` module import

**File:** `lib/models/FormAssignment.ts`, `FormLink.ts`, `ZohoToken.ts`

- Changed from `AUTH_DYNAMODB_ID/AUTH_DYNAMODB_SECRET` to `AWS_KEY/AWS_PASS`

**Files:** `.github/workflows/deploy-develop.yml`, `deploy-production.yml`, `deploystagetesting.yml`

- Updated to use `AWS_KEY`/`AWS_PASS` from secrets instead of `AUTH_DYNAMODB_*`

### 2. Outreach Repository (`/home/dan/code/SAX/twilio-conversations-react`)

**File:** `scripts/deploy-outreach.cjs`

- Added `os` module import
- Added `outreachCloudfrontDistribution` config for each environment
  - develop: `E8BMOBRWCCCO2`
  - staging: TODO
  - production: TODO
- Fixed JSON escaping for Lambda env var updates (use temp file)
- Added Step 5.6: Check/fix CloudFront headers configuration
  - Removes `Cookie` from headers list (CloudFront doesn't allow it)
  - Forwards 8 specific headers (NOT Host)

**File:** `.env`

- Fixed syntax error: `arn:aws  :kms` → `arn:aws:kms` (line 56)
- Added Auth0 credentials (copied from SleepConnect):
  - `AUTH0_CLIENT_ID`
  - `AUTH0_CLIENT_SECRET`
  - `AUTH0_SECRET`
- Added Twilio credentials:
  - `TWILIO_ACCOUNT_SID`
  - `TWILIO_AUTH_TOKEN`
- Added `NEXT_PUBLIC_API_BASE_URL`

**Git Branch:** `001-sms-outreach-integration`

- Latest commit: Fixed CloudFront headers config and env var JSON escaping

### 3. AWS CloudFront Changes

**Distribution E8BMOBRWCCCO2** (outreach-dev.mydreamconnect.com):

- ✅ Updated forwarded headers from `["*"]` to specific list (8 headers, NO Host, NO Cookie)
- Status: Deployed

**Distribution E2CJ0SW11QUMP8** (dev.mydreamconnect.com):

- ✅ Disabled `Compress` on `/outreach/*` behavior
- ✅ Created CloudFront Function: `strip-outreach-prefix`
  - ARN: `arn:aws:cloudfront::597088017323:function/strip-outreach-prefix`
  - Purpose: Strip `/outreach` prefix before forwarding to Lambda origin
  - Status: Published and associated with `/outreach/*` behavior
- ⏳ Status: InProgress (last update at 21:59 UTC)

---

## Current State

### What's Working ✅

- `https://outreach-dev.mydreamconnect.com/` returns 200 with content
- Outreach Lambda deployment succeeds
- SleepConnect `/outreach/*` routing configured
- CloudFront → Lambda connection established

### What's Not Working ❌

- `https://dev.mydreamconnect.com/outreach/conversations` returns 200 but empty body
- Response headers show `x-amzn-remapped-content-length: 10842` but `content-length: 0`

### What's Pending ⏳

- CloudFront distribution E2CJ0SW11QUMP8 updating (ETA: 2-5 minutes from 21:59 UTC)
- Need to invalidate cache after deployment completes
- Need to test `/outreach/conversations` after CloudFront deploys

---

## Next Steps (Priority Order)

1. **Wait for CloudFront deployment** (~3-5 min from 21:59 UTC)

   ```bash
   aws cloudfront get-distribution --id E2CJ0SW11QUMP8 | jq -r '.Distribution.Status'
   # Wait until: "Deployed"
   ```

2. **Invalidate cache**

   ```bash
   aws cloudfront create-invalidation \
     --distribution-id E2CJ0SW11QUMP8 \
     --paths "/outreach/*"
   ```

3. **Test the multi-zone URL**

   ```bash
   curl -v "https://dev.mydreamconnect.com/outreach/conversations" 2>&1 | head -50
   # Should see HTML content, not empty response
   ```

4. **If still failing:** Check CloudFront Function logs

   ```bash
   # The function should be stripping /outreach from the path
   # Request: /outreach/conversations → Lambda receives: /conversations
   ```

5. **Alternative Fix (if CloudFront Function doesn't work):**
   - Remove `basePath: "/outreach"` from `next.config.mjs`
   - Redeploy Outreach Lambda
   - This makes the app run at root, CloudFront handles all routing

---

## Testing Commands

### Test Outreach standalone

```bash
curl -I "https://outreach-dev.mydreamconnect.com/"
# Should return: HTTP/2 200
```

### Test multi-zone routing

```bash
curl -v "https://dev.mydreamconnect.com/outreach/conversations"
# Should return: HTTP/2 200 with HTML content
```

### Test Lambda directly

```bash
curl -I "https://psiqwcczfy5q4bsmljhyycwnbi0ynixx.lambda-url.us-east-1.on.aws/"
# Should return: HTTP/1.1 200
```

### Check CloudFront status

```bash
aws cloudfront get-distribution --id E2CJ0SW11QUMP8 | jq -r '.Distribution.Status'
```

---

## Configuration Reference

### Outreach next.config.mjs

```javascript
basePath: "/outreach",
assetPrefix: process.env.NODE_ENV === "production" ? "/outreach-static" : "/outreach",
```

### CloudFront Function (strip-outreach-prefix)

```javascript
function handler(event) {
    var request = event.request;
    var uri = request.uri;
    
    if (uri.startsWith('/outreach')) {
        request.uri = uri.substring(9);
        if (request.uri === '') {
            request.uri = '/';
        }
    }
    
    return request;
}
```

### Environment Variables (Outreach .env)

```bash
AUTH0_CLIENT_ID=your_auth0_client_id
AUTH0_CLIENT_SECRET=your_auth0_client_secret
AUTH0_SECRET=your_auth0_secret
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
NEXT_PUBLIC_API_BASE_URL=https://develop-api.mydreamconnect.com/develop
```

---

## Deployment Commands

### Deploy Outreach

```bash
cd /home/dan/code/SAX/twilio-conversations-react
set -a && source .env && set +a
./scripts/deploy-outreach.cjs
```

### Deploy SleepConnect

```bash
cd /home/dan/code/SAX/sleepconnect
# Via GitHub Actions (preferred)
git push origin dev
```

---

## Known Issues & Resolutions

1. **Issue:** `x-amzn-remapped-content-length` shows content but body is empty
   - **Cause:** CloudFront stripping response body due to encoding mismatch
   - **Attempted:** Disabled Compress, still investigating
   - **Current Fix:** CloudFront Function to strip basePath prefix

2. **Issue:** Lambda env var update failed with JSON parsing error
   - **Resolution:** Changed from inline JSON to temp file with `--cli-input-json`

3. **Issue:** Cookie header not allowed in CloudFront forwarded headers
   - **Resolution:** Removed from headers list (cookies handled via ForwardedValues.Cookies)

---

## Contact/References

- SleepConnect CloudFront: E2CJ0SW11QUMP8
- Outreach CloudFront: E8BMOBRWCCCO2
- Outreach Lambda: sax-lambda-us-east-1-0x-d-outreach-server_develop
- Git Branch: 001-sms-outreach-integration

**Last Updated:** 2025-12-22 22:00 UTC
