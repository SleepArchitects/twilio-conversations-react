# Phase 2 Quality Checklist: Foundational Infrastructure

**Purpose**: Validate implementation quality of Phase 2 tasks before proceeding to user stories  
**Created**: December 2, 2025  
**Feature**: [tasks.md](../tasks.md) - Phase 2: Foundational  
**Depth**: Standard | **Audience**: Developer (self-review)

---

## T010: TypeScript Types (types/sms.ts)

### Completeness

- [ ] CHK001 - Are all 6 enum types defined (ConversationStatus, SlaStatus, MessageDirection, MessageStatus, Sentiment, TemplateCategory)? [Completeness, data-model.md]
- [ ] CHK002 - Are all 5 core entity interfaces defined (Conversation, Message, Template, ResponseMetric, AnalyticsSnapshot)? [Completeness, data-model.md]
- [ ] CHK003 - Are common interfaces defined (AuditFields, TenantScope)? [Completeness, data-model.md]
- [ ] CHK004 - Are API request/response types defined (CreateConversationRequest, SendMessageRequest, etc.)? [Completeness, contracts/sms-api.yaml]

### Clarity

- [ ] CHK005 - Are all interface properties documented with JSDoc comments? [Clarity]
- [ ] CHK006 - Are nullable fields explicitly typed with `| null`? [Clarity]
- [ ] CHK007 - Are timestamp fields documented as ISO 8601 format? [Clarity, FR-008b]

### Consistency

- [ ] CHK008 - Do field names match data-model.md (camelCase for TS, snake_case in DB)? [Consistency]
- [ ] CHK009 - Are validation helpers included (US_PHONE_REGEX, TEMPLATE_VARIABLE_REGEX, SLA_THRESHOLD_SECONDS)? [Consistency, FR-004, FR-018, FR-026]

**How to verify**:

```bash
# Check file exists and has expected exports
grep -c "export" types/sms.ts  # Should be 20+
grep "ConversationStatus\|SlaStatus\|MessageDirection" types/sms.ts
```

---

## T011: App Layout (app/layout.tsx)

### Completeness

- [ ] CHK010 - Is UserProvider from @auth0/nextjs-auth0/client wrapping children? [Completeness]
- [ ] CHK011 - Is ThemeModeScript included for dark mode support? [Completeness]
- [ ] CHK012 - Is Toaster from sonner configured for notifications? [Completeness]
- [ ] CHK013 - Are metadata title and description set? [Completeness]

### Consistency

- [ ] CHK014 - Does styling match sleepconnect theme (dark mode default, Inter font)? [Consistency]
- [ ] CHK015 - Is globals.css imported with Tailwind directives? [Consistency]

**How to verify**:

```bash
# Check required imports
grep -E "UserProvider|ThemeModeScript|Toaster" app/layout.tsx
# Check metadata
grep "title.*SMS Outreach" app/layout.tsx
```

---

## T012: Auth Utilities (lib/auth.ts)

### Completeness

- [ ] CHK016 - Is getSession exported for retrieving Auth0 session? [Completeness]
- [ ] CHK017 - Is withApiAuthRequired re-exported for API route protection? [Completeness]
- [ ] CHK018 - Is getCurrentUserSaxId function defined? [Completeness]
- [ ] CHK019 - Is getTenantContext function defined? [Completeness]
- [ ] CHK020 - Is withUserContext wrapper defined for API routes? [Completeness]

### Clarity

- [ ] CHK021 - Are SaxClaims and UserContext interfaces defined with proper types? [Clarity]
- [ ] CHK022 - Are error cases handled (null session, missing claims)? [Clarity]

### Security

- [ ] CHK023 - Does withUserContext validate sax_id, tenant_id, practice_id before proceeding? [Security, FR-032]

**How to verify**:

```bash
# Check exports
grep -E "export.*(getSession|withApiAuthRequired|getCurrentUserSaxId|getTenantContext|withUserContext)" lib/auth.ts
# Check error handling
grep -c "401\|403\|Unauthorized" lib/auth.ts  # Should be 2+
```

---

## T013: Twilio Client (lib/twilio.ts)

### Completeness

- [ ] CHK024 - Is getTwilioClient function defined returning Twilio REST client? [Completeness]
- [ ] CHK025 - Is generateAccessToken function defined for frontend SDK? [Completeness]
- [ ] CHK026 - Does generateAccessToken use ChatGrant for Conversations access? [Completeness]

### Configuration

- [ ] CHK027 - Are all 5 env vars validated (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_API_KEY_SID, TWILIO_API_KEY_SECRET, TWILIO_CONVERSATIONS_SERVICE_SID)? [Configuration]
- [ ] CHK028 - Is token TTL set to 1 hour (3600 seconds)? [Configuration]

### Security

- [ ] CHK029 - Is client instantiated as singleton to avoid connection leaks? [Security]
- [ ] CHK030 - Are API keys used (not auth token) for access token generation? [Security]

**How to verify**:

```bash
# Check exports
grep -E "export.*(getTwilioClient|generateAccessToken)" lib/twilio.ts
# Check env vars
grep -c "TWILIO_" lib/twilio.ts  # Should be 5
# Check TTL
grep "3600\|ttl" lib/twilio.ts
```

---

## T014: API Client (lib/api.ts)

### Completeness

- [ ] CHK031 - Is ApiError class defined with status, message, code? [Completeness]
- [ ] CHK032 - Are all HTTP methods exported (get, post, patch, delete)? [Completeness]
- [ ] CHK033 - Is base URL configurable via NEXT_PUBLIC_API_BASE_URL? [Completeness]

### Error Handling

- [ ] CHK034 - Are HTTP error responses (4xx, 5xx) converted to ApiError? [Error Handling]
- [ ] CHK035 - Is JSON parsing error handled gracefully? [Error Handling]
- [ ] CHK036 - Is 204 No Content response handled without parsing? [Edge Case]

### Clarity

- [ ] CHK037 - Are methods generic typed for response type inference? [Clarity]
- [ ] CHK038 - Is query parameter support included via options? [Clarity]

**How to verify**:

```bash
# Check exports
grep -E "export.*(ApiError|api|get|post|patch|delete)" lib/api.ts
# Check error handling
grep -c "ApiError\|throw" lib/api.ts  # Should be 3+
```

---

## T015: UI Components (components/ui/*)

### Completeness

- [ ] CHK039 - Is button.tsx present with buttonVariants? [Completeness]
- [ ] CHK040 - Is card.tsx present with Card, CardHeader, CardTitle, CardContent, CardFooter? [Completeness]
- [ ] CHK041 - Is badge.tsx present with badgeVariants? [Completeness]
- [ ] CHK042 - Is lib/utils.ts present with cn() helper? [Completeness]

### Consistency

- [ ] CHK043 - Do components use @/lib/utils import path? [Consistency]
- [ ] CHK044 - Are variant styles using class-variance-authority (cva)? [Consistency]

**How to verify**:

```bash
# Check files exist
ls -la components/ui/button.tsx components/ui/card.tsx components/ui/badge.tsx lib/utils.ts
# Check cn import
grep "@/lib/utils" components/ui/*.tsx | wc -l  # Should be 3
```

---

## T016: Token API Route (app/api/outreach/token/route.ts)

### Completeness

- [ ] CHK045 - Is POST handler exported? [Completeness]
- [ ] CHK046 - Is Auth0 authentication required via withApiAuthRequired? [Completeness, FR-032]
- [ ] CHK047 - Does response include token, identity, expiresAt? [Completeness]

### Security

- [ ] CHK048 - Is user identity derived from session sax_id (not request body)? [Security]
- [ ] CHK049 - Is 401 returned for unauthenticated requests? [Security]
- [ ] CHK050 - Is 500 returned for Twilio configuration errors? [Error Handling]

**How to verify**:

```bash
# Check exports
grep -E "export.*(POST|GET)" app/api/outreach/token/route.ts
# Check auth
grep -E "withApiAuthRequired|getSession" app/api/outreach/token/route.ts
# Check response shape
grep -E "token.*identity.*expiresAt" app/api/outreach/token/route.ts
```

---

## T017: useTwilioClient Hook (hooks/useTwilioClient.ts)

### Completeness

- [ ] CHK051 - Does hook return { client, isConnected, isLoading, error }? [Completeness]
- [ ] CHK052 - Is token fetched from /api/outreach/token? [Completeness]
- [ ] CHK053 - Is token refresh scheduled before expiry? [Completeness]

### Reliability

- [ ] CHK054 - Is client cleanup performed on unmount? [Reliability]
- [ ] CHK055 - Are Twilio SDK events handled (connectionStateChanged, tokenAboutToExpire)? [Reliability]
- [ ] CHK056 - Is refresh timer cleared on unmount? [Reliability]

### Edge Cases

- [ ] CHK057 - Is token refresh at 50% TTL (not at expiry)? [Edge Case]
- [ ] CHK058 - Is error state set on fetch failure? [Edge Case]

**How to verify**:

```bash
# Check return type
grep -E "client.*isConnected.*isLoading.*error" hooks/useTwilioClient.ts
# Check cleanup
grep -E "shutdown|cleanup|clearTimeout" hooks/useTwilioClient.ts
# Check events
grep -E "connectionStateChanged|tokenAboutToExpire" hooks/useTwilioClient.ts
```

---

## T018: Auth Middleware (middleware.ts)

### Completeness

- [ ] CHK059 - Is withMiddlewareAuthRequired from @auth0/nextjs-auth0/edge used? [Completeness]
- [ ] CHK060 - Is /api/outreach/webhook excluded from auth (Twilio callbacks)? [Completeness, FR-022]
- [ ] CHK061 - Is /api/auth/* excluded from auth (Auth0 routes)? [Completeness]

### Configuration

- [ ] CHK062 - Is matcher configured to exclude static files (_next/static,_next/image)? [Configuration]
- [ ] CHK063 - Is middleware exported as default function? [Configuration]

**How to verify**:

```bash
# Check imports
grep "withMiddlewareAuthRequired" middleware.ts
# Check public paths
grep -E "webhook|/api/auth" middleware.ts
# Check matcher
grep -E "matcher.*_next" middleware.ts
```

---

## Cross-Cutting Quality Checks

### TypeScript

- [ ] CHK064 - Does `pnpm exec tsc --noEmit` pass with no errors? [TypeScript]

### Dependencies

- [ ] CHK065 - Are all required packages installed (twilio, @auth0/nextjs-auth0, @twilio/conversations, sonner, flowbite-react)? [Dependencies]

### File Structure

- [ ] CHK066 - Are all Phase 2 files in correct locations per plan.md? [Structure]

**How to verify**:

```bash
# TypeScript check
pnpm exec tsc --noEmit

# Check dependencies
grep -E "twilio|@auth0|sonner|flowbite" package.json

# Check file structure
ls -la types/sms.ts app/layout.tsx lib/auth.ts lib/twilio.ts lib/api.ts \
  components/ui/button.tsx hooks/useTwilioClient.ts middleware.ts \
  app/api/outreach/token/route.ts
```

---

## Summary

| Task | Items | Description |
|------|-------|-------------|
| T010 | CHK001-CHK009 | TypeScript types from data-model |
| T011 | CHK010-CHK015 | App layout with providers |
| T012 | CHK016-CHK023 | Auth utilities |
| T013 | CHK024-CHK030 | Twilio client |
| T014 | CHK031-CHK038 | API client |
| T015 | CHK039-CHK044 | UI components |
| T016 | CHK045-CHK050 | Token API route |
| T017 | CHK051-CHK058 | useTwilioClient hook |
| T018 | CHK059-CHK063 | Auth middleware |
| Cross-cutting | CHK064-CHK066 | TypeScript, deps, structure |
| **Total** | **66 items** | |

## Quick Verification Script

Run this to verify all Phase 2 files exist and TypeScript compiles:

```bash
cd /home/dan/code/SAX/twilio-conversations-react

echo "=== Checking Phase 2 Files ==="
for f in types/sms.ts app/layout.tsx lib/auth.ts lib/twilio.ts lib/api.ts \
         lib/utils.ts components/ui/button.tsx components/ui/card.tsx \
         components/ui/badge.tsx hooks/useTwilioClient.ts middleware.ts \
         app/api/outreach/token/route.ts; do
  [ -f "$f" ] && echo "✅ $f" || echo "❌ $f MISSING"
done

echo ""
echo "=== TypeScript Check ==="
pnpm exec tsc --noEmit && echo "✅ TypeScript passes" || echo "❌ TypeScript errors"

echo ""
echo "=== Export Counts ==="
echo "types/sms.ts exports: $(grep -c 'export' types/sms.ts)"
echo "lib/auth.ts exports: $(grep -c 'export' lib/auth.ts)"
echo "lib/twilio.ts exports: $(grep -c 'export' lib/twilio.ts)"
echo "lib/api.ts exports: $(grep -c 'export' lib/api.ts)"
```
