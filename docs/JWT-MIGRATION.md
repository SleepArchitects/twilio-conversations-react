# JWT Authentication Migration

This document describes the migration from plain JSON cookies to JWT-based authentication for the outreach application, using Auth0's client secret for signing.

## What Changed

### Before (Plain JSON)
- Cookie contained plain JSON: `{"sax_id":123,"tenant_id":"...", ...}`
- No signature verification
- Could be tampered with (though HttpOnly provided some protection)
- No built-in expiration

### After (JWT)
- Cookie contains signed JWT token: `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...`
- Cryptographically signed and verified
- Cannot be tampered with
- Built-in expiration (1 hour)
- Industry-standard security

## Installation Steps

### 1. Install Dependencies

**In both sleepconnect and twilio-conversations-react projects:**

```bash
npm install jose
```

or with pnpm:

```bash
pnpm add jose
```

**Note**: We use the `jose` library instead of `jsonwebtoken` because it's compatible with Next.js Edge Runtime (used by middleware).

### 2. Configure AUTH0_CLIENT_SECRET

**CRITICAL**: Both projects must use the same `AUTH0_CLIENT_SECRET`!

The JWT tokens are signed using your Auth0 client secret. Ensure both projects have the same `AUTH0_CLIENT_SECRET` in their `.env.local` files:

**sleepconnect/.env.local**:
```bash
AUTH0_CLIENT_SECRET=your-auth0-client-secret-from-auth0-dashboard
```

**twilio-conversations-react/.env.local**:
```bash
AUTH0_CLIENT_SECRET=your-auth0-client-secret-from-auth0-dashboard
```

**Note**: Get your Auth0 client secret from the Auth0 dashboard under your application settings.

### 3. Restart Both Applications

After confirming the AUTH0_CLIENT_SECRET is set and installing dependencies:

1. Stop sleepconnect dev server
2. Stop twilio-conversations-react dev server
3. Start sleepconnect: `npm run dev` (port 3000)
4. Start twilio-conversations-react: `npm run dev` (port 3001)

### 4. Test Authentication

1. Navigate to `http://localhost:3000/login`
2. Log in with your credentials
3. Navigate to `http://localhost:3000/outreach`
4. You should see the outreach app without redirect loops

## How It Works

### SleepConnect (Cookie Creation)
```typescript
// sleepconnect/middleware.ts
import { createUserContextToken } from './lib/jwt-utils';

const userContext = { sax_id, tenant_id, practice_id, email, name };
const token = createUserContextToken(userContext, '1h');

response.cookies.set('x-sax-user-context', token, {
  httpOnly: true,
  maxAge: 60 * 60, // 1 hour
  secure: true,
});
```

### Outreach (Cookie Verification)
```typescript
// twilio-conversations-react/middleware.ts
import { verifyUserContextToken } from './lib/jwt-utils';

const token = request.cookies.get('x-sax-user-context')?.value;
const userContext = verifyUserContextToken(token); // Returns null if invalid
```

## Security Benefits

1. **Tamper-Proof**: JWT signature is verified on every request
2. **Expiration**: Tokens automatically expire after 1 hour
3. **Standard**: JWT is an industry-standard authentication method
4. **Auditable**: Can add additional claims (iat, exp, iss, aud) for tracking
5. **Revocable**: Can implement token blacklisting if needed

## Troubleshooting

### "JWT verification failed"
- **Cause**: AUTH0_CLIENT_SECRET mismatch between projects
- **Solution**: Ensure both projects have identical AUTH0_CLIENT_SECRET

### "JWT expired"
- **Cause**: Token is older than 1 hour
- **Solution**: Log out and log back in to get a new token

### "JWT malformed"
- **Cause**: Cookie contains old plain JSON format
- **Solution**: Clear cookies and log in again

### Import errors for jose
- **Cause**: Package not installed
- **Solution**: Run `npm install jose` or `pnpm add jose`

## Rollback

If you need to rollback to plain JSON (not recommended):

1. In `sleepconnect/middleware.ts`, replace:
   ```typescript
   const token = createUserContextToken(userContext, '1h');
   response.cookies.set('x-sax-user-context', token, {...});
   ```
   
   With:
   ```typescript
   response.cookies.set('x-sax-user-context', JSON.stringify(userContext), {...});
   ```

2. In `twilio-conversations-react/middleware.ts` and `lib/auth.ts`, replace JWT verification with `JSON.parse()`

3. Remove the import statements for jwt-utils

## Production Deployment

1. Set `AUTH0_CLIENT_SECRET` as an environment variable in your deployment platform
2. Use the same Auth0 client secret from your Auth0 application configuration
3. **NEVER commit AUTH0_CLIENT_SECRET to git**
4. Use different Auth0 applications (and thus different secrets) for staging/production environments
5. Rotate secrets via Auth0 dashboard when needed (requires coordinated deployment)
