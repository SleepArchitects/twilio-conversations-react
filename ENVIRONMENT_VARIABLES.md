# Environment Variables — Twilio Conversations React (Outreach)

Scope: Outreach Next.js app and its AWS/OpenNext deployment. SleepConnect backend variables in `.env` (RDS, DynamoDB, SES, etc.) are not consumed by this app and are documented in the SleepConnect repo.

## Quick URLs by Environment

| Env        | App URL (`NEXT_PUBLIC_APP_BASE_URL`)          | REST API (`API_BASE_URL`/`NEXT_PUBLIC_API_BASE_URL`) | WebSocket (`NEXT_PUBLIC_WS_API_URL`)           | SleepConnect shell (`NEXT_PUBLIC_SLEEPCONNECT_URL`) | Base path   |
| ---------- | --------------------------------------------- | ---------------------------------------------------- | ---------------------------------------------- | --------------------------------------------------- | ----------- |
| Develop    | `https://outreach-dev.mydreamconnect.com`     | `https://outreach-api-dev.mydreamconnect.com`        | `wss://outreach-ws-dev.mydreamconnect.com`     | `https://dev.mydreamconnect.com`                    | `/outreach` |
| Staging    | `https://outreach-staging.mydreamconnect.com` | `https://outreach-api-staging.mydreamconnect.com`    | `wss://outreach-ws-staging.mydreamconnect.com` | `https://stage.mydreamconnect.com`                  | `/outreach` |
| Production | `https://outreach.mydreamconnect.com`         | `https://outreach-api.mydreamconnect.com`            | `wss://outreach-ws.mydreamconnect.com`         | `https://mydreamconnect.com`                        | `/outreach` |

### Local development defaults

- `NEXT_PUBLIC_APP_BASE_URL=http://localhost:3001`
- `NEXT_PUBLIC_SLEEPCONNECT_URL=http://localhost:3000`
- `NEXT_PUBLIC_API_BASE_URL=https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev`
- `NEXT_PUBLIC_WS_API_URL=wss://outreach-ws-dev.mydreamconnect.com`
- Run Outreach on port `3001` and SleepConnect on `3000`.

## Build-time variables (set in `.env.local` and GitHub Actions secrets)

| Variable                            | Required | Purpose                                    | Example (develop)                             |
| ----------------------------------- | :------: | ------------------------------------------ | --------------------------------------------- |
| `NEXT_PUBLIC_APP_BASE_URL`          |   Yes    | Public app URL used by links and redirects | `https://outreach-dev.mydreamconnect.com`     |
| `NEXT_PUBLIC_SLEEPCONNECT_URL`      |   Yes    | SleepConnect shell URL for redirects       | `https://dev.mydreamconnect.com`              |
| `NEXT_PUBLIC_BASE_PATH`             |   Yes    | Base path for multi-zone routing           | `/outreach`                                   |
| `NEXT_PUBLIC_API_BASE_URL`          |   Yes    | REST API base URL (client)                 | `https://outreach-api-dev.mydreamconnect.com` |
| `NEXT_PUBLIC_WS_API_URL`            |   Yes    | WebSocket endpoint for real-time updates   | `wss://outreach-ws-dev.mydreamconnect.com`    |
| `NEXT_PUBLIC_SHOW_BANNER`           |    No    | Toggle marketing banner                    | `false`                                       |
| `NEXT_PUBLIC_BANNER_LOGO`           |    No    | Banner logo key                            | `moonplus`                                    |
| `NEXT_PUBLIC_BANNER_LINK`           |    No    | Banner href                                | `/bot`                                        |
| `NEXT_PUBLIC_BANNER_TEXT`           |    No    | Banner copy                                | `Meet Alora`                                  |
| `NEXT_PUBLIC_PRACTICE_NAME`         |    No    | Default practice name fallback             | `Sleep Architects`                            |
| `NEXT_PUBLIC_ENABLE_SLA_MONITORING` |    No    | Enable SLA UI                              | `true`                                        |

| `NEXT_PUBLIC_ALLOW_INTERNATIONAL_PHONES` | No | Allow international phone input | `false` |

## Runtime variables (Lambda / server-side)

| Variable          | Required | Purpose                                             | Example (develop) |
| ----------------- | :------: | --------------------------------------------------- | ----------------- |
| `NODE_ENV`        |   Yes    | Execution environment                               | `production`      |
| `MULTI_ZONE_MODE` |   Yes    | Enable multi-zone auth (read JWT from SleepConnect) | `true`            |
| `AUTH0_SECRET`    |   Yes    | Shared secret for JWT verification                  | `***`             |

| `AUTH0_CLIENT_SECRET` | Yes | Same as `AUTH0_SECRET` (alias) | `***` |
| `AUTH0_CLIENT_ID` | Yes | Auth0 client ID | `***` |
| `AUTH0_DOMAIN` | Yes | Auth0 domain | `sleeparchitects.us.auth0.com` |
| `AUTH0_ISSUER_BASE_URL` | Yes | Auth0 issuer URL | `https://sleeparchitects.us.auth0.com` |
| `AUTH0_BASE_URL` | Yes | Callback base (must match SleepConnect) | `https://dev.mydreamconnect.com/outreach` |
| `API_BASE_URL` | Yes | REST API base URL (server-side) | `https://outreach-api-dev.mydreamconnect.com` |
| `WS_API_URL` | No | WebSocket alias used by deploy script | `wss://outreach-ws-dev.mydreamconnect.com` |
| `TWILIO_ACCOUNT_SID` | Yes | Twilio account SID | `AC...` |
| `TWILIO_AUTH_TOKEN` | Yes | Twilio auth token | `***` |
| `TWILIO_MESSAGING_SERVICE_SID` | Yes | Messaging service SID | `MG...` |
| `TWILIO_FROM_NUMBER` | No | Default sender number if needed | `+18778650928` |
| `ENABLE_SLA_MONITORING` | No | Enable SLA processing on server | `true` |
| `ALLOW_INTERNATIONAL_PHONES` | No | Server-side toggle for phone validation | `false` |

## Deployment script helpers (optional)

| Variable                                  | Purpose                                                       | When used                                                          |
| ----------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------ |
| `FUNCTION_URL`                            | Override Lambda Function URL for asset uploads/invalidation   | Only for legacy function-url deployments; custom domains preferred |
| `SLEEPCONNECT_CLOUDFRONT_DISTRIBUTION_ID` | CloudFront ID for cache invalidation in `deploy-outreach.cjs` | Optional; if empty, invalidation is skipped                        |

## GitHub Actions secrets (mirrors build/runtime needs)

- `APP_BASE_URL`, `SLEEPCONNECT_URL`, `API_BASE_URL`, `WS_API_URL`
- `AUTH0_CLIENT_SECRET`, `AUTH0_CLIENT_ID`, `AUTH0_DOMAIN`, `AUTH0_BASE_URL`
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID`
- `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`

## Deprecated / not used by Outreach

- `REACT_APP_ACCESS_TOKEN_SERVICE_URL` — legacy demo token service; do not set.
- SleepConnect backend values in `.env` (e.g., `DYNAMODB_TABLE`, `HOST`, `SES_FROM_EMAIL`, `SAX_COMPANY`, `SST_STAGE`, `FORMS_BASE_URL`) are maintained for the SleepConnect app and not read by this Outreach codebase.

---

## Dev Merge Readiness Checklist

**Goal**: Ensure SleepConnect + Outreach multi-zone integration works when deploying to `develop` environment via GitHub Actions.

### Pre-Merge: Infrastructure Verification

#### 1. AWS Lambda (Outreach)

- [ ] Lambda function exists: `sax-lambda-us-east-1-0x-d-outreach-server_develop`
- [ ] Lambda Function URL created (or custom domain configured)
- [ ] Lambda has execution role with S3/CloudWatch permissions
- [ ] Test Lambda directly:

  ```bash
  aws lambda invoke \
    --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop \
    --region us-east-1 \
    /tmp/response.json && cat /tmp/response.json
  ```

#### 2. S3 Assets Bucket (Outreach)

- [ ] Bucket exists: `sax-nextjs-us-east-1-develop-outreach-assets`
- [ ] Bucket has versioning enabled
- [ ] Bucket has public access blocked
- [ ] Bucket policy allows CloudFront OAC access
- [ ] Test bucket access:

  ```bash
  aws s3 ls s3://sax-nextjs-us-east-1-develop-outreach-assets/
  ```

#### 3. CloudFront Distribution (SleepConnect)

- [ ] SleepConnect CloudFront exists: `E2CJ0SW11QUMP8` (or current ID)
- [ ] Origin exists for Outreach custom domain: `outreach-dev.mydreamconnect.com`
- [ ] Origin exists for Outreach S3 assets: `sax-nextjs-us-east-1-develop-outreach-assets`
- [ ] Behavior exists: `/outreach/*` → Outreach custom domain origin
- [ ] Behavior exists: `/outreach-static/*` → S3 assets origin with OAC
- [ ] Test CloudFront behaviors:

  ```bash
  curl -I https://dev.mydreamconnect.com/outreach
  curl -I https://dev.mydreamconnect.com/outreach-static/_next/static/test.js
  ```

#### 4. Custom Domains (Recommended)

- [ ] Custom domain configured: `outreach-dev.mydreamconnect.com` → CloudFront
- [ ] Custom domain configured: `outreach-api-dev.mydreamconnect.com` → API Gateway
- [ ] Custom domain configured: `outreach-ws-dev.mydreamconnect.com` → WebSocket API Gateway
- [ ] ACM certificate issued and validated (covers all 3 subdomains)
- [ ] Route53 DNS records created (A/CNAME)
- [ ] Test custom domains:

  ```bash
  curl -I https://outreach-dev.mydreamconnect.com/outreach
  curl -I https://outreach-api-dev.mydreamconnect.com/health
  wscat -c wss://outreach-ws-dev.mydreamconnect.com
  ```

#### 5. Backend API Gateway (Must be deployed first)

- [ ] REST API deployed: `https://outreach-api-dev.mydreamconnect.com` (or `0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev`)
- [ ] WebSocket API deployed: `wss://outreach-ws-dev.mydreamconnect.com`
- [ ] Test backend health:

  ```bash
  curl https://outreach-api-dev.mydreamconnect.com/health
  # Should return 200, not 404 or 502
  ```

### Pre-Merge: SleepConnect Configuration

**SleepConnect must be configured and deployed BEFORE deploying Outreach** to enable multi-zone integration.

#### 5A. SleepConnect Code Configuration

- [ ] `next.config.js` has `/outreach/*` rewrite configured:

  ```javascript
  async rewrites() {
    const outreachUrl = process.env.OUTREACH_APP_URL || 'http://localhost:3001';
    return {
      beforeFiles: [
        {
          source: '/outreach/:path*',
          destination: `${outreachUrl}/outreach/:path*`,
        },
      ],
    };
  }
  ```

- [ ] Middleware forwards JWT cookies to Outreach (if custom implementation exists)

#### 5B. SleepConnect Lambda Environment Variables

Check SleepConnect Lambda has `OUTREACH_APP_URL` set:

```bash
aws lambda get-function-configuration \
  --function-name sax-lambda-us-east-1-0x-d-sleep-connect-server_develop \
  --region us-east-1 \
  --query 'Environment.Variables.OUTREACH_APP_URL'
```

- [ ] `OUTREACH_APP_URL=https://outreach-dev.mydreamconnect.com` (custom domain)
  - OR: `OUTREACH_APP_URL=<lambda-function-url>` (if not using custom domain)

**If missing or incorrect**, update SleepConnect Lambda:

```bash
aws lambda update-function-configuration \
  --function-name sax-lambda-us-east-1-0x-d-sleep-connect-server_develop \
  --region us-east-1 \
  --environment "Variables={OUTREACH_APP_URL=https://outreach-dev.mydreamconnect.com,...<other-vars>}"
```

**Or redeploy SleepConnect**:

```bash
cd ~/code/SAX/sleepconnect
OUTREACH_APP_URL="https://outreach-dev.mydreamconnect.com" node scripts/deploy-nextjs.cjs develop
```

#### 5C. SleepConnect CloudFront Origins & Behaviors

**Add Outreach UI Origin** (if not exists):

```bash
# Get CloudFront distribution config
aws cloudfront get-distribution-config \
  --id E2CJ0SW11QUMP8 \
  --region us-east-1 > /tmp/cloudfront-config.json
```

Check/Add origins:

- [ ] Origin for Outreach UI: `outreach-dev.mydreamconnect.com` (custom domain)
  - OR: Lambda Function URL domain (e.g., `abc123.lambda-url.us-east-1.on.aws`)
- [ ] Origin for Outreach S3 assets: `sax-nextjs-us-east-1-develop-outreach-assets.s3.us-east-1.amazonaws.com`

**Add/Verify Cache Behaviors**:

- [ ] Path pattern `/outreach/*` → Outreach UI origin
  - Viewer protocol: Redirect HTTP to HTTPS
  - Allowed methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
  - Cache policy: CachingDisabled (or appropriate SSR policy)
  - Origin request policy: AllViewer
  - Forward cookies: All

- [ ] Path pattern `/outreach-static/*` → S3 assets origin
  - Viewer protocol: Redirect HTTP to HTTPS
  - Allowed methods: GET, HEAD, OPTIONS
  - Cache policy: CachingOptimized
  - Compress: Yes
  - TTL: 31536000 (1 year)

**Configure S3 Bucket Policy for CloudFront OAC**:

```bash
# Create/update bucket policy to allow CloudFront OAC
cat > /tmp/outreach-assets-policy.json <<EOF
{
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
        "AWS:SourceArn": "arn:aws:cloudfront::597088017323:distribution/E2CJ0SW11QUMP8"
      }
    }
  }]
}
EOF

aws s3api put-bucket-policy \
  --bucket sax-nextjs-us-east-1-develop-outreach-assets \
  --policy file:///tmp/outreach-assets-policy.json
```

- [ ] S3 bucket policy allows CloudFront OAC access
- [ ] Origin Access Control (OAC) created and assigned to S3 origin

#### 5D. SleepConnect GitHub Actions Secrets (if using CI/CD)

Verify in SleepConnect repo: **Settings → Secrets and variables → Actions**

- [ ] `OUTREACH_APP_URL_DEVELOP` = `https://outreach-dev.mydreamconnect.com`
  - OR: Add to workflow YAML directly (see SleepConnect's `.github/workflows/deploy-develop.yml`)

#### 5E. SleepConnect Deployment

**Deploy SleepConnect with Outreach integration**:

```bash
cd ~/code/SAX/sleepconnect

# Option 1: Deploy via script with OUTREACH_APP_URL
OUTREACH_APP_URL="https://outreach-dev.mydreamconnect.com" node scripts/deploy-nextjs.cjs develop

# Option 2: Trigger GitHub Actions workflow (if configured)
# Go to Actions → Deploy Develop → Run workflow
```

**Verify SleepConnect deployment**:

```bash
# Test SleepConnect loads
curl -I https://dev.mydreamconnect.com

# Test proxy to Outreach (will fail until Outreach is deployed, but should not 404)
curl -I https://dev.mydreamconnect.com/outreach
# Expected: 502 (bad gateway) or 200, NOT 404
```

- [ ] SleepConnect deployed successfully
- [ ] `/outreach/*` proxy configured (may return 502 until Outreach deployed)
- [ ] `/outreach-static/*` serves from S3 (may return 404 until assets uploaded)

### Pre-Merge: Environment Variables (Outreach)

#### 6. GitHub Actions Secrets (Outreach Repo)

Verify all secrets are set in: **Settings → Secrets and variables → Actions**

**Build-time secrets** (used during `npm run build`):

- [ ] `APP_BASE_URL` = `https://outreach-dev.mydreamconnect.com`
- [ ] `SLEEPCONNECT_URL` = `https://dev.mydreamconnect.com`
- [ ] `API_BASE_URL` = `https://outreach-api-dev.mydreamconnect.com`
- [ ] `WS_API_URL` = `wss://outreach-ws-dev.mydreamconnect.com`

**Runtime secrets** (set on Lambda during deployment):

- [ ] `AUTH0_CLIENT_SECRET` = `<shared-with-sleepconnect>`
- [ ] `AUTH0_CLIENT_ID` = `<shared-with-sleepconnect>`
- [ ] `AUTH0_DOMAIN` = `sleeparchitects.us.auth0.com`
- [ ] `AUTH0_BASE_URL` = `https://dev.mydreamconnect.com/outreach`
- [ ] `TWILIO_ACCOUNT_SID` = `AC...`
- [ ] `TWILIO_AUTH_TOKEN` = `<token>`
- [ ] `TWILIO_MESSAGING_SERVICE_SID` = `MG...`

**AWS credentials**:

- [ ] `AWS_ACCESS_KEY_ID` = `<deploy-user-key>`
- [ ] `AWS_SECRET_ACCESS_KEY` = `<deploy-user-secret>`

**Optional**:

- [ ] `SLEEPCONNECT_CLOUDFRONT_DISTRIBUTION_ID` = `E2CJ0SW11QUMP8` (for cache invalidation)

#### 7. Lambda Environment Variables (Outreach)

These should match the runtime secrets and be set automatically by the deploy script, but verify:

```bash
aws lambda get-function-configuration \
  --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --region us-east-1 \
  --query 'Environment.Variables'
```

Expected variables:

- [ ] `NODE_ENV=production`
- [ ] `MULTI_ZONE_MODE=true`
- [ ] `AUTH0_SECRET=<same as SleepConnect>`

- [ ] `AUTH0_CLIENT_SECRET=<same as SleepConnect>`
- [ ] `AUTH0_CLIENT_ID=<same as SleepConnect>`
- [ ] `AUTH0_DOMAIN=sleeparchitects.us.auth0.com`
- [ ] `AUTH0_ISSUER_BASE_URL=https://sleeparchitects.us.auth0.com`
- [ ] `AUTH0_BASE_URL=https://dev.mydreamconnect.com/outreach`
- [ ] `API_BASE_URL=https://outreach-api-dev.mydreamconnect.com`
- [ ] `TWILIO_ACCOUNT_SID=AC...`
- [ ] `TWILIO_AUTH_TOKEN=<token>`
- [ ] `TWILIO_MESSAGING_SERVICE_SID=MG...`
- [ ] `NEXT_PUBLIC_WS_API_URL=wss://outreach-ws-dev.mydreamconnect.com`
- [ ] `NEXT_PUBLIC_API_BASE_URL=https://outreach-api-dev.mydreamconnect.com`
- [ ] `NEXT_PUBLIC_APP_BASE_URL=https://dev.mydreamconnect.com`
- [ ] `NEXT_PUBLIC_SLEEPCONNECT_URL=https://dev.mydreamconnect.com`
- [ ] `NEXT_PUBLIC_BASE_PATH=/outreach`

#### 8. SleepConnect Environment Variables

SleepConnect must know where to proxy `/outreach/*` requests:

**Check SleepConnect Lambda env vars**:

```bash
aws lambda get-function-configuration \
  --function-name sax-lambda-us-east-1-0x-d-sleep-connect-server_develop \
  --region us-east-1 \
  --query 'Environment.Variables.OUTREACH_APP_URL'
```

- [ ] `OUTREACH_APP_URL=https://outreach-dev.mydreamconnect.com` (or Lambda Function URL if not using custom domain)

**If missing**, redeploy SleepConnect with:

```bash
cd ~/code/SAX/sleepconnect
OUTREACH_APP_URL="https://outreach-dev.mydreamconnect.com" node scripts/deploy-nextjs.cjs develop
```

#### 9. SleepConnect CloudFront Configuration

- [ ] SleepConnect `next.config.js` has rewrites for `/outreach/*` (should already exist)
- [ ] CloudFront has origin for `outreach-dev.mydreamconnect.com`
- [ ] CloudFront has origin for `sax-nextjs-us-east-1-develop-outreach-assets` S3 bucket
- [ ] CloudFront OAC configured for S3 bucket access
- [ ] S3 bucket policy updated to allow CloudFront OAC

### Deployment: GitHub Actions Workflow

#### 10. Trigger Manual Deployment

1. Go to: **Actions → Deploy to AWS with OpenNext → Run workflow**
2. Select branch: `001-sms-outreach-integration` (or `develop` after merge)
3. Select environment: `dev`
4. Click **Run workflow**

#### 11. Monitor Deployment

Watch the workflow execution:

- [ ] **Install dependencies** - completes successfully
- [ ] **Run tests** - all tests pass (or continue-on-error)
- [ ] **Build with OpenNext** - `.open-next/` directory created
- [ ] **Deploy to AWS** - Lambda updated, S3 assets uploaded
- [ ] **Create deployment summary** - workflow completes with summary

**Check CloudWatch Logs** during/after deployment:

```bash
aws logs tail /aws/lambda/sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --follow \
  --region us-east-1
```

Look for:

- [ ] No errors in Lambda logs
- [ ] Requests being processed
- [ ] JWT validation succeeding

### Post-Deployment: Integration Testing

#### 12. Test Multi-Zone Access

**Via SleepConnect proxy** (recommended flow):

```bash
# Should redirect to login if not authenticated
open https://dev.mydreamconnect.com/outreach/conversations

# After login, should load Outreach app
```

Expected flow:

1. User redirected to Auth0 login (if not logged in)
2. After login, redirected back to `/outreach/conversations`
3. Middleware validates `x-sax-user-context` cookie
4. AuthGuard verifies session on client
5. Application loads successfully

#### 13. Test Static Assets

- [ ] Open browser DevTools → Network tab
- [ ] Navigate to `https://dev.mydreamconnect.com/outreach/conversations`
- [ ] Verify all `/_next/static/*` and `/outreach-static/*` assets load (200 status)
- [ ] Check asset URLs use `/outreach-static/` prefix
- [ ] Verify assets served from CloudFront (check `x-cache` header)

#### 14. Test API Integration

- [ ] Open conversation in UI
- [ ] Verify messages load (REST API call succeeds)
- [ ] Send a test message
- [ ] Verify WebSocket connection established (DevTools → WS tab)
- [ ] Verify real-time updates work

**Manual API tests**:

```bash
# Test REST API (requires auth token)
curl -H "Authorization: Bearer <token>" \
  https://outreach-api-dev.mydreamconnect.com/outreach/conversations

# Test WebSocket (requires wscat)
wscat -c wss://outreach-ws-dev.mydreamconnect.com
```

#### 15. Test Authentication Flow

- [ ] Clear cookies (incognito mode)
- [ ] Navigate to `https://dev.mydreamconnect.com/outreach`
- [ ] Verify redirect to SleepConnect login
- [ ] Log in with test credentials
- [ ] Verify redirect back to `/outreach` after login
- [ ] Verify user context appears in UI (name, practice)

#### 16. Test SLA Monitoring (if enabled)

- [ ] Send inbound SMS to Twilio number
- [ ] Verify conversation appears with SLA timer
- [ ] Verify status shows "Warning" or "Critical" based on time
- [ ] Send reply
- [ ] Verify SLA status changes to "OK"

### Rollback Plan (If Deployment Fails)

#### 17. Quick Rollback Steps

If deployment fails or breaks existing functionality:

**Option A: Revert Lambda to previous version**

```bash
# List Lambda versions
aws lambda list-versions-by-function \
  --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --region us-east-1

# Update alias to previous version
aws lambda update-alias \
  --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --name develop \
  --function-version <PREVIOUS_VERSION> \
  --region us-east-1
```

**Option B: Restore S3 assets from previous version**

```bash
# List S3 object versions
aws s3api list-object-versions \
  --bucket sax-nextjs-us-east-1-develop-outreach-assets \
  --prefix outreach-static/

# Restore specific version (if needed)
aws s3api copy-object \
  --bucket sax-nextjs-us-east-1-develop-outreach-assets \
  --copy-source "sax-nextjs-us-east-1-develop-outreach-assets/path/to/file?versionId=VERSION_ID" \
  --key path/to/file
```

**Option C: Re-run previous successful workflow**

- Go to Actions → Find last successful deployment
- Click "Re-run all jobs"

### Success Criteria

All of the following must pass:

- [ ] GitHub Actions workflow completes successfully
- [ ] No errors in CloudWatch Logs
- [ ] Multi-zone access works: `https://dev.mydreamconnect.com/outreach` loads
- [ ] Static assets load correctly (no 404s)
- [ ] API calls succeed (conversations load)
- [ ] WebSocket connects and real-time updates work
- [ ] Authentication flow works (login → redirect back)
- [ ] JWT validation succeeds (no auth errors in logs)
- [ ] User context appears correctly in UI

### Common Issues & Fixes

**Issue**: 404 on `/outreach` routes

- **Fix**: Check `OUTREACH_APP_URL` is set on SleepConnect Lambda; redeploy SleepConnect

**Issue**: 404 on static assets (`/outreach-static/*`)

- **Fix**: Verify CloudFront behavior exists for `/outreach-static/*` → S3 bucket; check S3 bucket policy allows CloudFront OAC

**Issue**: CORS errors on API calls

- **Fix**: Verify API Gateway CORS configuration includes `https://dev.mydreamconnect.com`; check custom domain is configured

**Issue**: Authentication fails (redirect loop)

- **Fix**: Verify `AUTH0_CLIENT_SECRET` matches between SleepConnect and Outreach; check `x-sax-user-context` cookie is being set by SleepConnect

**Issue**: WebSocket connection fails

- **Fix**: Verify `NEXT_PUBLIC_WS_API_URL` is correct; check WebSocket API Gateway is deployed and custom domain is configured

**Issue**: Lambda 500 errors

- **Fix**: Check CloudWatch Logs for error details; verify all environment variables are set on Lambda; check OpenNext build completed successfully

### Documentation References

- **Environment Variables**: This file (ENVIRONMENT_VARIABLES.md)
- **Custom Domains**: `DOCUMENTATION-UPDATE-SUMMARY.md`, SleepConnect's `OUTREACH-CUSTOM-DOMAIN-SETUP.md`
- **Deployment Guide**: `AWS-DEPLOYMENT-GUIDE.md`, `AWS-PRE-DEPLOYMENT-SETUP.md`
- **Multi-Zone Integration**: `MULTI-ZONE-DEPLOYMENT-GUIDE.md`, `DEPLOYMENT-HANDOVER.md`
- **Authentication**: `docs/AUTHENTICATION.md`
- **SleepConnect Setup**: `~/code/SAX/sleepconnect/DEPLOY-MULTI-ZONE-OUTREACH.md`

---

**Ready to Deploy?** Complete checklist items 1-9, then trigger GitHub Actions (item 10). Monitor deployment (item 11), run integration tests (items 12-16), and verify success criteria.
