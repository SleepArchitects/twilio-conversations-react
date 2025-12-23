# SleepConnect Multi-Zone Authentication Integration

## TL;DR

SleepConnect's middleware must inject the `x-sax-user-context` JWT header when proxying requests to the Outreach zone (`/outreach/*`). This header contains user session data that the Outreach zone uses for authentication.

## Current Status

✅ **WORKAROUND IMPLEMENTED**: Outreach zone now falls back to reading Auth0 session cookies directly  
❌ **PROPER FIX NEEDED**: SleepConnect should forward JWT header (preferred method)

---

## Problem Description

The Outreach zone is a separate Next.js application deployed as a multi-zone setup. It needs to authenticate users but doesn't have direct access to Auth0 session cookies due to Next.js zone limitations.

### What's Happening Now

1. User authenticates with SleepConnect (Auth0 session stored in `__session__*` cookies)
2. User navigates to `/outreach/*` 
3. SleepConnect proxies the request to Outreach zone
4. **ISSUE**: `x-sax-user-context` JWT header is NOT being forwarded
5. **WORKAROUND**: Outreach reads Auth0 cookies directly (less secure, not ideal)

### Why This Matters

- **Security**: Auth0 session cookies should only be read by the Auth0 SDK in SleepConnect
- **Performance**: Creating JWT on every request is inefficient
- **Architecture**: Proper zone separation requires header-based communication

---

## Required Implementation

### Location

**File**: SleepConnect's Next.js middleware (likely `middleware.ts` or similar)

### Implementation Steps

#### Step 1: Create JWT Token Helper

```typescript
// lib/jwt-token-creator.ts (in SleepConnect repo)
import { SignJWT } from "jose";
import { Session } from "@auth0/nextjs-auth0";

/**
 * Create JWT token for Outreach zone from Auth0 session
 * This token is passed via x-sax-user-context header
 */
export async function createOutreachJWT(session: Session): Promise<string> {
  const secret = process.env.AUTH0_CLIENT_SECRET;
  if (!secret) {
    throw new Error("AUTH0_CLIENT_SECRET not configured");
  }

  const user = session.user as any; // Your SaxClaims type

  const encoder = new TextEncoder();
  const token = await new SignJWT({
    sax_id: user.sax_id,
    tenant_id: user.tenant_id,
    practice_id: user.practice_id,
    email: user.email || "",
    name: user.name || "",
  })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setIssuer("sleepconnect")
    .setAudience("outreach")
    .setExpirationTime("1h")
    .sign(encoder.encode(secret));

  return token;
}
```

#### Step 2: Update Middleware to Inject Header

```typescript
// middleware.ts (in SleepConnect repo)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { auth0 } from "./lib/auth0";
import { createOutreachJWT } from "./lib/jwt-token-creator";

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Check if this is a request to the Outreach zone
  if (pathname.startsWith("/outreach")) {
    console.log("[Middleware] Request to Outreach zone:", pathname);

    try {
      // Get the user's Auth0 session
      const session = await auth0.getSession();

      if (!session?.user) {
        console.warn("[Middleware] No session for Outreach request");
        // Let Outreach handle unauthenticated requests
        return NextResponse.next();
      }

      // Create JWT token for Outreach zone
      const jwtToken = await createOutreachJWT(session);
      console.log("[Middleware] Created JWT for Outreach zone");

      // Clone the request and add the JWT header
      const requestHeaders = new Headers(request.headers);
      requestHeaders.set("x-sax-user-context", jwtToken);

      // Create response with the modified headers
      const response = NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      });

      console.log("[Middleware] Forwarding request with x-sax-user-context header");
      return response;
    } catch (error) {
      console.error("[Middleware] Error creating JWT for Outreach:", error);
      // Continue without the header - Outreach will use fallback
      return NextResponse.next();
    }
  }

  // Other middleware logic for non-Outreach requests
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    "/((?!_next/static|_next/image|favicon.ico|public).*)",
  ],
};
```

#### Step 3: Environment Configuration

Ensure `AUTH0_CLIENT_SECRET` is available in SleepConnect's environment:

```bash
# .env.local or deployment config
AUTH0_CLIENT_SECRET=your_auth0_client_secret_here
```

**CRITICAL**: Both SleepConnect and Outreach MUST use the **same** `AUTH0_CLIENT_SECRET` for JWT signing/verification to work.

---

## Testing the Implementation

### Step 1: Verify JWT is Being Created

Add logging to see if JWT is being generated:

```bash
# In SleepConnect logs, you should see:
[Middleware] Request to Outreach zone: /outreach/conversations
[Middleware] Created JWT for Outreach zone
[Middleware] Forwarding request with x-sax-user-context header
```

### Step 2: Check Outreach Receives Header

In Outreach zone, the `/api/auth/set-cookie` endpoint will log:

```bash
# Should see this (preferred):
[Set Cookie API] ✅ Found x-sax-user-context header (preferred method)

# Currently seeing this (fallback):
[Set Cookie API] ⚠️  No x-sax-user-context header - falling back to Auth0 session
```

### Step 3: Manual Testing with curl

```bash
# From SleepConnect, proxy a request with the JWT header
curl 'https://sleepconnect.example.com/outreach/api/auth/set-cookie' \
  -H 'Cookie: __session__0=...; __session__1=...' \
  -v

# Check response headers to verify JWT was set:
# Should see: Set-Cookie: x-sax-user-context=eyJ...
```

---

## Security Considerations

### JWT Token Security

- ✅ **Signed**: JWT is signed with `AUTH0_CLIENT_SECRET` (HMAC SHA-256)
- ✅ **Short-lived**: Token expires in 1 hour
- ✅ **Audience-specific**: Token explicitly for "outreach" audience
- ✅ **Issuer validation**: Token issued by "sleepconnect"

### Why Use JWT Header Instead of Cookie Sharing

1. **Zone Isolation**: Each zone manages its own auth independently
2. **No Cookie Conflicts**: Avoids cookie path/domain conflicts between zones
3. **Standard Pattern**: Header-based auth is standard for microservices
4. **Explicit Control**: SleepConnect explicitly decides what data to share

### Secret Management

**IMPORTANT**: The `AUTH0_CLIENT_SECRET` is shared between zones. Ensure:

- Secret is stored securely (AWS Secrets Manager, etc.)
- Both applications pull from the same secret source
- Secret rotation updates both applications simultaneously

---

## Troubleshooting

### JWT Header Not Received

**Symptoms**: Outreach logs show fallback to Auth0 session

**Checks**:
1. Verify SleepConnect middleware is running on `/outreach/*` paths
2. Check SleepConnect logs for JWT creation
3. Verify `AUTH0_CLIENT_SECRET` is set in SleepConnect environment
4. Check Next.js version compatibility (middleware behavior changed in v13+)

### JWT Verification Fails

**Symptoms**: `[JWT] Token verification failed` in Outreach logs

**Checks**:
1. Verify both apps use the **exact same** `AUTH0_CLIENT_SECRET`
2. Check JWT issuer is "sleepconnect" and audience is "outreach"
3. Verify token hasn't expired (1 hour max age)
4. Check jose library version compatibility

### Performance Issues

**Symptoms**: Slow requests to Outreach zone

**Solutions**:
1. Cache JWT tokens per session (use session ID as cache key)
2. Consider longer JWT expiration (2-4 hours) with refresh mechanism
3. Use Redis or similar for distributed JWT caching

---

## Migration Path

### Phase 1: Current State (DONE)
- ✅ Outreach has fallback to Auth0 cookies
- ✅ Authentication works but not optimal
- ✅ Diagnostic logging in place

### Phase 2: Implement Header Forwarding (TODO)
- [ ] Add JWT creator to SleepConnect
- [ ] Update SleepConnect middleware
- [ ] Deploy to dev environment
- [ ] Verify header is received

### Phase 3: Remove Fallback (FUTURE)
- [ ] Confirm header-based auth works reliably
- [ ] Remove Auth0 cookie fallback from Outreach
- [ ] Update documentation
- [ ] Deploy to production

---

## References

- [Next.js Middleware Documentation](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Multi-Zone Setup](https://nextjs.org/docs/pages/building-your-application/deploying/multi-zones)
- [jose JWT Library](https://github.com/panva/jose) (Edge Runtime compatible)
- [Auth0 Next.js SDK](https://github.com/auth0/nextjs-auth0)

---

## Questions?

Contact the Outreach zone team for:
- JWT token format specifications
- Environment variable requirements
- Testing assistance