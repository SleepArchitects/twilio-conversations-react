# Phase 3 / User Story 1 - Requirements Quality Checklist

**Purpose**: Validate requirements quality for Phase 3 (T019-T027a) - Send and Receive SMS Messages  
**Created**: 2025-12-02  
**Depth**: Standard (PR-level review)  
**Focus Areas**: Real-time Twilio SDK events, Webhook security, HIPAA compliance, UX/UI, API contracts, Integration  
**Actor**: Reviewer (PR)

---

## Requirement Completeness

### Core Messaging (US1)

- [ ] CHK001 - Are message bubble visual specifications defined (sender colors, alignment, spacing)? [Completeness, Gap]
- [ ] CHK002 - Is the MessageBubble component required to display all status states (sending, sent, delivered, read, failed)? [Completeness, Spec §FR-003]
- [ ] CHK003 - Are delivery status indicator designs specified (icons, colors, tooltips)? [Completeness, Gap]
- [ ] CHK004 - Is the character counter behavior specified when approaching/exceeding 160 chars? [Completeness, Spec §FR-005]
- [ ] CHK005 - Are segment count display requirements defined for multi-segment messages? [Completeness, Spec §US1.4]
- [ ] CHK006 - Is the send button disabled state specified (empty input, sending in progress)? [Completeness, Gap]
- [ ] CHK007 - Are keyboard shortcuts documented (Enter to send, Shift+Enter for newline)? [Completeness, Gap]

### Real-time Updates

- [ ] CHK008 - Is the 3-second latency requirement (FR-002) specified for all real-time event types? [Completeness, Spec §FR-002]
- [ ] CHK009 - Are Twilio SDK event handlers documented for messageAdded, messageUpdated, participantUpdated? [Completeness, Gap]
- [ ] CHK010 - Is connection state handling specified (connecting, connected, disconnected, error)? [Completeness, Gap]
- [ ] CHK011 - Are reconnection requirements defined (auto-retry, backoff strategy, max attempts)? [Completeness, Gap]
- [ ] CHK012 - Is the SDK initialization sequence documented (auth → token → client → subscribe)? [Completeness, Gap]

### Webhook Requirements

- [ ] CHK013 - Is Twilio signature validation explicitly required for webhook route? [Security, Gap]
- [ ] CHK014 - Are all webhook event types documented (onMessageAdded, onMessageUpdated, statusCallback)? [Completeness, contracts/sms-api.yaml]
- [ ] CHK015 - Is the webhook response format specified (200 for success, specific error codes)? [Completeness, contracts/]
- [ ] CHK016 - Are webhook retry/idempotency requirements documented? [Completeness, Gap]
- [ ] CHK017 - Is the race condition between SDK events and webhook handled? [Completeness, Gap]

---

## Requirement Clarity

### Message Status Lifecycle

- [ ] CHK018 - Is the status progression (sending → sent → delivered → read → failed) unambiguous? [Clarity, Spec §FR-003]
- [ ] CHK019 - Are the conditions for each status transition explicitly defined? [Clarity, Gap]
- [ ] CHK020 - Is "failed" status handling clear (when to show, retry behavior)? [Clarity, Gap]
- [ ] CHK021 - Is the difference between Twilio status callbacks and SDK events clarified? [Clarity, Gap]

### Component Boundaries

- [ ] CHK022 - Is the responsibility split between MessageBubble, MessageComposer, and ConversationDetail clear? [Clarity, tasks.md T019-T024]
- [ ] CHK023 - Is the hooks/useMessages.ts scope defined (state shape, actions, selectors)? [Clarity, Gap]
- [ ] CHK024 - Is the data flow from webhook → Lambda → SDK → UI documented? [Clarity, Gap]

### Phone Number Validation

- [ ] CHK025 - Is the +1 US format regex explicitly specified in requirements? [Clarity, Spec §FR-004, Clarifications]
- [ ] CHK026 - Are validation error messages defined for invalid phone formats? [Clarity, Gap]

---

## Requirement Consistency

### Types Alignment

- [ ] CHK027 - Does Message interface in types/sms.ts match sms-api.yaml Message schema? [Consistency, contracts/]
- [ ] CHK028 - Does MessageStatus enum align with Twilio's possible status values? [Consistency]
- [ ] CHK029 - Do webhook payload types match Twilio's actual event structure? [Consistency]

### API Contract Alignment

- [ ] CHK030 - Does POST /conversations/{id}/messages match sms-api.yaml sendMessage operation? [Consistency, contracts/]
- [ ] CHK031 - Does POST /webhook match sms-api.yaml twilioWebhook operation? [Consistency, contracts/]
- [ ] CHK032 - Are error response formats consistent between routes? [Consistency]

### Cross-Phase Consistency

- [ ] CHK033 - Does useMessages.ts use the same auth context as lib/auth.ts from Phase 2? [Consistency]
- [ ] CHK034 - Does ConversationDetail use the same Twilio client from useTwilioClient.ts? [Consistency]

---

## Security & HIPAA Compliance

### PHI Handling

- [ ] CHK035 - Are message bodies (PHI) handled according to HIPAA requirements? [Security, Spec §FR-035-038]
- [ ] CHK036 - Is message content excluded from all client-side logging? [Security, HIPAA]
- [ ] CHK037 - Are error messages sanitized to prevent PHI leakage? [Security, Gap]
- [ ] CHK038 - Is message preview truncation documented to prevent PHI exposure in notifications? [Security, Gap]

### Webhook Security

- [ ] CHK039 - Is X-Twilio-Signature validation required before processing any webhook? [Security, contracts/sms-api.yaml]
- [ ] CHK040 - Is the webhook URL validation (comparing to expected host) documented? [Security, Gap]
- [ ] CHK041 - Are webhook rate limiting requirements specified? [Security, Gap]
- [ ] CHK042 - Is webhook replay attack prevention addressed? [Security, Gap]

### Auth Requirements

- [ ] CHK043 - Is Auth0 token validation required for all message operations? [Security, Spec §FR-032]
- [ ] CHK044 - Is tenant_id/practice_id authorization checked before message access? [Security, data-model.md]
- [ ] CHK045 - Is coordinator_sax_id ownership validation specified for conversation access? [Security, Spec §FR-012]

### Audit Logging

- [ ] CHK046 - Are audit log requirements defined for message send/receive events? [Security, Spec §FR-036]
- [ ] CHK047 - Is the audit log format specified (who, what, when, from where)? [Completeness, Gap]

---

## Edge Case Coverage

### Message Delivery Failures

- [ ] CHK048 - Is unreachable phone number handling documented? [Edge Case, Spec §Edge Cases]
- [ ] CHK049 - Are Twilio error codes and their UI representations specified? [Edge Case, Gap]
- [ ] CHK050 - Is retry behavior for transient failures defined? [Edge Case, Gap]
- [ ] CHK051 - Is the failed message retry UI specified (retry button, auto-retry)? [Edge Case, Gap]

### Patient Opt-Out (STOP)

- [ ] CHK052 - Is opt-out detection (STOP message) handling specified? [Edge Case, Spec §FR-004a, T027a]
- [ ] CHK053 - Is the opted-out conversation visual state defined? [Edge Case, Gap]
- [ ] CHK054 - Is the opt-out error message displayed when trying to send to opted-out number defined? [Edge Case, Gap]
- [ ] CHK055 - Is opt-in (START message) handling addressed? [Edge Case, Gap]

### Twilio Service Issues

- [ ] CHK056 - Is Twilio service unavailability handling specified? [Edge Case, Spec §Edge Cases]
- [ ] CHK057 - Is local message queue behavior for offline sending defined? [Edge Case, Spec §Edge Cases]
- [ ] CHK058 - Is SDK disconnect/reconnect behavior during active conversation defined? [Edge Case, Gap]

### Concurrent Access

- [ ] CHK059 - Is concurrent coordinators messaging same patient addressed? [Edge Case, Spec §Edge Cases]
- [ ] CHK060 - Is conversation lock or typing indicator for concurrent access defined? [Edge Case, Gap]

### Character Limits

- [ ] CHK061 - Is behavior at exactly 160 characters defined? [Edge Case, Spec §US1.4]
- [ ] CHK062 - Are multi-segment cost implications surfaced to user? [Edge Case, Gap]
- [ ] CHK063 - Is maximum message length (total chars) defined? [Edge Case, Gap]

---

## UX/UI Requirements

### Visual Design

- [ ] CHK064 - Are message bubble colors specified for inbound vs outbound? [UX, Gap]
- [ ] CHK065 - Is timestamp display format defined (relative vs absolute, threshold)? [UX, Spec §FR-008a]
- [ ] CHK066 - Is auto-scroll behavior specified (scroll to bottom on new message)? [UX, Spec §US3.3]
- [ ] CHK067 - Is the new message visual indicator defined? [UX, Spec §US3.3]

### Accessibility

- [ ] CHK068 - Are keyboard navigation requirements defined for message composer? [A11y, Gap]
- [ ] CHK069 - Are screen reader labels specified for status indicators? [A11y, Gap]
- [ ] CHK070 - Is focus management defined for new message arrival? [A11y, Gap]
- [ ] CHK071 - Are ARIA roles specified for message list and bubbles? [A11y, Gap]

### Loading States

- [ ] CHK072 - Is the initial message list loading state defined? [UX, Gap]
- [ ] CHK073 - Is the message sending in-progress state defined? [UX, Gap]
- [ ] CHK074 - Is the "sending" optimistic UI behavior specified? [UX, Gap]

### Responsive Design

- [ ] CHK075 - Are mobile layout requirements for conversation detail defined? [UX, Gap]
- [ ] CHK076 - Is the mobile composer behavior specified (keyboard handling)? [UX, Gap]

---

## Non-Functional Requirements

### Performance

- [ ] CHK077 - Is the 3-second latency for inbound messages measurable/testable? [NFR, Spec §FR-002, SC-002]
- [ ] CHK078 - Is the 5-second delivery confirmation target defined? [NFR, Spec §SC-001]
- [ ] CHK079 - Is pagination size for message list defined? [NFR, contracts/sms-api.yaml - default 50]

### Observability

- [ ] CHK080 - Are error logging requirements for webhook failures defined? [Observability, Gap]
- [ ] CHK081 - Are metrics requirements for message latency tracking defined? [Observability, Gap]
- [ ] CHK082 - Is correlation ID propagation from webhook to SDK events specified? [Observability, Gap]

---

## API Contract Coverage

### Request/Response Schemas

- [ ] CHK083 - Is SendMessageRequest schema complete in sms-api.yaml? [API, contracts/]
- [ ] CHK084 - Is Message response schema complete with all status fields? [API, contracts/]
- [ ] CHK085 - Are webhook event payload schemas documented? [API, contracts/sms-api.yaml]

### Error Responses

- [ ] CHK086 - Are all error codes for sendMessage documented (400, 401, 404, 500)? [API, contracts/]
- [ ] CHK087 - Are webhook error responses defined (401 for invalid signature)? [API, contracts/]
- [ ] CHK088 - Is error response body structure consistent with other endpoints? [API, Consistency]

---

## Integration Requirements

### Multi-Zone Coordination

- [ ] CHK089 - Is /outreach basePath applied to all API routes including webhook? [Integration, Spec §FR-031a]
- [ ] CHK090 - Are asset paths (/outreach-static/) correctly configured for message UI? [Integration, Spec §FR-033]
- [ ] CHK091 - Is webhook URL in Twilio console matching deployed basePath? [Integration, Gap]

### Twilio SDK Integration

- [ ] CHK092 - Is Twilio Conversations SDK version pinned in requirements? [Integration, Gap]
- [ ] CHK093 - Is SDK initialization sequence relative to Auth0 session documented? [Integration, Gap]
- [ ] CHK094 - Is SDK cleanup on component unmount specified? [Integration, Gap]

### Lambda Integration

- [ ] CHK095 - Are Lambda function signatures for message operations documented? [Integration, data-model.md]
- [ ] CHK096 - Is insert_sms_message Lambda function contract defined? [Integration, Gap]
- [ ] CHK097 - Is update_sms_message_status Lambda function contract defined? [Integration, Gap]

---

## Timezone Handling

- [ ] CHK098 - Is UTC storage for created_on, sent_at, delivered_at, read_at confirmed? [Timezone, Spec §FR-008b, Constitution VII]
- [ ] CHK099 - Is browser local timezone display for message timestamps specified? [Timezone, Spec §FR-008a]
- [ ] CHK100 - Is lib/datetime.ts utility contract defined (input: UTC, output: local string)? [Timezone, T019a]

---

## Traceability

### Task to Requirement Mapping

- [ ] CHK101 - Does T019 (MessageBubble) trace to FR-003 (delivery status display)? [Traceability]
- [ ] CHK102 - Does T020 (MessageComposer) trace to FR-005 (character limits)? [Traceability]
- [ ] CHK103 - Does T021 (messages route) trace to sms-api.yaml sendMessage/listMessages? [Traceability]
- [ ] CHK104 - Does T022 (webhook) trace to sms-api.yaml twilioWebhook? [Traceability]
- [ ] CHK105 - Does T027a (opt-out) trace to FR-004a? [Traceability]

---

## Summary

| Category | Items | Description |
|----------|-------|-------------|
| Completeness | CHK001-CHK017 | Are all necessary requirements documented? |
| Clarity | CHK018-CHK026 | Are requirements unambiguous and specific? |
| Consistency | CHK027-CHK034 | Do requirements align without conflicts? |
| Security/HIPAA | CHK035-CHK047 | Are security & compliance requirements specified? |
| Edge Cases | CHK048-CHK063 | Are boundary conditions and error scenarios defined? |
| UX/UI | CHK064-CHK076 | Are visual and interaction requirements specified? |
| NFR | CHK077-CHK082 | Are non-functional requirements measurable? |
| API Contracts | CHK083-CHK088 | Is OpenAPI spec complete? |
| Integration | CHK089-CHK097 | Are multi-zone and SDK requirements aligned? |
| Timezone | CHK098-CHK100 | Are UTC/local requirements clear? |
| Traceability | CHK101-CHK105 | Can requirements be traced to tasks? |
| **Total** | **105 items** | |

---

## Usage Notes

This checklist validates **requirements quality** for Phase 3 / US1, not implementation correctness:

- ✅ "Is the 3-second latency requirement measurable?" → Tests if spec defines testable criteria
- ❌ "Does the message appear in 3 seconds?" → Tests implementation behavior

Review each item against:
- `spec.md` §User Story 1, §Edge Cases, §FR-001–FR-014a
- `data-model.md` §Message entity
- `contracts/sms-api.yaml` /messages, /webhook endpoints
- `tasks.md` T019-T027a

Address gaps before implementation to prevent ambiguity during development.
