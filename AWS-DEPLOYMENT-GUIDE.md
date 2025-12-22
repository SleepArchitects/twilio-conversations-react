# AWS Deployment Guide - SMS Outreach (Multi-Zone Integration)

**Last Updated**: December 22, 2025  
**Project**: Twilio Conversations SMS Outreach  
**Deployment Method**: OpenNext (Next.js → AWS Lambda + S3 + CloudFront)  
**Architecture**: Multi-Zone Integration with SleepConnect  
**Custom Domains**: Stable URLs for all environments

---

## 🎯 Architecture Summary

This application deploys as part of a **multi-zone architecture** with SleepConnect using **custom domains** for stability:

**Environment URLs:**
- **Develop**: `https://dev.mydreamconnect.com/outreach` (via `https://outreach-dev.mydreamconnect.com`)
- **Staging**: `https://stage.mydreamconnect.com/outreach` (via `https://outreach-staging.mydreamconnect.com`)
- **Production**: `https://mydreamconnect.com/outreach` (via `https://outreach.mydreamconnect.com`)

**Custom Domain Components (per environment):**
- UI: CloudFront → Lambda (e.g., `outreach-dev.mydreamconnect.com`)
- REST API: API Gateway (e.g., `outreach-api-dev.mydreamconnect.com`)
- WebSocket: API Gateway (e.g., `outreach-ws-dev.mydreamconnect.com`)

---

## 📋 Table of Contents

1. [Prerequisites](#prerequisites)
2. [Quick Start](#quick-start)
3. [Detailed Setup](#detailed-setup)
4. [Deployment Process](#deployment-process)
5. [Environment Variables](#environment-variables)
6. [Troubleshooting](#troubleshooting)
7. [Cost Estimates](#cost-estimates)

---

## Prerequisites

### Required Tools

```bash
# Check if installed
node --version     # v18.17.0 or higher
npm --version      # v9.0.0 or higher
aws --version      # AWS CLI v2.x
```

**Important**: AWS CLI v2 uses a pager by default. To disable it:

```bash
# Option 1: Set environment variable (recommended)
export AWS_PAGER=""

# Option 2: Add to your ~/.bashrc or ~/.zshrc
echo 'export AWS_PAGER=""' >> ~/.zshrc

# Option 3: Use --no-cli-pager flag on each command
aws <command> --no-cli-pager
```

### AWS Account Setup

1. **AWS Account** with appropriate permissions
2. **AWS CLI** configured with credentials:
   ```bash
   aws configure
   # Enter: Access Key ID, Secret Access Key, Region (us-east-1), Output format (json)
   ```
3. **Domain** managed in Route53 or external DNS provider
4. **Permissions** required:
   - S3: Full access to create buckets
   - CloudFront: Create distributions
   - Lambda: Create and update functions
   - ACM: Request and validate certificates
   - IAM: Create roles and policies
   - Route53: Update DNS records (if using Route53)

---

## Quick Start

**Note**: This application is deployed as part of a multi-zone architecture. For complete setup, see:
- SleepConnect repo: `DEPLOY-MULTI-ZONE-OUTREACH.md`
- This repo: `MULTI-ZONE-DEPLOYMENT-GUIDE.md`

### Prerequisites for Multi-Zone Deployment

1. **Custom domains must be configured** (recommended, see SleepConnect repo: `OUTREACH-CUSTOM-DOMAIN-SETUP.md`)
2. **SleepConnect must be configured** to proxy `/outreach/*` requests
3. **Environment variables must be set** for API endpoints

### 1. Install Dependencies

```bash
cd ~/code/SAX/twilio-conversations-react
npm install
```

This will install `@opennextjs/aws` along with all other dependencies.

### 2. Set Up AWS Infrastructure (One-time)

```bash
# Run the infrastructure setup script
./scripts/setup-aws-infrastructure.sh production
```

This creates:
- S3 bucket for static assets
- CloudFront Origin Access Identity
- ACM certificate (requires DNS validation)
- IAM deployment user/role

### 3. Validate ACM Certificate

After running the setup script, validate your certificate:

```bash
# Get the certificate validation record
CERT_ARN=$(cat .aws-cert-arn-production.txt)
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.DomainValidationOptions[0].ResourceRecord' \
  --no-cli-pager
```

Add the CNAME record to your DNS provider (Route53 or external).

Wait for validation (can take 5-30 minutes):
```bash
aws acm describe-certificate \
  --certificate-arn $CERT_ARN \
  --region us-east-1 \
  --query 'Certificate.Status' \
  --no-cli-pager
# Should return "ISSUED"
```

### 4. Build with OpenNext

```bash
# Production build
npm run build:open-next

# Or with debug info (includes source maps)
npm run build:open-next:debug
```

This creates a `.open-next/` directory with:
- `server-function/` - Lambda function for Next.js SSR
- `assets/` - Static files (JS, CSS, images)
- `image-optimization-function/` - Lambda for image optimization

### 5. Deploy to AWS

```bash
# Deploy everything
./scripts/deploy-to-aws.sh production
```

This will:
1. Upload static assets to S3
2. Create/update Lambda functions
3. Save CloudFront configuration
4. Invalidate CloudFront cache (if distribution exists)

### 6. Set Up CloudFront Distribution

The deployment script saves configuration but doesn't create CloudFront automatically.
You have two options:

#### Option A: Manual Setup (via AWS Console)

1. Go to CloudFront console
2. Create new distribution with settings from `.aws-cloudfront-config-production.json`
3. Add the Lambda function as Lambda@Edge trigger

#### Option B: Infrastructure as Code (Recommended)

See [CloudFront IaC Setup](#cloudfront-iac-setup) below.

### 7. Configure DNS

Point your domain to the CloudFront distribution:

```bash
# If using Route53
aws route53 change-resource-record-sets \
  --hosted-zone-id YOUR_ZONE_ID \
  --change-batch file://route53-change.json \
  --no-cli-pager
```

---

## Detailed Setup

### OpenNext Configuration

The `open-next.config.ts` file controls how Next.js is transformed for AWS:

```typescript
import type { OpenNextConfig } from "@opennextjs/aws/types/open-next.js";

const config = {
  default: {
    minify: !process.env.OPEN_NEXT_DEBUG, // Minify in production
    override: {
      wrapper: "aws-lambda-streaming", // Use streaming responses
    },
  },
  middleware: {
    external: true, // Separate middleware function
  },
  imageOptimization: {
    arch: "x64",
    memory: 1536, // MB for image optimization Lambda
  },
} satisfies OpenNextConfig;
```

### Build Process

When you run `npm run build:open-next`:

1. **Next.js Build**: Creates `.next/` directory
2. **OpenNext Transform**: Converts to AWS-compatible format
3. **Output Structure**:
   ```
   .open-next/
   ├── server-function/          # Main Lambda function
   │   ├── index.mjs            # Entry point
   │   ├── package.json
   │   └── ... (Next.js runtime)
   ├── assets/                   # Static files for S3
   │   ├── _next/               # Next.js assets
   │   └── public/              # Public files
   ├── image-optimization-function/  # Image Lambda
   └── middleware-function/      # Middleware Lambda (if exists)
   ```

### AWS Architecture

```
┌─────────────────────────────────────────────────────────┐
│ User Request: outreach.mydreamconnect.com/outreach      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ Route53 DNS                                             │
│ A Record → CloudFront Distribution                      │
└────────────────────┬────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────┐
│ CloudFront Distribution                                 │
│ - SSL/TLS termination (ACM certificate)                 │
│ - Edge caching                                          │
│ - Behavior rules:                                       │
│   • /outreach-static/* → S3 (long cache)               │
│   • /outreach/* → Lambda@Edge (server function)        │
└─────────────┬───────────────────────┬───────────────────┘
              │                       │
              ▼                       ▼
    ┌─────────────────┐     ┌──────────────────┐
    │ S3 Bucket       │     │ Lambda@Edge      │
    │ Static Assets   │     │ Next.js Server   │
    │ - JS chunks     │     │ - SSR            │
    │ - CSS           │     │ - API routes     │
    │ - Images        │     │ - Dynamic pages  │
    └─────────────────┘     └──────────────────┘
```

---

## Deployment Process

### Environments

The scripts support multiple environments:
- `production` - Production deployment
- `staging` - Staging environment
- `dev` - Development environment

Resources are named with environment suffix: `outreach-mydreamconnect-production`

### Regular Deployment Workflow

```bash
# 1. Pull latest code
git pull origin main

# 2. Install/update dependencies
npm install

# 3. Run tests (optional)
npm test
npm run test:e2e

# 4. Build with OpenNext
npm run build:open-next

# 5. Deploy to staging first
./scripts/deploy-to-aws.sh staging

# 6. Test staging deployment
curl https://staging.mydreamconnect.com/outreach/health

# 7. Deploy to production
./scripts/deploy-to-aws.sh production

# 8. Verify production
curl https://outreach.mydreamconnect.com/outreach/health
```

### Rollback

If you need to rollback:

```bash
# S3 versioning is enabled, so you can restore previous version
aws s3api list-object-versions \
  --bucket outreach-mydreamconnect-production \
  --prefix outreach-static/ \
  --no-cli-pager

# Restore specific version
aws s3api copy-object \
  --bucket outreach-mydreamconnect-production \
  --copy-source "outreach-mydreamconnect-production/path/to/file?versionId=VERSION_ID" \
  --key path/to/file \
  --no-cli-pager

# For Lambda, use previous version
aws lambda update-alias \
  --function-name outreach-mydreamconnect-server-production \
  --name production \
  --function-version PREVIOUS_VERSION \
  --no-cli-pager
```

---

## 🎯 Recommended: Custom Domain for Stability

**Before production deployment**, set up custom domains for Outreach Lambda:

- `outreach-dev.mydreamconnect.com` → develop
- `outreach-staging.mydreamconnect.com` → staging  
- `outreach.mydreamconnect.com` → production

**Benefits**:
- Lambda URLs won't change on function recreation
- `OUTREACH_APP_URL` stays constant
- No manual URL updates needed

**Setup**: See [`../sleepconnect/OUTREACH-CUSTOM-DOMAIN-SETUP.md`](../sleepconnect/OUTREACH-CUSTOM-DOMAIN-SETUP.md)

---

## Environment Variables

### Build-Time Variables (Required)

These must be set **before building** the application:

```bash
# API Endpoints (use custom domains)
export NEXT_PUBLIC_API_BASE_URL="https://outreach-api-dev.mydreamconnect.com"
export NEXT_PUBLIC_WS_URL="wss://outreach-ws-dev.mydreamconnect.com"

# Application URLs
export NEXT_PUBLIC_APP_BASE_URL="https://outreach-dev.mydreamconnect.com"
export NEXT_PUBLIC_SLEEPCONNECT_URL="https://dev.mydreamconnect.com"

# Multi-zone configuration
export NEXT_PUBLIC_BASE_PATH="/outreach"
```

### Runtime Variables (Lambda Environment)

Set these in the Lambda function configuration:

```bash
NODE_ENV=production
MULTI_ZONE_MODE=true
AUTH0_SECRET=<shared-with-sleepconnect>
AUTH0_CLIENT_SECRET=<shared-with-sleepconnect>
AUTH0_CLIENT_ID=<shared-with-sleepconnect>
AUTH0_ISSUER_BASE_URL=https://sleeparchitects.us.auth0.com
AUTH0_BASE_URL=https://dev.mydreamconnect.com/outreach
API_BASE_URL=https://outreach-api-dev.mydreamconnect.com
NEXT_PUBLIC_API_BASE_URL=https://outreach-api-dev.mydreamconnect.com
NEXT_PUBLIC_WS_URL=wss://outreach-ws-dev.mydreamconnect.com
```

### Custom Domain URLs by Environment

**Develop:**
```bash
OUTREACH_APP_URL=https://outreach-dev.mydreamconnect.com
NEXT_PUBLIC_API_BASE_URL=https://outreach-api-dev.mydreamconnect.com
NEXT_PUBLIC_WS_URL=wss://outreach-ws-dev.mydreamconnect.com
```

**Staging:**
```bash
OUTREACH_APP_URL=https://outreach-staging.mydreamconnect.com
NEXT_PUBLIC_API_BASE_URL=https://outreach-api-staging.mydreamconnect.com
NEXT_PUBLIC_WS_URL=wss://outreach-ws-staging.mydreamconnect.com
```

**Production:**
```bash
OUTREACH_APP_URL=https://outreach.mydreamconnect.com
NEXT_PUBLIC_API_BASE_URL=https://outreach-api.mydreamconnect.com
NEXT_PUBLIC_WS_URL=wss://outreach-ws.mydreamconnect.com
```

### Build-Time Variables

These are embedded during the build process:

```bash
# .env.local or .env.production
NEXT_PUBLIC_APP_BASE_URL=https://outreach.mydreamconnect.com
NEXT_PUBLIC_SLEEPCONNECT_URL=https://dev.mydreamconnect.com
NEXT_PUBLIC_BASE_PATH=/outreach
NEXT_PUBLIC_API_BASE_URL=https://outreach-api.mydreamconnect.com
NEXT_PUBLIC_WS_API_URL=wss://vfb5l5uxak.execute-api.us-east-1.amazonaws.com/dev
```

### Runtime Variables (Lambda)

Set in Lambda environment:

```bash
# Authentication
AUTH0_CLIENT_SECRET=your-secret
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_BASE_URL=https://dev.mydreamconnect.com

# Application
NODE_ENV=production
ENVIRONMENT=production
MULTI_ZONE_MODE=true
DISABLE_AUTH=false  # NEVER true in production
```

### Setting Lambda Environment Variables

```bash
# Update environment variables
aws lambda update-function-configuration \
  --function-name outreach-mydreamconnect-server-production \
  --environment "Variables={
    NODE_ENV=production,
    AUTH0_CLIENT_SECRET=${AUTH0_CLIENT_SECRET},
    AUTH0_DOMAIN=your-tenant.auth0.com,
    MULTI_ZONE_MODE=true
  }" \
  --no-cli-pager
```

Or create a `.env.lambda.json` file:

```json
{
  "Variables": {
    "NODE_ENV": "production",
    "AUTH0_CLIENT_SECRET": "your-secret",
    "AUTH0_DOMAIN": "your-tenant.auth0.com",
    "AUTH0_CLIENT_ID": "your-client-id",
    "AUTH0_BASE_URL": "https://dev.mydreamconnect.com",
    "MULTI_ZONE_MODE": "true",
    "DISABLE_AUTH": "false"
  }
}
```

```bash
aws lambda update-function-configuration \
  --function-name outreach-mydreamconnect-server-production \
  --environment file://.env.lambda.json \
  --no-cli-pager
```

---

## CloudFront IaC Setup

### Option 1: AWS CDK (TypeScript)

Create `infra/cloudfront-stack.ts`:

```typescript
import * as cdk from 'aws-cdk-lib';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class OutreachCloudFrontStack extends cdk.Stack {
  constructor(scope: cdk.App, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Reference existing resources
    const bucket = s3.Bucket.fromBucketName(this, 'AssetsBucket', 
      'outreach-mydreamconnect-production');
    
    const serverFunction = lambda.Function.fromFunctionArn(this, 'ServerFunction',
      'arn:aws:lambda:us-east-1:ACCOUNT:function:outreach-mydreamconnect-server-production');

    // Create CloudFront distribution
    new cloudfront.Distribution(this, 'OutreachDistribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        edgeLambdas: [{
          functionVersion: serverFunction.currentVersion,
          eventType: cloudfront.LambdaEdgeEventType.ORIGIN_REQUEST,
        }],
      },
      additionalBehaviors: {
        '/outreach-static/*': {
          origin: new origins.S3Origin(bucket),
          viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
        },
      },
      domainNames: ['outreach.mydreamconnect.com'],
      certificate: acm.Certificate.fromCertificateArn(this, 'Certificate',
        'arn:aws:acm:us-east-1:ACCOUNT:certificate/CERT_ID'),
    });
  }
}
```

### Option 2: Terraform

Create `infra/cloudfront.tf`:

```hcl
resource "aws_cloudfront_distribution" "outreach" {
  enabled = true
  aliases = ["outreach.mydreamconnect.com"]

  origin {
    domain_name = aws_s3_bucket.assets.bucket_regional_domain_name
    origin_id   = "S3-outreach-assets"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.oai.cloudfront_access_identity_path
    }
  }

  default_cache_behavior {
    target_origin_id       = "S3-outreach-assets"
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS", "PUT", "POST", "PATCH", "DELETE"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]

    lambda_function_association {
      event_type   = "origin-request"
      lambda_arn   = aws_lambda_function.server.qualified_arn
      include_body = true
    }
  }

  ordered_cache_behavior {
    path_pattern           = "/outreach-static/*"
    target_origin_id       = "S3-outreach-assets"
    viewer_protocol_policy = "redirect-to-https"
    cache_policy_id        = data.aws_cloudfront_cache_policy.optimized.id
  }

  viewer_certificate {
    acm_certificate_arn = aws_acm_certificate.outreach.arn
    ssl_support_method  = "sni-only"
  }
}
```

---

## Troubleshooting

### Build Issues

**Error: "Cannot find module '@opennextjs/aws'"**
```bash
# Solution: Install dependencies
npm install
```

**Error: "Output 'standalone' is not compatible with OpenNext"**
```bash
# Solution: This is normal, OpenNext handles standalone output
# Just ensure next.config.mjs has: output: "standalone"
```

### Deployment Issues

**Error: "S3 bucket not found"**
```bash
# Solution: Run infrastructure setup first
./scripts/setup-aws-infrastructure.sh production
```

**Error: "Certificate not validated"**
```bash
# Check certificate status
CERT_ARN=$(cat .aws-cert-arn-production.txt)
aws acm describe-certificate --certificate-arn $CERT_ARN --region us-east-1 --no-cli-pager

# Add DNS validation records if pending
```

**Error: "Lambda function too large"**
```bash
# Solution: Enable minification
npm run build:open-next  # (not build:open-next:debug)

# Or increase Lambda size limit (max 250MB)
```

### Runtime Issues

**500 Error from Lambda**
```bash
# Check Lambda logs
aws logs tail /aws/lambda/outreach-mydreamconnect-server-production --follow

# Check environment variables
aws lambda get-function-configuration \
  --function-name outreach-mydreamconnect-server-production \
  --no-cli-pager
```

**404 for static assets**
```bash
# Verify S3 upload
aws s3 ls s3://outreach-mydreamconnect-production/outreach-static/ --recursive --no-cli-pager

# Check CloudFront cache behavior for /outreach-static/*
```

**Authentication failures**
```bash
# Verify Lambda environment variables include AUTH0_CLIENT_SECRET
# Check Auth0 configuration matches
# Ensure MULTI_ZONE_MODE is set correctly
```

---

## Cost Estimates

### Monthly Costs (Production)

Based on moderate traffic (100K requests/month):

| Service | Cost |
|---------|------|
| Lambda (server) | $5-15 |
| Lambda (image optimization) | $2-5 |
| S3 storage (10GB) | $0.23 |
| S3 requests | $0.50 |
| CloudFront data transfer (100GB) | $8.50 |
| CloudFront requests | $1.00 |
| Route53 hosted zone | $0.50 |
| ACM certificate | FREE |
| **Total** | **~$17.73-30.73/month** |

### Cost Optimization Tips

1. **Enable CloudFront caching** for static assets (31536000s TTL)
2. **Use S3 Intelligent-Tiering** for less frequently accessed files
3. **Set Lambda memory appropriately** (1024MB is usually enough)
4. **Enable CloudFront compression** to reduce data transfer
5. **Use Lambda provisioned concurrency sparingly** (adds significant cost)

---

## Next Steps

1. ✅ Install dependencies: `npm install`
2. ✅ Set up AWS infrastructure: `./scripts/setup-aws-infrastructure.sh production`
3. ⏭️ Validate ACM certificate
4. ⏭️ Build with OpenNext: `npm run build:open-next`
5. ⏭️ Deploy to AWS: `./scripts/deploy-to-aws.sh production`
6. ⏭️ Set up CloudFront distribution (IaC or manual)
7. ⏭️ Configure DNS (Route53 or external)
8. ⏭️ Test deployment
9. ⏭️ Set up CI/CD (optional, see [GitHub Actions](#github-actions))

---

## GitHub Actions

Create `.github/workflows/deploy-aws.yml` for automated deployments:

```yaml
name: Deploy to AWS

on:
  push:
    branches: [main]
  workflow_dispatch:

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
          
      - name: Install dependencies
        run: npm ci
        
      - name: Build with OpenNext
        run: npm run build:open-next
        env:
          NEXT_PUBLIC_APP_BASE_URL: ${{ secrets.APP_BASE_URL }}
          NEXT_PUBLIC_API_BASE_URL: ${{ secrets.API_BASE_URL }}
          
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
          
      - name: Deploy to AWS
        run: ./scripts/deploy-to-aws.sh production
```

---

## Support & References

- **OpenNext Documentation**: https://opennext.js.org
- **Next.js Deployment**: https://nextjs.org/docs/deployment
- **AWS Lambda**: https://docs.aws.amazon.com/lambda/
- **CloudFront**: https://docs.aws.amazon.com/cloudfront/

**Internal Documentation**:
- [AWS-DEPLOYMENT-ARCHITECTURE.md](./AWS-DEPLOYMENT-ARCHITECTURE.md)
- [DEPLOYMENT-HANDOVER.md](./DEPLOYMENT-HANDOVER.md)
- [next.config.mjs](./next.config.mjs)
