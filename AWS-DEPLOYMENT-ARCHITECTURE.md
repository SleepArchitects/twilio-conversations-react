# AWS Deployment Architecture for SMS Outreach

**Date**: December 17, 2025  
**Project**: Twilio Conversations SMS Outreach  
**Target**: `outreach.mydreamconnect.com`

## 🏗️ Architecture Overview

This Next.js application uses a **standalone output** build and will be deployed to AWS using:

- **S3**: Static asset storage and Next.js server files
- **CloudFront**: CDN, HTTPS, and routing
- **EC2/ECS** (or Lambda): For Next.js server rendering (SSR)
- **ACM**: SSL/TLS certificates
- **Route53**: DNS management

### Deployment Strategy

Since this is a Next.js app with SSR, we have two deployment options:

#### Option 1: Static Export (Recommended for Multi-Zone)
Convert to static export since this app is primarily used in multi-zone mode where SSR is handled by SleepConnect.

**Pros**:
- Simple S3 + CloudFront deployment
- No server management
- Lower costs
- Better multi-zone performance

**Cons**:
- Limited to client-side data fetching
- No API routes (move to separate API)

#### Option 2: Server-Side Rendering with EC2/ECS
Keep full Next.js functionality with server-side rendering.

**Pros**:
- Full Next.js features
- API routes supported
- Dynamic rendering

**Cons**:
- More complex infrastructure
- Higher costs
- Server management required

## 📋 Required AWS Services

### 1. S3 Buckets

#### Production Bucket
- **Name**: `outreach-mydreamconnect-production`
- **Purpose**: Store build artifacts and static assets
- **Configuration**:
  - Static website hosting enabled
  - Public read access (via CloudFront OAI)
  - Versioning enabled (recommended)

#### Development Bucket (Optional)
- **Name**: `outreach-mydreamconnect-dev`
- **Purpose**: Development/staging deployments

### 2. CloudFront Distribution

#### Primary Distribution (`outreach.mydreamconnect.com`)

**Origin Configuration**:
- Origin: S3 bucket or Load Balancer (depending on deployment option)
- Origin Access Identity: Create new OAI for S3 security
- Origin Protocol Policy: HTTPS only (if using ALB)

**Behavior Configuration**:

```yaml
Default Behavior (/outreach/*):
  Viewer Protocol Policy: Redirect HTTP to HTTPS
  Allowed HTTP Methods: GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE
  Cached HTTP Methods: GET, HEAD, OPTIONS
  Cache Policy: CachingOptimized (for static assets)
  Origin Request Policy: AllViewer (for API calls)
  
Static Assets (/outreach-static/*):
  Viewer Protocol Policy: Redirect HTTP to HTTPS
  Allowed HTTP Methods: GET, HEAD, OPTIONS
  Cache Policy: CachingOptimized
  Compress Objects: Yes
  TTL: 31536000 (1 year)
  
API Routes (/outreach/api/*):
  Viewer Protocol Policy: Redirect HTTP to HTTPS
  Cache Policy: CachingDisabled
  Origin Request Policy: AllViewer
```

**Custom Error Responses**:
- 403 → 404.html (or /outreach/404)
- 404 → 404.html (or /outreach/404)

**SSL/TLS Certificate**:
- Use ACM certificate in `us-east-1` region
- Domain: `outreach.mydreamconnect.com`
- Alternative names: `*.mydreamconnect.com` (if wildcard available)

### 3. ACM (AWS Certificate Manager)

**Certificate Configuration**:
- Region: **us-east-1** (required for CloudFront)
- Domain Name: `outreach.mydreamconnect.com`
- Validation Method: DNS validation
- Add CNAME records to Route53 for validation

### 4. Route53

**DNS Records**:

```
Type: A (Alias)
Name: outreach.mydreamconnect.com
Target: CloudFront distribution domain name
Routing Policy: Simple
```

### 5. EC2/ECS/Lambda (Option 2 Only)

If using server-side rendering:

#### EC2 Option:
- Instance Type: t3.small or larger
- OS: Amazon Linux 2023
- Node.js: v18.17.0+
- PM2 for process management
- Application Load Balancer for health checks

#### ECS Option (Recommended):
- Service: Fargate
- Task Definition: 0.5 vCPU, 1GB RAM
- Container: Node.js 18+ with standalone build
- Application Load Balancer

#### Lambda@Edge Option:
- Runtime: Node.js 18.x
- Memory: 512MB
- Timeout: 30 seconds
- Attached to CloudFront distribution

## 🔧 Deployment Architecture

### Option 1: Static S3 + CloudFront (Recommended)

```
User Request
    ↓
Route53 (outreach.mydreamconnect.com)
    ↓
CloudFront Distribution
    ├─→ /outreach-static/* → S3 Bucket (static assets)
    ├─→ /outreach/* → S3 Bucket (HTML pages)
    └─→ 404/403 → 404.html
```

**Build Process**:
1. `npm run build` (creates `.next/` directory)
2. Convert to static export or extract standalone
3. Upload to S3
4. Invalidate CloudFront cache

### Option 2: Server with S3 + CloudFront

```
User Request
    ↓
Route53 (outreach.mydreamconnect.com)
    ↓
CloudFront Distribution
    ├─→ /outreach-static/* → S3 Bucket (cached, long TTL)
    └─→ /outreach/* → Application Load Balancer
                           ↓
                      EC2/ECS Instances
                      (Next.js standalone server)
```

**Build Process**:
1. `npm run build` (creates `.next/standalone`)
2. Upload standalone server to EC2/ECS
3. Upload static assets to S3
4. Deploy new version with rolling update

## 🔐 IAM Roles and Policies

### Deployment User/Role

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:ListBucket",
        "s3:DeleteObject"
      ],
      "Resource": [
        "arn:aws:s3:::outreach-mydreamconnect-*",
        "arn:aws:s3:::outreach-mydreamconnect-*/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "cloudfront:CreateInvalidation",
        "cloudfront:GetInvalidation",
        "cloudfront:ListInvalidations"
      ],
      "Resource": "*"
    }
  ]
}
```

### EC2/ECS Role (Option 2)

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:GetObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::outreach-mydreamconnect-production",
        "arn:aws:s3:::outreach-mydreamconnect-production/*"
      ]
    },
    {
      "Effect": "Allow",
      "Action": [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents"
      ],
      "Resource": "arn:aws:logs:*:*:*"
    }
  ]
}
```

## 📦 Build Configuration

### Current Configuration

The `next.config.mjs` is already configured for deployment:

```javascript
output: "standalone",           // Creates optimized server bundle
basePath: "/outreach",          // Multi-zone base path
assetPrefix: "/outreach-static" // Separate static assets path
```

### Build Outputs

After running `npm run build`:

```
.next/
├── standalone/          # Server code (Option 2)
│   ├── server.js       # Next.js server entry point
│   ├── package.json
│   └── .next/
├── static/             # Static assets (both options)
│   ├── chunks/
│   ├── css/
│   └── media/
└── BUILD_ID
```

## 🚀 Deployment Workflow

### Initial Setup (One-time)

1. **Create S3 Buckets**
2. **Request ACM Certificate** (us-east-1)
3. **Validate Certificate** (DNS)
4. **Create CloudFront Distribution**
5. **Configure Route53 DNS**
6. **Set up IAM roles/users**
7. **Create EC2/ECS resources** (Option 2 only)

### Regular Deployment

1. **Build Application**: `npm run build`
2. **Upload to S3**: Static assets
3. **Deploy Server** (Option 2): Update EC2/ECS
4. **Invalidate CloudFront**: Clear cache
5. **Verify**: Test deployment

## 🔍 Monitoring and Logging

### CloudWatch Logs
- CloudFront access logs → S3 bucket
- EC2/ECS logs → CloudWatch Logs (Option 2)
- Lambda@Edge logs → CloudWatch Logs (Option 2)

### CloudWatch Metrics
- CloudFront requests, errors, cache hit rate
- ALB target health (Option 2)
- EC2/ECS CPU, memory (Option 2)

### X-Ray (Optional)
- Request tracing for performance analysis

## 💰 Cost Estimation

### Option 1 (S3 + CloudFront Only)
- S3: ~$5-20/month (storage + requests)
- CloudFront: ~$10-50/month (data transfer)
- Route53: ~$1/month (hosted zone + queries)
- **Total**: ~$16-71/month

### Option 2 (With Server)
- Above + EC2 t3.small: ~$15/month
- Or ECS Fargate: ~$25-40/month
- Application Load Balancer: ~$16/month
- **Total**: ~$47-127/month

## 📝 Next Steps

1. ✅ Review this architecture document
2. ⏭️ Choose deployment option (Static vs. Server)
3. ⏭️ Create infrastructure setup scripts
4. ⏭️ Create deployment scripts
5. ⏭️ Configure environment variables
6. ⏭️ Set up CI/CD pipeline (optional)

## 🔗 Related Documentation

- [DEPLOYMENT-HANDOVER.md](./DEPLOYMENT-HANDOVER.md) - Multi-zone integration details
- [next.config.mjs](./next.config.mjs) - Next.js configuration
- [.env.example](./.env.example) - Environment variables template
