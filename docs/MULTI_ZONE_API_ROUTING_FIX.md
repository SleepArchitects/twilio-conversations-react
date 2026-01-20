# Multi-Zone API Routing Fix

**Date:** December 16, 2025  
**Status:** ✅ Resolved  
**Severity:** Critical - API routes not executing

## Executive Summary

Next.js API routes in the Outreach app (`/outreach/api/outreach/*`) were not executing because the SleepConnect proxy was rewriting requests directly to the Lambda API Gateway, bypassing the Next.js API route handlers entirely. This prevented any server-side logic, authentication, and header transformation from running.

---

## Problem Description

### Symptoms

1. **No server logs**: `console.log("[TEMPLATES API] START")` never appeared
2. **Debugger not triggered**: Breakpoints in API routes never hit
3. **Direct Lambda errors**: 400 "Invalid or missing tenant_id" from Lambda
4. **Missing context**: User context headers not being forwarded

### Root Cause

The SleepConnect proxy configuration in `next.config.js` had this rewrite rule:

```javascript
{
  source: '/outreach/api/outreach/:path*',
  destination: `${apiGatewayUrl}/outreach/:path*`,  // ❌ Direct to Lambda
}
```

This meant:
- Client request: `http://localhost:3000/outreach/api/outreach/templates`
- SleepConnect rewrote to: `https://API_GATEWAY/outreach/templates`
- **Skipped**: The Next.js API route at `app/api/outreach/templates/route.ts`

### Architecture Context

```
┌─────────────────────────────────────────────────────────────┐
│                     SleepConnect (Port 3000)                │
│                         Proxy Layer                          │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ❌ BEFORE (Broken):                                        │
│  /outreach/api/outreach/* → API Gateway (direct)           │
│                                                              │
│  ✅ AFTER (Fixed):                                          │
│  /outreach/api/outreach/* → Outreach App → API Gateway     │
│  /outreach/* → Outreach App (pages)                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
                              ↓
                ┌─────────────────────────────┐
                │  Outreach App (Port 3001)   │
                │     basePath: /outreach     │
                ├─────────────────────────────┤
                │                             │
                │  API Routes:                │
                │  ├─ /api/outreach/templates │
                │  ├─ /api/outreach/campaigns │
                │  └─ /api/outreach/messages  │
                │                             │
                │  Pages:                     │
                │  ├─ /templates              │
                │  ├─ /campaigns              │
                │  └─ /messages               │
                │                             │
                └─────────────────────────────┘
                              ↓
                   API Route Middleware:
                   1. Auth validation
                   2. JWT decoding
                   3. Header transformation
                   4. Logging
                              ↓
                ┌─────────────────────────────┐
                │      Lambda API Gateway     │
                │   (0qz7d63vw2...amazonaws)  │
                └─────────────────────────────┘
```

---

## The Fix

### Changed Configuration

**File:** `~/code/SAX/sleepconnect/next.config.js`

```javascript
async rewrites() {
  const outreachUrl = process.env.OUTREACH_APP_URL || 'http://localhost:3001';
  const apiGatewayUrl = process.env.OUTREACH_API_URL || 'https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev';

  return {
    beforeFiles: [
      // ✅ Route API calls through the Outreach app (not direct to Gateway)
      {
        source: '/outreach/api/outreach/:path*',
        destination: `${outreachUrl}/outreach/api/outreach/:path*`,
      },
      // Standard multi-zone routing for pages
      {
        source: '/outreach/:path*',
        destination: `${outreachUrl}/outreach/:path*`,
      },
    ],
  };
}
```

### Why This Works

1. **Request Flow (Before Fix)**:
   ```
   Browser → SleepConnect:3000/outreach/api/outreach/templates
          → API Gateway/outreach/templates (bypassed Outreach app)
          → Lambda (no headers, no context) ❌
   ```

2. **Request Flow (After Fix)**:
   ```
   Browser → SleepConnect:3000/outreach/api/outreach/templates
          → Outreach:3001/outreach/api/outreach/templates
          → API Route Handler executes ✅
             - Decodes JWT from x-sax-user-context cookie
             - Extracts tenant_id, practice_id, saxId
             - Adds x-tenant-id, x-practice-id, x-coordinator-sax-id headers
             - Logs context for debugging
          → API Gateway/outreach/templates (with headers)
          → Lambda (with all required context) ✅
   ```

---

## Critical Components

### 1. API Route Handler Pattern

**File:** `app/api/outreach/templates/route.ts`

The handler does essential work that cannot be bypassed:

```typescript
export const GET = withUserContext(
  async (req: Request, userContext: UserContext) => {
    // 1. Server-side logging
    console.log("[TEMPLATES API] Calling Lambda", {
      tenant: userContext.tenantId,
      practice: userContext.practiceId,
      saxId: userContext.saxId,
    });

    // 2. Build query params from user context
    const queryParams = {
      tenant_id: userContext.tenantId,
      practice_id: userContext.practiceId,
    };

    // 3. Build headers from user context
    const headers = {
      "x-tenant-id": userContext.tenantId,
      "x-practice-id": userContext.practiceId,
      "x-coordinator-sax-id": String(userContext.saxId),
      "x-user-sax-id": String(userContext.saxId),
      "x-sax-id": String(userContext.saxId),
    };

    // 4. Call Lambda with full context
    const lambdaResponse = await api.get(
      buildPath(LAMBDA_API_BASE, "templates"),
      { params: queryParams, headers }
    );

    return NextResponse.json({ data: templates });
  }
);
```

### 2. Authentication Middleware

**File:** `lib/auth.ts` - `withUserContext`

```typescript
export function withUserContext(
  handler: (req: Request, userContext: UserContext) => Promise<NextResponse>
) {
  return async (req: Request) => {
    // Decode x-sax-user-context JWT
    const userContext = await getUserContextFromRequest(req);
    
    if (!userContext) {
      return NextResponse.json(
        { code: "UNAUTHORIZED", message: "Missing user context" },
        { status: 401 }
      );
    }

    return handler(req, userContext);
  };
}
```

### 3. JWT User Context

**Cookie Name:** `x-sax-user-context`

**Payload Structure:**
```json
{
  "email": "user@example.com",
  "name": "User Name",
  "practice_id": "00000000-0000-0000-0000-000000000020",
  "practice_name": "Practice Name",
  "sax_id": "1386",
  "tenant_id": "00000000-0000-0000-0000-000000000001",
  "iat": 1765927563,
  "iss": "sleepconnect",
  "aud": "outreach",
  "exp": 1765931163
}
```

**Signing Secret:** `AUTH0_CLIENT_SECRET` (shared between projects)

---

## Environment Variables

### SleepConnect (Port 3000)

```bash
# Multi-zone routing
OUTREACH_APP_URL=http://localhost:3001
OUTREACH_API_URL=https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev

# Auth0 (for signing JWT)
AUTH0_CLIENT_SECRET=<shared-secret>
```

### Outreach App (Port 3001)

```bash
# Multi-zone mode
MULTI_ZONE_MODE=true

# API endpoints
API_BASE_URL=https://0qz7d63vw2.execute-api.us-east-1.amazonaws.com/dev
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/outreach

# Auth0 (for verifying JWT)
AUTH0_SECRET=<shared-secret>
AUTH0_CLIENT_SECRET=<shared-secret>  # Same as SleepConnect
AUTH0_BASE_URL=http://localhost:3001/outreach
AUTH0_ISSUER_BASE_URL=https://dev-tgu5bvd1fvg00y3p.us.auth0.com
AUTH0_CLIENT_ID=<client-id>
```

**Critical:** `AUTH0_CLIENT_SECRET` must be identical in both apps for JWT signing/verification.

---

## Deployment Considerations

### 1. Production Rewrites

In production, the same routing logic applies but with different URLs:

```javascript
// Production example
const outreachUrl = process.env.OUTREACH_APP_URL || 'https://outreach.saxdevlab.com';
const apiGatewayUrl = process.env.OUTREACH_API_URL || 'https://api.saxdevlab.com/prod';

return {
  beforeFiles: [
    {
      source: '/outreach/api/outreach/:path*',
      destination: `${outreachUrl}/outreach/api/outreach/:path*`,
    },
    {
      source: '/outreach/:path*',
      destination: `${outreachUrl}/outreach/:path*`,
    },
  ],
};
```

### 2. CloudFront / CDN Configuration

If using CloudFront, ensure:

1. **API route path patterns** (`/outreach/api/*`) forward ALL headers and cookies
2. **Cache behavior**: Set `CachePolicyId` to `Managed-CachingDisabled` for API routes
3. **Origin Request Policy**: Include all headers, especially `x-sax-user-context`, `cookie`

Example CloudFront behavior:
```yaml
PathPattern: /outreach/api/*
TargetOriginId: SleepConnectOrigin  # Not direct to Lambda!
AllowedMethods: [GET, HEAD, OPTIONS, PUT, PATCH, POST, DELETE]
CachedMethods: [GET, HEAD, OPTIONS]
CachePolicyId: 4135ea2d-6df8-44a3-9df3-4b5a84be39ad  # CachingDisabled
OriginRequestPolicyId: 216adef6-5c7f-47e4-b989-5492eafa07d3  # AllViewer
```

### 3. Header Requirements

Lambda functions expect these headers:

| Header | Source | Required |
|--------|--------|----------|
| `x-tenant-id` | JWT `tenant_id` | ✅ Yes |
| `x-practice-id` | JWT `practice_id` | ✅ Yes |
| `x-coordinator-sax-id` | JWT `sax_id` | ✅ Yes |
| `x-user-sax-id` | JWT `sax_id` | Recommended |
| `x-sax-id` | JWT `sax_id` | Recommended |

**All headers are added by the Next.js API route handler** - they cannot be bypassed.

### 4. Testing Checklist

Before deploying:

- [ ] Verify `AUTH0_CLIENT_SECRET` is identical in both apps
- [ ] Test API route execution: Check server logs for `[TEMPLATES API] START`
- [ ] Verify user context extraction: Check logs for tenant/practice/saxId values
- [ ] Test Lambda calls: Confirm no "Invalid or missing tenant_id" errors
- [ ] Verify cookie forwarding: Ensure `x-sax-user-context` reaches API routes
- [ ] Test multi-zone navigation: Confirm page routing still works
- [ ] Check static assets: Verify `/outreach-static/*` loads correctly in production

### 5. Common Mistakes to Avoid

❌ **Don't:** Route `/outreach/api/*` directly to API Gateway  
✅ **Do:** Route through the Outreach app for middleware execution

❌ **Don't:** Strip cookies or headers in CloudFront/proxy  
✅ **Do:** Forward ALL headers/cookies to API routes

❌ **Don't:** Use different JWT secrets in SleepConnect vs Outreach  
✅ **Do:** Share `AUTH0_CLIENT_SECRET` between both apps

❌ **Don't:** Cache API responses in CDN  
✅ **Do:** Use `CachingDisabled` policy for `/outreach/api/*`

---

## Troubleshooting Guide

### No Server Logs Appearing

**Symptom:** API route logs (`[TEMPLATES API] START`) don't appear

**Diagnosis:**
```bash
# Check if request reaches the Outreach app
curl http://localhost:3001/outreach/api/outreach/templates \
  -H "Cookie: x-sax-user-context=<jwt-token>"
```

**Fix:** Verify SleepConnect rewrites route to Outreach app, not API Gateway

### "Invalid or missing tenant_id" Errors

**Symptom:** Lambda returns 400 error about missing tenant

**Diagnosis:**
```javascript
// Add to API route handler
console.log("User Context:", userContext);
console.log("Headers to Lambda:", headers);
console.log("Query Params:", queryParams);
```

**Fix:** Ensure:
1. JWT is being decoded: Check `withUserContext` middleware
2. Headers are added: Check `getLambdaHeaders()` function
3. Secrets match: Verify `AUTH0_CLIENT_SECRET` in both apps

### 401 Unauthorized Errors

**Symptom:** API route returns 401 before calling Lambda

**Diagnosis:**
```bash
# Decode JWT to check payload
echo "<jwt-token>" | cut -d'.' -f2 | base64 -d | jq
```

**Fix:** Verify:
1. Cookie is present: Check browser DevTools → Network → Request Headers
2. JWT is valid: Verify signature with `AUTH0_CLIENT_SECRET`
3. JWT hasn't expired: Check `exp` timestamp

---

## Related Documentation

- [LOCAL-DEV-QUICKSTART.md](./LOCAL-DEV-QUICKSTART.md) - Local development setup
- [MULTI-ZONE-DEPLOYMENT-GUIDE.md](./MULTI-ZONE-DEPLOYMENT-GUIDE.md) - Production deployment
- [PHASE-6B-BACKEND-HANDOVER.md](./PHASE-6B-BACKEND-HANDOVER.md) - Lambda API contracts

---

## Change Log

| Date | Change | Author |
|------|--------|--------|
| 2025-12-16 | Fixed API route bypass issue in multi-zone setup | GitHub Copilot |
| 2025-12-16 | Initial documentation | GitHub Copilot |

---

## Summary

The core issue was a **routing misconfiguration** where the SleepConnect proxy sent API requests directly to Lambda, bypassing the Outreach app's Next.js API routes. These routes are critical because they:

1. Decode and validate JWT tokens
2. Extract user context (tenant, practice, coordinator ID)
3. Transform context into required Lambda headers
4. Provide server-side logging and debugging

The fix ensures all `/outreach/api/outreach/*` requests **first pass through the Outreach app** where middleware can execute, then forward to Lambda with complete context.

**Key Takeaway for Deployment:** Never bypass Next.js API routes in a multi-zone setup - they are essential middleware layers, not optional proxies.
