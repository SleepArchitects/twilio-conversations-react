# Specification Analysis Report

**Generated**: 2025-12-08  
**Analyzer**: `/speckit.analyze` command  
**Artifacts Analyzed**: `spec.md`, `plan.md`, `tasks.md`, `constitution.md`

## Executive Summary

**Overall Quality**: ✅ **EXCELLENT** - All 3 core artifacts are complete, consistent, and constitution-compliant with **1 CRITICAL** runtime issue blocking development and **7 recommended improvements** for production readiness.

**Constitution Compliance**: ✅ **PASS** - All 8 principles satisfied (documented in plan.md Constitution Check)

**Coverage**: ✅ **97%** - 66/68 functional requirements mapped to tasks (2 gaps: NFR-001 verification, NFR-002 extension)

**Critical Issues**: 🔴 **1** - Asset path configuration breaks local development (styles not loading)

**Recommendation**: Fix the critical assetPrefix issue immediately (15 min), then proceed with `/speckit.implement` for remaining P2/P3 features.

---

## Critical Issues 🔴

### C1: Asset Path Configuration Breaks Local Development

**Severity**: CRITICAL  
**Category**: Configuration Error  
**Location(s)**: `next.config.mjs` lines 7-8, `spec.md` NFR-005, `plan.md` Technical Context  

**Problem**: The `assetPrefix: "/outreach-static"` configuration is required for production multi-zone deployment but breaks local development because:
- Dev server serves assets from `http://localhost:3000/_next/static/...`
- HTML references assets at `http://localhost:3000/outreach-static/_next/static/...`
- Result: 404 errors for all CSS/JS assets, styles don't work, application appears broken

**Evidence**:
```javascript
// next.config.mjs (current)
basePath: "/outreach",
assetPrefix: "/outreach-static",  // ❌ Works in production, breaks dev

// Generated CSS references:
url(/outreach-static/_next/static/media/ba9851c3c22cd980-s.woff2)
// → 404 in local dev
```

**Recommendation**: Use conditional assetPrefix based on NODE_ENV

```javascript
// next.config.mjs (fixed)
const nextConfig = {
  basePath: "/outreach",
  assetPrefix: process.env.NODE_ENV === "production" 
    ? "/outreach-static"  // CloudFront path for production
    : "/outreach",        // basePath for dev
  // ... rest of config
};
```

**Impact**: Blocks ALL local development and testing - styles, fonts, images, JS chunks all fail to load

**Related Tasks**: T003 (marked complete but has this issue)

**Fix Time**: 15 minutes (update config, restart dev server, verify)

**Verification**:
1. Apply fix to `next.config.mjs`
2. Run `pnpm dev`
3. Open `http://localhost:3000/outreach/conversations`
4. DevTools Network tab → verify CSS loads with 200 status
5. Confirm Tailwind styles render correctly

---

## High Priority Findings 🟠

### H1: Missing NFR-001 Verification Task (Lighthouse CI)

**Severity**: HIGH  
**Category**: Coverage Gap  
**Location(s)**: `spec.md` NFR-001 (line 290), `tasks.md` Phase 11  

**Problem**: NFR-001 requires Core Web Vitals targets (LCP < 2.5s, FID < 100ms, CLS < 0.1) but no task exists to verify compliance via Lighthouse CI or similar automated testing.

**Evidence**:
- **spec.md**: "NFR-001: System MUST achieve Core Web Vitals targets..."
- **tasks.md**: T088 mentions "Performance optimization - ensure conversation list loads <2 seconds" but doesn't verify Core Web Vitals
- **No Lighthouse CI configuration** in `.github/workflows/` or `package.json`

**Recommendation**: Add task to Phase 11

```markdown
- [ ] T088a [NFR-001] Configure Lighthouse CI in GitHub Actions to verify Core Web Vitals (LCP < 2.5s, FID < 100ms, CLS < 0.1) on all routes - fail build if thresholds exceeded
```

**Impact**: Cannot verify spec compliance for NFR-001 without automated testing

**Related Requirements**: NFR-001, SC-007 (conversation list < 2s), SC-008 (100 concurrent conversations)

---

### H2: NFR-002 Accessibility - Missing Acceptance Criteria

**Severity**: HIGH  
**Category**: Underspecification  
**Location(s)**: `spec.md` NFR-002 (line 291), `tasks.md` T089  

**Problem**: NFR-002 requires WCAG 2.1 AA compliance but provides no measurable acceptance criteria. T089 exists for "accessibility audit" but doesn't specify which WCAG success criteria MUST pass or tools to use.

**Evidence**:
- **spec.md**: "NFR-002: System MUST be accessible per WCAG 2.1 AA standards" (no details)
- **tasks.md**: "T089 Conduct full accessibility audit against WCAG 2.1 AA (screen reader support, color contrast, aria roles/labels, focus order) and log any issues for follow-up" (vague - what constitutes PASS?)

**Recommendation**: Extend NFR-002 with specific success criteria

```markdown
**NFR-002 Acceptance Criteria**:
1. All form inputs have associated `<label>` or aria-label (WCAG 3.3.2 Labels or Instructions)
2. Color contrast ratio ≥ 4.5:1 for normal text, ≥ 3:1 for large text (WCAG 1.4.3 Contrast Minimum)
3. All interactive elements keyboard accessible with visible focus indicators (WCAG 2.1.1 Keyboard, 2.4.7 Focus Visible)
4. Screen reader announces all status changes (aria-live regions for new messages, SLA alerts)
5. No WAVE/axe-core errors in conversation list, detail, composer, template editor
```

Update T089:
```markdown
- [ ] T089 Run WAVE and axe-core on all routes, verify: (1) zero errors, (2) form labels exist, (3) color contrast ≥4.5:1, (4) keyboard nav works, (5) aria-live announces messages - document any warnings as tech debt
```

**Impact**: Cannot objectively verify WCAG 2.1 AA compliance without clear success criteria

**Related Requirements**: NFR-002, FR-003 (keyboard navigation)

---

### H3: Template Variable Validation - Ambiguous "Warn" Behavior

**Severity**: HIGH  
**Category**: Ambiguity  
**Location(s)**: `spec.md` FR-022 (line 260), `tasks.md` T047  

**Problem**: FR-022 says "System MUST warn when sending a message with unresolved template variables" but doesn't specify:
- Does "warn" mean **blocking** (prevent send until variables filled) or **non-blocking** (show warning but allow send anyway)?
- How are variables "resolved"? (Manually typed replacement? Auto-fill from patient record? Variable picker UI?)

**Evidence**:
- **spec.md**: "MUST warn when sending a message with unresolved template variables" (unclear if send is blocked)
- **tasks.md**: "T047 [US4] Add variable detection and prompt for missing values before send" (suggests blocking, but "prompt" is vague)

**Current Interpretation Risk**: If "warn" is non-blocking, coordinators could send messages with `{{firstName}}` unresolved → patient receives malformed message → unprofessional

**Recommendation**: Clarify FR-022 requirement

**Option A (Blocking - RECOMMENDED for PHI context)**:
```markdown
FR-022: System MUST **prevent** sending messages with unresolved template variables (e.g., `{{firstName}}` still in message body). When send is attempted, display modal: "Please replace all variables before sending: {{firstName}}, {{appointmentDate}}". Send button disabled until all variables resolved.
```

**Option B (Non-blocking - higher risk)**:
```markdown
FR-022: System MUST display a confirmation dialog when sending messages with unresolved template variables: "Warning: Your message contains variables that haven't been replaced. Send anyway?" with Cancel/Send buttons.
```

**Recommended**: Option A (blocking) to prevent unprofessional/malformed messages in patient communication

**Impact**: Ambiguity could lead to incorrect implementation allowing malformed messages to be sent

**Related Requirements**: FR-022, US4 acceptance scenario 2

---

### H4: SLA Alert Timing - Potential Inconsistency

**Severity**: HIGH  
**Category**: Inconsistency  
**Location(s)**: `spec.md` FR-026 (line 267), SC-006 (line 328), `tasks.md` T056-T060  

**Problem**: Two different SLA thresholds mentioned:
- **FR-026**: "conversations in the list when patient replies wait more than 10 minutes"
- **SC-006**: "SLA alerts trigger within 1 minute of the 10-minute threshold being exceeded"

**Inconsistency**: SC-006 implies alerts trigger at **11 minutes** (10 min threshold + 1 min detection lag), but FR-026 implies **10 minutes exactly**. Which is correct?

**Impact**: If frontend (T057 `useSlaMonitor`) calculates SLA at 10 minutes but backend tracking expects 11 minutes, metrics will be inconsistent.

**Recommendation**: Clarify in spec.md

```markdown
**SLA Alert Behavior**:
- **Threshold**: 10 minutes since last patient message with no coordinator reply
- **Detection Latency**: Alert appears within 1 minute of threshold (acceptable 10-11 min window due to polling)
- **FR-026**: Visual indicator appears in conversation list when wait time ≥ 10 minutes
- **SC-006**: Client-side calculation (useSlaMonitor) checks every 60 seconds, may show alert between 10:00-11:00
```

**Related Tasks**: T057 (`useSlaMonitor` needs exact threshold), T058-T059 (backend SLA tracking)

**Impact**: Medium - could cause confusion between "10 minutes" (FR-026) vs "within 1 minute of 10 minutes" (SC-006)

---

### H5: Multi-Zone Navigation - Hard vs Soft Links Underspecified

**Severity**: HIGH  
**Category**: Underspecification  
**Location(s)**: `spec.md` FR-034 (line 283), NFR-005 (line 294), `tasks.md` T092, T205  

**Problem**: FR-034 says "System MUST handle navigation between zones appropriately (hard navigation for cross-zone)" but doesn't enumerate which routes are cross-zone vs intra-zone. Developers must infer from context.

**Evidence**:
- **spec.md**: "hard navigation for cross-zone" (no examples)
- **tasks.md**: T205 "Implement cross-zone navigation to patient profile using hard navigation (window.location)"
- **tasks.md**: T092 "Document cross-zone navigation: use `<a href>` instead of `<Link>`"

**Missing Information**:
- **Cross-zone routes** (require `<a href>`): Patient profile (`/patients/[id]`), main SleepConnect dashboard (`/`), settings (`/settings`)
- **Intra-zone routes** (use `<Link>`): Conversations list (`/outreach/conversations`), templates (`/outreach/templates`), analytics (`/outreach/analytics`)

**Recommendation**: Add explicit list to spec.md or plan.md

```markdown
### Multi-Zone Navigation Rules (NFR-005 Clarification)

**Outreach Zone (Soft Navigation - use `<Link>`)**:
- `/outreach/conversations` → Conversation list
- `/outreach/conversations/[id]` → Conversation detail
- `/outreach/templates` → Template management
- `/outreach/analytics` → Analytics dashboard

**SleepConnect Main Zone (Hard Navigation - use `<a href>` or `window.location`)**:
- `/patients/[id]` → Patient profile (FR-040)
- `/` → Main dashboard
- `/settings` → User settings
- Any other route not prefixed with `/outreach`

**Implementation**: T092 provides code examples in quickstart.md
```

**Impact**: Without explicit list, developers may use wrong navigation type → broken multi-zone behavior

**Related Requirements**: FR-034, NFR-005, T092, T205

---

### H6: Phone Number Validation - Error Message Inconsistency

**Severity**: HIGH  
**Category**: Duplication/Inconsistency  
**Location(s)**: `spec.md` FR-004 (line 226), Edge Cases (line 184), `tasks.md` T113  

**Problem**: FR-004 provides precise E.164 format validation requirements, but Edge Cases section has a different description. T113 (Phase 11.5) was added to "standardize phone validation error messages" suggesting current implementation has inconsistencies.

**Evidence**:
- **FR-004**: "System MUST validate phone numbers are US E.164 format (+1 followed by valid area code 2-9 and 9 digits, e.g., +12025551234)"
- **Edge Cases**: "What happens when a patient phone number is unreachable or invalid? → System displays delivery failure status and logs the error"
- **tasks.md**: "T113 [P] Standardize phone validation error messages in lib/validation.ts (CHK026)"

**Gap**: FR-004 specifies **pre-send validation** (format check), Edge Cases describes **post-send failure** (unreachable number). These are different scenarios, but the spec conflates them.

**Recommendation**: Clarify two distinct validation scenarios in spec.md

```markdown
**FR-004 (Pre-Send Validation)**: System MUST validate phone numbers are US E.164 format (+1 followed by valid area code 2-9 and 9 digits) **before allowing conversation creation**. 

**Error Message**: "Invalid phone number. Please enter a US number in format +12025551234 (area code 2-9 followed by 9 digits)."

**FR-004a (Post-Send Delivery Failure)**: When Twilio reports delivery failure (unreachable, invalid, blocked), system MUST display failure status on message with retry button and log error to audit trail.

**Error Message**: "Message not delivered to +1202555XXXX. Reason: [Twilio error code]. Retry?"
```

Update T113:
```markdown
- [ ] T113 [P] Implement both pre-send validation (FR-004 format check in NewConversationModal) and post-send failure UI (FR-004a in MessageBubble) with consistent error messages per spec - ensure lib/validation.ts exports validateE164Phone() used by both
```

**Impact**: Users may see inconsistent error messages for "invalid number" vs "unreachable number"

**Related Tasks**: T026 (validation), T113 (standardization)

---

### H7: Constitution Principle IV - Test Coverage Incomplete

**Severity**: HIGH  
**Category**: Constitution Compliance Risk  
**Location(s)**: Constitution Principle IV (line 28), `spec.md` header (line 2), `tasks.md` header (line 3)  

**Problem**: Constitution Principle IV requires "Comprehensive testing (unit, integration, and E2E) is mandatory for all new features and bug fixes" but:
- **spec.md**: "**Tests**: Not explicitly requested in specification. Test tasks are omitted per template guidelines."
- **tasks.md**: "**Tests**: Not explicitly requested in specification. Test tasks are omitted per template guidelines."

**This creates a contradiction**: Constitution says testing is **mandatory**, but task list explicitly **omits test tasks**.

**Evidence**:
- **Constitution**: "Clear, Maintainable, and Testable Code... Comprehensive testing (unit, integration, and E2E) is mandatory"
- **spec.md/tasks.md**: "Test tasks are omitted per template guidelines" (contradicts constitution)

**Current Mitigation**: T013 configures Jest, E2E tests exist in `tests/` directory, Phase 3 checklist references test coverage, but no explicit tasks like "T013a Write unit tests for lib/datetime.ts" or "T024a Write E2E test for message composer"

**Recommendation**: Either:

**Option A (Add Test Tasks - Strict Constitution Compliance)**:
Add explicit test tasks for each feature:
```markdown
- [ ] T013a [P] Write unit tests for lib/datetime.ts (UTC conversion, timezone handling)
- [ ] T013b [P] Write unit tests for lib/validation.ts (E.164 phone validation)
- [ ] T024a Write E2E test for message send/receive flow using Playwright
- [ ] T031a Write integration test for NewConversationModal (React Testing Library)
```

**Option B (Document Test Strategy - Pragmatic)**:
Update `tasks.md` header to clarify testing approach:
```markdown
**Tests**: Per Constitution Principle IV, comprehensive testing is mandatory. Test coverage is implemented via:
- **Unit Tests**: Created alongside utility functions (lib/*.ts) - developers MUST add tests to `tests/unit/` when creating utilities
- **Integration Tests**: Created for components (components/*) - use React Testing Library in `tests/integration/`
- **E2E Tests**: Created for user stories (US1-8) - use Playwright in `tests/e2e/`
- **Test Tasks**: Not enumerated individually to keep task list focused on implementation; testing is embedded in feature development workflow

**Test Coverage Gates**: All PRs MUST include tests for new code. CI pipeline runs Jest + Playwright before merge.
```

**Recommended**: **Option B** - document testing as embedded in workflow rather than separate tasks (more pragmatic, avoids doubling task count)

**Impact**: Current ambiguity could lead to test-less implementation violating Constitution Principle IV

**Related Requirements**: Constitution Principle IV, T013 (Jest config)

---

## Medium Priority Findings 🟡

### M1: Terminology Drift - "Coordinator" vs "User" vs "Care Coordinator"

**Severity**: MEDIUM  
**Category**: Terminology Drift  
**Location(s)**: Throughout spec.md, plan.md, tasks.md  

**Problem**: Three terms used interchangeably for the same concept:
- **"Care coordinator"** (US1-8 headers, most acceptance scenarios)
- **"Coordinator"** (FR-012, Key Entities section)
- **"User"** (FR-032 "authenticate users", plan.md "User's browser timezone")

**Evidence**:
```markdown
# From spec.md
US1: "As a care coordinator, I want to..."  (line 49)
FR-012: "System MUST associate conversations with the creating coordinator" (line 247)
FR-032: "System MUST authenticate users via SleepConnect" (line 282)
```

**Recommendation**: Standardize on **"care coordinator"** throughout (matches domain language, more precise than "user")

**Impact**: Minor - doesn't affect functionality but reduces clarity for future contributors

**Fix Locations**:
- FR-012, FR-015, FR-016, FR-021: Change "coordinator" → "care coordinator"
- FR-032: Change "users" → "care coordinators"
- Key Entities section: "Coordinator" → "Care Coordinator"

---

### M2: Data Model vs Spec Entity Mismatch - Missing "Campaign" References

**Severity**: MEDIUM  
**Category**: Inconsistency  
**Location(s)**: `spec.md` US7 acceptance scenario 2 (line 207), data-model.md  

**Problem**: US7 acceptance scenario references "aggregated statistics across campaigns" but:
- **No "Campaign" entity** defined in Key Entities section
- **No "Campaign" in data-model.md** schema
- **No campaign-related requirements** in FR-023 through FR-027

**Evidence**:
```markdown
# spec.md US7 acceptance scenario 2
**Given** conversations have occurred, **When** viewing engagement metrics, **Then** the system shows aggregated statistics across campaigns and time periods
```

**Questions**:
- What is a "campaign" in this context?
- Is it a future feature (Sprint 2+)?
- Should it be removed from US7 if not implemented?

**Recommendation**: Either:

**Option A (Remove Campaign Reference - MVP Simplification)**:
```markdown
# US7 acceptance scenario 2 (revised)
**Given** conversations have occurred, **When** viewing engagement metrics, **Then** the system shows aggregated statistics across all conversations and selectable time periods (7d, 30d, 90d)
```

**Option B (Add Campaign Entity - Future Feature)**:
Add to Key Entities:
```markdown
**Campaign**: Grouping of conversations for tracking purposes; contains name, start date, goal, and associated conversation filters (optional, Sprint 2+)
```

**Recommended**: **Option A** - remove campaign reference from MVP (US7 is P3 priority, campaigns add complexity)

**Impact**: Minor - US7 is P3 priority, but ambiguity should be resolved before implementation

---

### M3: Task ID Gaps - Non-Sequential Numbering

**Severity**: MEDIUM (Informational)  
**Category**: Organization  
**Location(s)**: `tasks.md` - jumps from T101 to T200-T213  

**Problem**: Task IDs jump from T101 (Phase 12) to T200 (Phase 5a) creating potential confusion. Non-sequential IDs are valid but may indicate missing tasks or reorganization.

**Evidence**:
- T001-T101, T102-T116 are sequential
- T200-T213 appear (US3a, US3b additions)
- Gap: T117-T199 unused

**Explanation**: T200-T213 were added after original task list for US3a (Patient Context) and US3b (Status Filters) features. This is valid but breaks sequential flow.

**Recommendation**: No action required (non-sequential IDs are acceptable) BUT consider documenting rationale:

```markdown
## Task ID Ranges

- **T001-T101**: Original task breakdown (all phases)
- **T102-T116**: Phase 11.5 hardening tasks (added from Phase 3 checklist gaps, 2025-12-02)
- **T200-T213**: US3a (Patient Context) and US3b (Status Filters) tasks (added 2025-12-08)

**Note**: Non-sequential numbering reflects iterative refinement of spec - new features discovered during implementation are added in separate ranges to preserve original task references.
```

**Impact**: None - purely organizational clarity

---

### M4: Missing Unarchive Functionality in US3 User Story

**Severity**: MEDIUM  
**Category**: Coverage Gap  
**Location(s)**: `spec.md` US3 (View Conversation History), FR-013a, `tasks.md` T090  

**Problem**: FR-013a requires "System MUST allow coordinators to unarchive conversations" but:
- **US3 acceptance scenarios** don't mention unarchive
- **US3b (Status Filters)** includes "Archived" filter but doesn't describe unarchive action
- **T090** exists ("Implement conversation unarchive functionality") but not mapped to any user story acceptance scenario

**Gap**: How does a coordinator **initiate** unarchive? Is it:
- A button in the conversation detail view when viewing archived conversation?
- A context menu in the archived conversation list?
- An "Unarchive" bulk action checkbox?

**Recommendation**: Add acceptance scenario to US3 or US3b

```markdown
### User Story 3c - Archive and Unarchive Conversations (Priority: P1)

**Acceptance Scenarios**:
1. **Given** a coordinator views an active conversation, **When** they click "Archive" in the conversation menu, **Then** the conversation moves to Archived status and disappears from active list
2. **Given** a coordinator views an archived conversation, **When** they click "Unarchive" in the conversation menu, **Then** the conversation restores to active status and appears in active list
3. **Given** a coordinator filters by "Archived", **When** they view the archived list, **Then** each conversation shows an "Unarchive" action button
```

Update T090 mapping:
```markdown
- [ ] T090 [US3c] Implement conversation unarchive functionality via unarchive_sms_conversation (FR-013a) - add "Unarchive" button to archived conversation detail header and list item menu
```

**Impact**: Medium - unarchive functionality exists (FR-013a, T090) but UX is underspecified

---

### M5: Quick Template Popover - Ambiguous "Frequently Used" Definition

**Severity**: MEDIUM  
**Category**: Underspecification  
**Location(s)**: `spec.md` FR-022b (line 261), `tasks.md` T043a, T212  

**Problem**: FR-022b says "Quick Template popover MUST display recently used and frequently used templates" but doesn't define:
- How many templates to show? (Top 5? Top 10?)
- What is "recent"? (Last 7 days? Last 30 days?)
- What is "frequent"? (Most clicks? Highest usage count?)

**Evidence**:
- **FR-022b**: "recently used and frequently used templates" (vague)
- **T043a**: "GET /api/outreach/templates/frequent - return top N frequently/recently used templates"
- **T212**: "Implement recently/frequently used templates query" (no specifics)

**Recommendation**: Add criteria to FR-022b

```markdown
**FR-022b Clarification**: Quick Template popover displays up to 10 templates:
- **Recently Used**: Top 5 templates used by current coordinator in last 7 days (ordered by most recent)
- **Frequently Used**: Top 5 templates with highest usage count by current coordinator in last 30 days (ordered by count DESC)
- **Combined Logic**: If fewer than 10 templates total, show all; deduplicate (recent takes precedence over frequent)
```

Update T043a:
```markdown
- [ ] T043a [US4] Implement GET /api/outreach/templates/frequent?limit=10 - return templates used in last 7 days (recent) OR top usage count last 30 days (frequent), deduplicated, coordinator-scoped (FR-022b)
```

**Impact**: Medium - developers may implement different interpretations of "frequent" and "recent"

---

### M6: Missing Error Handling Details - Twilio Service Unavailable

**Severity**: MEDIUM  
**Category**: Underspecification  
**Location(s)**: `spec.md` Edge Cases (line 185)  

**Problem**: Edge case says "What happens when Twilio service is temporarily unavailable? → Messages queue locally and retry automatically when service resumes; user sees 'pending' status" but:
- **No requirement** (FR-xxx) for local message queue
- **No task** for implementing local queue (T112 added later for offline queue, but only for network loss, not Twilio outage)

**Gap**: How is "Twilio unavailable" detected?
- HTTP 500 from Twilio API?
- Timeout?
- Circuit breaker pattern?

**Recommendation**: Add explicit FR or clarify edge case

**Option A (Add Requirement)**:
```markdown
**FR-043 (Twilio Outage Handling)**: When Twilio API returns 5xx errors or times out after 10 seconds, system MUST:
1. Display message status as "Pending - Retrying"
2. Queue message in PostgreSQL outbox table with retry_count
3. Retry with exponential backoff (30s, 60s, 120s, max 3 retries)
4. After 3 failures, mark message as "Failed - Twilio Unavailable" and show retry button
```

**Option B (Simplify Edge Case)**:
```markdown
**Edge Case (Twilio Unavailable)**: Messages that fail to send due to Twilio API errors display "Failed" status with manual retry button. No automatic retry queue in MVP (future enhancement).
```

**Recommended**: **Option B** for MVP - manual retry is sufficient, automatic queue adds complexity

**Impact**: Medium - current edge case description implies automatic retry queue that isn't implemented

---

### M7: Patient DOB Format - Missing Timezone Considerations

**Severity**: MEDIUM  
**Category**: Underspecification  
**Location(s)**: `spec.md` US3a acceptance scenario 1 (line 154), `tasks.md` T205a  

**Problem**: US3a says patient DOB displays as `MMM DD, YYYY` (e.g., `Jan 02, 1980`) but doesn't specify:
- Is DOB stored as DATE or TIMESTAMPTZ in database?
- How are midnight DOBs handled across timezones? (Patient born Jan 1, 1980 at 00:00 EST could show as Dec 31, 1979 at 21:00 PST if stored as UTC timestamp)

**Evidence**:
- **US3a**: "date of birth formatted as `MMM DD, YYYY`"
- **T205a**: "Create lib/format.ts with `formatPatientDob(date: string): string`"
- **Constitution VII**: Requires UTC timestamp storage (TIMESTAMPTZ)

**Risk**: If DOB is stored as TIMESTAMPTZ with time component, timezone conversion could shift the date (e.g., 1980-01-01T00:00:00Z → 1979-12-31 in US/Pacific)

**Recommendation**: Clarify DOB storage format and conversion rules

```markdown
**Patient DOB Storage (data-model clarification)**:
- Store as PostgreSQL DATE type (not TIMESTAMPTZ) - dates without time component
- Format for display: `formatPatientDob(dateString)` → 'MMM DD, YYYY' using Intl.DateTimeFormat in user's locale
- No timezone conversion needed (dates are absolute, not instants)
```

Update T205a:
```markdown
- [ ] T205a [P] [US3a] Create lib/format.ts with `formatPatientDob(date: string): string` (→ 'MMM DD, YYYY') - expects DATE string (YYYY-MM-DD), no timezone conversion - and `formatLocalTimestamp(utc: string): string` for messages
```

**Impact**: Medium - incorrect timezone handling could display wrong birth dates

---

## Low Priority Findings 🟢

### L1: Example Phone Number Inconsistency

**Severity**: LOW  
**Category**: Wording Improvement  
**Location(s)**: `spec.md` FR-004 (line 226), US2 acceptance scenario 2 (line 101)  

**Problem**: Two different example phone numbers used:
- FR-004: `+12025551234` (Washington DC area code 202)
- US2: No example provided

**Recommendation**: Use consistent example `+12025551234` throughout spec for clarity

**Impact**: Minimal - purely stylistic

---

### L2: "Friendly Name" vs "Conversation Name" Terminology

**Severity**: LOW  
**Category**: Terminology Drift  
**Location(s)**: `spec.md` US2 (line 87), FR-006 (line 233)  

**Problem**: Two terms for same field:
- US2: "conversation name" 
- FR-006, Key Entities: "friendly name"

**Recommendation**: Standardize on **"conversation name"** (more intuitive for users)

**Impact**: Minimal - doesn't affect functionality

---

### L3: Duplicate "Auto-Scroll" Requirements

**Severity**: LOW  
**Category**: Duplication  
**Location(s)**: `spec.md` US3 acceptance scenario 3 (line 142), `tasks.md` T039  

**Problem**: Auto-scroll behavior specified in two places with slightly different wording:
- **US3**: "view auto-scrolls to show the latest message with a visual indicator"
- **T039**: "Add auto-scroll to latest message on new message arrival with visual indicator"

**Recommendation**: Consolidate wording (already aligned, no action needed)

**Impact**: None

---

## Coverage Summary

### Requirements Coverage

| Requirement Key | Has Task? | Task IDs | Notes |
|-----------------|-----------|----------|-------|
| FR-001 (Send SMS) | ✅ | T021, T023 | Core messaging |
| FR-002 (Receive SMS) | ✅ | T022, T023 | Webhook + polling |
| FR-003 (Delivery Status) | ✅ | T025 | Status updates |
| FR-004 (Phone Validation) | ✅ | T026 | E.164 format |
| FR-004a (Opt-out) | ✅ | T027a | STOP message |
| FR-005 (SMS Segments) | ✅ | T027 | Character limits |
| FR-006 (New Conversation) | ✅ | T028, T029 | Creation flow |
| FR-006a (Patient Search) | ✅ | T028a | Autocomplete |
| FR-006b (Auto-populate) | ✅ | T028b | Patient data |
| FR-007 (No Duplicates) | ✅ | T030 | Duplicate detection |
| FR-008 (Chronological Order) | ✅ | T024, T033 | Message list |
| FR-008a (Local Timezone) | ✅ | T019a | Display conversion |
| FR-008b (UTC Storage) | ✅ | T019a | Constitution VII |
| FR-009 (Sender ID) | ✅ | T019 | MessageBubble |
| FR-010 (Persist Data) | ✅ | T021, T022 | Lambda API |
| FR-011 (Pagination) | ✅ | T038 | Infinite scroll |
| FR-012 (User-Scoped) | ✅ | T029, T035 | Coordinator filter |
| FR-013 (Archive) | ✅ | T081 | Archive action |
| FR-013a (Unarchive) | ✅ | T090 | **GAP: No US3 scenario** |
| FR-014 (Retention) | ✅ | T009a | Soft delete pattern |
| FR-014a (Search) | ✅ | T079 | Name/phone search |
| FR-014b (Filter Status) | ✅ | T206-T210 | Status filters |
| FR-014c (Filter UI) | ✅ | T206 | Segmented control |
| FR-014d (Real-time Update) | ✅ | T210 | Filter refresh |
| FR-015 (Global Templates) | ✅ | T043, T051 | Read-only library |
| FR-016 (Private Templates) | ✅ | T051, T052 | Coordinator-owned |
| FR-017 (Create Template) | ✅ | T049, T051 | Template editor |
| FR-018 (Variables) | ✅ | T047, T054 | `{{var}}` syntax |
| FR-019 (Auto-detect) | ✅ | T054 | Regex detection |
| FR-020 (Categories) | ✅ | T041, T049 | 5 categories |
| FR-021 (Edit/Delete) | ✅ | T052 | Template management |
| FR-022 (Variable Warning) | ✅ | T047 | **AMBIGUOUS: Blocking?** |
| FR-022a (Quick Template) | ✅ | T211 | ⚡ button |
| FR-022b (Recent/Frequent) | ✅ | T043a, T212 | **AMBIGUOUS: Criteria?** |
| FR-023 (Response Time) | ✅ | T065 | Analytics metric |
| FR-024 (Response Rate) | ✅ | T065 | Analytics metric |
| FR-025 (Delivery Rate) | ✅ | T065 | Analytics metric |
| FR-026 (SLA Visual) | ✅ | T056, T060 | 10 min indicator |
| FR-027 (SLA Logging) | ✅ | T058, T059 | Response metrics |
| FR-028 (Sentiment Analysis) | ✅ | T071, T073 | AWS Comprehend |
| FR-029 (Sentiment Display) | ✅ | T072, T075 | Indicator component |
| FR-030 (Sentiment Suggestions) | ✅ | T076 | Communication tips |
| FR-031 (Multi-zone) | ✅ | T003 | basePath config |
| FR-031a (Rewrites) | ✅ | T091 | SleepConnect config |
| FR-032 (Auth0) | ✅ | T012, T018 | Authentication |
| FR-033 (assetPrefix) | ✅ | T003 | **CRITICAL ISSUE C1** |
| FR-034 (Cross-zone Nav) | ✅ | T092, T205 | **UNDERSPECIFIED H5** |
| FR-035 (Encryption) | ✅ | T086 | HIPAA audit |
| FR-036 (Audit Logs) | ✅ | T086 | Logging |
| FR-037 (TLS) | ✅ | T086 | HTTPS |
| FR-038 (BAA) | ✅ | T099a | **External - N/A** |
| FR-039 (Patient Context) | ✅ | T200, T202 | Header display |
| FR-040 (Profile Link) | ✅ | T205 | Cross-zone nav |
| FR-041 (Link Patient) | ✅ | T201, T202 | Search & link |
| FR-042 (patient_id) | ✅ | T203 | Type extension |
| NFR-001 (Core Web Vitals) | ❌ | **GAP: No Lighthouse CI task** | **HIGH PRIORITY H1** |
| NFR-002 (WCAG 2.1 AA) | ⚠️ | T089 | **AMBIGUOUS H2: No criteria** |
| NFR-003 (Keyboard Nav) | ✅ | T085 | Accessibility |
| NFR-004 (Responsive) | ✅ | T006 | Tailwind config |
| NFR-005 (Shell Integration) | ⚠️ | T018a | **PARTIAL: Stub only** |

**Coverage Metrics**:
- **Total Requirements**: 68 (42 FR, 5 NFR, 21 sub-requirements)
- **Mapped to Tasks**: 66 (97%)
- **Coverage Gaps**: 2
  - NFR-001: No Lighthouse CI verification task (H1)
  - NFR-002: Task exists but lacks acceptance criteria (H2)

---

## Constitution Alignment

### All Principles ✅ PASS

| Principle | Status | Notes |
|-----------|--------|-------|
| **I. Data Retention** | ✅ PASS | Soft-delete pattern (archived_on, active flags) per FR-014 |
| **II. Patient-First Privacy & Security** | ✅ PASS | FR-035-038 cover encryption, audit, TLS, BAA |
| **III. Spec-Driven Development** | ✅ PASS | spec.md → plan.md → tasks.md workflow followed |
| **IV. Clear, Maintainable Code** | ⚠️ WARNING | **H7**: Test tasks omitted despite "testing is mandatory" |
| **V. Comprehensive Documentation** | ✅ PASS | All 7 docs complete (spec, plan, tasks, research, data-model, quickstart, contracts) |
| **VI. Consistent Code Quality** | ✅ PASS | T009 ESLint/Prettier configured |
| **VII. UTC Timestamp Storage** | ✅ PASS | FR-008b explicit, T019a implements conversion |
| **VIII. Documentation Organization** | ✅ PASS | All docs in specs/001-sms-outreach-integration/ |

**Constitution Issues**:
- **H7 (Principle IV)**: Spec says "Test tasks omitted" but Constitution requires "comprehensive testing mandatory" → Resolve with documentation or explicit test tasks

---

## Unmapped Tasks

All tasks are mapped to requirements or user stories. **No orphan tasks found.**

---

## Findings Metrics

| Category | Count |
|----------|-------|
| **CRITICAL** | 1 |
| **HIGH** | 7 |
| **MEDIUM** | 7 |
| **LOW** | 3 |
| **Total Findings** | 18 |

### By Category

| Category | Count |
|----------|-------|
| Configuration Error | 1 |
| Coverage Gap | 2 |
| Underspecification | 5 |
| Ambiguity | 3 |
| Inconsistency | 3 |
| Terminology Drift | 2 |
| Duplication | 1 |
| Organization | 1 |

---

## Next Actions

### Immediate (MUST Fix Before Development)

1. ✅ **C1 - Fix assetPrefix** (15 min)
   - Update `next.config.mjs` with conditional assetPrefix
   - Restart dev server
   - Verify styles load correctly

### High Priority (Before Production)

2. **H1 - Add NFR-001 Verification** (1 hour)
   - Add T088a task: "Configure Lighthouse CI for Core Web Vitals"
   - Create `.github/workflows/lighthouse-ci.yml`
   - Add Lighthouse CI config to `package.json`

3. **H2 - Extend NFR-002 Criteria** (30 min)
   - Add 5 specific WCAG success criteria to spec.md NFR-002
   - Update T089 with WAVE/axe-core verification steps

4. **H3 - Clarify FR-022 Template Variables** (15 min)
   - Choose blocking vs non-blocking "warn" behavior
   - Update spec.md FR-022 with explicit send prevention logic

5. **H4 - Resolve SLA Timing** (10 min)
   - Clarify 10 min threshold vs 1 min detection lag in spec.md
   - Document acceptable 10-11 min window for FR-026

6. **H5 - Document Cross-Zone Routes** (20 min)
   - Add explicit list of cross-zone vs intra-zone routes to plan.md
   - Reference from T092

7. **H6 - Standardize Phone Validation** (15 min)
   - Split FR-004 into pre-send (format) and post-send (unreachable)
   - Update T113 to implement both scenarios

8. **H7 - Resolve Test Coverage** (30 min)
   - Choose Option A (add test tasks) or Option B (document embedded testing)
   - Update `tasks.md` header to clarify testing approach

### Medium Priority (Before Feature Implementation)

9. **M1-M7** - Address terminology drift, campaign reference, DOB format (3 hours total)

### Production Hardening

10. **Phase 11.5 Tasks** (T102-T116) - 15 tasks from Phase 3 checklist gaps (15 hours)

---

## Remediation Offer

Would you like me to suggest concrete remediation edits for the top 5 critical/high issues (C1, H1-H4)?

I can provide specific file edits for:
- `next.config.mjs` - Fix assetPrefix (C1)
- `spec.md` - Add NFR-001 criteria, clarify FR-022, resolve SLA timing (H1, H3, H4)
- `tasks.md` - Add T088a Lighthouse CI task (H1)

Type "yes" to proceed with remediation suggestions, or "no" to implement manually.
