# Deployment Handover: SMS Outreach Multi-Zone Integration

**Date**: December 16, 2025  
**Project**: Twilio Conversations SMS Outreach  
**Target Domains**:

- Primary: `outreach.mydreamconnect.com` (standalone)
- Multi-zone: `dev.mydreamconnect.com/outreach` (integrated with SleepConnect)
- API: `outreach-api.mydreamconnect.com` (backend API)

---

## 📋 Project Overview

This project is a Next.js application for SMS outreach and conversations management that needs to be deployed in **two modes**:

1. **Standalone Mode**: Independent deployment at `outreach.mydreamconnect.com`
2. **Multi-Zone Mode**: Integrated with SleepConnect at `dev.mydreamconnect.com/outreach`

### Architecture Pattern

```
┌─────────────────────────────────────────────────────────────┐
│ User: https://dev.mydreamconnect.com/outreach/conversations │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ SleepConnect (Main Zone) - dev.mydreamconnect.com          │
│ - Intercepts /outreach/* requests via rewrites              │
│ - Proxies to outreach.mydreamconnect.com                    │
│ - Injects SleepConnect header/footer (SSR)                  │
│ - Forwards JWT token via x-sax-user-context cookie          │
└────────────────────────┬────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Outreach Zone - outreach.mydreamconnect.com                 │
│ - basePath: /outreach                                       │
│ - assetPrefix: /outreach-static (prod) or /outreach (dev)   │
│ - Returns content without header/footer                     │
│ - Validates JWT from x-sax-user-context cookie              │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Backend API - outreach-api.mydreamconnect.com               │
│ - AWS API Gateway (WebSocket + REST)                        │
│ - Lambda functions                                          │
│ - RDS PostgreSQL database                                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 🔐 Environment Variables Required

### `.env.local` Template

Based on `.env.example` and code analysis, here are ALL required environment variables:

```bash
# =============================================================================
# AUTHENTICATION
# =============================================================================

# Authentication is hardened and mandatory.
# For local development, run the SleepConnect multi-zone proxy and use valid test credentials.

# Multi-zone mode: validates JWT from SleepConnect's forwarded cookie
# Set to true when deployed behind SleepConnect proxy
MULTI_ZONE_MODE=true

# Auth0 Configuration
AUTH0_DOMAIN=your-tenant.auth0.com
AUTH0_CLIENT_ID=your-client-id
AUTH0_CLIENT_SECRET=your-client-secret
AUTH0_BASE_URL=https://dev.mydreamconnect.com

# =============================================================================
# APPLICATION URLs
# =============================================================================

# Base URL for this outreach application
NEXT_PUBLIC_APP_BASE_URL=https://outreach.mydreamconnect.com

# SleepConnect main application URL (for redirects and API calls)
NEXT_PUBLIC_SLEEPCONNECT_URL=https://dev.mydreamconnect.com

# Base path for multi-zone (already set in next.config.mjs)
NEXT_PUBLIC_BASE_PATH=/outreach

# =============================================================================
# API CONFIGURATION
# =============================================================================

# Backend API base URL (REST endpoints)
API_BASE_URL=https://outreach-api.mydreamconnect.com
NEXT_PUBLIC_API_BASE_URL=https://outreach-api.mydreamconnect.com

# WebSocket API URL (real-time message updates)
NEXT_PUBLIC_WS_API_URL=wss://outreach-ws-dev.mydreamconnect.com

# =============================================================================
# TWILIO CONFIGURATION
# =============================================================================

# Twilio credentials
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_SID=your-twilio-sid  # Alternative name for ACCOUNT_SID

# Twilio messaging service
TWILIO_MESSAGING_SERVICE_SID=your-messaging-service-sid

# Twilio phone number (for sending SMS)
TWILIO_FROM_NUMBER=+1234567890

# =============================================================================
# FEATURE FLAGS
# =============================================================================

# Enable SLA monitoring and alerts
ENABLE_SLA_MONITORING=true
NEXT_PUBLIC_ENABLE_SLA_MONITORING=true

# Allow international phone numbers
ALLOW_INTERNATIONAL_PHONES=false
NEXT_PUBLIC_ALLOW_INTERNATIONAL_PHONES=false

# =============================================================================
# BRANDING & UI
# =============================================================================

# Practice/organization name
NEXT_PUBLIC_PRACTICE_NAME=Your Practice Name

# Banner configuration
NEXT_PUBLIC_SHOW_BANNER=false
NEXT_PUBLIC_BANNER_LOGO=moonplus
NEXT_PUBLIC_BANNER_LINK=/
NEXT_PUBLIC_BANNER_TEXT=Meet Alora

# =============================================================================
# BUILD & DEPLOYMENT
# =============================================================================

# Node environment
NODE_ENV=production

# CI flag (for automated testing)
CI=false
```

---

## 🌐 AWS Infrastructure Required

### 1. API Gateway (WebSocket + HTTP)

**Current WebSocket URL**: `wss://outreach-ws-dev.mydreamconnect.com`

#### Actions Needed

```bash
# List existing APIs
aws apigatewayv2 get-apis --region us-east-1

# Check for outreach-related APIs
aws apigatewayv2 get-apis --region us-east-1 --query 'Items[?contains(Name, `outreach`)]'

# Get stages for an API
aws apigatewayv2 get-stages --api-id <api-id> --region us-east-1
```

**Target Configuration**:

- **WebSocket API**: For real-time message updates
- **HTTP API**: For REST endpoints (conversations, messages, templates)
- **Custom Domain**: `outreach-api.mydreamconnect.com`

### 2. Route53 DNS Configuration

```bash
# Check hosted zones
aws route53 list-hosted-zones

# Check for mydreamconnect.com zone
aws route53 list-hosted-zones --query 'HostedZones[?Name==`mydreamconnect.com.`]'

# List records in hosted zone
aws route53 list-resource-record-sets --hosted-zone-id <zone-id>
```

**DNS Records Needed**:

- `outreach.mydreamconnect.com` → CloudFront or ALB
- `outreach-api.mydreamconnect.com` → API Gateway custom domain
- `dev.mydreamconnect.com` → SleepConnect (already exists)

### 3. CloudFront Distribution

**Purpose**: Serve static assets with `/outreach-static` prefix

```bash
# List distributions
aws cloudfront list-distributions --query 'DistributionList.Items[*].[Id,DomainName,Comment]'

# Check if outreach distribution exists
aws cloudfront list-distributions --query 'DistributionList.Items[?contains(Comment, `outreach`)]'
```

**Configuration Needed**:

- Origin: S3 bucket or Next.js server
- Alternate domain: `outreach.mydreamconnect.com`
- SSL certificate: ACM certificate for `*.mydreamconnect.com`
- Behaviors:
  - `/outreach-static/*` → S3 static assets
  - `/outreach/*` → Next.js server

### 4. RDS Database

```bash
# List RDS instances
aws rds describe-db-instances --region us-east-1 --query 'DBInstances[*].[DBInstanceIdentifier,Engine,Endpoint.Address]'
```

**Connection Details Needed**:

- Host: `<instance>.cluster-<id>.us-east-1.rds.amazonaws.com`
- Port: `5432`
- Database name: `outreach` or `sleepconnect`
- Credentials: Store in AWS Secrets Manager

---

## 📦 Deployment Architecture

### Current Configuration (next.config.mjs)

```javascript
{
  output: "standalone",           // For OpenNext/Lambda deployment
  basePath: "/outreach",           // Multi-zone base path
  assetPrefix: process.env.NODE_ENV === "production"
    ? "/outreach-static"           // CloudFront path
    : "/outreach",                 // Dev server path
}
```

### Multi-Zone Integration Points

#### 1. SleepConnect Rewrites (needs to be added to SleepConnect project)

```javascript
// In sleepconnect/next.config.js
async rewrites() {
  return [
    {
      source: '/outreach/:path*',
      destination: 'https://outreach.mydreamconnect.com/outreach/:path*',
      // In multi-zone mode, SleepConnect proxies to Outreach zone
    }
  ]
}
```

#### 2. JWT Cookie Forwarding

**Cookie Name**: `x-sax-user-context`  
**Content**: Signed JWT with user context from Auth0  
**Validation**: `lib/jwt-utils.ts` verifies signature using `AUTH0_CLIENT_SECRET`

**User Context Structure**:

```typescript
{
  sub: string;           // Auth0 user ID
  email: string;
  name: string;
  roles: string[];       // e.g., ["admin", "provider"]
  practice_id: string;
  iat: number;
  exp: number;
}
```

#### 3. Middleware Authentication Flow

See [middleware.ts](middleware.ts):

- Checks for `x-sax-user-context` cookie
- Verifies JWT signature
- Redirects to SleepConnect login if invalid
- Allows Auth0 routes to be handled by SleepConnect

---

## 🚀 Deployment Steps

### Phase 1: AWS Infrastructure Setup

1. **Create/Verify API Gateway**

   ```bash
   # Find existing WebSocket API
   aws apigatewayv2 get-apis --region us-east-1

   # Create custom domain for outreach-api.mydreamconnect.com
   aws apigatewayv2 create-domain-name \
     --domain-name outreach-api.mydreamconnect.com \
     --domain-name-configurations CertificateArn=arn:aws:acm:us-east-1:xxx
   ```

2. **Configure Route53 DNS**

   ```bash
   # Add A record for outreach.mydreamconnect.com
   # Add CNAME record for outreach-api.mydreamconnect.com → API Gateway
   ```

3. **Setup CloudFront Distribution**
   - Origin: Next.js deployment (Lambda/Fargate)
   - Alternate domain: `outreach.mydreamconnect.com`
   - SSL: ACM certificate

4. **Database Connection**

   ```bash
   # Get RDS endpoint
   aws rds describe-db-instances --region us-east-1

   # Store credentials in Secrets Manager
   aws secretsmanager create-secret \
     --name outreach/db/credentials \
     --secret-string '{"username":"xxx","password":"xxx","host":"xxx"}'
   ```

### Phase 2: Environment Configuration

1. **Create `.env.production` file** with all variables from template above
2. **Update domain references**:
   - `NEXT_PUBLIC_APP_BASE_URL=https://outreach.mydreamconnect.com`
   - `NEXT_PUBLIC_SLEEPCONNECT_URL=https://dev.mydreamconnect.com`
   - `API_BASE_URL=https://outreach-api.mydreamconnect.com`

3. **Configure Auth0**:
   - Add callback URL: `https://dev.mydreamconnect.com/callback`
   - Add logout URL: `https://dev.mydreamconnect.com/`
   - Add allowed origins: `https://outreach.mydreamconnect.com`

### Phase 3: SleepConnect Integration

**In the SleepConnect project**, add rewrites:

```javascript
// sleepconnect/next.config.js
module.exports = {
  async rewrites() {
    return [
      {
        source: "/outreach/:path*",
        destination: "https://outreach.mydreamconnect.com/outreach/:path*",
      },
    ];
  },

  async headers() {
    return [
      {
        source: "/outreach/:path*",
        headers: [
          {
            key: "x-sax-user-context",
            value: "{{JWT_TOKEN}}", // Set in middleware
          },
        ],
      },
    ];
  },
};
```

**In SleepConnect middleware**, forward JWT:

```typescript
// sleepconnect/middleware.ts
export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/outreach")) {
    const session = await getSession(request);

    if (session) {
      // Create JWT token with user context
      const token = await signUserContextToken({
        sub: session.user.sub,
        email: session.user.email,
        name: session.user.name,
        roles: session.user.roles,
        practice_id: session.user.practice_id,
      });

      // Forward to Outreach zone with JWT cookie
      const response = NextResponse.rewrite(
        new URL("/outreach" + request.nextUrl.pathname, request.url),
      );
      response.cookies.set("x-sax-user-context", token, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
      });
      return response;
    }
  }

  return NextResponse.next();
}
```

### Phase 4: Build and Deploy

```bash
# Build Next.js application
pnpm build

# Deploy to AWS (using OpenNext or similar)
# Option 1: OpenNext + Lambda
npx open-next build

# Option 2: Docker + ECS/Fargate
docker build -t outreach-app .
docker push <ecr-repo>/outreach-app:latest

# Option 3: Vercel (if using Vercel for hosting)
vercel --prod
```

### Phase 5: Verification

1. **Test Standalone Mode**:

   ```bash
   curl https://outreach.mydreamconnect.com/outreach/conversations
   # Should redirect to login if not authenticated
   ```

2. **Test Multi-Zone Mode**:

   ```bash
   # Login to SleepConnect first
   # Then navigate to:
   https://dev.mydreamconnect.com/outreach/conversations
   # Should show Outreach UI with SleepConnect header/footer
   ```

3. **Test API Endpoints**:

   ```bash
   curl https://outreach-api.mydreamconnect.com/outreach/conversations
   # Should return conversations data (with auth token)
   ```

4. **Test WebSocket Connection**:

   ```bash
   wscat -c wss://outreach-ws-dev.mydreamconnect.com
   # Should establish connection
   ```

---

## 📝 Key Code References

### Environment Variable Usage

| Variable                       | Used In                                                                                                                                    | Purpose                      |
| ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| `AUTH0_CLIENT_SECRET`          | [lib/jwt-utils.ts](lib/jwt-utils.ts#L19)                                                                                                   | JWT signature verification   |
| `TWILIO_ACCOUNT_SID`           | [lib/twilio.ts](lib/twilio.ts#L5)                                                                                                          | Twilio client initialization |
| `TWILIO_AUTH_TOKEN`            | [lib/twilio.ts](lib/twilio.ts#L6)                                                                                                          | Twilio authentication        |
| `MULTI_ZONE_MODE`              | [lib/auth.ts](lib/auth.ts#L56)                                                                                                             | Enable multi-zone behavior   |
| `NEXT_PUBLIC_SLEEPCONNECT_URL` | [middleware.ts](middleware.ts#L48), [components/auth/AuthGuard.tsx](components/auth/AuthGuard.tsx#L77)                                     | SleepConnect redirects       |
| `API_BASE_URL`                 | [lib/api.ts](lib/api.ts#L9)                                                                                                                | Backend API calls            |
| `NEXT_PUBLIC_WS_API_URL`       | [hooks/useMessages.ts](hooks/useMessages.ts#L58)                                                                                           | WebSocket connection         |
| `ENABLE_SLA_MONITORING`        | [app/api/outreach/conversations/[conversationId]/messages/route.ts](app/api/outreach/conversations/[conversationId]/messages/route.ts#L26) | SLA tracking feature         |

### Critical Files

1. **[next.config.mjs](next.config.mjs)** - Multi-zone configuration
2. **[middleware.ts](middleware.ts)** - Authentication & redirects
3. **[lib/jwt-utils.ts](lib/jwt-utils.ts)** - JWT verification
4. **[lib/auth.ts](lib/auth.ts)** - Auth helpers
5. **[lib/api.ts](lib/api.ts)** - API client configuration

---

## 🔍 AWS Resources Checklist

Use these commands to inventory existing resources:

```bash
# 1. API Gateway
aws apigatewayv2 get-apis --region us-east-1 | grep -E '(ApiId|Name|ApiEndpoint)'

# 2. Lambda Functions
aws lambda list-functions --region us-east-1 --query 'Functions[?contains(FunctionName, `outreach`)]'

# 3. CloudFront Distributions
aws cloudfront list-distributions --query 'DistributionList.Items[*].[Id,Comment,DomainName]'

# 4. RDS Instances
aws rds describe-db-instances --region us-east-1 --query 'DBInstances[*].[DBInstanceIdentifier,Endpoint.Address]'

# 5. Route53 Records
aws route53 list-hosted-zones --query 'HostedZones[?Name==`mydreamconnect.com.`].Id' --output text | \
  xargs -I {} aws route53 list-resource-record-sets --hosted-zone-id {}

# 6. ACM Certificates
aws acm list-certificates --region us-east-1 --query 'CertificateSummaryList[*].[DomainName,CertificateArn]'

# 7. CloudWatch Log Groups
aws logs describe-log-groups --region us-east-1 --log-group-name-prefix /aws/lambda/outreach

# 8. Secrets Manager
aws secretsmanager list-secrets --region us-east-1 --query 'SecretList[?contains(Name, `outreach`)]'
```

---

## 🐛 Common Issues & Solutions

### Issue 1: CSS/Assets Not Loading

**Symptom**: Styles don't render, 404 errors in browser console for `/_next/static/*`

**Cause**: `assetPrefix` misconfiguration

**Solution**: Already fixed in [next.config.mjs](next.config.mjs#L10):

```javascript
assetPrefix: process.env.NODE_ENV === "production"
  ? "/outreach-static"
  : "/outreach";
```

### Issue 2: Authentication Loop

**Symptom**: Endless redirects between login and /outreach/conversations

**Cause**: JWT cookie not being set or verified correctly

**Solution**:

1. Check `AUTH0_CLIENT_SECRET` matches between SleepConnect and Outreach
2. Verify cookie is set with `httpOnly`, `secure`, `sameSite: 'lax'`
3. Check middleware logs: `console.log('[OUTREACH MIDDLEWARE]')`

### Issue 3: API Calls Failing

**Symptom**: 404 or CORS errors when calling backend API

**Cause**: `API_BASE_URL` not set or incorrect

**Solution**:

1. Verify `API_BASE_URL` in environment
2. Check API Gateway is deployed and accessible
3. Ensure CORS headers are configured in API Gateway

### Issue 4: WebSocket Connection Fails

**Symptom**: Real-time messages not updating

**Cause**: `NEXT_PUBLIC_WS_API_URL` incorrect or WebSocket API not deployed

**Solution**:

1. Test WebSocket URL: `wscat -c <WS_URL>`
2. Verify API Gateway WebSocket API stage is deployed
3. Check Lambda function logs for connection errors

---

## 📚 Additional Resources

### Documentation Files

- [AUTHENTICATION.md](docs/AUTHENTICATION.md) - Auth flow details
- [JWT-MIGRATION.md](docs/JWT-MIGRATION.md) - JWT implementation guide
- [FIXES-APPLIED-2025-12-08.md](specs/001-sms-outreach-integration/FIXES-APPLIED-2025-12-08.md) - Recent fixes applied
- [PHASE-6B-FRONTEND-COMPLETE.md](PHASE-6B-FRONTEND-COMPLETE.md) - Frontend completion status

### External References

- [Next.js Multi-Zones](https://nextjs.org/docs/pages/building-your-application/deploying/multi-zones)
- [Next.js Rewrites](https://nextjs.org/docs/pages/api-reference/next-config-js/rewrites)
- [Auth0 Custom Domains](https://auth0.com/docs/customize/custom-domains)
- [AWS API Gateway Custom Domains](https://docs.aws.amazon.com/apigateway/latest/developerguide/how-to-custom-domains.html)

---

## 🎯 Next Actions

### Immediate Tasks

1. ✅ Complete environment variable inventory (done above)
2. ⬜ Locate SleepConnect project folder
3. ⬜ Run AWS inventory commands to find existing resources
4. ⬜ Create `.env.production` file with actual values
5. ⬜ Configure SleepConnect rewrites and JWT forwarding

### AWS Infrastructure Tasks

1. ⬜ Verify API Gateway endpoints exist
2. ⬜ Create custom domain `outreach-api.mydreamconnect.com`
3. ⬜ Setup CloudFront distribution for `outreach.mydreamconnect.com`
4. ⬜ Configure Route53 DNS records
5. ⬜ Test database connectivity

### Integration Tasks

1. ⬜ Add multi-zone rewrites to SleepConnect `next.config.js`
2. ⬜ Implement JWT forwarding in SleepConnect middleware
3. ⬜ Test authentication flow end-to-end
4. ⬜ Verify header/footer injection from SleepConnect

### Deployment Tasks

1. ⬜ Build Next.js application (`pnpm build`)
2. ⬜ Deploy to AWS (OpenNext/Lambda or ECS)
3. ⬜ Configure environment variables in deployment environment
4. ⬜ Test standalone mode at `outreach.mydreamconnect.com`
5. ⬜ Test multi-zone mode at `dev.mydreamconnect.com/outreach`

---

## 📞 Support & Troubleshooting

### Logs to Check

```bash
# CloudWatch Logs - API Gateway
aws logs tail /aws/apigateway/<api-id> --follow

# CloudWatch Logs - Lambda
aws logs tail /aws/lambda/<function-name> --follow

# Local development logs
pnpm dev
# Check terminal output for [OUTREACH MIDDLEWARE] and [API] logs
```

### Debug Mode

Enable verbose logging by setting:

```bash
DEBUG=* pnpm dev
```

### Health Checks

```bash
# Frontend health
curl https://outreach.mydreamconnect.com/outreach/api/health

# API health
curl https://outreach-api.mydreamconnect.com/health

# WebSocket health
wscat -c wss://outreach-ws-dev.mydreamconnect.com
```

---

**Document Status**: Ready for handover  
**Last Updated**: December 16, 2025  
**Next Review**: After AWS infrastructure inventory
