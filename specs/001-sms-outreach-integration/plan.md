# Implementation Plan: SMS Outreach Integration

**Branch**: `001-sms-outreach-integration` | **Date**: 2025-11-28 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/001-sms-outreach-integration/spec.md`

## Summary

Enable care coordinators to manage patient SMS conversations through a dedicated interface with real-time bi-directional messaging, reusable message templates, conversation history, SLA monitoring, and engagement analytics. The application will be implemented as a Next.js multi-zone that integrates with SleepConnect, using Twilio for SMS delivery, Auth0 for authentication, and AWS Lambda/PostgreSQL for data persistence.

## Technical Context

**Language/Version**: TypeScript 5.x, Next.js 14+ (App Router)  
**Primary Dependencies**:

- Next.js 14 (App Router) - multi-zone architecture
- @twilio/conversations 2.4.x - real-time SMS messaging
- Flowbite React - UI component library (matching sleepconnect)
- Tailwind CSS 3.x - styling (matching sleepconnect theme)
- @auth0/nextjs-auth0 - authentication integration
- sonner - toast notifications (matching sleepconnect)

**Storage**:

- PostgreSQL on RDS via AWS Lambda (conversations, messages, templates, analytics)
- Twilio Conversations API (real-time message state, delivery status)

**Testing**: Jest + React Testing Library (unit), Playwright (e2e)  
**Target Platform**: Web (AWS via SST/OpenNext, matching sleepconnect deployment)  
**Project Type**: Web - Multi-Zone Next.js application integrated with sleepconnect  
**Performance Goals**:

- Message delivery confirmation < 5 seconds
- Patient replies visible < 3 seconds  
- 95% first-attempt delivery success
- Conversation list load < 2 seconds (500+ messages)

**Constraints**:

- HIPAA compliance (encryption at rest, audit logging, Twilio BAA)
- US phone numbers only (+1 format)
- 100-500 messages/day/coordinator
- Browser-timezone message display

**Scale/Scope**:

- Internal care coordinators (~20-50 users)
- 100 concurrent active conversations
- Indefinite message retention

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Gate | Status | Notes |
|------|--------|-------|
| **Security/HIPAA** | ✅ PASS | All endpoints require Auth0 authentication; data encrypted at rest via RDS; audit logging via AWS CloudWatch; Twilio BAA required (administrative prerequisite, verify before launch) |
| **Testing** | ✅ PASS | Unit tests for business logic (hooks, utilities); integration tests for API routes; E2E tests for critical user flows |
| **Accessibility** | ✅ PASS | Using Flowbite components (WCAG 2.1 AA compliant); keyboard navigation required |
| **Performance** | ✅ PASS | Core Web Vitals targets defined; pagination for large datasets; real-time updates via Twilio SDK |
| **Simplicity** | ✅ PASS | Leveraging existing sleepconnect patterns and components; minimal new abstractions |

## Project Structure

### Documentation (this feature)

```text
specs/001-sms-outreach-integration/
├── plan.md              # This file - implementation plan
├── research.md          # Phase 0 - technology decisions and patterns
├── data-model.md        # Phase 1 - entity definitions and relationships
├── quickstart.md        # Phase 1 - developer onboarding guide
├── contracts/           # Phase 1 - OpenAPI specifications
│   └── sms-api.yaml     # SMS endpoints OpenAPI spec
└── tasks.md             # Phase 2 - implementation tasks (NOT in this phase)
```

### Build Configuration (repository root)

```text
open-next.config.ts           # OpenNext configuration for AWS Lambda deployment
```

### Source Code (repository root)

```text
# Next.js Multi-Zone Application
app/                          # New Next.js App Router structure
├── layout.tsx                # Root layout with Flowbite theme
├── page.tsx                  # Redirect to /conversations
├── globals.css               # Tailwind + sleepconnect styles
├── conversations/
│   ├── page.tsx              # Conversation list view
│   └── [id]/
│       └── page.tsx          # Single conversation detail
├── templates/
│   └── page.tsx              # Template management
├── analytics/
│   └── page.tsx              # Engagement analytics dashboard
└── api/                      # API routes (extend sleepconnect patterns)
    └── outreach/             # SMS outreach endpoints (matches sms-api.yaml)
        ├── conversations/
        │   └── route.ts      # CRUD for conversations
        ├── messages/
        │   └── route.ts      # Message sending/receiving
        ├── templates/
        │   └── route.ts      # Template CRUD
        ├── token/
        │   └── route.ts      # Twilio access token generation
        ├── webhook/
        │   └── route.ts      # Twilio inbound/status webhooks
        └── analytics/
            └── route.ts      # Analytics aggregation

components/                   # UI components (Flowbite-based)
├── conversations/
│   ├── ConversationList.tsx
│   ├── ConversationDetail.tsx
│   ├── MessageBubble.tsx
│   ├── MessageComposer.tsx
│   └── SlaIndicator.tsx
├── templates/
│   ├── TemplateList.tsx
│   ├── TemplateEditor.tsx
│   └── TemplatePreview.tsx
├── analytics/
│   ├── MetricsCards.tsx
│   └── ResponseTimeChart.tsx
└── ui/                       # Shared UI (copy from sleepconnect)
    ├── button.tsx
    ├── card.tsx
    └── badge.tsx

hooks/                        # React hooks
├── useTwilioClient.ts        # Twilio SDK initialization and token refresh
├── useConversations.ts       # Conversation list state management
├── useMessages.ts            # Message state
├── useTemplates.ts           # Template CRUD
└── useAnalytics.ts           # Analytics data

lib/                          # Utilities and configurations
├── utils.ts                  # cn() helper (from sleepconnect)
├── twilio.ts                 # Twilio client configuration
├── auth.ts                   # Auth0 utilities
└── api.ts                    # Lambda API client utilities

tests/
├── unit/                     # Jest unit tests
│   ├── hooks/
│   └── components/
├── integration/              # API route tests
│   └── api/
└── e2e/                      # Playwright E2E tests
    └── conversations.spec.ts

# Configuration files
next.config.js                # Multi-zone config (basePath: '/outreach')
tailwind.config.ts            # Copy from sleepconnect
package.json                  # Dependencies
tsconfig.json                 # TypeScript config

# Legacy (to be deprecated)
src/                          # Original CRA structure (reference only)
```

**Structure Decision**: Converting to Next.js App Router structure to enable multi-zones integration with sleepconnect. The existing `src/` directory is retained as reference for patterns but will not be deployed. Components will use Flowbite React to match sleepconnect's visual language.

## Complexity Tracking

> **No constitution violations identified.** The approach uses existing patterns from sleepconnect and standard Next.js conventions.
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
