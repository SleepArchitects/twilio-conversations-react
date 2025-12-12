---
description: "Task list for SMS Outreach Integration"
---

# Tasks: SMS Outreach Integration

**Input**: Design documents from `specs/001-sms-outreach-integration/`

**Prerequisites**: `plan.md` ✅, `spec.md` ✅, `research.md` ✅, `data-model.md` ✅, `contracts/` ✅, `quickstart.md` ✅

**Tests**: Manual verification will be performed by the user/developer using the spec’s **Independent Test** / **Acceptance Scenarios** and the checkpoints below. Automated tests may be added later, but manual verification is required.

## Checklist Format (REQUIRED)

Every task MUST strictly follow:

Example: `- [ ] T001 [P] [US1] Do something in path/to/file.ts`

Where:

- **[P]** = parallelizable (different files, no dependencies)
- **[US#]** = user-story label for user story phases only (`[US1]`, `[US2]`, `[US3]`, `[US3a]`, ...)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Ensure the Outreach zone is runnable, configured, and consistent with `plan.md`.

- [ ] T001 Confirm zone routing config in `next.config.mjs` (`basePath: '/outreach'`, `assetPrefix: '/outreach-static'`) (FR-033, NFR-005)
- [ ] T002 [P] Confirm global styling + theme primitives in `app/globals.css` and `tailwind.config.ts` (Flowbite + tokens)
- [ ] T003 [P] Confirm TypeScript path aliases in `tsconfig.json` for `@/components`, `@/hooks`, `@/lib`, `@/types`
- [ ] T004 [P] Confirm required env vars documented in `.env.example` (Twilio, Auth0, Lambda base URL, webhook base URL)
- [ ] T005 [P] Confirm base lint/format scripts in `package.json` (lint, typecheck)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Shared primitives that block all user stories.

- [ ] T006 Ensure core domain types exist in `types/sms.ts` (Conversation, Message, Template, enums: status/sla/sentiment)
- [ ] T007 [P] Ensure phone validation helpers exist in `lib/validation.ts` (US E.164 +1 rules per FR-004)
- [ ] T008 [P] Ensure datetime formatting utilities exist in `lib/datetime.ts` (UTC storage, local display per FR-008a/FR-008b)
- [ ] T009 [P] Ensure Auth0 helpers exist in `lib/auth.ts` for API routes (session extraction, coordinator identity) (FR-032)
- [ ] T010 Ensure tenant/practice request context is enforced for API routes via `lib/auth.ts` + `lib/api.ts` (contracts require `X-Tenant-Id`, `X-Practice-Id`) (FR-032)
- [ ] T011 [P] Ensure Lambda API client conventions exist in `lib/api.ts` (timeouts, error shaping, buildPath helper using native `URL` API)
- [ ] T012 [P] Add a minimal audit logging helper in `lib/api.ts` (invoked from API routes; no PHI in logs) (FR-036)

**Checkpoint**: Foundation ready — user story work can begin.

---

## Phase 3: User Story 1 — Send and Receive SMS Messages (Priority: P1) — MVP

**Goal**: Coordinator can send SMS and see inbound replies + delivery statuses.

**Independent Test**: Send SMS to patient phone, receive reply, verify both appear with correct timestamps and delivery status.

- [ ] T013 [P] [US1] Implement message composer UI in `components/conversations/MessageComposer.tsx` (character count + segment count per FR-005)
- [ ] T014 [P] [US1] Implement message bubble UI in `components/conversations/MessageBubble.tsx` (sender + timestamp + status per FR-003/FR-009)
- [ ] T015 [US1] Implement messages API route in `app/api/outreach/conversations/[conversationId]/messages/route.ts` (GET/POST per `specs/001-sms-outreach-integration/contracts/sms-api.yaml`)
- [ ] T016 [P] [US1] Implement messages query/mutation hook in `hooks/useMessages.ts` (polling interval tuned to SC-002)
- [ ] T017 [US1] Twilio webhook handling is implemented in SleepConnect (API Gateway/Lambda), not this zone (signature validation + inbound storage per FR-002)
- [ ] T018 [US1] Twilio status callback handling is implemented in SleepConnect (API Gateway/Lambda) (sending→sent→delivered→read→failed per FR-003)
- [ ] T019 [US1] Opt-out detection is implemented in SleepConnect inbound webhook processing; enforce outbound blocking in `app/api/outreach/conversations/[conversationId]/messages/route.ts` (FR-004a)

**Checkpoint**: SMS send/receive works end-to-end; status updates reflect webhook callbacks.

---

## Phase 4: User Story 2 — Start New Patient Conversation (Priority: P1)

**Goal**: Coordinator can initiate a new conversation via phone/name (and patient search), with duplicate prevention.

**Independent Test**: Create a new conversation with patient phone; verify it appears; send initial message.

- [ ] T020 [P] [US2] Add "New Conversation" entry point in `app/conversations/page.tsx` (button + navigation)
- [ ] T021 [P] [US2] Implement new conversation modal in `components/conversations/NewConversationModal.tsx` (phone + friendly name validation)
- [ ] T022 [P] [US2] Implement patient search hook in `hooks/usePatientsSearch.ts` (calls SleepConnect `/api/patients?search=` with debounce) (FR-006a)
- [ ] T023 [US2] Implement create-conversation API route in `app/api/outreach/conversations/route.ts` (POST per contract)
- [ ] T024 [P] [US2] Implement conversations list hook in `hooks/useConversations.ts` (GET `/api/outreach/conversations`)
- [ ] T025 [US2] Implement duplicate handling: on create 409 navigate to existing in `NewConversationModal.tsx` (FR-007)

**Checkpoint**: Coordinator can create (or reuse) a conversation by phone/name or patient selection.

---

## Phase 5: User Story 3 — View Conversation History (Priority: P1)

**Goal**: Coordinator can view full history with pagination/infinite scroll and near-real-time updates.

**Independent Test**: Select conversation; messages load ordered; scroll loads older; new messages appear.

- [ ] T026 [P] [US3] Create conversation detail page in `app/conversations/[id]/page.tsx` (loads conversation + messages)
- [ ] T027 [P] [US3] Build conversation detail component in `components/conversations/ConversationDetail.tsx` (auto-scroll to latest)
- [ ] T028 [US3] Implement infinite scroll / pagination in `hooks/useMessages.ts` + `ConversationDetail.tsx` (FR-011)
- [ ] T029 [US3] Implement mark-as-read call in `app/api/outreach/conversations/[conversationId]/read/route.ts` (POST per contract) and invoke from `ConversationDetail.tsx`

**Checkpoint**: Conversation history is usable for 500+ messages (SC-007).

---

## Phase 6: User Story 3a — View Patient Context (Priority: P1)

**Goal**: Show patient name/DOB + patient profile link; allow linking when unlinked.

**Independent Test**: Linked conversation shows name/DOB + profile link; unlinked shows Link Patient flow; linking updates header.

- [ ] T030 [P] [US3a] Create header component in `components/conversations/PatientContextHeader.tsx` (linked: name/DOB; unlinked: phone/friendly name)
- [ ] T031 [US3a] Implement conversation detail API route in `app/api/outreach/conversations/[conversationId]/route.ts` (GET per contract, includes `patientId`)
- [ ] T032 [P] [US3a] Implement link-patient UI in `components/conversations/LinkPatientButton.tsx` (search + select)
- [ ] T033 [US3a] Implement link-patient mutation via `app/api/outreach/conversations/[conversationId]/route.ts` (PATCH per contract; sets `patient_id`) (FR-041/FR-042)
- [ ] T034 [US3a] Ensure patient profile navigation uses hard navigation in `PatientContextHeader.tsx` (FR-040/FR-034)

**Checkpoint**: Patient context appears when linked; linking flow updates conversation.

---

## Phase 7: User Story 3b — Filter Conversations by Status (Priority: P1)

**Goal**: Filter list by All/Unread/SLA Risk/Archived, updating near real-time.

**Independent Test**: Apply each filter; only matching conversations display; status changes refresh list.

- [ ] T035 [P] [US3b] Create filter UI in `components/conversations/ConversationFilter.tsx` with canonical values (FR-014c)
- [ ] T036 [US3b] Wire filter into `app/conversations/page.tsx` and `hooks/useConversations.ts` query params
- [ ] T037 [US3b] Implement server-side filter mapping in `app/api/outreach/conversations/route.ts` (status/unread/sla_risk/archived)
- [ ] T038 [US3b] Implement conversation list refresh policy in `hooks/useConversations.ts` (polling) to satisfy FR-014d + SC-006

- [ ] T067 [P] [US3b] Add conversation search input (name/phone) in `app/conversations/page.tsx` with debounce and URL query param (FR-014a; use native `URL` API)
- [ ] T068 [P] [US3b] Extend `hooks/useConversations.ts` to accept `search` param, include it in the query key, and build request URLs via native `URL` API (FR-014a)
- [ ] T069 [US3b] Implement server-side search mapping in `app/api/outreach/conversations/route.ts` (forward/search by patient name or phone per contract/Lambda semantics) (FR-014a)

- [ ] T070 [US3b] (Low priority) Add archive/unarchive action UI (list item and/or detail) that calls the archive endpoint and refreshes list state (FR-013/FR-013a)
- [ ] T071 [US3b] (Low priority) Implement archive/unarchive wiring in API routes under `app/api/outreach/conversations/[conversationId]/*` per `sms-api.yaml` (DELETE = archive/soft-delete via `active=false`) (FR-013/FR-013a, Constitution I)

**Checkpoint**: Coordinator can focus by status; SLA risk appears within 10:00–11:00.

---

## Phase 8: User Story 4 — Use Message Templates (Priority: P2)

**Goal**: Insert templates into composer with variable highlighting and quick access.

**Independent Test**: Select template; variables highlight; unresolved variables block send.

- [ ] T039 [P] [US4] Implement templates list API route in `app/api/outreach/templates/route.ts` (GET per contract)
- [ ] T040 [P] [US4] Implement templates hook in `hooks/useTemplates.ts` (list + caching)
- [ ] T041 [P] [US4] Implement template picker popover in `components/templates/TemplatePickerPopover.tsx` (used by composer)
- [ ] T042 [US4] Add Quick Template button to `components/conversations/MessageComposer.tsx` (FR-022a)
- [ ] T043 [US4] Implement unresolved-variable detection + blocking UI in `components/conversations/MessageComposer.tsx` (FR-022)
- [ ] T044 [US4] Implement recent/frequent templates tracking in `lib/templates.ts` and surface in `TemplatePickerPopover.tsx` (FR-022b)

**Checkpoint**: Templates can be inserted quickly; unresolved placeholders are blocked.

---

## Phase 9: User Story 5 — Create and Manage Templates (Priority: P2)

**Goal**: Create/edit/archive templates with variable detection.

**Independent Test**: Create template; variables detected; edit; archive; library updates.

- [ ] T045 [P] [US5] Implement templates page in `app/templates/page.tsx`
- [ ] T046 [P] [US5] Create template editor in `components/templates/TemplateEditor.tsx` (name/category/content)
- [ ] T047 [P] [US5] Implement variable detection helper in `lib/template-tokens.ts` (`{{variable}}` parsing per FR-018/FR-019)
- [ ] T048 [US5] Implement template CRUD API routes in `app/api/outreach/templates/route.ts` (POST) and `app/api/outreach/templates/[templateId]/route.ts` (GET/PATCH/DELETE=archive; `active=false` per contract) (FR-021, Constitution I)
- [ ] T049 [US5] Wire create/edit/archive flows via `hooks/useTemplates.ts` mutations + cache updates

**Checkpoint**: Templates can be managed; categories enforced; variables detected.

---

## Phase 10: User Story 6 — Monitor Response SLA (Priority: P2)

**Goal**: SLA risk indicator shows when patient reply waits > 10 minutes; clears on response; logs response times.

**Independent Test**: Receive patient reply; wait 10 minutes; see SLA risk; respond; SLA clears and metric logs.

- [ ] T050 [P] [US6] Render SLA indicator on list items in `components/conversations/ConversationListItem.tsx` (FR-026)
- [ ] T051 [P] [US6] Implement SLA status tracking UI helper in `hooks/useSlaMonitor.ts` (client-side calculation; aligns to SC-006)
- [ ] T052 [US6] Ensure inbound webhook triggers SLA start tracking in SleepConnect (API Gateway/Lambda) (FR-027)
- [ ] T053 [US6] Ensure outbound send path completes SLA tracking in `app/api/outreach/conversations/[conversationId]/messages/route.ts` (FR-027)

**Checkpoint**: SLA risk indicator and response metrics behave per spec.

---

## Phase 11: User Story 7 — View Engagement Analytics (Priority: P3)

**Goal**: Analytics dashboard shows delivery/response metrics and trends.

**Independent Test**: View analytics page for a date range; verify metrics render and match expected results.

- [ ] T054 [P] [US7] Implement analytics page in `app/analytics/page.tsx`
- [ ] T055 [P] [US7] Implement analytics API routes in `app/api/outreach/analytics/route.ts` and `app/api/outreach/analytics/daily/route.ts` (GET per contract)
- [ ] T056 [P] [US7] Implement SLA metrics API route in `app/api/outreach/analytics/sla/route.ts` (GET per contract)
- [ ] T057 [US7] Implement analytics hook in `hooks/useAnalytics.ts` (date-range queries)
- [ ] T058 [US7] Render dashboard components in `components/analytics/` (KPIs + basic trends)

**Checkpoint**: Coordinators/managers can view engagement analytics.

---

## Phase 12: User Story 8 — AI Tone Analysis (Priority: P3)

**Goal**: Sentiment indicators on inbound messages + suggested guidance.

**Independent Test**: Receive messages with different sentiment; indicator appears; guidance shown for negative sentiment.

- [ ] T059 [P] [US8] Confirm sentiment fields in `types/sms.ts` match `data-model.md` (sentiment + sentimentScore)
- [ ] T060 [US8] Implement message detail API route in `app/api/outreach/messages/[messageId]/route.ts` (GET per contract)
- [ ] T061 [US8] Add sentiment indicator UI in `components/conversations/MessageBubble.tsx` (patient messages only)
- [ ] T062 [US8] Add guidance panel in `components/conversations/SentimentGuidance.tsx` (feature-flagged)
- [ ] T063 [US8] Gate sentiment UI with `NEXT_PUBLIC_ENABLE_SENTIMENT_ANALYSIS` in `lib/buildInfo.ts` (or existing feature-flag helper)

**Checkpoint**: Tone analysis appears and is controllable via feature flag.

---

## Final Phase: Polish & Cross-Cutting Concerns

**Purpose**: Hardening, security, and docs validation.

- [ ] T064 [P] Remove any message-body logging in server routes under `app/api/outreach/**` (PHI-safe logging only) (Constitution II, FR-036)
- [ ] T065 Ensure Twilio signature validation is enforced outside dev in SleepConnect (API Gateway/Lambda) (FR-002)
- [ ] T066 [P] Validate quickstart steps + env vars against current implementation in `specs/001-sms-outreach-integration/quickstart.md`

- [ ] T072 [P] Run manual accessibility + keyboard navigation pass for key flows (conversations list/detail, composer, templates) and record results (NFR-002, NFR-003)
- [ ] T073 [P] Run manual responsive pass (320px → 2560px) for key flows and record results (NFR-004)
- [ ] T074 Validate SleepConnect shell integration + cross-zone navigation behavior and record results (NFR-005, FR-034)
- [ ] T075 [P] Run a basic performance check (Core Web Vitals / Lighthouse snapshot) for conversations list/detail and record results (NFR-001)

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) → Foundational (Phase 2) → User Stories (Phases 3–12) → Polish

### User Story Dependencies (Recommended)

- **US1** can be developed first (MVP), using any existing conversation for initial manual verification.
- **US2** should land early to make **US1** fully self-serve (create conversation → send message).
- **US3 / US3a / US3b** build on the conversation + message flows.
- **US4/US5** build on the composer (US1).
- **US6** depends on inbound/outbound messaging (US1).
- **US7/US8** should follow after P1/P2 stability.

---

## Parallel Execution Examples

### US1 Parallel Set

- `T013` (`components/conversations/MessageComposer.tsx`)
- `T014` (`components/conversations/MessageBubble.tsx`)
- `T016` (`hooks/useMessages.ts`)

### US2 Parallel Set

- `T021` (`components/conversations/NewConversationModal.tsx`)
- `T022` (`hooks/usePatientsSearch.ts`)

### US5 Parallel Set

- `T046` (`components/templates/TemplateEditor.tsx`)
- `T047` (`lib/template-tokens.ts`)
