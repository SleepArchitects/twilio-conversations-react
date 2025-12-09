# Tasks: SMS Outreach Integration

**Input**: Design documents from `/specs/001-sms-outreach-integration/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, data-model.md ✅, contracts/ ✅, quickstart.md ✅

**Tests**: Not explicitly requested in specification. Test tasks are omitted per template guidelines.

**Organization**: Tasks grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

Based on plan.md structure:

- `app/` - Next.js App Router pages and API routes
- `components/` - React UI components
- `hooks/` - Custom React hooks
- `lib/` - Utilities and configurations
- `types/` - TypeScript type definitions

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and Next.js App Router conversion

- [X] T001 Create Next.js App Router project structure with `app/`, `components/`, `hooks/`, `lib/`, `types/` directories
- [X] T002 Initialize package.json with Next.js 14, TypeScript 5.x, and core dependencies per plan.md
- [X] T003 [P] Configure next.config.js with basePath '/outreach', assetPrefix '/outreach-static', and security headers for multi-zone integration per <https://nextjs.org/docs/pages/guides/multi-zones>
- [X] T004 [P] Copy tailwind.config.ts from sleepconnect and update content paths
- [X] T005 [P] Copy lib/utils.ts (cn helper) from sleepconnect
- [X] T006 [P] Create app/globals.css with Tailwind imports and sleepconnect theme variables
- [X] T007 [P] Configure tsconfig.json with path aliases (@/components, @/lib, @/hooks, @/types)
- [X] T008 [P] Create .env.example with all required environment variables per quickstart.md
- [X] T009 [P] Configure ESLint and Prettier matching sleepconnect patterns
- [X] T009a Document PostgreSQL stored procedures required by tasks (insert_sms_conversation, get_sms_messages_for_conversation, mark_sms_conversation_read, insert_sms_response_metric, complete_sms_response_metric, archive_sms_conversation, unarchive_sms_conversation, increment_sms_template_usage, update_sms_message_sentiment) - coordinate with sleepconnect Lambda layer

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T010 Create TypeScript types from data-model.md in types/sms.ts (enums, interfaces for all entities)
- [X] T011 [P] Create app/layout.tsx with Flowbite ThemeProvider, Auth0 UserProvider, and base HTML structure
- [X] T012 [P] Implement lib/auth.ts with Auth0 session utilities and withApiAuthRequired wrapper
- [X] T013 [P] Implement lib/twilio.ts with Twilio client configuration and token generation
- [X] T014 [P] Implement lib/api.ts with Lambda API client utilities and error handling
- [X] T015 [P] Copy shared UI components from sleepconnect: components/ui/button.tsx, card.tsx, badge.tsx
- [N/A] T016 ~~Create app/api/outreach/token/route.ts for Twilio access token generation~~ *PIVOTED: Not needed - using Twilio Messaging API (REST) instead of Conversations SDK*
- [N/A] T017 ~~Implement hooks/useTwilioClient.ts for Twilio Conversations SDK~~ *PIVOTED: Using API-based messaging with React Query polling instead. Rationale: Serverless-compatible (Lambda), ~$475/mo cheaper, simpler maintenance, single source of truth (PostgreSQL). See ADR below.*
- [X] T018 Auth0 route protection via SleepConnect middleware.ts (multi-zone architecture - middleware lives in sleepconnect repo, forwards user context to Outreach zone via cookies)
- [X] T018a [P] Multi-zone shell integration - **COMPLETE**: Using proxy-level header rendering (Option D - cleanest approach). SleepConnect reverse proxy provides header/footer at proxy level. Outreach zone layout.tsx does NOT include header/footer (content-only). `ShellHeader`/`ShellFooter` exist only as stubs for standalone dev mode.

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel ✅

### T018a Implementation: Proxy-Level Header Rendering (Option D - CHOSEN)

**Status**: ✅ **COMPLETE** - Cleanest multi-zone architecture implemented

**Implementation**:
- ✅ Outreach `app/layout.tsx` does NOT render header/footer (content-only zone)
- ✅ SleepConnect acts as reverse proxy and renders complete shell
- ✅ User requests → SleepConnect proxy → wraps Outreach content with shell → seamless UX
- ✅ `ShellHeader`/`ShellFooter` exist only for standalone dev mode (not used in production)

**How It Works**:
1. User navigates to `https://sleepconnect.com/outreach/conversations`
2. SleepConnect proxy intercepts and fetches Outreach zone content
3. Proxy wraps content with SleepConnect header/footer (SSR at proxy level)
4. User sees seamless interface with consistent shell across all zones

**Benefits Over Options A/B/C**:
- **Single source of truth**: Header lives only in SleepConnect (no duplication)
- **Automatic consistency**: All zones get header updates instantly
- **No shared packages**: No need for NPM packages, Git submodules, or Module Federation
- **Zero maintenance**: Header changes propagate automatically to all zones
- **Correct Next.js pattern**: Standard multi-zone architecture per Next.js docs

**Cross-Zone Navigation** (T092):
- Use `<a href>` for links to other zones (hard navigation)
- Use `<Link>` for links within Outreach zone (soft navigation)
- Example: `<a href="/patients/123">View Patient</a>` (SleepConnect zone)

---

## Phase 3: User Story 1 - Send and Receive SMS Messages (Priority: P1) 🎯 MVP

**Goal**: Enable bi-directional SMS messaging between coordinators and patients with real-time delivery status

**Independent Test**: Send SMS to patient phone, receive reply, verify both appear in conversation view with correct timestamps and delivery status

### Implementation for User Story 1

- [X] T019 [P] [US1] Create components/conversations/MessageBubble.tsx with sender identification, timestamp, and delivery status indicator
- [X] T019a [P] [US1] Implement lib/datetime.ts with UTC-to-local timezone conversion utilities using Intl.DateTimeFormat (FR-008a, FR-008b, Constitution VII)
- [X] T020 [P] [US1] Create components/conversations/MessageComposer.tsx with textarea, character count, segment display, and send button
- [X] T021 [US1] Implement app/api/outreach/conversations/[conversationId]/messages/route.ts (GET list, POST send) per sms-api.yaml
- [X] T022 [US1] Implement app/api/outreach/webhook/route.ts for Twilio inbound messages and status callbacks
- [X] T023 [US1] Implement hooks/useMessages.ts for message state management with React Query polling of backend messaging API (Twilio Messaging API via Lambda)
- [X] T024 [US1] Create components/conversations/ConversationDetail.tsx with message list, auto-scroll, and composer integration
- [X] T025 [US1] Implement message delivery status updates (sending → sent → delivered → read → failed) via Twilio webhooks
- [X] T026 [US1] Add US phone number validation (+1 format) in lib/validation.ts
- [X] T027 [US1] Handle SMS character limits and segment counting in MessageComposer (160 char segments)
- [X] T027a [US1] Handle patient opt-out (STOP message) in webhook - mark conversation opted-out, prevent outbound (FR-004a) - HIPAA compliance critical

**Checkpoint**: Coordinators can send SMS messages and receive patient replies in real-time

---

## Phase 4: User Story 2 - Start New Patient Conversation (Priority: P1)

**Goal**: Allow coordinators to initiate new SMS conversations by entering patient phone number and friendly name

**Independent Test**: Create new conversation with phone number, send initial message, verify conversation appears in list

### Implementation for User Story 2

- [X] T028 [P] [US2] Create components/conversations/NewConversationModal.tsx with phone input, name input, and validation
- [X] T028a [P] [US2] Add patient search autocomplete to NewConversationModal.tsx - call SleepConnect core patient search endpoint `GET /api/patients?search=` (owned by SleepConnect backend, not part of `contracts/sms-api.yaml`) with 300ms debounce (FR-006a)
- [X] T028b [US2] Wire patient selection to auto-fill phone number and friendly name (first_name + last_name) from patient record returned by SleepConnect patient search API (FR-006b)
- [X] T029 [US2] Implement app/api/outreach/conversations/route.ts (GET list, POST create) per sms-api.yaml
- [X] T030 [US2] Add duplicate conversation detection - navigate to existing conversation if phone number already has active conversation
- [X] T031 [US2] Integrate NewConversationModal with ConversationList for triggering new conversation flow *(integration complete via ConversationList onNewConversation prop)*
- [X] T032 [US2] Create Twilio conversation on backend and sync with PostgreSQL via insert_sms_conversation function *(delegated to Lambda API layer)*

**Checkpoint**: Coordinators can start new conversations with patients (with optional patient search)

---

## Phase 5: User Story 3 - View Conversation History (Priority: P1)

**Goal**: Display complete chronological conversation history with timestamps and sender identification

**Independent Test**: Select conversation, verify all messages display chronologically with correct timestamps and sender IDs

### Implementation for User Story 3

- [X] T033 [P] [US3] Create components/conversations/ConversationList.tsx with conversation cards showing preview, unread count, last message time
- [X] T034 [P] [US3] Create components/conversations/ConversationListItem.tsx with patient name/phone, SLA indicator, unread badge
- [X] T035 [US3] Implement hooks/useConversations.ts for conversation list state with Twilio SDK real-time updates
- [X] T036 [US3] Create app/conversations/page.tsx as main conversation list view
- [X] T037 [US3] Create app/conversations/[id]/page.tsx for single conversation detail view
- [X] T038 [US3] Implement infinite scroll/pagination for conversations with many messages using get_sms_messages_for_conversation
- [X] T039 [US3] Add auto-scroll to latest message on new message arrival with visual indicator
- [X] T040 [US3] Implement mark as read functionality via mark_sms_conversation_read when conversation is viewed

**Checkpoint**: All P1 user stories complete - MVP functional for basic messaging

---

## Phase 5a: User Story 3a - View Patient Context (Priority: P1)

**Goal**: Display patient clinical context in conversation header for informed responses

**Independent Test**: Open conversation linked to patient, verify header shows name, DOB, and profile link

### Implementation for User Story 3a

- [X] T200 [P] [US3a] Create components/conversations/PatientContextHeader.tsx with patient name, DOB, and profile link
- [X] T201 [P] [US3a] Create components/conversations/LinkPatientButton.tsx for unlinked conversations with patient search
- [X] T202 [US3a] Implement app/api/outreach/conversations/[conversationId]/patient/route.ts (GET patient context, PATCH link patient) per FR-039, FR-041
- [X] T203 [US3a] Extend Conversation type in types/sms.ts with optional patient_id, patient_first_name, patient_last_name, patient_dob
- [X] T204 [US3a] Integrate PatientContextHeader with ConversationDetail header - display patient info when linked
- [X] T205 [US3a] Implement cross-zone navigation to patient profile using hard navigation (window.location) per FR-040
- [X] T205a [P] [US3a] Create lib/format.ts with `formatPatientDob(date: string): string` (→ 'MMM DD, YYYY') and `formatLocalTimestamp(utc: string): string` utilities using Intl.DateTimeFormat

**Checkpoint**: Coordinators can view patient clinical context without leaving messaging interface ✅ **COMPLETE**

---

## Phase 5b: User Story 3b - Filter Conversations by Status (Priority: P1)

**Goal**: Enable coordinators to filter conversation list by status for workflow efficiency

**Independent Test**: Apply each filter (All, Unread, SLA Risk, Archived) and verify correct conversations display

### Implementation for User Story 3b

- [X] T206 [P] [US3b] Create components/conversations/ConversationFilter.tsx with segmented control (All, Unread, SLA Risk, Archived)
- [X] T207 [US3b] Extend useConversations hook with filterStatus parameter and real-time filter updates
- [X] T208 [US3b] Integrate ConversationFilter with ConversationList page header
- [X] T209 [US3b] Update app/api/outreach/conversations/route.ts to accept status filter query parameter
- [X] T210 [US3b] Add real-time filter update when conversation status changes (message read, SLA threshold exceeded)

**Checkpoint**: Coordinators can quickly focus on conversations requiring attention ✅ **COMPLETE**

---

## 🎉 MVP MILESTONE ACHIEVED (December 8, 2025)

**All Priority 1 (P1) User Stories Complete!**

- ✅ **Phase 1**: Setup (10/10 tasks)
- ✅ **Phase 2**: Foundation (10/10 tasks)
- ✅ **Phase 3**: Send/Receive SMS - US1 (11/11 tasks) - E2E Verified
- ✅ **Phase 4**: New Conversation - US2 (7/7 tasks)
- ✅ **Phase 5**: View History - US3 (8/8 tasks)
- ✅ **Phase 5a**: Patient Context - US3a (7/7 tasks)
- ✅ **Phase 5b**: Status Filters - US3b (5/5 tasks)

**Total MVP**: 58/58 tasks complete (100%) 🎯

See `specs/001-sms-outreach-integration/MVP-COMPLETE.md` for full implementation summary.

**Next Steps**: Deploy to development environment for stakeholder review, then proceed with P2 features (Templates & SLA) or production hardening.

---

## Phase 6: User Story 4 - Use Message Templates (Priority: P2)

**Goal**: Allow coordinators to use pre-built templates with dynamic variables for efficient messaging

**Independent Test**: Select template, verify variables highlighted, send message with variables replaced

### Implementation for User Story 4

- [ ] T041 [P] [US4] Create components/templates/TemplateSelector.tsx with category filter and search
- [ ] T042 [P] [US4] Create components/templates/TemplatePreview.tsx showing template content with highlighted variables
- [ ] T043 [US4] Implement app/api/outreach/templates/route.ts (GET list) per sms-api.yaml *(Note: T051 adds POST to same file)*
- [ ] T043a [US4] Implement app/api/outreach/templates/frequent/route.ts (GET) - return top N frequently/recently used templates for current coordinator (FR-022b)
- [ ] T044 [US4] Implement app/api/outreach/templates/[templateId]/render/route.ts (POST render with variables)
- [ ] T045 [US4] Implement hooks/useTemplates.ts for template list and selection state
- [ ] T046 [US4] Integrate TemplateSelector with MessageComposer - populate template content on selection
- [ ] T047 [US4] Add variable detection and prompt for missing values before send ({{variableName}} syntax)
- [ ] T048 [US4] Track template usage via increment_sms_template_usage when template is used to send
- [ ] T211 [P] [US4] Create components/templates/QuickTemplateButton.tsx with ⚡ icon and popover UI per FR-022a
- [ ] T212 [US4] Implement recently/frequently used templates query in hooks/useTemplates.ts - consume T043a /api/outreach/templates/frequent endpoint (FR-022b)
- [ ] T213 [US4] Integrate QuickTemplateButton with MessageComposer - position next to send button

**Checkpoint**: Coordinators can use templates for efficient, consistent messaging

---

## Phase 7: User Story 5 - Create and Manage Templates (Priority: P2)

**Goal**: Enable coordinators to create, edit, and delete private message templates

**Independent Test**: Create template with variables, edit it, verify it appears in template library

### Implementation for User Story 5

- [ ] T049 [P] [US5] Create components/templates/TemplateEditor.tsx with name, category selector, content textarea, and variable detection
- [ ] T050 [P] [US5] Create components/templates/TemplateList.tsx showing all templates with edit/delete actions
- [ ] T051 [US5] Add POST handler to app/api/outreach/templates/route.ts (create template) *(extends T043)*
- [ ] T052 [US5] Implement app/api/outreach/templates/[templateId]/route.ts (GET, PATCH, DELETE) per sms-api.yaml
- [ ] T053 [US5] Create app/templates/page.tsx as template management view
- [ ] T054 [US5] Auto-detect variables from content using regex \{\{(\w+)\}\} and display in editor
- [ ] T055 [US5] Add copy to clipboard functionality for template content

**Checkpoint**: Coordinators can manage their own template library

---

## Phase 8: User Story 6 - Monitor Response SLA (Priority: P2)

**Goal**: Alert coordinators when patient replies wait >10 minutes without response

**Independent Test**: Receive patient message, wait 10 minutes, verify SLA alert appears on conversation

### Implementation for User Story 6

- [ ] T056 [P] [US6] Create components/conversations/SlaIndicator.tsx with visual states (ok, warning, breached)
- [ ] T057 [US6] Implement hooks/useSlaMonitor.ts for client-side SLA calculation per research.md pattern
- [ ] T058 [US6] Add SLA tracking on inbound message receipt via insert_sms_response_metric
- [ ] T059 [US6] Update SLA status on coordinator response via complete_sms_response_metric
- [ ] T060 [US6] Integrate SlaIndicator with ConversationListItem - highlight overdue conversations
- [ ] T061 [US6] ~~Add SLA filter to conversation list~~ *(SUPERSEDED by T206-T210 in Phase 5b; SLA Risk is now one of the standard filters)*
- [ ] T062 [US6] Sort conversations by SLA status - overdue conversations appear at top

**Checkpoint**: All P2 user stories complete - enhanced productivity features functional

---

## Phase 9: User Story 7 - View Engagement Analytics (Priority: P3)

**Goal**: Display analytics dashboard with message volume, response times, and delivery rates

**Independent Test**: View analytics dashboard, verify metrics reflect actual conversation data

### Implementation for User Story 7

- [ ] T063 [P] [US7] Create components/analytics/MetricsCards.tsx showing active conversations, avg response time, response rate, delivery rate
- [ ] T064 [P] [US7] Create components/analytics/ResponseTimeChart.tsx with daily trend visualization
- [ ] T065 [US7] Implement app/api/outreach/analytics/route.ts (GET aggregated) per sms-api.yaml
- [ ] T066 [US7] Implement app/api/outreach/analytics/daily/route.ts (GET daily snapshots) per sms-api.yaml
- [ ] T067 [US7] Implement app/api/outreach/analytics/sla/route.ts (GET SLA metrics) per sms-api.yaml
- [ ] T068 [US7] Implement hooks/useAnalytics.ts for analytics data fetching with date range
- [ ] T069 [US7] Create app/analytics/page.tsx as analytics dashboard view
- [ ] T070 [US7] Add date range picker for filtering analytics period

**Checkpoint**: Coordinators can view engagement metrics and trends

---

## Phase 10: User Story 8 - AI Tone Analysis (Priority: P3)

**Goal**: Provide AI-powered sentiment analysis on patient messages with communication suggestions

**Independent Test**: View conversation with varied patient messages, verify sentiment indicators appear

### Implementation for User Story 8

- [ ] T071 [P] [US8] Create lib/sentiment.ts with AWS Comprehend client for sentiment analysis
- [ ] T072 [P] [US8] Create components/conversations/SentimentIndicator.tsx with visual states (positive, neutral, negative, mixed)
- [ ] T073 [US8] Integrate sentiment analysis into webhook handler - analyze inbound messages asynchronously
- [ ] T074 [US8] Store sentiment results via update_sms_message_sentiment function
- [ ] T075 [US8] Display SentimentIndicator on MessageBubble for patient messages
- [ ] T076 [US8] Add sentiment-based communication suggestions in ConversationDetail sidebar
- [ ] T077 [US8] Include sentiment distribution in analytics dashboard (positive/neutral/negative counts)

**Checkpoint**: All user stories complete - full feature set functional

---

## Phase 11: Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] T078 [P] Create app/page.tsx with redirect to /conversations
- [ ] T079 [P] Add search functionality to ConversationList (search by patient name/phone) per FR-014a
- [ ] T080 [P] ~~Add status filter to ConversationList~~ *(SUPERSEDED by T206-T210 in Phase 5b)*
- [ ] T081 Implement conversation archive functionality via archive_sms_conversation
- [ ] T082 Add error boundaries and fallback UI for component errors
- [ ] T083 [P] Add loading states and skeletons for async data fetching
- [ ] T084 [P] Configure toast notifications using sonner for user feedback
- [ ] T085 Add keyboard navigation support for accessibility (WCAG 2.1 AA)
- [ ] T086 [P] Add audit logging for all API operations per HIPAA requirements (FR-036) - verify encryption at rest (FR-035) and TLS (FR-037)
- [ ] T087 Validate quickstart.md setup instructions work end-to-end
- [ ] T088 Performance optimization - ensure conversation list loads <2 seconds with 500+ messages
- [ ] T089 Conduct full accessibility audit against WCAG 2.1 AA (screen reader support, color contrast, aria roles/labels, focus order) and log any issues for follow-up
- [ ] T090 Implement conversation unarchive functionality via unarchive_sms_conversation (FR-013a)
- [ ] T091 Configure SleepConnect multi-zone rewrites in `/home/dan/code/SAX/sleepconnect/next.config.js`: add rewrites for `/outreach/:path*` → Outreach zone, `/outreach-static/_next/:path+` → Outreach zone assets (FR-031a)
- [ ] T092 Document cross-zone navigation: use `<a href>` instead of `<Link>` for navigation between sleepconnect and Outreach zone per Next.js multi-zones guide

---

## Phase 11.5: Production Hardening (From Phase 3 Checklist)

**Purpose**: Address remaining gaps from Phase 3 requirements quality checklist for production readiness

**Source**: `checklists/phase3-us1.md` - 14 remaining items identified during E2E testing (2025-12-02)

### Webhook Security & Reliability

- [ ] T102 [P] Implement webhook idempotency via twilioSid deduplication - prevent duplicate message processing (CHK016)
- [ ] T103 [P] Add webhook rate limiting using token bucket algorithm - protect against flood attacks (CHK041)
- [ ] T104 [P] Implement webhook replay attack prevention via timestamp validation - reject requests older than 5 minutes (CHK042)
- [ ] T105 Handle SDK/webhook race condition - deduplicate events when both SDK and webhook update same message (CHK017)

### Observability & Monitoring

- [ ] T106 [P] Integrate AWS CloudWatch metrics for message latency tracking - measure webhook-to-UI delivery time (CHK081)
- [ ] T107 [P] Implement correlation ID propagation from webhook to SDK events - trace requests across components (CHK082)
- [ ] T108 Define detailed audit log schema (who, what, when, from where) for HIPAA compliance (CHK047)

### Edge Case UI Enhancements

- [ ] T109 [P] Create components/conversations/RetryButton.tsx for failed message retry UI (CHK050, CHK051)
- [ ] T110 [P] Add opt-out send error UI - display clear error when trying to send to opted-out number (CHK054)
- [ ] T111 Implement opt-in (START message) handling in webhook - detect and clear optedOut flag (CHK055)
- [ ] T112 [P] Implement offline message queue using IndexedDB - queue messages when connection lost (CHK057)

### Validation & Concurrency

- [ ] T113 [P] Standardize phone validation error messages in lib/validation.ts (CHK026)
- [ ] T114 Document concurrent coordinator policy - single coordinator per conversation enforcement (CHK059)
- [ ] T115 [P] Add typing indicator component for concurrent access awareness (CHK060)

### Push Notifications (Future)

- [ ] T116 [P] Document push notification PHI truncation requirements for message previews (CHK038)

**Checkpoint**: Production-ready hardening complete - all Phase 3 checklist gaps addressed

---

## Phase 12: Deployment & Infrastructure

**Purpose**: AWS Lambda deployment pipeline matching sleepconnect patterns

- [ ] T093 [P] Create `open-next.config.ts` with OpenNextConfig (minify: !isDebugMode) per sleepconnect pattern
- [ ] T094 [P] Create `scripts/deploy-nextjs.cjs` with ENVIRONMENTS config for develop/staging/production (Lambda, CloudFront, S3 assets)
- [ ] T095 [P] Create `.github/workflows/deploy-develop.yml` with pnpm build, OpenNext, Lambda update, S3 sync, CloudFront invalidation
- [ ] T096 [P] Create `.github/workflows/deploy-staging.yml` matching develop workflow with staging environment config
- [ ] T097 [P] Create `.github/workflows/deploy-production.yml` with production config and 5-second confirmation delay
- [ ] T098 Add Outreach zone environment variables to sleepconnect GitHub workflow secrets: OUTREACH_ZONE_URL (Lambda function URL per environment)
- [ ] T099 Request AWS resources: Lambda functions, S3 buckets, CloudFront distributions for develop/staging/production
- [N/A] T099a ~~**GATE** Verify Twilio Business Associate Agreement (BAA) is in place before production deployment (FR-038, HIPAA compliance)~~ *External responsibility - not managed by this project*
- [ ] T100 Configure Twilio webhook URLs to point to deployed Lambda function URLs per environment
- [ ] T101 [P] Integrate AWS CloudWatch RUM by copying `providers/RumProvider.tsx` and `utils/rum-user-context.ts` patterns from sleepconnect (low priority, staging/production only)

---

## Dependencies & Execution Order

### Phase Dependencies

```
Phase 1 (Setup) ─────────────────────────────────────────────┐
                                                              │
Phase 2 (Foundational) ──────────────────────────────────────┤
                                                              │
     ┌────────────────────────────────────────────────────────┘
     │
     ├── Phase 3 (US1: Send/Receive) ─────┐ ✅ COMPLETE
     │                                     │
     ├── Phase 4 (US2: New Conversation)──┼── Can run in parallel
     │                                     │   after Phase 2
     ├── Phase 5 (US3: History) ──────────┘
     │
     ├── Phase 5a (US3a: Patient Context) ─┐── Can run in parallel
     │                                      │   after US3
     ├── Phase 5b (US3b: Status Filters) ──┘
     │
     │   [MVP Complete after US1-3, US3a, US3b]
     │
     ├── Phase 6 (US4: Use Templates) ────┐
     │                                     │
     ├── Phase 7 (US5: Manage Templates)──┼── Can run in parallel
     │                                     │
     ├── Phase 8 (US6: SLA Monitoring) ───┘
     │
     │   [Enhanced Features after US4-6]
     │
     ├── Phase 9 (US7: Analytics) ────────┐
     │                                     ├── Can run in parallel
     └── Phase 10 (US8: AI Sentiment) ────┘
     
         [Full Feature after US7-8]
         
Phase 11 (Polish) ─── Depends on all desired stories complete

Phase 11.5 (Hardening) ─── Production readiness from Phase 3 checklist gaps

Phase 12 (Deployment) ─── Can start after Phase 1; independent of feature phases
```

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|-----------|-------------------|
| US1 (Send/Receive) | Phase 2 | US2, US3 |
| US2 (New Conversation) | Phase 2 | US1, US3 |
| US3 (View History) | Phase 2 | US1, US2 |
| US3a (Patient Context) | US3 (ConversationDetail) | US3b, US4, US5 |
| US3b (Status Filters) | US3 (ConversationList) | US3a, US4, US5 |
| US4 (Use Templates) | US1 (MessageComposer) | US5, US6 |
| US5 (Manage Templates) | Phase 2 | US4, US6 |
| US6 (SLA Monitoring) | US1, US3 (message flow) | US4, US5 |
| US7 (Analytics) | Phase 2 | US8 |
| US8 (AI Sentiment) | US1 (webhook) | US7 |

### Within Each User Story

- Models/types before hooks
- Hooks before components
- API routes before UI integration
- Core functionality before enhancements

### Parallel Opportunities

**Phase 2 Parallel Tasks**:

```
T011, T012, T013, T014, T015 can all run in parallel
```

**User Story 1 Parallel Tasks**:

```
T019, T019a, T020 can run in parallel (different component files)
```

**User Story 3 Parallel Tasks**:

```
T033, T034 can run in parallel (different component files)
```

**Cross-Story Parallelism** (after Phase 2):

```
Developer A: US1 (Send/Receive)
Developer B: US2 (New Conversation)
Developer C: US3 (View History)
```

---

## Multi-Agent Parallel Execution Plan

### Agent Workstream Allocation

| Agent | Focus Area | Primary Phases | Skills Required |
|-------|------------|----------------|-----------------|
| **Agent A** | Core Infrastructure | Phase 1-2, Phase 12 | Next.js, Auth0, Deployment |
| **Agent B** | Messaging Features | Phase 3 (US1), Phase 10 (US8) | Twilio SDK, Webhooks, AI |
| **Agent C** | Conversations UI | Phase 4-5 (US2-3), Phase 11 | React, Components |
| **Agent D** | Templates & SLA | Phase 6-8 (US4-6) | React, State Management |
| **Agent E** | Analytics | Phase 9 (US7) | Charts, Data Viz |

### Execution Order Table

| Step | Agent A | Agent B | Agent C | Agent D | Agent E | Blocker |
|------|---------|---------|---------|---------|---------|---------|
| **1** | T001, T002 | — | — | — | — | None |
| **2** | T003-T009a | — | — | — | — | T001-T002 |
| **3** | T010 | — | — | — | — | Phase 1 ✅ |
| **4** | T011-T015 | — | — | — | — | T010 (types) |
| **5** | T016-T018 | — | — | — | — | T012-T014 |
| **6** | — | T019, T019a, T020, T026 | T033, T034 | T041, T042, T049, T050 | T063, T064 | Phase 2 ✅ |
| **7** | T093, T094 | T021, T022 | T028, T029 | T043, T044 | T065-T067 | Step 6 |
| **8** | T095-T097 | T023, T025 | T030, T035 | T045, T051 | T068 | Step 7 |
| **9** | — | T024, T027, T027a | T031, T032, T036, T037 | T046-T048, T052 | T069, T070 | Step 8 |
| **10** | T098-T100 | T071, T072 | T038-T040 | T053-T055, T056 | — | Step 9 |
| **11** | T099a, T101 | T073-T075 | T078-T080 | T057-T059 | — | Step 10 |
| **12** | — | T076, T077 | T081-T083 | T060-T062 | — | Step 11 |
| **13** | T091 | — | T084-T086 | — | — | Step 12 |
| **14** | T092 | — | T087, T088, T090 | — | — | Step 13 |

### Parallel Execution Metrics

| Metric | Value |
|--------|-------|
| **Sequential execution** | ~104 units |
| **Parallel execution (5 agents)** | ~14 units |
| **Speedup factor** | ~7.4x |
| **Critical path length** | 11 tasks |

### Critical Path

```
T001 → T002 → T010 → T016 → T017 → T023 → T024 → T037 → T038 → T081 → T087
```

### Task Allocation by Agent

| Agent | Tasks | Count |
|-------|-------|-------|
| **Agent A** | T001-T018, T091-T101 | 29 |
| **Agent B** | T019-T027a, T071-T077 | 18 |
| **Agent C** | T028-T040, T078-T090 | 25 |
| **Agent D** | T041-T062 | 22 |
| **Agent E** | T063-T070 | 8 |

### MVP Parallel Execution (3 Agents)

For MVP delivery (US1-3 only), use Agents A, B, C:

| Step | Agent A | Agent B | Agent C | Notes |
|------|---------|---------|---------|-------|
| 1-5 | Phase 1-2 | — | — | Foundation |
| 6 | — | T019, T019a, T020, T026 | T033, T034 | Components |
| 7 | — | T021, T022 | T028, T029 | APIs |
| 8 | — | T023, T025 | T030, T035 | Hooks |
| 9 | — | T024, T027, T027a | T031, T032, T036, T037 | Integration |
| 10 | — | — | T038, T039, T040 | Polish |

**MVP with 3 agents**: ~10 steps (vs ~42 sequential)

---

## Implementation Strategy

### MVP First (User Stories 1-3 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1 (Send/Receive)
4. Complete Phase 4: User Story 2 (New Conversation)
5. Complete Phase 5: User Story 3 (View History)
6. **STOP and VALIDATE**: Test all P1 stories independently
7. Deploy/demo MVP

### Incremental Delivery

| Increment | Stories | Value Delivered |
|-----------|---------|-----------------|
| MVP | US1, US2, US3 | Basic bi-directional SMS messaging |
| Enhanced | US4, US5, US6 | Templates + SLA monitoring |
| Full | US7, US8 | Analytics + AI insights |
| Polish | Cross-cutting | Search, filters, accessibility |

### Key Files by Layer

| Layer | Files | User Stories |
|-------|-------|--------------|
| Types | types/sms.ts | All |
| API Routes | app/api/outreach/* | All |
| Hooks | hooks/use*.ts | All |
| Components | components/conversations/* | US1, US2, US3, US6 |
| Components | components/templates/* | US4, US5 |
| Components | components/analytics/* | US7 |
| Pages | app/conversations/* | US1, US2, US3 |
| Pages | app/templates/* | US5 |
| Pages | app/analytics/* | US7 |
| Deployment | scripts/deploy-nextjs.cjs, .github/workflows/* | Deployment |
| Config | open-next.config.ts, next.config.js | Setup, Deployment |

---

## Summary

| Metric | Value |
|--------|-------|
| **Total Tasks** | 138 (T001-T116, T200-T213, + T018a, T028a, T028b, T043a, T205a, T089; T061, T080 superseded) |
| **Phase 1 (Setup)** | 10 tasks (T001-T009a) |
| **Phase 2 (Foundational)** | 10 tasks (T010-T018a) |
| **Phase 3 (US1)** | 11 tasks (T019-T027a) ✅ **COMPLETE** (E2E verified 2025-12-02) |
| **Phase 4 (US2)** | 7 tasks (T028-T032 + T028a, T028b for patient search) |
| **Phase 5 (US3)** | 8 tasks |
| **Phase 5a (US3a: Patient Context)** | 7 tasks (T200-T205a) |
| **Phase 5b (US3b: Status Filters)** | 5 tasks (T206-T210) |
| **Phase 6 (US4)** | 12 tasks (T041-T048, T043a frequent templates API, T211-T213 for Quick Template) |
| **Phase 7 (US5)** | 7 tasks |
| **Phase 8 (US6)** | 7 tasks |
| **Phase 9 (US7)** | 8 tasks |
| **Phase 10 (US8)** | 7 tasks |
| **Phase 11 (Polish)** | 15 tasks (T078-T092) |
| **Phase 11.5 (Hardening)** | 15 tasks (T102-T116, from Phase 3 checklist gaps) |
| **Phase 12 (Deployment)** | 10 tasks (T093-T101, includes T099a BAA gate) |
| **Parallel Opportunities** | 55 tasks marked [P] |
| **MVP Scope** | T001-T040, T200-T210 + T028a, T028b (55 tasks with T019a, T027a, US3a, US3b) |
| **Multi-Zone Integration** | T091 configures sleepconnect rewrites for /outreach; T028a uses sleepconnect /api/patients |

### Format Validation ✅

All tasks follow the required checklist format:

- ✅ Checkbox prefix `- [ ]`
- ✅ Task ID (T001-T116, with T009a, T019a, T027a, T028a, T028b, T099a additions)
- ✅ [P] marker for parallelizable tasks
- ✅ [US#] label for user story phase tasks
- ✅ Description with file paths

---

## Notes

- All API routes follow OpenAPI spec in `contracts/sms-api.yaml`
- Database functions referenced (e.g., `insert_sms_*`, `get_sms_*`, `update_sms_*`) are PostgreSQL stored procedures defined in the database schema, executed via SAX Backend API (`/home/dan/code/SAX/sax-backend`) - see T009a for full list and `sleepconnect/specs/sms-outreach-database-integration.md` for implementation tasks
- ~~Twilio SDK patterns from `research.md` section 4~~ *Superseded by ADR-001*
- Auth0 integration patterns from `research.md` section 3
- UI components use Flowbite React matching sleepconnect
- **Prerequisites**: Twilio BAA verification is an external responsibility (T099a marked N/A)
- **Phase 3 Checklist**: 91/105 items complete (87% PASS), 14 gaps addressed in Phase 11.5 (T102-T116)

---

## Architecture Decision Records

### ADR-001: Twilio Messaging API vs Conversations API

**Date**: 2025-12-08  
**Status**: Accepted  
**Context**: Original spec (T016, T017) called for Twilio Conversations SDK with WebSocket-based real-time updates.

**Decision**: Use Twilio Messaging API (Programmable SMS) with REST + webhooks + React Query polling instead.

**Rationale**:

| Factor | Conversations SDK | Messaging API (Chosen) |
|--------|-------------------|------------------------|
| Lambda Compatible | ❌ Needs persistent connections | ✅ Stateless, perfect fit |
| AWS Cost | ~$475/mo (ECS + Conversations fees) | ~$2.50/mo (Lambda only) |
| Complexity | High (SDK, tokens, WebSockets, sync) | Low (REST, webhooks, polling) |
| State Management | Dual (Twilio Cloud + DB) | Single (PostgreSQL) |
| Real-time Latency | ~100ms | ~3s (polling interval) |
| Maintenance | SDK upgrades, token refresh | Minimal |

**Consequences**:

- T016 (token route) marked N/A - not needed
- T017 (useTwilioClient) marked N/A - replaced by useMessages with React Query
- 3-second polling latency is acceptable for SMS workflows
- PostgreSQL is single source of truth for all conversation state

**Affected Tasks**: T016, T017 (pivoted), T023 (uses polling)
