# AWS Deployment - Quick Reference

**Project**: SMS Outreach Zone  
**Method**: OpenNext (Next.js → AWS Lambda)  
**⚠️ IMPORTANT**: Use `deploy-outreach.cjs` script (NOT the bash scripts)

## 🚀 Quick Commands

```bash
# Install dependencies
npm install

# Build for AWS with OpenNext
npm run build:open-next

# Deploy to develop environment
node scripts/deploy-outreach.cjs develop

# Deploy to staging
node scripts/deploy-outreach.cjs staging

# Deploy to production
node scripts/deploy-outreach.cjs production
```

## ⚠️ FIRST TIME SETUP REQUIRED

**Before first deployment, complete these manual steps:**

1. Create S3 bucket
2. Create Lambda IAM role
3. Create Lambda function (placeholder)
4. Create Lambda Function URL
5. Set Lambda environment variables
6. Update SleepConnect CloudFront
7. Redeploy SleepConnect

**See**: [AWS-PRE-DEPLOYMENT-SETUP.md](./AWS-PRE-DEPLOYMENT-SETUP.md) for detailed instructions

## 📁 Key Files

| File | Purpose | Status |
|------|---------|--------|
| `open-next.config.ts` | OpenNext build configuration | ✅ Ready |
| `package.json` | OpenNext dependency and build scripts | ✅ Ready |
| `scripts/deploy-outreach.cjs` | **USE THIS** - Deployment script | ✅ Ready |
| `scripts/setup-aws-infrastructure.sh` | ❌ Reference only - Don't use | 📚 Docs |
| `scripts/deploy-to-aws.sh` | ❌ Reference only - Don't use | 📚 Docs |
| `.github/workflows/deploy-aws.yml` | CI/CD automation | ✅ Ready |
| `AWS-PRE-DEPLOYMENT-SETUP.md` | **READ THIS FIRST** | 📖 Guide |
| `AWS-DEPLOYMENT-GUIDE.md` | Complete deployment guide | 📖 Guide |
| `AWS-QUICK-REFERENCE.md` | This file | 📖 Guide |

## 🏗️ Infrastructure (One-Time Setup)

**CRITICAL**: Follow [AWS-PRE-DEPLOYMENT-SETUP.md](./AWS-PRE-DEPLOYMENT-SETUP.md) step-by-step

Quick checklist:

```bash
# 1. Create S3 bucket
aws s3 mb s3://sax-nextjs-us-east-1-develop-outreach-assets --region us-east-1

# 2. Create Lambda role
aws iam create-role --role-name sax-lambda-outreach-execution-role --assume-role-policy-document file://trust-policy.json

# 3. Create Lambda function
aws lambda create-function --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop ...

# 4. Create Function URL
aws lambda create-function-url-config --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop --auth-type NONE

# 5. Set environment variables
aws lambda update-function-configuration --function-name sax-lambda-us-east-1-0x-d-outreach-server_develop --environment Variables={...}

# 6. Update SleepConnect CloudFront
# - Add S3 origin for outreach assets
# - Add behavior: /outreach-static/* → S3
# - Set OUTREACH_APP_URL in SleepConnect

# 7. Redeploy SleepConnect
cd ../sleepconnect && pnpm deploy:dev
```

## 📦 Build Output

After `npm run build:open-next`:

```
.open-next/
├── server-functions/
│   └── default/              → Lambda (Next.js SSR)
│       ├── index.mjs        → Entry point
│       └── ...
├── assets/                   → S3 (static files)
│   ├── _next/               → JS/CSS bundles
│   └── ...
├── image-optimization-function/ → Lambda (images, optional)
└── cache/                    → Build cache
```

**Deploy script uses**: `.open-next/server-functions/default/` (correct for OpenNext v3)

## ☁️ AWS Resources Created

| Resource | Name/ID | Purpose |
|----------|---------|---------|
| S3 Bucket | `sax-nextjs-us-east-1-{env}-outreach-assets` | Static assets |
| Lambda | `sax-lambda-us-east-1-0x-{d/s/p}-outreach-server_{env}` | Next.js SSR |
| Lambda Function URL | (generated, save to file) | Public endpoint |
| IAM Role | `sax-lambda-outreach-execution-role` | Lambda permissions |
| CloudFront | (SleepConnect's distribution) | CDN + routing |
| CloudFront Behavior | `/outreach-static/*` → S3 | Static assets |
| CloudFront Behavior | `/outreach/*` → Lambda | SSR pages |

**Note**: No separate CloudFront distribution - uses SleepConnect's multi-zone setup

## 🔐 Required Secrets

### Build-time (public)

```bash
NEXT_PUBLIC_APP_BASE_URL=https://outreach.mydreamconnect.com
NEXT_PUBLIC_SLEEPCONNECT_URL=https://dev.mydreamconnect.com
NEXT_PUBLIC_BASE_PATH=/outreach
NEXT_PUBLIC_API_BASE_URL=https://outreach-api.mydreamconnect.com
NEXT_PUBLIC_WS_API_URL=wss://...amazonaws.com/dev
```

### Runtime (Lambda environment)

```bash
AUTH0_CLIENT_SECRET=***
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=***
AUTH0_BASE_URL=https://dev.mydreamconnect.com
NODE_ENV=production
MULTI_ZONE_MODE=true
```

 (or local build)
2. **GitHub Actions** triggers (or manual: `npm run build:open-next`)
3. **OpenNext** transforms Next.js → AWS format (`.open-next/`)
4. **deploy-outreach.cjs** zips Lambda code, uploads to S3 + Lambda
5. **CloudFront** invalidation clears cache (if dist ID provided)
6. **Done** ✅

**Multi-zone flow:**

```
User → dev.mydreamconnect.com/outreach
  ↓
SleepConnect CloudFront
  ↓
/outreach-static/* → S3 (outreach assets bucket)
/outreach/* → Lambda Function URL (Outreach server)
  ↓pre-deployment setup (Step 1) |
| Lambda not found | Run pre-deployment setup (Step 3) |
| Lambda 500 error | Check logs: `aws logs tail /aws/lambda/sax-lambda-us-east-1-0x-d-outreach-server_develop --follow` |
| 404 on static assets | Verify S3 upload and CloudFront `/outreach-static/*` behavior |
| Auth failing | Check Lambda env vars match SleepConnect's Auth0 config |
| Middleware redirect loop | Verify `x-sax-user-context` cookie is forwarded from SleepConnect |
| Backend API 404 | Verify API Gateway is deployed and URL is correct |

**Debug build output:**
```bash
# Check OpenNext created correct structure
ls -la .open-next/server-functions/default/index.mjs

# Test Lambda locally (if using SAM)
sam local invoke --event event.json

# Stream Lambda logs
aws logs tail /aws/lambda/sax-lambda-us-east-1-0x-d-outreach-server_develop --follow --format short
```

```** transforms Next.js → AWS format
4. **Deploy script** uploads to S3 + Lambda
5. **CloudFront** invalidation clears cache
6. **Done** ✅

## 🐛 Troubleshooting
Deployment script ready (`scripts/deploy-outreach.cjs`)
- [x] CI/CD workflow ready (`.github/workflows/deploy-aws.yml`)
- [x] Environment variables documented (`.env.example`)
- [ ] **AWS credentials configured** (`aws configure`)
- [ ] **S3 bucket created** (see AWS-PRE-DEPLOYMENT-SETUP.md)
- [ ] **Lambda function created** (see AWS-PRE-DEPLOYMENT-SETUP.md)
- [ ] **Lambda Function URL created** (see AWS-PRE-DEPLOYMENT-SETUP.md)
- [ ] **Lambda environment variables set** (see AWS-PRE-DEPLOYMENT-SETUP.md)
- [ ] **SleepConnect CloudFront updated** (see AWS-PRE-DEPLOYMENT-SETUP.md)
- [ ] **SleepConnect redeployed** with OUTREACH_APP_URL
- [ ] **Backend API Gateway verified** (accessible)
- [ ] **First deployment completed** (`node scripts/deploy-outreach.cjs develop`)
- [ ] **Tested** via dev.mydreamconnect.com/outreach

## 🎯 Next Steps

**If this is your first time:**

1. **Read**: [AWS-PRE-DEPLOYMENT-SETUP.md](./AWS-PRE-DEPLOYMENT-SETUP.md)
2. **Complete**: All 10 setup steps (one-time)
3. **Deploy**: `node scripts/deploy-outreach.cjs develop`
4. **Test**: Visit https://dev.mydreamconnect.com/outreach

**For regular deployments:**

1. Make code changes
2. Commit and push to GitHub (triggers CI/CD)
3. Or manually: `npm run build:open-next && node scripts/deploy-outreach.cjs develop`
4. Test and verifylete guide
- **[AWS-DEPLOYMENT-ARCHITECTURE.md](./AWS-DEPLOYMENT-ARCHITECTURE.md)** - Architecture details
- **[DEPLOYMENT-HANDOVER.md](./DEPLOYMENT-HANDOVER.md)** - Multi-zone integration

## ✅ Prerequisites Checklist

- [x] OpenNext installed (`@opennextjs/aws` in package.json)
- [x] Build scripts added (`build:open-next`)
- [x] OpenNext config created (`open-next.config.ts`)
- [x] Infrastructure script ready (`scripts/setup-aws-infrastructure.sh`)
- [x] Deployment script ready (`scripts/deploy-to-aws.sh`)
- [x] CI/CD workflow ready (`.github/workflows/deploy-aws.yml`)
- [ ] AWS credentials configured (`aws configure`)
- [ ] Infrastructure deployed (`./scripts/setup-aws-infrastructure.sh`)
- [ ] ACM certificate validated (DNS CNAME)
- [ ] First deployment completed (`./scripts/deploy-to-aws.sh`)
- [ ] CloudFront distribution created (manual or IaC)
- [ ] DNS configured (Route53 or external)

## 🎯 Next Steps

1. **Install dependencies**: `npm install`
2. **Configure AWS CLI**: `aws configure`
3. **Run infrastructure setup**: `./scripts/setup-aws-infrastructure.sh production`
4. **Validate certificate**: Add DNS records
5. **Test build**: `npm run build:open-next`
6. **Deploy**: `./scripts/deploy-to-aws.sh production`
7. **Set up CloudFront** (see AWS-DEPLOYMENT-GUIDE.md)
8. **Configure DNS** to point to CloudFront
9. **Test**: Visit `https://outreach.mydreamconnect.com/outreach`

---

**Need help?** See [AWS-DEPLOYMENT-GUIDE.md](./AWS-DEPLOYMENT-GUIDE.md) for detailed instructions.
