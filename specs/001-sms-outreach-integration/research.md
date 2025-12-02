# Research: SMS Outreach Integration

**Feature**: 001-sms-outreach-integration  
**Date**: 2025-11-28  
**Status**: Complete

This document captures research findings and technology decisions for the SMS Outreach Integration feature.

---

## 1. Next.js Multi-Zones Integration

### Question

How should the twilio-conversations-react project integrate with sleepconnect using Next.js multi-zones?

### Research Findings

**Multi-Zones Overview**:
Next.js multi-zones allow multiple Next.js applications to be served from the same domain. Each zone:

- Has its own `basePath` configuration
- Deploys independently
- Uses "hard navigation" between zones (full page reload)
- Can share authentication via cookies

**Configuration Pattern**:

```javascript
// twilio-conversations-react/next.config.js
module.exports = {
  basePath: '/sms',
  assetPrefix: '/sms/',
  // ... other config
}

// sleepconnect/next.config.js (rewrites needed)
module.exports = {
  async rewrites() {
    return {
      beforeFiles: [
        {
          source: '/sms/:path*',
          destination: 'https://sms-zone.example.com/sms/:path*',
        },
      ],
    };
  },
}
```

**Alternative: Direct Integration**:
Given that sleepconnect already has:

- `/app/api/twilio/` API routes
- `/components/sms/` components (ConversationClient, ConversationHistory, TemplateManager)

We could also integrate directly within sleepconnect as a new route group.

### Decision

**Use Next.js Multi-Zones with `basePath: '/sms'`**

**Rationale**:

1. Maintains separate deployment pipeline for SMS feature
2. Allows independent scaling and iteration
3. Feature spec explicitly mentions multi-zones architecture
4. Preserves existing sleepconnect codebase stability

**Alternatives Rejected**:

- *Direct integration*: Would increase sleepconnect bundle size and coupling
- *Module Federation*: Overly complex for this use case
- *iframe embedding*: Poor UX and accessibility

---

## 2. Visual Language Adoption

### Question

How to ensure visual consistency with sleepconnect's design system?

### Research Findings

**sleepconnect Visual Language Components**:

1. **Tailwind Configuration** (`tailwind.config.ts`):
   - HSL-based color tokens: `--color-bg`, `--color-surface`, `--color-primary`, etc.
   - Dark mode by default (`darkMode: "class"`)
   - Flowbite plugin integration
   - Custom animations (bubble-pop, fade-in, slide-in)

2. **UI Component Library**:
   - Flowbite React for common components (Button, Card, Modal, Badge, etc.)
   - shadcn/ui patterns for `button.tsx`, `card.tsx` (Radix + CVA)
   - `cn()` utility from `lib/utils.ts` for class merging

3. **Global Styles** (`styles/globals.css`):
   - Custom scrollbar styling
   - Dark mode input/select styling
   - Flowbite CSS imports
   - CSS variables via `variables.css`

4. **Color Palette** (observed):
   - Background: `gray-900` (dark mode)
   - Cards: `gray-800` surfaces
   - Accent: Purple (`purple-500`, `purple-600`)
   - Text: `gray-100` (headings), `gray-300` (body)

### Decision

**Copy sleepconnect's Tailwind config and core UI components**

**Implementation**:

1. Copy `tailwind.config.ts` from sleepconnect (modify content paths)
2. Copy `lib/utils.ts` (cn function)
3. Copy `styles/globals.css` and related imports
4. Copy core UI components: `button.tsx`, `card.tsx`, `badge.tsx`, `dialog.tsx`
5. Use Flowbite React for remaining components

**Files to Copy**:

```
From sleepconnect:
├── tailwind.config.ts         → ./tailwind.config.ts
├── lib/utils.ts               → ./lib/utils.ts
├── styles/globals.css         → ./app/globals.css
├── styles/variables.css       → ./styles/variables.css
├── components/ui/button.tsx   → ./components/ui/button.tsx
├── components/ui/card.tsx     → ./components/ui/card.tsx
├── components/ui/badge.tsx    → ./components/ui/badge.tsx
└── components/ui/dialog.tsx   → ./components/ui/dialog.tsx
```

---

## 3. Auth0 Authentication Integration

### Question

How to share Auth0 authentication between sleepconnect and the SMS zone?

### Research Findings

**Auth0 in sleepconnect**:

- Uses `@auth0/nextjs-auth0` package
- Session stored in cookies (httpOnly, secure)
- Middleware-based route protection

**Cross-Zone Authentication Options**:

1. **Shared Cookie Domain**:
   - Set Auth0 cookie with domain `.example.com`
   - Both zones read the same session cookie
   - Requires same parent domain

2. **Token Passing via URL**:
   - Pass access token via query parameter on zone navigation
   - Less secure, requires careful handling

3. **Centralized Auth Endpoint**:
   - Both zones call sleepconnect's `/api/auth/*` endpoints
   - SMS zone validates tokens against same Auth0 tenant

### Decision

**Use shared cookie domain with `@auth0/nextjs-auth0`**

**Configuration**:

```javascript
// auth0.ts configuration
export const auth0Config = {
  // Cookie settings for cross-zone
  session: {
    cookie: {
      domain: '.dreamconnect.health', // or .saxdevlab.com
      sameSite: 'lax',
      secure: true,
    },
  },
};
```

**Implementation Steps**:

1. Install `@auth0/nextjs-auth0` in SMS zone
2. Configure with same Auth0 tenant as sleepconnect
3. Set cookie domain to parent domain
4. Implement middleware for route protection

---

## 4. Twilio Conversations SDK Best Practices

### Question

What are the best practices for using Twilio Conversations with Next.js?

### Research Findings

**sleepconnect's Current Implementation** (`components/sms/ConversationClient.tsx`):

- Client-side initialization with `@twilio/conversations`
- Token fetched from `/api/twilio/token`
- Event-driven updates (conversationAdded, conversationRemoved)
- React hooks pattern (`useConversations`)

**Best Practices Identified**:

1. **Token Management**:
   - Tokens expire after TTL (currently 1 hour)
   - Implement token refresh before expiry
   - Store identity in Auth0 user metadata

2. **Connection State**:
   - Handle connection state changes (connected, connecting, disconnected)
   - Implement reconnection logic
   - Show connection status to users

3. **Real-time Updates**:
   - Subscribe to conversation and message events
   - Implement optimistic UI updates
   - Handle typing indicators

4. **Error Handling**:
   - Graceful degradation when Twilio unavailable
   - Retry logic for failed message sends
   - User-friendly error messages

### Decision

**Extend sleepconnect's existing patterns with improvements**

**Enhancements**:

1. Add token refresh logic (refresh at 50% TTL)
2. Add connection status indicator component
3. Implement retry queue for failed messages
4. Add typing indicators support

---

## 5. Sentiment Analysis Service

### Question

Which AI service for HIPAA-compliant sentiment analysis?

### Research Findings

**Candidates**:

| Service | HIPAA Eligible | Accuracy | Cost | Latency |
|---------|---------------|----------|------|---------|
| AWS Comprehend Medical | ✅ Yes (BAA) | Good | $0.01/unit | ~200ms |
| OpenAI API | ⚠️ Enterprise only | Excellent | $0.002/1K tokens | ~500ms |
| Azure Text Analytics | ✅ Yes (BAA) | Good | $1/1K records | ~150ms |
| Google Cloud NLP | ✅ Yes (BAA) | Good | $1/1K records | ~100ms |

**AWS Comprehend Advantages**:

- Already in AWS ecosystem (sleepconnect uses AWS)
- HIPAA-eligible with BAA
- Comprehend Medical variant for healthcare
- Native integration with Lambda/API Gateway

**OpenAI Advantages**:

- More nuanced sentiment understanding
- Can provide suggested responses
- Better context awareness

### Decision

**Use AWS Comprehend for sentiment analysis (Phase 1), with OpenAI option for Phase 2**

**Rationale**:

1. AWS Comprehend is HIPAA-eligible with existing BAA
2. Same ecosystem simplifies infrastructure
3. Sufficient accuracy for positive/neutral/negative classification
4. Can enhance with OpenAI later for response suggestions

**Implementation**:

```typescript
// lib/sentiment.ts
import { ComprehendClient, DetectSentimentCommand } from "@aws-sdk/client-comprehend";

export async function analyzeSentiment(text: string) {
  const client = new ComprehendClient({ region: "us-east-1" });
  const response = await client.send(new DetectSentimentCommand({
    Text: text,
    LanguageCode: "en",
  }));
  return {
    sentiment: response.Sentiment, // POSITIVE, NEGATIVE, NEUTRAL, MIXED
    scores: response.SentimentScore,
  };
}
```

---

## 6. Data Persistence Architecture

### Question

How should conversation data be persisted?

### Research Findings

**Current sleepconnect Pattern**:

- PostgreSQL on RDS for other data
- Lambda functions for data operations

**Twilio Conversations**:

- Twilio stores conversations and messages on their servers
- Data accessible via SDK and REST API
- 30-day default retention (configurable)

**Options**:

1. **Twilio-only**: Rely on Twilio for all storage
   - Pro: No additional database needed
   - Con: Limited querying, vendor lock-in, retention limits

2. **Hybrid**: Twilio for real-time, PostgreSQL for analytics
   - Pro: Best of both worlds
   - Con: Data synchronization complexity

3. **Mirror to PostgreSQL**: Webhook-based sync to local database
   - Pro: Full control, flexible querying
   - Con: Eventual consistency, more infrastructure

### Decision

**Hybrid approach: Twilio for real-time messaging, PostgreSQL for analytics and search**

**Implementation**:

1. Use Twilio SDK for real-time messaging (already implemented)
2. Configure Twilio webhooks to sync messages to PostgreSQL
3. Store analytics data (response times, delivery status) in PostgreSQL

**Database Tables**:

```sql
-- Conversations reference table
CREATE TABLE sms_conversations (
  id UUID PRIMARY KEY,
  twilio_sid VARCHAR(34) UNIQUE NOT NULL,
  coordinator_id VARCHAR(255) NOT NULL, -- Auth0 user ID
  patient_phone VARCHAR(15) NOT NULL,
  friendly_name VARCHAR(255),
  status VARCHAR(20) DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  archived_at TIMESTAMPTZ,
  last_message_at TIMESTAMPTZ
);

-- Message log for analytics
CREATE TABLE sms_messages (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES sms_conversations(id),
  twilio_sid VARCHAR(34) UNIQUE NOT NULL,
  direction VARCHAR(10) NOT NULL, -- 'inbound' or 'outbound'
  body TEXT,
  sentiment VARCHAR(20),
  status VARCHAR(20),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  read_at TIMESTAMPTZ
);

-- Response time tracking
CREATE TABLE sms_response_metrics (
  id UUID PRIMARY KEY,
  conversation_id UUID REFERENCES sms_conversations(id),
  inbound_message_id UUID REFERENCES sms_messages(id),
  outbound_message_id UUID REFERENCES sms_messages(id),
  response_time_seconds INTEGER,
  sla_breached BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 7. SLA Monitoring Implementation

### Question

How to implement the 10-minute SLA monitoring with in-app alerts?

### Research Findings

**Requirements** (from spec):

- Alert when patient reply waits > 10 minutes without response
- In-app visual indicator only (no external notifications)
- Conversation highlighted in list with badge

**Implementation Options**:

1. **Client-side polling**:
   - Check message timestamps every 30 seconds
   - Calculate time since last patient message
   - Update UI state when threshold exceeded

2. **Server-side scheduled job**:
   - Lambda/cron checks conversations every minute
   - Marks conversations as SLA-breached in database
   - Client polls for status

3. **Real-time with Twilio webhooks**:
   - Webhook fires on inbound message
   - Start 10-minute timer in backend
   - Push notification to client if timer expires

### Decision

**Hybrid: Client-side calculation with server-side persistence**

**Rationale**:

- Client-side gives immediate feedback
- Server-side ensures SLA state persists across sessions
- Avoids complex timer infrastructure

**Implementation**:

```typescript
// hooks/useSlaMonitor.ts
export function useSlaMonitor(conversation: Conversation) {
  const [slaStatus, setSlaStatus] = useState<'ok' | 'warning' | 'breached'>('ok');
  
  useEffect(() => {
    const lastPatientMessage = conversation.messages
      .filter(m => m.direction === 'inbound')
      .sort((a, b) => b.timestamp - a.timestamp)[0];
    
    if (!lastPatientMessage) return;
    
    const hasCoordinatorReply = conversation.messages.some(
      m => m.direction === 'outbound' && m.timestamp > lastPatientMessage.timestamp
    );
    
    if (hasCoordinatorReply) {
      setSlaStatus('ok');
      return;
    }
    
    const minutesSinceMessage = (Date.now() - lastPatientMessage.timestamp) / 60000;
    
    if (minutesSinceMessage > 10) {
      setSlaStatus('breached');
    } else if (minutesSinceMessage > 7) {
      setSlaStatus('warning');
    }
  }, [conversation.messages]);
  
  return slaStatus;
}
```

---

## Summary of Decisions

| Topic | Decision | Key Rationale |
|-------|----------|---------------|
| Integration | Next.js Multi-Zones with `basePath: '/sms'` | Maintain separation, spec requirement |
| Visual Language | Copy sleepconnect's Tailwind config + UI components | Consistent UX, reduced development time |
| Authentication | Shared Auth0 cookies across zones | Seamless user experience |
| Twilio SDK | Extend existing patterns with token refresh | Proven implementation, minimal changes |
| Sentiment Analysis | AWS Comprehend (HIPAA-eligible) | Same ecosystem, compliant |
| Data Storage | Hybrid Twilio + PostgreSQL | Real-time + analytics |
| SLA Monitoring | Client-side calculation + server persistence | Immediate feedback, reliable state |

---

## Next Steps

1. **Phase 1: Data Model** - Define entities and relationships in `data-model.md`
2. **Phase 1: Contracts** - Create OpenAPI specification in `contracts/`
3. **Phase 1: Quickstart** - Developer setup guide in `quickstart.md`
