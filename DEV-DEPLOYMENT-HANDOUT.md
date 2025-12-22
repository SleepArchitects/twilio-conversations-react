# Dev Deployment Handout — Multi-Zone Integration

**Date**: December 22, 2025  
**Objective**: Deploy SleepConnect (via GitHub Actions) and Outreach (manual) to `develop` environment with full multi-zone integration.  
**Audience**: AI agent or engineer executing the deployment

---

## Overview

This deployment integrates two Next.js applications:
- **SleepConnect** (main app) at `https://dev.mydreamconnect.com`
- **Outreach** (SMS zone) at `https://dev.mydreamconnect.com/outreach`

SleepConnect proxies `/outreach/*` requests to Outreach Lambda, creating a seamless multi-zone experience.

---

## Prerequisites

### Required Tools
- AWS CLI configured with appropriate credentials (`aws configure`)
- Node.js 18+ and pnpm/npm installed
- Access to both repositories:
  - `~/code/SAX/sleepconnect`
  - `~/code/SAX/twilio-conversations-react`
- GitHub repository access with ability to trigger workflows

### Required Credentials
- AWS Account ID: `597088017323`
- Auth0 tenant: `sleeparchitects.us.auth0.com`
- Twilio Account SID and Auth Token
- GitHub Actions permissions for both repos

---

## Phase 1: Verify Infrastructure (15-20 min)

### 1.1 Outreach Lambda Function
```bash
# Check if Lambda exists
aws lambda get-function \
  --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --region us-east-1

# If not found, create placeholder:
cd ~/code/SAX/twilio-conversations-react
# Follow AWS-PRE-DEPLOYMENT-SETUP.md Step 3
```

**Expected**: Lambda exists or can be created.

### 1.2 Outreach S3 Assets Bucket
```bash
# Check if bucket exists
aws s3 ls s3://sax-nextjs-us-east-1-develop-outreach-assets/

# If not found, create:
aws s3 mb s3://sax-nextjs-us-east-1-develop-outreach-assets --region us-east-1
aws s3api put-bucket-versioning \
  --bucket sax-nextjs-us-east-1-develop-outreach-assets \
  --versioning-configuration Status=Enabled
aws s3api put-public-access-block \
  --bucket sax-nextjs-us-east-1-develop-outreach-assets \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true"
```

**Expected**: Bucket exists with versioning and public access blocked.

### 1.3 SleepConnect CloudFront Distribution
```bash
# Find SleepConnect CloudFront ID
aws cloudfront list-distributions \
  --query "DistributionList.Items[?contains(Aliases.Items, 'dev.mydreamconnect.com')].Id" \
  --output text

# Should return: E2CJ0SW11QUMP8 or similar
```

**Expected**: CloudFront distribution ID found. Save this as `CLOUDFRONT_DIST_ID`.

### 1.4 Backend API Gateway (Must exist)
```bash
# Test REST API
curl -I https://outreach-api-dev.mydreamconnect.com/health
# OR (if custom domain not set up):
curl -I https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev/health

# Test WebSocket API
wscat -c wss://outreach-ws-dev.mydreamconnect.com
# OR:
wscat -c wss://vfb5l5uxak.execute-api.us-east-1.amazonaws.com/dev
```

**Expected**: REST API returns 200 or 401 (not 404). WebSocket connects.

**If APIs don't exist**: Deploy backend APIs first from SleepConnect lambdas directory.

---

## Phase 2: Configure SleepConnect (20-30 min)

### 2.1 Verify SleepConnect Code Configuration

```bash
cd ~/code/SAX/sleepconnect

# Check next.config.js has rewrites
grep -A 10 "async rewrites" next.config.js
```

**Expected**: Should see `/outreach/:path*` rewrite using `OUTREACH_APP_URL`.

**If missing**, add to `next.config.js`:
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

### 2.2 Configure SleepConnect GitHub Actions Secrets

Go to: **sleepconnect repo → Settings → Secrets and variables → Actions**

Verify these secrets exist (or add them):
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AUTH0_CLIENT_SECRET`
- `AUTH0_CLIENT_ID`
- Other SleepConnect deployment secrets

Check `.github/workflows/deploy-develop.yml` for required secrets list.

### 2.3 Verify SleepConnect Workflow has OUTREACH_APP_URL

```bash
cd ~/code/SAX/sleepconnect

# Check if OUTREACH_APP_URL is in the workflow
grep -n "OUTREACH_APP_URL" .github/workflows/deploy-develop.yml
```

**Expected**: Line 105 with `OUTREACH_APP_URL: https://outreach-dev.mydreamconnect.com`

**Status**: ✅ Already configured (added Dec 19, 2025). The deployment script (`scripts/deploy-nextjs.cjs`) automatically reads this env var and updates the Lambda function configuration at Step 5.5.

### 2.4 Configure CloudFront for Outreach

#### Check Current Origins
```bash
CLOUDFRONT_DIST_ID="E2CJ0SW11QUMP8"  # Replace with actual ID from step 1.3

aws cloudfront get-distribution-config \
  --id $CLOUDFRONT_DIST_ID \
  --region us-east-1 \
  --query 'DistributionConfig.Origins.Items[*].[Id,DomainName]' \
  --output table
```

**Check for**:
- Origin with domain: `outreach-dev.mydreamconnect.com` (or Lambda Function URL)
- Origin with domain: `sax-nextjs-us-east-1-develop-outreach-assets.s3.us-east-1.amazonaws.com`

**If missing**, you need to update CloudFront:
1. Get current config: `aws cloudfront get-distribution-config --id $CLOUDFRONT_DIST_ID > /tmp/cf-config.json`
2. Edit `/tmp/cf-config.json` to add origins and behaviors
3. Update: `aws cloudfront update-distribution --id $CLOUDFRONT_DIST_ID --if-match <ETag> --distribution-config file:///tmp/cf-config-updated.json`

**Recommended**: Use AWS Console → CloudFront → E2CJ0SW11QUMP8 → Edit to add:

**Origin 1: Outreach UI**
- Name: `outreach-lambda-dev`
- Domain: `outreach-dev.mydreamconnect.com` (or Lambda Function URL without https://)
- Protocol: HTTPS only

**Origin 2: Outreach S3 Assets**
- Name: `outreach-assets-dev`
- Domain: `sax-nextjs-us-east-1-develop-outreach-assets.s3.us-east-1.amazonaws.com`
- Origin access: Origin access control (recommended)
- Create new OAC if needed

**Behavior 1**: `/outreach/*`
- Precedence: 0 (highest)
- Origin: `outreach-lambda-dev`
- Viewer protocol: Redirect HTTP to HTTPS
- Allowed methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
- Cache policy: CachingDisabled
- Origin request policy: AllViewer

**Behavior 2**: `/outreach-static/*`
- Precedence: 1
- Origin: `outreach-assets-dev`
- Viewer protocol: Redirect HTTP to HTTPS
- Allowed methods: GET, HEAD, OPTIONS
- Cache policy: CachingOptimized
- Compress: Yes

#### Configure S3 Bucket Policy for OAC
```bash
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
        "AWS:SourceArn": "arn:aws:cloudfront::597088017323:distribution/$CLOUDFRONT_DIST_ID"
      }
    }
  }]
}
EOF

aws s3api put-bucket-policy \
  --bucket sax-nextjs-us-east-1-develop-outreach-assets \
  --policy file:///tmp/outreach-assets-policy.json
```

**Expected**: Bucket policy applied successfully.

### 2.5 Deploy SleepConnect via GitHub Actions

```bash
# Commit any changes to .github/workflows/deploy-develop.yml
cd ~/code/SAX/sleepconnect
git add .github/workflows/deploy-develop.yml
git commit -m "feat: add OUTREACH_APP_URL to develop workflow"
git push origin develop  # or current branch
```

**Go to GitHub**:
1. Navigate to: **sleepconnect repo → Actions → Deploy Develop**
2. Click **Run workflow**
3. Select branch: `develop` (or current branch if testing)
4. Click **Run workflow**

**Monitor deployment**:
- Watch workflow progress in GitHub Actions UI
- Expected duration: 10-20 minutes
- All jobs should complete successfully

**Verify deployment**:
```bash
# Test SleepConnect loads
curl -I https://dev.mydreamconnect.com
# Expected: 200 OK

# Test Outreach proxy (will fail until Outreach deployed)
curl -I https://dev.mydreamconnect.com/outreach
# Expected: 502 Bad Gateway (normal before Outreach deployment) or 404 (needs investigation)
```

**If 404**: SleepConnect rewrites not configured or `OUTREACH_APP_URL` not set.

### 2.6 Verify SleepConnect Lambda Environment

```bash
# Check OUTREACH_APP_URL is set (after deployment)
aws lambda get-function-configuration \
  --function-name sax-lambda-us-east-1-0x-d-sleep-connect-server_develop \
  --region us-east-1 \
  --query 'Environment.Variables.OUTREACH_APP_URL'

# Expected: "https://outreach-dev.mydreamconnect.com"
```

**Note**: The deployment script automatically updates this from the GitHub Actions workflow env var (Step 5.5 in `scripts/deploy-nextjs.cjs`). No manual configuration needed.

---

## Phase 3: Deploy Outreach (Manual) (15-20 min)

### 3.1 Configure Outreach Environment Variables

```bash
cd ~/code/SAX/twilio-conversations-react

# Create/update .env.local for build-time vars
cat > .env.local <<'EOF'
# Build-time variables
NEXT_PUBLIC_APP_BASE_URL=https://outreach-dev.mydreamconnect.com
NEXT_PUBLIC_SLEEPCONNECT_URL=https://dev.mydreamconnect.com
NEXT_PUBLIC_BASE_PATH=/outreach
NEXT_PUBLIC_API_BASE_URL=https://outreach-api-dev.mydreamconnect.com
NEXT_PUBLIC_WS_API_URL=wss://outreach-ws-dev.mydreamconnect.com

# Feature flags (optional)
NEXT_PUBLIC_ENABLE_SLA_MONITORING=true
NEXT_PUBLIC_ALLOW_INTERNATIONAL_PHONES=false
NEXT_PUBLIC_SHOW_BANNER=false
EOF
```

### 3.2 Set Outreach Lambda Environment Variables

```bash
# Get secrets from SleepConnect or secure storage
# Replace <...> with actual values

aws lambda update-function-configuration \
  --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --region us-east-1 \
  --environment "Variables={
    NODE_ENV=production,
    MULTI_ZONE_MODE=true,
    DISABLE_AUTH=false,
    AUTH0_SECRET=<same-as-sleepconnect>,
    AUTH0_CLIENT_SECRET=<same-as-sleepconnect>,
    AUTH0_CLIENT_ID=<same-as-sleepconnect>,
    AUTH0_DOMAIN=sleeparchitects.us.auth0.com,
    AUTH0_ISSUER_BASE_URL=https://sleeparchitects.us.auth0.com,
    AUTH0_BASE_URL=https://dev.mydreamconnect.com/outreach,
    API_BASE_URL=https://outreach-api-dev.mydreamconnect.com,
    TWILIO_ACCOUNT_SID=<your-twilio-sid>,
    TWILIO_AUTH_TOKEN=<your-twilio-token>,
    TWILIO_MESSAGING_SERVICE_SID=<your-messaging-service-sid>,
    NEXT_PUBLIC_WS_API_URL=wss://outreach-ws-dev.mydreamconnect.com,
    NEXT_PUBLIC_API_BASE_URL=https://outreach-api-dev.mydreamconnect.com,
    NEXT_PUBLIC_APP_BASE_URL=https://dev.mydreamconnect.com,
    NEXT_PUBLIC_SLEEPCONNECT_URL=https://dev.mydreamconnect.com,
    NEXT_PUBLIC_BASE_PATH=/outreach
  }"
```

**To get Auth0 secrets from SleepConnect**:
```bash
cd ~/code/SAX/sleepconnect
grep AUTH0_CLIENT_SECRET .env.local
# Or check SleepConnect Lambda env vars
```

### 3.3 Build Outreach with OpenNext

```bash
cd ~/code/SAX/twilio-conversations-react

# Install dependencies if needed
npm install

# Build with OpenNext
npm run build:open-next

# Verify build output
ls -la .open-next/server-functions/default/
# Expected: index.mjs and other Lambda files
```

**If build fails**: Check error messages, verify Node.js version (18+), ensure dependencies installed.

### 3.4 Deploy to Lambda and S3

```bash
# Run deployment script
node scripts/deploy-outreach.cjs develop

# Expected output:
# ✅ Lambda function code updated
# ✅ Static assets deployed to S3
# ✅ CloudFront cache invalidated (if dist ID provided)
# 🎉 Deployment complete!
```

**Monitor deployment**:
```bash
# Stream Lambda logs during deployment
aws logs tail /aws/lambda/sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --follow \
  --region us-east-1
```

**Expected**: Logs show Lambda starting, no errors about missing env vars.

### 3.5 Verify Outreach Deployment

```bash
# Test Lambda Function URL directly (if using custom domain)
curl -I https://outreach-dev.mydreamconnect.com/outreach
# Expected: 200 OK with HTML content

# Test via SleepConnect multi-zone
curl -I https://dev.mydreamconnect.com/outreach
# Expected: 200 OK (proxied through SleepConnect)

# Check S3 assets uploaded
aws s3 ls s3://sax-nextjs-us-east-1-develop-outreach-assets/outreach-static/_next/ --recursive
# Expected: Multiple .js, .css files listed

# Test static asset via CloudFront
curl -I https://dev.mydreamconnect.com/outreach-static/_next/static/chunks/main.js
# Expected: 200 OK with x-cache header
```

---

## Phase 4: Integration Testing (10-15 min)

### 4.1 Test Multi-Zone Access

**Open browser** (or use curl with session cookies):
```bash
open https://dev.mydreamconnect.com/outreach/conversations
```

**Expected flow**:
1. Redirect to Auth0 login (if not logged in)
2. After login, redirect back to `/outreach/conversations`
3. Page loads with conversation list
4. No errors in browser console

### 4.2 Test Static Assets

**In browser DevTools**:
1. Open Network tab
2. Reload page
3. Filter by `.js` and `.css` files

**Verify**:
- All assets return 200 status
- Assets load from `/outreach-static/_next/...` path
- `x-cache` header shows `Hit from cloudfront` (after first load)

### 4.3 Test API Integration

**In browser console**:
```javascript
// Test REST API
fetch('https://outreach-api-dev.mydreamconnect.com/outreach/conversations', {
  headers: { 'Authorization': 'Bearer <token>' }
}).then(r => r.json()).then(console.log)

// Check WebSocket in DevTools → WS tab
// Should show connection to wss://outreach-ws-dev.mydreamconnect.com
```

**Expected**:
- API calls return 200 with data
- WebSocket connection established
- Real-time updates work (send message, see it appear)

### 4.4 Test Authentication

**Test valid session**:
1. Log in to SleepConnect
2. Navigate to `/outreach`
3. Verify user name appears in UI
4. Verify conversations load

**Test invalid session**:
1. Clear cookies (incognito mode)
2. Navigate to `https://dev.mydreamconnect.com/outreach`
3. Verify redirect to SleepConnect login
4. After login, verify redirect back to `/outreach`

### 4.5 Check CloudWatch Logs

```bash
# Stream logs for 30 seconds
aws logs tail /aws/lambda/sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --follow \
  --region us-east-1 \
  --since 5m

# Look for:
# - Incoming requests
# - JWT validation success
# - No errors about missing env vars
# - No 500 errors
```

---

## Phase 5: Validation Checklist

### SleepConnect Deployment
- [ ] GitHub Actions workflow completed successfully
- [ ] SleepConnect Lambda has `OUTREACH_APP_URL` set
- [ ] CloudFront has `/outreach/*` behavior → Outreach origin
- [ ] CloudFront has `/outreach-static/*` behavior → S3 origin
- [ ] `https://dev.mydreamconnect.com` loads correctly
- [ ] `https://dev.mydreamconnect.com/outreach` returns 200 (after Outreach deployed)

### Outreach Deployment
- [ ] Lambda function code updated
- [ ] Lambda has all required environment variables
- [ ] S3 assets uploaded successfully
- [ ] `https://outreach-dev.mydreamconnect.com/outreach` returns 200
- [ ] No errors in CloudWatch Logs

### Integration
- [ ] Multi-zone access works: `https://dev.mydreamconnect.com/outreach`
- [ ] Static assets load from `/outreach-static/*`
- [ ] API calls succeed
- [ ] WebSocket connects
- [ ] Authentication flow works (login → redirect back)
- [ ] User context appears correctly in UI
- [ ] Real-time updates work (WebSocket)

---

## Troubleshooting Guide

### Issue: SleepConnect `/outreach` returns 404

**Cause**: Rewrites not configured or `OUTREACH_APP_URL` not set.

**Fix**:
```bash
# Check SleepConnect Lambda env var
aws lambda get-function-configuration \
  --function-name sax-lambda-us-east-1-0x-d-sleep-connect-server_develop \
  --region us-east-1 \
  --query 'Environment.Variables.OUTREACH_APP_URL'

# If missing, redeploy SleepConnect with:
cd ~/code/SAX/sleepconnect
OUTREACH_APP_URL="https://outreach-dev.mydreamconnect.com" node scripts/deploy-nextjs.cjs develop
```

### Issue: Static assets return 404

**Cause**: CloudFront behavior missing or S3 bucket policy incorrect.

**Fix**:
```bash
# Verify CloudFront behavior exists for /outreach-static/*
aws cloudfront get-distribution-config \
  --id E2CJ0SW11QUMP8 \
  --query 'DistributionConfig.CacheBehaviors.Items[?PathPattern==`/outreach-static/*`]'

# Verify S3 bucket policy
aws s3api get-bucket-policy \
  --bucket sax-nextjs-us-east-1-develop-outreach-assets

# Re-apply bucket policy if needed (see Phase 2.4)
```

### Issue: Authentication fails (redirect loop)

**Cause**: `AUTH0_CLIENT_SECRET` mismatch between SleepConnect and Outreach.

**Fix**:
```bash
# Get SleepConnect secret
cd ~/code/SAX/sleepconnect
grep AUTH0_CLIENT_SECRET .env.local

# Update Outreach Lambda with same secret
aws lambda update-function-configuration \
  --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --region us-east-1 \
  --environment "Variables={...,AUTH0_CLIENT_SECRET=<same-as-sleepconnect>,...}"
```

### Issue: CORS errors on API calls

**Cause**: API Gateway CORS not configured for `dev.mydreamconnect.com`.

**Fix**: Update API Gateway CORS settings to allow origin `https://dev.mydreamconnect.com`.

### Issue: WebSocket connection fails

**Cause**: Incorrect `NEXT_PUBLIC_WS_API_URL` or WebSocket API not deployed.

**Fix**:
```bash
# Test WebSocket API directly
wscat -c wss://outreach-ws-dev.mydreamconnect.com

# Verify env var in Lambda
aws lambda get-function-configuration \
  --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --query 'Environment.Variables.NEXT_PUBLIC_WS_API_URL'
```

### Issue: Lambda 500 errors

**Cause**: Missing environment variables or code error.

**Fix**:
```bash
# Check CloudWatch Logs for error details
aws logs tail /aws/lambda/sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --follow \
  --region us-east-1

# Verify all env vars are set
aws lambda get-function-configuration \
  --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --query 'Environment.Variables'

# Common missing vars: AUTH0_CLIENT_SECRET, TWILIO_AUTH_TOKEN, API_BASE_URL
```

---

## Rollback Procedures

### Rollback SleepConnect
**Option 1**: Re-run previous successful GitHub Actions workflow
- Go to Actions → Find last successful run → Re-run all jobs

**Option 2**: Revert Lambda to previous version
```bash
aws lambda update-alias \
  --function-name sax-lambda-us-east-1-0x-d-sleep-connect-server_develop \
  --name develop \
  --function-version <PREVIOUS_VERSION> \
  --region us-east-1
```

### Rollback Outreach
**Option 1**: Redeploy previous commit
```bash
cd ~/code/SAX/twilio-conversations-react
git checkout <previous-commit>
npm run build:open-next
node scripts/deploy-outreach.cjs develop
```

**Option 2**: Restore Lambda version
```bash
# List versions
aws lambda list-versions-by-function \
  --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop

# Update to previous version
aws lambda update-alias \
  --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop \
  --name develop \
  --function-version <PREVIOUS_VERSION>
```

---

## Success Criteria

**All must pass**:
- [ ] SleepConnect GitHub Actions deployment succeeded
- [ ] Outreach manual deployment completed without errors
- [ ] `https://dev.mydreamconnect.com` loads SleepConnect
- [ ] `https://dev.mydreamconnect.com/outreach` loads Outreach app
- [ ] Static assets load (no 404s in browser console)
- [ ] API calls succeed (conversations load)
- [ ] WebSocket connects (real-time updates work)
- [ ] Authentication flow works (login → redirect → access granted)
- [ ] No errors in CloudWatch Logs for either Lambda
- [ ] CloudFront cache behaviors working for both `/outreach/*` and `/outreach-static/*`

---

## Reference Documentation

- **Environment Variables**: `ENVIRONMENT_VARIABLES.md` (this repo)
- **Deployment Guide**: `AWS-DEPLOYMENT-GUIDE.md` (this repo)
- **Pre-Deployment Setup**: `AWS-PRE-DEPLOYMENT-SETUP.md` (this repo)
- **Multi-Zone Guide**: `MULTI-ZONE-DEPLOYMENT-GUIDE.md` (this repo)
- **SleepConnect Multi-Zone**: `~/code/SAX/sleepconnect/DEPLOY-MULTI-ZONE-OUTREACH.md`
- **Custom Domains**: `~/code/SAX/sleepconnect/OUTREACH-CUSTOM-DOMAIN-SETUP.md`
- **Authentication**: `docs/AUTHENTICATION.md` (this repo)

---

## Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| 1. Verify Infrastructure | 15-20 min | AWS CLI access |
| 2. Configure SleepConnect | 20-30 min | GitHub access, CloudFront config |
| 2.5. Deploy SleepConnect (GitHub Actions) | 10-20 min | Phase 2 complete |
| 3. Deploy Outreach (Manual) | 15-20 min | Phase 2.5 complete |
| 4. Integration Testing | 10-15 min | Phase 3 complete |
| 5. Validation | 5-10 min | All phases complete |
| **Total** | **75-115 min** | **~1.5-2 hours** |

---

**Questions or Issues?** Check CloudWatch Logs first, then refer to the Troubleshooting Guide above.

**Ready to begin?** Start with Phase 1: Verify Infrastructure.
