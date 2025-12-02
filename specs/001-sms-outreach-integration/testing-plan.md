# Phase 3 Testing Plan: SMS Outreach Integration

**Feature**: 001-sms-outreach-integration  
**Phase**: 3 - User Story 1 (Send and Receive SMS Messages)  
**Created**: 2025-12-02  
**Status**: Ready for Testing

---

## Prerequisites Checklist

Before testing, ensure you have:

### 1. Environment Setup

```bash
cd /home/dan/code/SAX/twilio-conversations-react
cp .env.example .env.local
```

### 2. Required Environment Variables (in `.env.local`)

```dotenv
# Twilio (get from Twilio Console)
TWILIO_ACCOUNT_SID=ACxxxxx
TWILIO_AUTH_TOKEN=xxxxx
TWILIO_API_KEY_SID=SKxxxxx
TWILIO_API_KEY_SECRET=xxxxx
TWILIO_CONVERSATIONS_SERVICE_SID=ISxxxxx

# Auth0 (get from Auth0 Dashboard)
AUTH0_SECRET=<32-char-random-string>
AUTH0_ISSUER_BASE_URL=https://sleeparchitects.us.auth0.com/
AUTH0_BASE_URL=http://localhost:3001
AUTH0_CLIENT_ID=xxxxx
AUTH0_CLIENT_SECRET=xxxxx

# API (Lambda backend)
NEXT_PUBLIC_API_BASE_URL=https://dev-api.example.com

# Webhook (for local testing with ngrok)
WEBHOOK_BASE_URL=https://your-ngrok-url.ngrok.io
```

### 3. Install Dependencies

```bash
pnpm install
```

---

## Test Execution Checklist

### 1. Build Verification ✅

```bash
# Verify TypeScript compilation
pnpm exec tsc --noEmit

# Verify production build
pnpm run build
```

- [ ] TypeScript compiles without errors
- [ ] Production build completes successfully

---

### 2. Unit Tests

```bash
# Run all unit tests
pnpm test

# Run with coverage
pnpm test -- --coverage
```

**Files to test**:
- [ ] `lib/datetime.ts` - Timezone conversion utilities
- [ ] `lib/validation.ts` - Phone number validation
- [ ] `components/conversations/MessageBubble.tsx`
- [ ] `components/conversations/MessageComposer.tsx`
- [ ] `hooks/useMessages.ts`

---

### 3. Local Development Server

```bash
# Start development server
pnpm dev
```

**Access Points**:
- Main app: `http://localhost:3000/outreach` (with basePath)
- API routes: `http://localhost:3000/api/outreach/*`

- [ ] Development server starts without errors
- [ ] Can access the application in browser

---

### 4. API Endpoint Testing

#### 4.1 Token Generation

```bash
# Test Twilio token endpoint (requires auth cookie)
curl -X POST http://localhost:3000/api/outreach/token \
  -H "Cookie: appSession=<your-auth0-session-cookie>"
```

**Expected Response**:
```json
{
  "token": "eyJ...",
  "identity": "sax_12345",
  "expiresAt": "2025-12-02T17:00:00.000Z"
}
```

- [ ] Token endpoint returns valid JWT
- [ ] Identity matches authenticated user's SAX ID

#### 4.2 List Messages

```bash
curl -X GET "http://localhost:3000/api/outreach/conversations/{conversationId}/messages?limit=50" \
  -H "Cookie: appSession=<session>" \
  -H "X-Tenant-Id: <tenant-uuid>" \
  -H "X-Practice-Id: <practice-uuid>"
```

- [ ] Returns paginated message list
- [ ] Pagination metadata is correct

#### 4.3 Send Message

```bash
curl -X POST "http://localhost:3000/api/outreach/conversations/{conversationId}/messages" \
  -H "Content-Type: application/json" \
  -H "Cookie: appSession=<session>" \
  -H "X-Tenant-Id: <tenant-uuid>" \
  -H "X-Practice-Id: <practice-uuid>" \
  -d '{"body": "Hello from test!"}'
```

- [ ] Message is sent successfully
- [ ] Returns message with "sending" status
- [ ] Message appears in Twilio console

---

### 5. Webhook Testing (Local with ngrok)

```bash
# Start ngrok tunnel
ngrok http 3000

# Configure Twilio webhook URL in console:
# https://<ngrok-id>.ngrok.io/api/outreach/webhook
```

#### 5.1 Test Webhook Health

```bash
curl -X GET https://<ngrok-id>.ngrok.io/api/outreach/webhook
```

- [ ] Returns `200 OK` with "Webhook endpoint active"

#### 5.2 Inbound Message Test

- [ ] Send SMS to Twilio phone number from test phone
- [ ] Webhook receives and processes message
- [ ] Message stored in database via Lambda

---

### 6. Component Visual Testing

#### 6.1 MessageBubble States

- [ ] Inbound message (left-aligned, gray background)
- [ ] Outbound message (right-aligned, blue background)
- [ ] Status icon: sending (clock)
- [ ] Status icon: sent (✓)
- [ ] Status icon: delivered (✓✓)
- [ ] Status icon: read (✓✓ blue)
- [ ] Status icon: failed (✗ red)
- [ ] Timestamp display (relative for recent, absolute for older)
- [ ] Error message display for failed messages

#### 6.2 MessageComposer States

- [ ] Empty state (send button disabled)
- [ ] Character count: gray (< 140 chars)
- [ ] Character count: yellow (140-160 chars)
- [ ] Character count: red (> 160 chars)
- [ ] Segment count display (appears at > 160 chars)
- [ ] Sending state (spinner, disabled input)
- [ ] Keyboard: Enter sends message
- [ ] Keyboard: Shift+Enter adds newline

#### 6.3 ConversationDetail States

- [ ] Loading skeleton displays during fetch
- [ ] Empty conversation shows "No messages yet"
- [ ] Message list displays with date separators
- [ ] Auto-scroll on new message
- [ ] Load more button works (pagination)
- [ ] Opted-out warning banner displays correctly

---

### 7. Phone Validation Testing

```typescript
// Test in browser console or unit test
import { isValidUSPhoneNumber, formatPhoneNumber, getPhoneValidationError } from '@/lib/validation';

// Valid numbers
isValidUSPhoneNumber('+15551234567'); // true
isValidUSPhoneNumber('+12125551234'); // true

// Invalid numbers
isValidUSPhoneNumber('+10551234567'); // false (area code starts with 0)
isValidUSPhoneNumber('+11125551234'); // false (area code starts with 1)
isValidUSPhoneNumber('5551234567');   // false (missing +1)

// Formatting
formatPhoneNumber('5551234567');      // '+15551234567'
formatPhoneNumber('(555) 123-4567');  // '+15551234567'

// Error messages
getPhoneValidationError('');              // 'Phone number is required'
getPhoneValidationError('+10001234567');  // 'Invalid area code'
```

- [ ] Valid US numbers pass validation
- [ ] Invalid area codes (0, 1) are rejected
- [ ] Various input formats are normalized correctly
- [ ] Appropriate error messages returned

---

### 8. Datetime Utilities Testing

```typescript
import { formatMessageTime, formatRelativeTime, isToday, isSameDay } from '@/lib/datetime';

// Today's message
formatMessageTime(new Date().toISOString()); // "3:45 PM"

// Yesterday
const yesterday = new Date();
yesterday.setDate(yesterday.getDate() - 1);
formatMessageTime(yesterday.toISOString()); // "Mon 3:45 PM" (weekday)

// Older message
formatMessageTime('2025-11-15T10:30:00Z'); // "Nov 15, 10:30 AM"

// Relative time
formatRelativeTime(new Date().toISOString()); // "just now"
```

- [ ] Today's timestamps show time only
- [ ] This week's timestamps show weekday + time
- [ ] Older timestamps show date + time
- [ ] Relative time displays correctly

---

### 9. End-to-End Test Scenarios

#### Scenario 1: Send and Receive SMS

1. [ ] Open conversation detail view
2. [ ] Type message in composer
3. [ ] Click send (or press Enter)
4. [ ] Verify message appears with "sending" status
5. [ ] Verify status updates to "sent" → "delivered"
6. [ ] Send SMS reply from test phone
7. [ ] Verify inbound message appears within 3 seconds

#### Scenario 2: Character Limit Handling

1. [ ] Type 150 characters → counter shows gray
2. [ ] Type 145 characters → counter shows yellow warning
3. [ ] Type 165 characters → counter shows red, segment count shows "2 segments"
4. [ ] Verify send still works for multi-segment messages

#### Scenario 3: Patient Opt-Out (STOP)

1. [ ] Send "STOP" from patient phone
2. [ ] Verify webhook marks conversation as opted-out
3. [ ] Verify ConversationDetail shows opt-out warning
4. [ ] Verify MessageComposer is disabled
5. [ ] Verify send attempt returns 403 error

---

### 10. Security Verification

- [ ] All `/api/outreach/*` routes (except `/webhook`) require Auth0 session
- [ ] Webhook validates `X-Twilio-Signature` before processing
- [ ] No PHI (message body) appears in console logs
- [ ] Error messages don't expose internal details
- [ ] Tenant/practice isolation enforced on all queries

---

## Quick Test Commands

```bash
# Full validation suite
pnpm exec tsc --noEmit && pnpm run build && pnpm test

# Development with hot reload
pnpm dev

# Lint check
pnpm lint
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| "Cannot find module '@/lib/datetime'" | Restart TypeScript server in VS Code |
| Webhook 403 error | Check `X-Twilio-Signature` and `TWILIO_AUTH_TOKEN` |
| Auth0 redirect loop | Verify `AUTH0_BASE_URL` matches your dev server |
| Twilio SDK not connecting | Check `TWILIO_CONVERSATIONS_SERVICE_SID` |
| Build fails with type errors | Run `pnpm exec tsc --noEmit` to see detailed errors |

---

## Test Results Summary

| Category | Passed | Failed | Skipped |
|----------|--------|--------|---------|
| Build Verification | | | |
| Unit Tests | | | |
| API Endpoints | | | |
| Webhook | | | |
| Components | | | |
| Validation | | | |
| Datetime | | | |
| E2E Scenarios | | | |
| Security | | | |
| **Total** | | | |

**Tested By**: ________________  
**Date**: ________________  
**Notes**: 

---
