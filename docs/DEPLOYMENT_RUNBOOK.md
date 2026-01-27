# Outreach SMS App - Deployment Runbook

> **Last Updated**: January 23, 2026
> **Version**: 1.3.0

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Prerequisites](#prerequisites)
4. [Environment Configuration](#environment-configuration)
5. [Infrastructure Management](#infrastructure-management)
6. [Deployment Workflows](#deployment-workflows)
7. [Rollback Procedures](#rollback-procedures)
8. [GitHub Actions CI/CD](#github-actions-cicd)
9. [Troubleshooting](#troubleshooting)
10. [Environment Variable Reference](#environment-variable-reference)

---

## Overview

The Outreach SMS App is a Next.js 14 application deployed to AWS using OpenNext. It runs as a Lambda function behind CloudFront, with static assets served from S3.

**Important**: We do **NOT** use Infrastructure as Code (IaC) tools like SST, Terraform, or CDK for this project. Deployment is handled via custom Node.js scripts using the AWS SDK, following a strict "OpenNext + AWS CLI" approach.

### Deployment Model

```
┌─────────────────────────────────────────────────────────────────────┐
│                         User Request                                │
│                              ↓                                      │
│     ┌─────────────────────────────────────────────────────┐         │
│     │           SleepConnect CloudFront                   │         │
│     │         (mydreamconnect.com)                        │         │
│     └─────────────────────────────────────────────────────┘         │
│                              ↓                                      │
│              /outreach/* routes to Outreach                         │
│                              ↓                                      │
│     ┌─────────────────────────────────────────────────────┐         │
│     │         Outreach CloudFront                         │         │
│     │    (outreach-{stage}.mydreamconnect.com)            │         │
│     └─────────────────────────────────────────────────────┘         │
│           ↓                              ↓                          │
│    ┌──────────────┐            ┌──────────────────┐                 │
│    │   S3 Bucket  │            │  Lambda Function │                 │
│    │ (static assets)           │  (Next.js SSR)   │                 │
│    └──────────────┘            └──────────────────┘                 │
└─────────────────────────────────────────────────────────────────────┘
```

### Environments

| Environment | Branch    | Domain                              | SleepConnect URL                            | Code |
| ----------- | --------- | ----------------------------------- | ------------------------------------------- | ---- |
| Develop     | `develop` | `outreach-dev.mydreamconnect.com`   | `https://dev.mydreamconnect.com/outreach`   | `d`  |
| Staging     | `staging` | `outreach-stage.mydreamconnect.com` | `https://stage.mydreamconnect.com/outreach` | `s`  |
| Production  | `main`    | `outreach.mydreamconnect.com`       | `https://mydreamconnect.com/outreach`       | `p`  |

---

## Architecture

### Naming Convention

We follow a strict resource naming convention:
`sax-{resource-prefix}-us-east-1-0x-{env-code}-{project-identifier}`

| Component | Prefix | Env Code    | Example (Staging)                                |
| --------- | ------ | ----------- | ------------------------------------------------ |
| Lambda    | `lam`  | `d`/`s`/`p` | `sax-lam-us-east-1-0x-s-outreach`                |
| S3        | `s3`   | `d`/`s`/`p` | `sax-s3-us-east-1-0x-s-outreach-assets`          |
| IAM Role  | `iam`  | `global`    | `sax-iam-us-east-1-0x-global-outreach-execution` |

### AWS Resources per Environment

| Resource                | Name Pattern                                     | Purpose                   |
| ----------------------- | ------------------------------------------------ | ------------------------- |
| Lambda Function         | `sax-lam-us-east-1-0x-{code}-outreach`           | Next.js SSR               |
| S3 Bucket               | `sax-s3-us-east-1-0x-{code}-outreach-assets`     | Static assets             |
| CloudFront Distribution | Per-environment ID                               | CDN + SSL termination     |
| ACM Certificate         | `outreach-{stage}.mydreamconnect.com`            | SSL certificate           |
| Route53 Record          | A record alias to CloudFront                     | DNS routing               |
| IAM Role                | `sax-iam-us-east-1-0x-global-outreach-execution` | Lambda execution (shared) |

### Detailed Resource Inventory

#### Develop Environment (Legacy Naming)

This environment uses legacy naming conventions to preserve existing resources.

| Resource Type   | Resource Name                                       | Status             |
| --------------- | --------------------------------------------------- | ------------------ |
| **Lambda**      | `sax-lambda-us-east-1-0x-d-outreach-server_develop` | ✅ Exists          |
| **S3 Bucket**   | `sax-nextjs-us-east-1-develop-outreach-assets`      | ✅ Exists          |
| **CloudFront**  | `E8BMOBRWCCCO2`                                     | ✅ Exists          |
| **IAM Role**    | `lambda-dynamodb-execution-role`                    | ✅ Exists (Shared) |
| **Domain**      | `outreach-dev.mydreamconnect.com`                   | ✅ Exists          |
| **Certificate** | `*.mydreamconnect.com` (Wildcard)                   | ✅ Exists          |

#### Staging Environment (Strict Naming)

New environment following the `sax-lam/s3` convention.

| Resource Type   | Resource Name                           | Status             |
| --------------- | --------------------------------------- | ------------------ |
| **Lambda**      | `sax-lam-us-east-1-0x-s-outreach`       | ⏳ To be created   |
| **S3 Bucket**   | `sax-s3-us-east-1-0x-s-outreach-assets` | ⏳ To be created   |
| **CloudFront**  | (Generated ID)                          | ⏳ To be created   |
| **IAM Role**    | `lambda-dynamodb-execution-role`        | ✅ Exists (Shared) |
| **Domain**      | `outreach-stage.mydreamconnect.com`     | ⏳ To be created   |
| **Certificate** | `outreach-stage.mydreamconnect.com`     | ⏳ To be requested |

#### Production Environment (Strict Naming)

New environment following the `sax-lam/s3` convention.

| Resource Type   | Resource Name                           | Status             |
| --------------- | --------------------------------------- | ------------------ |
| **Lambda**      | `sax-lam-us-east-1-0x-p-outreach`       | ⏳ To be created   |
| **S3 Bucket**   | `sax-s3-us-east-1-0x-p-outreach-assets` | ⏳ To be created   |
| **CloudFront**  | (Generated ID)                          | ⏳ To be created   |
| **IAM Role**    | `lambda-dynamodb-execution-role`        | ✅ Exists (Shared) |
| **Domain**      | `outreach.mydreamconnect.com`           | ⏳ To be created   |
| **Certificate** | `outreach.mydreamconnect.com`           | ⏳ To be requested |

---

## Prerequisites

### Local Development

1. **Node.js 20+**

   ```bash
   node --version  # Should be >= 20.0.0
   ```

2. **pnpm 8+**

   ```bash
   pnpm --version  # Should be >= 8.0.0
   ```

3. **AWS CLI v2** configured with appropriate credentials

   ```bash
   aws --version
   aws sts get-caller-identity  # Verify access
   ```

4. **mise** (optional, for task running)

   ```bash
   mise --version
   ```

### AWS Permissions Required

The deploying user/role needs:

- `lambda:*` on outreach Lambda functions
- `s3:*` on outreach S3 buckets
- `cloudfront:*` on outreach distributions
- `acm:*` in us-east-1 (for certificate management)
- `route53:*` on mydreamconnect.com hosted zone
- `iam:PassRole` for Lambda execution role
- `iam:GetRole` for looking up Lambda execution role ARN
- `logs:*` for CloudWatch logs

**GitHub Actions Role**: The CI/CD workflow assumes `arn:aws:iam::{AWS_ACCOUNT_ID}:role/github-actions-role`. This role must have the above permissions plus OIDC trust for GitHub Actions.

**Note**: The deployment scripts automatically check if the current credentials have the necessary permissions before proceeding.

### Pre-Deploy Validation

Before deploying, run the pre-deploy check script to validate configuration:

```bash
# Check staging configuration
node scripts/pre-deploy-check.cjs staging

# Check production configuration
node scripts/pre-deploy-check.cjs production
```

This script validates:

- Required environment variables are set locally
- Lambda has required env var KEYS (without exposing values)
- Auth0 secrets KEYS exist in both Outreach and SleepConnect Lambdas
- GitHub secrets exist (if `gh` CLI available)

---

## Environment Configuration

### Environment Variables

Environment variables are managed at three levels:

1. **Build-time** (`NEXT_PUBLIC_*`) - Baked into the client bundle
2. **Runtime** - Set on Lambda function configuration
3. **Secrets** - Stored in GitHub Secrets for CI/CD

### Environment Variable Coalescing

For deployments, we **coalesce** environment variables from multiple sources to ensure completeness:

1. `.env` (Base defaults)
2. `.env.local` (Local overrides/secrets - **Not committed**)
3. Process environment variables (CI/CD secrets)

The deployment script will **validate** that all required environment variables are present after coalescing. If any are missing, the deployment will fail fast.

### Local Setup

1. Copy the example environment file:

   ```bash
   cp .env.example .env.local
   ```

2. Fill in required values (see [Environment Variable Reference](#environment-variable-reference))

3. For mise users, create `mise.local.toml`:

   ```bash
   cp mise.local.toml.example mise.local.toml
   # Edit with your secrets
   ```

### Required Environment Variables

#### The Auth0 Variable Trio (Critical for Session Sharing)

> **⚠️ CRITICAL**: The following three variables MUST match the parent SleepConnect application exactly. They are NOT independent configurations.

| Variable              | Purpose                         | Must Match SleepConnect? | Source              |
| --------------------- | ------------------------------- | ------------------------ | ------------------- |
| `AUTH0_CLIENT_ID`     | Auth0 Application ID            | ✅ Yes                   | SleepConnect Lambda |
| `AUTH0_CLIENT_SECRET` | JWT signing/verification secret | ✅ Yes (identical)       | SleepConnect Lambda |
| `AUTH0_SECRET`        | Session encryption secret       | ✅ Yes (identical)       | SleepConnect Lambda |

#### Distinguishing the Auth0 Variables

| Variable              | What It Is                                  | What It Does                                                                    |
| --------------------- | ------------------------------------------- | ------------------------------------------------------------------------------- |
| `AUTH0_CLIENT_ID`     | Public identifier for the Auth0 Application | Identifies which Auth0 app to use for authentication flows                      |
| `AUTH0_CLIENT_SECRET` | Private cryptographic secret (HMAC-SHA256)  | Signs JWT tokens; MUST be identical between apps for cross-zone session sharing |
| `AUTH0_SECRET`        | Session encryption key                      | Encrypts/decrypts session cookies; MUST be identical between apps               |

**Why they must match:** SleepConnect creates JWT tokens signed with `AUTH0_CLIENT_SECRET`. Outreach must verify these signatures using the SAME secret. If they differ, session verification fails with `401 Unauthorized` or `JWT signature verification failed`.

#### Complete Variable Reference

| Variable                       | Required | Description                     |
| ------------------------------ | -------- | ------------------------------- |
| `AUTH0_CLIENT_ID`              | ✅       | Auth0 application client ID     |
| `AUTH0_CLIENT_SECRET`          | ✅       | Auth0 application client secret |
| `AUTH0_SECRET`                 | ✅       | Auth0 session encryption secret |
| `AUTH0_DOMAIN`                 | ✅       | Auth0 tenant domain             |
| `AUTH0_BASE_URL`               | ✅       | Application base URL            |
| `TWILIO_ACCOUNT_SID`           | ✅       | Twilio account SID              |
| `TWILIO_AUTH_TOKEN`            | ✅       | Twilio auth token               |
| `NEXT_PUBLIC_APP_BASE_URL`     | ✅       | Public app URL                  |
| `NEXT_PUBLIC_SLEEPCONNECT_URL` | ✅       | SleepConnect URL for multi-zone |
| `NEXT_PUBLIC_BASE_PATH`        | ✅       | Base path (`/outreach`)         |
| `NEXT_PUBLIC_API_BASE_URL`     | ✅       | API Gateway URL                 |
| `NEXT_PUBLIC_WS_API_URL`       | ✅       | WebSocket API URL               |

---

## Security Hygiene

### No Secrets in PR/Chat

> **🔒 NEVER commit, paste, or share actual secrets in:**
>
> - Pull request comments
> - Chat/messaging applications
> - Version control
> - Screenshots or code blocks in tickets

**If you accidentally expose secrets:**

1. Rotate the exposed secret immediately
2. Update all environments where it was used
3. Document the incident

### Recommended Practice: `.env.production.example`

Instead of committing actual secrets, maintain a `.env.production.example` file that documents the required structure:

```bash
# .env.production.example
# Copy this to .env.production and fill in values (DO NOT commit .env.production)

# Auth0 Configuration (Synced from SleepConnect Production)
# ⚠️  GET THESE FROM SLEEPCONNECT LAMBDA - DO NOT REGENERATE
AUTH0_CLIENT_ID=your-client-id-from-sleepconnect
AUTH0_CLIENT_SECRET=your-client-secret-from-sleepconnect
AUTH0_SECRET=your-session-secret-from-sleepconnect
AUTH0_DOMAIN=sleeparchitects.us.auth0.com
AUTH0_ISSUER_BASE_URL=https://sleeparchitects.us.auth0.com
AUTH0_BASE_URL=https://outreach.mydreamconnect.com

# Twilio Configuration
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
TWILIO_MESSAGING_SERVICE_SID=your-twilio-msg-sid

# Application URLs
NEXT_PUBLIC_APP_BASE_URL=https://outreach.mydreamconnect.com
NEXT_PUBLIC_SLEEPCONNECT_URL=https://mydreamconnect.com
NEXT_PUBLIC_BASE_PATH=/outreach
```

### Gitignore Verification

Ensure your `.gitignore` includes:

```gitignore
# Environment files with secrets
.env.local
.env.*.local
.env.production  # Contains real secrets - never commit
```

---

## Infrastructure Management

Infrastructure is managed via idempotent Node.js scripts in the `scripts/` directory. These scripts use the AWS SDK directly.

**Idempotency**: All infrastructure scripts are designed to be idempotent. They check if a resource exists before attempting to create it. If it exists, they update it (if necessary) or skip it. You can run `create-infrastructure.cjs` multiple times safely.

### Step 1: Check Existing Infrastructure

```bash
# Check what exists for staging
node scripts/check-infrastructure.cjs staging

# Output shows what's missing:
# {
#   "ready": false,
#   "missing": ["lambda", "s3", "cloudfront", "acm", "route53"]
# }
```

### Step 2: Create/Update Infrastructure

```bash
# Create or update resources for staging
node scripts/create-infrastructure.cjs staging

# This will:
# 1. Create S3 bucket `sax-s3-us-east-1-0x-s-outreach-assets` (if missing)
# 2. Create Lambda `sax-lam-us-east-1-0x-s-outreach` (if missing)
# 3. Request ACM certificate (if missing)
# 4. Create CloudFront distribution (if missing)
# 5. Create Route53 DNS record (if missing)
```

### Step 3: Wait for Certificate Validation

ACM certificates are validated via DNS. The script automatically creates Route53 validation records. Wait for the certificate to be issued (typically 2-5 minutes).

```bash
# Check certificate status
aws acm describe-certificate \
  --certificate-arn <ARN_FROM_OUTPUT> \
  --query 'Certificate.Status'
# Should return: "ISSUED"
```

### Step 4: Verify Infrastructure

```bash
# Verify everything is ready
node scripts/check-infrastructure.cjs staging

# Should output:
# {
#   "ready": true,
#   "missing": []
# }
```

### Step 5: Configure SleepConnect

SleepConnect needs to route `/outreach/*` traffic to the Outreach app.

1. Get the **Lambda Function URL** (or CloudFront URL) from the infrastructure output.
2. Update SleepConnect's environment configuration (e.g., `.env.staging` in the SleepConnect repo).

   ```
   OUTREACH_APP_URL=https://<lambda-function-url>
   ```

3. **Redeploy SleepConnect** using its standard deployment pipeline (do NOT use SST commands here).
   - This ensures the new environment variable is picked up and routing is updated.

---

## Deployment Workflows

### Manual Deployment (Local)

#### Using Node directly

```bash
# Load environment variables and deploy
source .env.local  # Or use mise/direnv
node scripts/deploy-outreach.cjs staging
```

#### Using mise

```bash
# Ensure environment is loaded
mise trust
mise install

# Deploy to staging
mise run deploy:staging

# Deploy to production
mise run deploy:production
```

### Deployment Steps (What the Script Does)

1. **Coalesce & Validate Env Vars** - Combines .env/.env.local/process.env and checks required vars.
2. **Check Permissions** - Verifies AWS credentials have required access.
3. **Build with OpenNext** - Compiles Next.js for Lambda.
4. **Fix pnpm symlinks** - Resolves styled-jsx and @swc/helpers.
5. **Create deployment package** - Zips server function.
6. **Update Lambda code** - Uploads zip to Lambda.
7. **Wait for Lambda ready** - Ensures update is complete.
8. **Update Lambda env vars** - Sets runtime configuration.
9. **Publish Lambda version** - Creates immutable version.
10. **Update Lambda alias** - Points 'live' alias to new version.
11. **Upload static assets to S3** - Syncs \_next/\* and public files.
12. **Configure CloudFront cache** - Ensures RSC headers are in cache key.
13. **Invalidate CloudFront cache** - Clears old cached content.
14. **Create git tag** - Tags release as `deploy-{env}-v{version}`.

> **⚠️ CRITICAL: Lambda Environment Variable Replacement**
>
> When you update Lambda configuration with `update-function-configuration`, **ALL** environment variables are replaced. The new configuration completely overwrites the previous set.
>
> **If you omit any variable in the update, it will be unset**, causing runtime failures.
>
> **Best Practice:**
>
> 1. Always retrieve the full current configuration before updating
> 2. Merge new values with existing values
> 3. Verify all required variables are present after update
>
> The `deploy-outreach.cjs` script handles this correctly by coalescing all required vars before update.
>
> **If updating manually via AWS Console or CLI:**
>
> ```bash
> # WRONG - will unset other variables:
> aws lambda update-function-configuration \
>   --function-name my-function \
>   --environment "Variables={AUTH0_CLIENT_SECRET=new-value}"
>
> # CORRECT - include all variables:
> aws lambda update-function-configuration \
>   --function-name my-function \
>   --environment "Variables={AUTH0_CLIENT_ID=...,AUTH0_CLIENT_SECRET=...,AUTH0_SECRET=...,...}"
> ```

### Deployment Flags

```bash
# Skip the build step (use existing .open-next)
node scripts/deploy-outreach.cjs staging --skip-build

# Verbose output
node scripts/deploy-outreach.cjs staging --verbose
```

---

## Rollback Procedures

### List Available Versions

```bash
node scripts/rollback-deployment.cjs staging --list

# Output:
# Version | Created            | Description          | Alias
# --------|--------------------|--------------------- |-------
# 7       | 2026-01-22 10:30   | v0.1.7 (abc123f)     | live
# 6       | 2026-01-21 15:45   | v0.1.6 (def456a)     |
# 5       | 2026-01-20 09:15   | v0.1.5 (789xyz0)     |
```

### Rollback to Specific Version

```bash
# Rollback by Lambda version number
node scripts/rollback-deployment.cjs staging --version 5

# Rollback by semver tag
node scripts/rollback-deployment.cjs staging --tag v0.1.5
```

### What Rollback Does

1. Updates Lambda alias 'live' to point to specified version
2. Invalidates CloudFront cache
3. Logs rollback action

### Emergency Rollback (AWS Console)

If scripts are unavailable:

1. Go to AWS Lambda Console
2. Select the function (e.g., `sax-lam-us-east-1-0x-s-outreach`)
3. Go to "Aliases" tab
4. Edit "live" alias
5. Change version to previous working version
6. Save

Then invalidate CloudFront:

```bash
aws cloudfront create-invalidation \
  --distribution-id <DISTRIBUTION_ID> \
  --paths "/*"
```

---

## GitHub Actions CI/CD

### Automatic Deployments

| Branch    | Environment | Trigger |
| --------- | ----------- | ------- |
| `develop` | develop     | Push    |
| `staging` | staging     | Push    |
| `main`    | production  | Push    |

### Manual Deployment

1. Go to Actions → "Deploy to AWS with OpenNext"
2. Click "Run workflow"
3. Select environment and action (deploy/rollback)
4. Click "Run workflow"

### Workflow Features

- **Infrastructure check** - Fails fast if AWS resources don't exist
- **Version bumping** - Auto-bumps patch version on merge
- **Git tagging** - Creates `deploy-{env}-v{version}` tags
- **Deployment summary** - Shows deployment details in Actions UI
- **Rollback support** - Can rollback via workflow_dispatch

### GitHub Secrets Strategy

We use **GitHub Environments** to manage secrets for different deployment stages. This provides a clear separation between staging and production secrets, with production requiring additional protection rules.

#### Repository Secrets vs Environment Secrets

| Secret Type             | Scope                | Use Case                                                             |
| ----------------------- | -------------------- | -------------------------------------------------------------------- |
| **Repository Secrets**  | Repository-wide      | Default values for all environments (Staging uses these as defaults) |
| **Environment Secrets** | Specific environment | Override repository secrets for that environment only                |

#### How It Works

1. **Staging Deployments** (`staging` branch)
   - Uses **Repository Secrets** directly
   - No additional protection required
   - Secrets use the **same names** as production (no `STAGING_` prefix), for example:
     - `AUTH0_CLIENT_ID`
     - `AUTH0_CLIENT_SECRET`
     - `AUTH0_SECRET`

2. **Production Deployments** (`main` branch)
   - **Repository Secrets** act as defaults
   - **Environment Secrets** (configured in GitHub for `production` environment) **override** the defaults
   - Requires additional protection: at least 1 reviewer approval
   - Secrets: **Same secret names**, but values come from the `production` environment configuration

#### Setting Up Production Environment Secrets

1. Go to repository **Settings** → **Environments** → **production**
2. Add the following secrets:
   - `AUTH0_CLIENT_ID`
   - `AUTH0_CLIENT_SECRET`
   - `AUTH0_SECRET`
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - etc.

3. Configure **Protection rules**:
   - Required reviewers: 1+ (depends on your security policy)
   - Wait timer: Optional (e.g., 30 minutes for manual approval)

> **Important**: The workflow file uses the same secret names for all environments. GitHub automatically selects the correct value based on the current environment context. For production, ensure the environment-specific secrets are set BEFORE merging to `main`.

#### Secret Naming Convention

Secrets use the **same names** in staging and production. The difference is **where** they are configured.

| Secret Name           | Staging Source    | Production Source               |
| --------------------- | ----------------- | ------------------------------- |
| `AUTH0_CLIENT_ID`     | Repository Secret | `production` Environment Secret |
| `AUTH0_CLIENT_SECRET` | Repository Secret | `production` Environment Secret |
| `AUTH0_SECRET`        | Repository Secret | `production` Environment Secret |
| `TWILIO_ACCOUNT_SID`  | Repository Secret | `production` Environment Secret |
| `TWILIO_AUTH_TOKEN`   | Repository Secret | `production` Environment Secret |

---

## Troubleshooting

### Build Failures

#### "Dynamic server usage" errors

These are **expected** for API routes using headers/cookies. The deploy script filters these warnings.

#### "styled-jsx not found" or "@swc/helpers not found"

The deploy script fixes pnpm symlinks automatically. If issues persist:

```bash
rm -rf .open-next
pnpm install
node scripts/deploy-outreach.cjs staging
```

#### Out of memory during build

Increase Node memory:

```bash
NODE_OPTIONS="--max-old-space-size=8192" node scripts/deploy-outreach.cjs staging
```

### Deployment Failures

#### "Lambda function not found"

Run infrastructure setup first:

```bash
node scripts/create-infrastructure.cjs staging
```

#### "S3 bucket doesn't exist"

Run infrastructure setup:

```bash
node scripts/create-infrastructure.cjs staging
```

#### "Access Denied" errors

Check AWS credentials have required permissions. See [Prerequisites](#prerequisites).

### Runtime Errors

#### 500 errors after deployment

1. Check CloudWatch logs:

   ```bash
   aws logs tail /aws/lambda/sax-lam-us-east-1-0x-s-outreach --follow
   ```

2. Verify environment variables are set correctly on Lambda
3. Consider rolling back.

#### Lambda payload size errors ("Request must be smaller than 6291456 bytes")

**Symptoms:**

- Error message: `{"Message":"Request must be smaller than 6291456 bytes for the InvokeFunction operation"}`
- Occurs intermittently, especially on new browser tabs
- Affects conversations with many messages
- Works in dev but fails in production

**Root Cause:**

CloudFront compression is disabled, causing uncompressed responses to exceed AWS Lambda's 6MB synchronous invocation payload limit.

**Fix:**

Ensure CloudFront cache policy has compression enabled:

```bash
# Check current cache policy
DIST_ID=$(aws cloudfront list-distributions --output json | \
  jq -r '.DistributionList.Items[] | select(.Aliases.Items[]? | contains("outreach.mydreamconnect.com")) | .Id')

aws cloudfront get-distribution-config --id $DIST_ID --output json | \
  jq '.DistributionConfig.DefaultCacheBehavior.CachePolicyId' -r | \
  xargs -I {} aws cloudfront get-cache-policy --id {} --output json | \
  jq '{Name: .CachePolicy.CachePolicyConfig.Name, Gzip: .CachePolicy.CachePolicyConfig.ParametersInCacheKeyAndForwardedToOrigin.EnableAcceptEncodingGzip, Brotli: .CachePolicy.CachePolicyConfig.ParametersInCacheKeyAndForwardedToOrigin.EnableAcceptEncodingBrotli}'

# Should show:
# {
#   "Name": "OutreachRSCCachePolicy_undefined",
#   "Gzip": true,
#   "Brotli": true
# }
```

If compression is disabled (Gzip/Brotli = false), update to use the correct cache policy:

```bash
# Use dev's cache policy ID (has compression enabled)
DEV_CACHE_POLICY="a9f86ce3-0b09-4f21-b9ab-de3a7c0fc1c4"

# Backup current config
aws cloudfront get-distribution-config --id $DIST_ID --output json > /tmp/cloudfront-backup.json

# Update cache policy
ETAG=$(jq -r '.ETag' /tmp/cloudfront-backup.json)
jq --arg policy "$DEV_CACHE_POLICY" \
  '.DistributionConfig.DefaultCacheBehavior.CachePolicyId = $policy' \
  /tmp/cloudfront-backup.json | jq '.DistributionConfig' > /tmp/cloudfront-updated.json

aws cloudfront update-distribution \
  --id $DIST_ID \
  --if-match "$ETAG" \
  --distribution-config file:///tmp/cloudfront-updated.json

# Wait for deployment (5-10 minutes)
while [ "$(aws cloudfront get-distribution --id $DIST_ID --query 'Distribution.Status' --output text)" != "Deployed" ]; do
  echo "Waiting for CloudFront deployment..."
  sleep 30
done

# Invalidate cache
aws cloudfront create-invalidation --distribution-id $DIST_ID --paths "/*"
```

**Prevention:**

The deployment scripts should verify CloudFront compression is enabled. See [`scripts/deploy-outreach.cjs`](../scripts/deploy-outreach.cjs) for the verification logic.

**Long-term Solution:**

Consider implementing message pagination to prevent responses from growing too large, regardless of compression.

#### Authentication failures

> **CRITICAL**: This is the most common cause of deployment failures when setting up a new environment. Read carefully!

**Symptoms:**

- `401 Unauthorized` responses from API calls
- `JWT signature verification failed` errors in Lambda logs
- Users unable to log in or being immediately logged out
- Auth0 redirect URIs mismatch errors

**Root Cause:**

The Outreach application shares authentication with the parent **SleepConnect** application. Auth0 sessions and JWT tokens are signed using a shared secret. If Outreach and SleepConnect use **different** Auth0 credentials (especially `AUTH0_CLIENT_SECRET` and `AUTH0_SECRET`), the following happens:

1. User logs in through SleepConnect
2. SleepConnect creates a session cookie with its own signing key
3. User navigates to Outreach
4. Outreach attempts to verify the session using its **different** signing key
5. Verification **fails** because the signatures don't match

**Fix:**

Copy the Auth0 environment variables **from the SleepConnect Lambda configuration** to the Outreach configuration:

1. **Get values from SleepConnect:**

   ```bash
   # Get SleepConnect Lambda environment variables
   # Note: SleepConnect uses legacy naming conventions.
   aws lambda get-function-configuration \
     --function-name sax-lambda-us-east-1-0x-s-sleep-connect-server_staging \
     --query 'Environment.Variables'

   # For production, use:
   # aws lambda get-function-configuration \
   #   --function-name sax-lambda-us-east-1-0x-p-sleep-connect-server_production \
   #   --query 'Environment.Variables'
   ```

2. **Set the same values on Outreach Lambda:**

   ```bash
   # Update Outreach Lambda with matching Auth0 credentials
   aws lambda update-function-configuration \
     --function-name sax-lam-us-east-1-0x-s-outreach \
     --environment "Variables={
       AUTH0_CLIENT_ID={value_from_sleepconnect},
       AUTH0_CLIENT_SECRET={value_from_sleepconnect},
       AUTH0_SECRET={value_from_sleepconnect},
       AUTH0_DOMAIN={same_domain},
       AUTH0_BASE_URL={outreach_url}
     }"
   ```

3. **Verify in GitHub Secrets:**
   - Ensure `AUTH0_CLIENT_ID` and `AUTH0_CLIENT_SECRET` match the SleepConnect values
   - Never regenerate these values independently for Outreach

> **WARNING**: `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, and `AUTH0_SECRET` **MUST MATCH** the parent SleepConnect application for the same environment. These are not independent configurations - they must be identical across both applications for session sharing to work.

**Verification:**

After fixing, check Lambda logs for successful session verification:

```bash
aws logs tail /aws/lambda/sax-lam-us-east-1-0x-s-outreach --follow
# Should see successful authentication without 401 errors
```

---

## Environment Variable Reference

### Build-time Variables (NEXT*PUBLIC*\*)

| Variable                       | Develop                                          | Staging                                          | Production                                       |
| ------------------------------ | ------------------------------------------------ | ------------------------------------------------ | ------------------------------------------------ |
| `NEXT_PUBLIC_APP_BASE_URL`     | `https://outreach-dev.mydreamconnect.com`        | `https://outreach-stage.mydreamconnect.com`      | `https://outreach.mydreamconnect.com`            |
| `NEXT_PUBLIC_SLEEPCONNECT_URL` | `https://dev.mydreamconnect.com`                 | `https://stage.mydreamconnect.com`               | `https://mydreamconnect.com`                     |
| `NEXT_PUBLIC_BASE_PATH`        | `/outreach`                                      | `/outreach`                                      | `/outreach`                                      |
| `NEXT_PUBLIC_API_BASE_URL`     | `https://develop-api.mydreamconnect.com/develop` | `https://develop-api.mydreamconnect.com/develop` | `https://develop-api.mydreamconnect.com/develop` |
| `NEXT_PUBLIC_WS_API_URL`       | `wss://outreach-ws-dev.mydreamconnect.com`       | `wss://outreach-ws-dev.mydreamconnect.com`       | `wss://outreach-ws-dev.mydreamconnect.com`       |

### Runtime Variables

| Variable                       | Description                                   | Source of Truth    |
| ------------------------------ | --------------------------------------------- | ------------------ |
| `NODE_ENV`                     | Always `production` for deployed environments | -                  |
| `ENVIRONMENT`                  | `develop`, `staging`, or `production`         | -                  |
| `MULTI_ZONE_MODE`              | Always `true` for deployed environments       | -                  |
| `AUTH0_DOMAIN`                 | Auth0 tenant domain                           | Auth0 Console      |
| `AUTH0_CLIENT_ID`              | Auth0 application client ID                   | **SleepConnect**   |
| `AUTH0_CLIENT_SECRET`          | Auth0 application client secret               | **SleepConnect**   |
| `AUTH0_SECRET`                 | Session encryption (must match SleepConnect)  | **SleepConnect**   |
| `AUTH0_BASE_URL`               | Application base URL for Auth0 callbacks      | Application Config |
| `AUTH0_ISSUER_BASE_URL`        | Auth0 issuer URL (`https://{domain}`)         | Auth0 Console      |
| `TWILIO_ACCOUNT_SID`           | Twilio account SID                            | Twilio Console     |
| `TWILIO_AUTH_TOKEN`            | Twilio auth token                             | Twilio Console     |
| `TWILIO_MESSAGING_SERVICE_SID` | Twilio messaging service SID                  | Twilio Console     |

> **⚠️ WARNING**: `AUTH0_CLIENT_ID`, `AUTH0_CLIENT_SECRET`, and `AUTH0_SECRET` **MUST MATCH** the parent **SleepConnect** application for the same environment. These values are sourced from SleepConnect's Lambda configuration, not regenerated independently. See [Authentication failures](#authentication-failures) for detailed troubleshooting.

---

## Change Log

| Version | Date       | Changes                                                                                                                                                                                                                                                                                |
| ------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.4.0   | 2026-01-27 | **CloudFront compression fix**: Fixed production 6MB payload limit error by enabling gzip/brotli compression on CloudFront distribution E3LYWD3FPTY1XF; added troubleshooting section for Lambda payload size errors; documented CloudFront cache policy requirements                  |
| 1.3.0   | 2026-01-23 | **Deployment hardening**: Fixed env var REPLACE→MERGE in deploy script; added GitHub Environments support to workflow; added pre-deploy-check.cjs validation script; added all missing secrets to workflow (TWILIO_FROM_NUMBER, API_BASE_URL, NEXT_PUBLIC_WS_API_URL, etc.)            |
| 1.2.0   | 2026-01-23 | **Critical Auth0 integration details**: Added Source of Truth column to Runtime Variables table; expanded Authentication failures troubleshooting with symptoms, root cause (JWT signature mismatch), and specific fix steps; added GitHub Environments secrets strategy documentation |
| 1.1.0   | 2026-01-22 | Updated naming conventions, removed SST references, improved deployment/infra docs                                                                                                                                                                                                     |
| 1.0.0   | 2026-01-22 | Initial runbook creation                                                                                                                                                                                                                                                               |
