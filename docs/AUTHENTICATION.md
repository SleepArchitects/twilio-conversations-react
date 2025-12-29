# Authentication Implementation - SMS Outreach

## Overview

The SMS Outreach (Twilio Conversations) application is secured with **hardened multi-zone authentication** that **REQUIRES** access through the SleepConnect proxy. The application will NOT function without proper forwarded authentication headers from the multi-zone proxy.

## Authentication Architecture

### Multi-Zone Mode (REQUIRED)

The application **MUST** run in multi-zone mode behind the SleepConnect proxy. There is no standalone mode or authentication bypass. User authentication is handled exclusively by SleepConnect, and user context is forwarded to the Outreach zone via the `x-sax-user-context` JWT cookie.

### Authentication Layers

1. **Middleware (Server-Side) - `middleware.ts`**
   - Runs on EVERY request to `/outreach/*` routes
   - **REQUIRES** valid `x-sax-user-context` JWT cookie
   - Validates JWT signature and decodes user context
   - Checks that required fields exist: `sax_id`, `tenant_id`, `practice_id`
   - Redirects to SleepConnect login if session is invalid
   - **NO BYPASS** - authentication is mandatory

2. **AuthGuard Component (Client-Side) - `components/auth/AuthGuard.tsx`**
   - Wraps the entire application in `app/layout.tsx`
   - Performs client-side session validation on mount
   - Calls local `/api/auth/session` endpoint to verify session
   - Cannot read cookie directly (it's HttpOnly for security)
   - Shows loading state during verification
   - Redirects to login if session is invalid
   - **NO BYPASS** - authentication is mandatory

3. **Session API Route - `app/api/auth/session/route.ts`**
   - Server-side endpoint that reads HttpOnly cookie
   - Called by AuthGuard to verify authentication
   - Returns user context if valid session exists
   - Returns 401 if no valid session

4. **API Route Protection - `lib/auth.ts`**
   - All API routes use `withUserContext()` wrapper
   - Validates user context from forwarded cookie
   - Returns 401/403 for invalid authentication
   - Already implemented for all `/api/outreach/*` endpoints

## User Flow

### Authenticated Access (Normal Flow)

1. User logs into SleepConnect at `http://localhost:3000/login`
2. SleepConnect establishes Auth0 session and creates `x-sax-user-context` cookie
3. User navigates to `/outreach` (SMS Outreach app)
4. SleepConnect proxy forwards request with cookie to Outreach app (port 3001)
5. Middleware validates cookie and allows request through
6. AuthGuard verifies session on client side
7. User sees application content

### Unauthenticated Access (Redirect Flow)

1. User attempts to access `/outreach` without valid session
2. Middleware detects missing/invalid `x-sax-user-context` cookie
3. Middleware redirects to: `http://localhost:3000/login?returnTo=/outreach`
4. User logs in to SleepConnect
5. After successful login, user is redirected back to `/outreach`

### Session Expiration

1. User's session expires or becomes invalid
2. Client-side AuthGuard detects invalid session during periodic checks
3. User is redirected to login with current page as return URL
4. After re-authentication, user returns to the page they were on

## Environment Configuration

### Required Settings (ALL Environments)

```bash
# Multi-zone mode is MANDATORY - application requires forwarded JWT from SleepConnect
MULTI_ZONE_MODE=true

# Auth0 client secret for JWT signing/verification (MUST match between sleepconnect and outreach)
AUTH0_CLIENT_SECRET=your-auth0-client-secret-here

# SleepConnect URL for redirects
NEXT_PUBLIC_SLEEPCONNECT_URL=https://app.sleepconnect.com

# Auth routes go through SleepConnect
AUTH0_BASE_URL=https://app.sleepconnect.com
```

### Development Settings

```bash
# For local development (still requires SleepConnect proxy)
MULTI_ZONE_MODE=true
NEXT_PUBLIC_SLEEPCONNECT_URL=http://localhost:3000

# Auth0 client secret (MUST match sleepconnect's AUTH0_CLIENT_SECRET)
AUTH0_CLIENT_SECRET=your-auth0-client-secret-here
```

**IMPORTANT**: There is no authentication bypass mode. The application MUST be accessed through the SleepConnect proxy in all environments.

## Security Considerations

### Cookie Security

- `x-sax-user-context` cookie contains a **signed JWT token** (not plain JSON)
- **HttpOnly** flag prevents JavaScript access via `document.cookie` (security feature)
- **Secure** flag ensures HTTPS-only transmission in production
- **Cryptographically signed** using AUTH0_CLIENT_SECRET - cannot be tampered with
- **Expiration** built into JWT (default: 1 hour)
- Cookie is set by SleepConnect and shared across domains
- Server-side code verifies JWT signature and decodes user context
- JWT payload contains: `sax_id`, `tenant_id`, `practice_id`, `email`, `name`

### Protection Against Unauthorized Access

- All routes protected by default (middleware + AuthGuard)
- API endpoints additionally protected with `withUserContext()`
- No public routes except redirects to SleepConnect auth
- **NO AUTHENTICATION BYPASS** - multi-zone proxy access is mandatory
- Application will not function without proper forwarded authentication headers

## Testing Authentication

### Test Valid Session

1. Start SleepConnect: `cd ../sleepconnect && npm run dev`
2. Start Outreach: `npm run dev`
3. Navigate to `http://localhost:3000/login`
4. Log in with valid credentials
5. Navigate to `http://localhost:3000/outreach`
6. Verify you can access the application

### Test Invalid Session

1. Clear cookies or use incognito window
2. Navigate directly to `http://localhost:3000/outreach`
3. Verify redirect to login page
4. After login, verify redirect back to outreach

### Test Session Expiration

1. Log in and access application
2. Clear `x-sax-user-context` cookie via browser dev tools
3. Refresh page or navigate
4. Verify redirect to login

## Troubleshooting

### "Verifying authentication..." Loops

**Cause**: AuthGuard cannot verify session via `/api/auth/session` endpoint

**Solutions**:

- Verify you're logged into SleepConnect (port 3000)
- Check the session API endpoint is accessible: `/outreach/api/auth/session`
- Ensure cookie is being forwarded from SleepConnect proxy
- Verify `MULTI_ZONE_MODE=true` in `.env.local`
- Check browser console for specific error messages
- Clear cookies and log in again

### Redirects to Login Despite Being Logged In

**Cause**: Cookie not being forwarded or has invalid format

**Solutions**:

- Check cookie is present in browser dev tools
- Verify cookie contains valid JSON with required fields
- Ensure SleepConnect proxy is forwarding cookies
- Check middleware logs for validation errors

### API Routes Return 401

**Cause**: `withUserContext()` can't read user context

**Solutions**:

## Related Files

- `middleware.ts` - Server-side authentication middleware (JWT verification)
- `components/auth/AuthGuard.tsx` - Client-side auth guard component
- `app/api/auth/session/route.ts` - Session verification endpoint
- `lib/auth.ts` - Authentication utilities and API protection (JWT decoding)
- `lib/jwt-utils.ts` - JWT token verification utilities
- `app/layout.tsx` - Root layout with AuthGuard wrapper
- `.env.example` - Environment variable template

**SleepConnect Project:**

- `sleepconnect/middleware.ts` - Creates and sets JWT token
- `sleepconnect/lib/jwt-utils.ts` - JWT token creation utilities

## Constitution Compliance

This hardened authentication implementation conforms to:

- **Patient-First Privacy & Security**: Ensures all patient data access requires valid authentication with NO bypass
- **Production-Grade Excellence**: Multi-layer defense prevents unauthorized access
- **Zero-Trust Architecture**: Application only functions when accessed through authenticated multi-zone proxy
