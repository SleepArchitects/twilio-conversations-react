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

- [ ] T010 Create TypeScript types from data-model.md in types/sms.ts (enums, interfaces for all entities)
- [ ] T011 [P] Create app/layout.tsx with Flowbite ThemeProvider, Auth0 UserProvider, and base HTML structure
- [ ] T012 [P] Implement lib/auth.ts with Auth0 session utilities and withApiAuthRequired wrapper
- [ ] T013 [P] Implement lib/twilio.ts with Twilio client configuration and token generation
- [ ] T014 [P] Implement lib/api.ts with Lambda API client utilities and error handling
- [ ] T015 [P] Copy shared UI components from sleepconnect: components/ui/button.tsx, card.tsx, badge.tsx
- [ ] T016 Create app/api/outreach/token/route.ts for Twilio access token generation (POST /api/outreach/token)
- [ ] T017 Implement hooks/useTwilioClient.ts for Twilio Conversations SDK initialization with token refresh
- [ ] T018 Create middleware.ts for Auth0 route protection on all /outreach routes

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3: User Story 1 - Send and Receive SMS Messages (Priority: P1) 🎯 MVP

**Goal**: Enable bi-directional SMS messaging between coordinators and patients with real-time delivery status

**Independent Test**: Send SMS to patient phone, receive reply, verify both appear in conversation view with correct timestamps and delivery status

### Implementation for User Story 1

- [ ] T019 [P] [US1] Create components/conversations/MessageBubble.tsx with sender identification, timestamp, and delivery status indicator
- [ ] T019a [P] [US1] Implement lib/datetime.ts with UTC-to-local timezone conversion utilities using Intl.DateTimeFormat (FR-008a, FR-008b, Constitution VII)
- [ ] T020 [P] [US1] Create components/conversations/MessageComposer.tsx with textarea, character count, segment display, and send button
- [ ] T021 [US1] Implement app/api/outreach/conversations/[conversationId]/messages/route.ts (GET list, POST send) per sms-api.yaml
- [ ] T022 [US1] Implement app/api/outreach/webhook/route.ts for Twilio inbound messages and status callbacks
- [ ] T023 [US1] Implement hooks/useMessages.ts for message state management with real-time Twilio SDK updates
- [ ] T024 [US1] Create components/conversations/ConversationDetail.tsx with message list, auto-scroll, and composer integration
- [ ] T025 [US1] Implement message delivery status updates (sending → sent → delivered → read → failed) via Twilio webhooks
- [ ] T026 [US1] Add US phone number validation (+1 format) in lib/validation.ts
- [ ] T027 [US1] Handle SMS character limits and segment counting in MessageComposer (160 char segments)
- [ ] T027a [US1] Handle patient opt-out (STOP message) in webhook - mark conversation opted-out, prevent outbound (FR-004a) - HIPAA compliance critical

**Checkpoint**: Coordinators can send SMS messages and receive patient replies in real-time

---

## Phase 4: User Story 2 - Start New Patient Conversation (Priority: P1)

**Goal**: Allow coordinators to initiate new SMS conversations by entering patient phone number and friendly name

**Independent Test**: Create new conversation with phone number, send initial message, verify conversation appears in list

### Implementation for User Story 2

- [ ] T028 [P] [US2] Create components/conversations/NewConversationModal.tsx with phone input, name input, and validation
- [ ] T029 [US2] Implement app/api/outreach/conversations/route.ts (GET list, POST create) per sms-api.yaml
- [ ] T030 [US2] Add duplicate conversation detection - navigate to existing conversation if phone number already has active conversation
- [ ] T031 [US2] Integrate NewConversationModal with ConversationList for triggering new conversation flow
- [ ] T032 [US2] Create Twilio conversation on backend and sync with PostgreSQL via insert_sms_conversation function

**Checkpoint**: Coordinators can start new conversations with patients

---

## Phase 5: User Story 3 - View Conversation History (Priority: P1)

**Goal**: Display complete chronological conversation history with timestamps and sender identification

**Independent Test**: Select conversation, verify all messages display chronologically with correct timestamps and sender IDs

### Implementation for User Story 3

- [ ] T033 [P] [US3] Create components/conversations/ConversationList.tsx with conversation cards showing preview, unread count, last message time
- [ ] T034 [P] [US3] Create components/conversations/ConversationListItem.tsx with patient name/phone, SLA indicator, unread badge
- [ ] T035 [US3] Implement hooks/useConversations.ts for conversation list state with Twilio SDK real-time updates
- [ ] T036 [US3] Create app/conversations/page.tsx as main conversation list view
- [ ] T037 [US3] Create app/conversations/[id]/page.tsx for single conversation detail view
- [ ] T038 [US3] Implement infinite scroll/pagination for conversations with many messages using get_sms_messages_for_conversation
- [ ] T039 [US3] Add auto-scroll to latest message on new message arrival with visual indicator
- [ ] T040 [US3] Implement mark as read functionality via mark_sms_conversation_read when conversation is viewed

**Checkpoint**: All P1 user stories complete - MVP functional for basic messaging

---

## Phase 6: User Story 4 - Use Message Templates (Priority: P2)

**Goal**: Allow coordinators to use pre-built templates with dynamic variables for efficient messaging

**Independent Test**: Select template, verify variables highlighted, send message with variables replaced

### Implementation for User Story 4

- [ ] T041 [P] [US4] Create components/templates/TemplateSelector.tsx with category filter and search
- [ ] T042 [P] [US4] Create components/templates/TemplatePreview.tsx showing template content with highlighted variables
- [ ] T043 [US4] Implement app/api/outreach/templates/route.ts (GET list) per sms-api.yaml *(Note: T051 adds POST to same file)*
- [ ] T044 [US4] Implement app/api/outreach/templates/[templateId]/render/route.ts (POST render with variables)
- [ ] T045 [US4] Implement hooks/useTemplates.ts for template list and selection state
- [ ] T046 [US4] Integrate TemplateSelector with MessageComposer - populate template content on selection
- [ ] T047 [US4] Add variable detection and prompt for missing values before send ({{variableName}} syntax)
- [ ] T048 [US4] Track template usage via increment_sms_template_usage when template is used to send

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
- [ ] T061 [US6] Add SLA filter to conversation list (show only SLA overdue)
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
- [ ] T080 [P] Add status filter to ConversationList (active, archived, SLA overdue) per FR-014b
- [ ] T081 Implement conversation archive functionality via archive_sms_conversation
- [ ] T082 Add error boundaries and fallback UI for component errors
- [ ] T083 [P] Add loading states and skeletons for async data fetching
- [ ] T084 [P] Configure toast notifications using sonner for user feedback
- [ ] T085 Add keyboard navigation support for accessibility (WCAG 2.1 AA)
- [ ] T086 [P] Add audit logging for all API operations per HIPAA requirements (FR-036) - verify encryption at rest (FR-035) and TLS (FR-037)
- [ ] T087 Validate quickstart.md setup instructions work end-to-end
- [ ] T088 Performance optimization - ensure conversation list loads <2 seconds with 500+ messages
- [ ] T090 Implement conversation unarchive functionality via unarchive_sms_conversation (FR-013a)
- [ ] T091 Configure SleepConnect multi-zone rewrites in `/home/dan/code/SAX/sleepconnect/next.config.js`: add rewrites for `/outreach/:path*` → Outreach zone, `/outreach-static/_next/:path+` → Outreach zone assets (FR-031a)
- [ ] T092 Document cross-zone navigation: use `<a href>` instead of `<Link>` for navigation between sleepconnect and Outreach zone per Next.js multi-zones guide

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
- [ ] T099a **GATE** Verify Twilio Business Associate Agreement (BAA) is in place before production deployment (FR-038, HIPAA compliance)
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
     ├── Phase 3 (US1: Send/Receive) ─────┐
     │                                     │
     ├── Phase 4 (US2: New Conversation)──┼── Can run in parallel
     │                                     │   after Phase 2
     ├── Phase 5 (US3: History) ──────────┘
     │
     │   [MVP Complete after US1-3]
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

Phase 12 (Deployment) ─── Can start after Phase 1; independent of feature phases
```

### User Story Dependencies

| Story | Depends On | Can Parallel With |
|-------|-----------|-------------------|
| US1 (Send/Receive) | Phase 2 | US2, US3 |
| US2 (New Conversation) | Phase 2 | US1, US3 |
| US3 (View History) | Phase 2 | US1, US2 |
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
| **Total Tasks** | 104 |
| **Phase 1 (Setup)** | 10 tasks (T001-T009a) |
| **Phase 2 (Foundational)** | 9 tasks |
| **Phase 3 (US1)** | 11 tasks (T019-T027a, includes T019a datetime utils, T027a opt-out handling) |
| **Phase 4 (US2)** | 5 tasks |
| **Phase 5 (US3)** | 8 tasks |
| **Phase 6 (US4)** | 8 tasks |
| **Phase 7 (US5)** | 7 tasks |
| **Phase 8 (US6)** | 7 tasks |
| **Phase 9 (US7)** | 8 tasks |
| **Phase 10 (US8)** | 7 tasks |
| **Phase 11 (Polish)** | 14 tasks (T078-T088, T090-T092; T089 moved to T027a) |
| **Phase 12 (Deployment)** | 10 tasks (T093-T101, includes T099a BAA gate) |
| **Parallel Opportunities** | 36 tasks marked [P] |
| **MVP Scope** | T001-T040 (42 tasks with T019a, T027a) |
| **Multi-Zone Integration** | T091 configures sleepconnect rewrites for /outreach |

### Format Validation ✅

All tasks follow the required checklist format:

- ✅ Checkbox prefix `- [ ]`
- ✅ Task ID (T001-T101, with T009a, T027a, T099a additions)
- ✅ [P] marker for parallelizable tasks
- ✅ [US#] label for user story phase tasks
- ✅ Description with file paths

---

## Notes

- All API routes follow OpenAPI spec in `contracts/sms-api.yaml`
- Database functions referenced (e.g., `insert_sms_*`, `get_sms_*`, `update_sms_*`) are PostgreSQL stored procedures defined in the database schema, executed via sleepconnect's Lambda API layer - see T009a for full list
- Twilio SDK patterns from `research.md` section 4
- Auth0 integration patterns from `research.md` section 3
- UI components use Flowbite React matching sleepconnect
- **Prerequisites**: Twilio BAA must be verified before production launch (T099a gate, HIPAA compliance)
- **Prerequisites**: Twilio BAA must be verified before production launch (HIPAA compliance)
