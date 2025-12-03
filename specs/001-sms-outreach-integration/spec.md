# Feature Specification: SMS Outreach Integration

**Feature Branch**: `001-sms-outreach-integration`  
**Created**: November 28, 2025  
**Status**: Draft  
**Input**: User description: "Manage patient SMS conversations with templates, two-way messaging, and engagement analytics"

## Overview

This feature enables care coordinators to manage patient SMS conversations through a dedicated interface. The system provides real-time bi-directional SMS messaging, reusable message templates with dynamic variables, complete conversation history, and analytics for engagement tracking. The application integrates with the SleepConnect platform via Next.js multi-zones architecture and uses Twilio for SMS delivery with Lambda functions for data persistence.

## Clarifications

### Session 2025-11-28

- Q: Does the system handle PHI requiring HIPAA-compliant security? → A: Yes, PHI-compliant with encrypted storage (AWS Lambda + PostgreSQL on RDS), audit logging required, BAA with Twilio needed
- Q: Are there different permission levels for coordinators? → A: Conversations are saved per user; each coordinator sees only their own conversations
- Q: How are old conversations managed? → A: Manual archive; coordinators can archive conversations, no auto-cleanup, all data retained indefinitely
- Q: Which AI service for sentiment analysis? → A: Deferred to planning; candidates are AWS Comprehend (same ecosystem, HIPAA-eligible) or OpenAI API (more sophisticated)
- Q: How are SLA alerts delivered? → A: In-app visual only; conversation highlighted in list with badge indicator, no external notifications
- Q: Are templates shared or private per coordinator? → A: Hybrid; global shared library (read-only) plus private coordinator templates
- Q: What phone number formats are supported? → A: US only (+1 country code)
- Q: What is the expected message volume? → A: 100-500 messages/day/coordinator
- Q: Should coordinators be able to search/filter conversations? → A: Yes; search by patient name/phone + filter by status (active, archived, SLA overdue)
- Q: What timezone for message timestamps? → A: User's browser/local timezone

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Send and Receive SMS Messages (Priority: P1)

As a care coordinator, I want to send SMS messages to patients and receive their replies in real-time, so that I can engage patients through their preferred communication channel.

**Why this priority**: Core value proposition - without bi-directional messaging, the entire feature has no utility. This is the foundation for all other features.

**Independent Test**: Can be fully tested by sending an SMS to a patient's phone number, receiving a reply, and verifying both messages appear in the conversation view with correct timestamps and delivery status.

**Acceptance Scenarios**:

1. **Given** a care coordinator is viewing a patient conversation, **When** they type a message and click "Send", **Then** the message is delivered to the patient's phone and appears in the conversation with "Sent" status
2. **Given** a patient has received an SMS, **When** the patient replies via text, **Then** the reply appears in the coordinator's conversation view within 3 seconds with the patient's phone number identified
3. **Given** a message has been sent, **When** the delivery status changes (sent → delivered → read), **Then** the status indicator updates in real-time
4. **Given** a coordinator is composing a message, **When** the message exceeds SMS character limits (160 characters), **Then** the system displays a character count and segments the message appropriately

---

### User Story 2 - Start New Patient Conversation (Priority: P1)

As a care coordinator, I want to initiate a new SMS conversation with a patient by entering their phone number and a friendly name, so that I can begin outreach to new or existing patients.

**Why this priority**: Essential for user acquisition into the messaging system - coordinators need to be able to start conversations before any messaging can occur.

**Independent Test**: Can be fully tested by creating a new conversation with a patient phone number, sending an initial message, and verifying the conversation appears in the list.

**Acceptance Scenarios**:

1. **Given** a coordinator clicks "New Conversation", **When** they enter a valid US phone number (+1 and 10 digits) and conversation name, **Then** a new conversation is created and appears in the conversation list
2. **Given** a coordinator enters a phone number, **When** the format is invalid (not US +1 format, wrong length), **Then** the system displays a validation error before allowing creation
3. **Given** a conversation already exists for a phone number, **When** the coordinator tries to create a duplicate, **Then** the system navigates to the existing conversation instead of creating a duplicate

---

### User Story 3 - View Conversation History (Priority: P1)

As a care coordinator, I want to view the complete conversation history with a patient including all messages, timestamps, and participant identification, so that I can understand the full context of our communication.

**Why this priority**: Critical for continuity of care - coordinators need historical context to provide appropriate follow-up and avoid repeating conversations.

**Independent Test**: Can be fully tested by selecting a conversation and verifying all historical messages display with correct chronological order, timestamps, and sender identification.

**Acceptance Scenarios**:

1. **Given** a coordinator selects a conversation from the list, **When** the conversation loads, **Then** all messages display in chronological order with timestamps and sender identification (coordinator vs. patient)
2. **Given** a conversation has many messages, **When** the coordinator scrolls up, **Then** older messages load progressively without losing scroll position
3. **Given** a coordinator views a conversation, **When** new messages arrive, **Then** the view auto-scrolls to show the latest message with a visual indicator

---

### User Story 4 - Use Message Templates (Priority: P2)

As a care coordinator, I want to use pre-built message templates with dynamic variables, so that I can send consistent, personalized messages efficiently.

**Why this priority**: Significantly improves efficiency and message quality, but coordinators can still function without templates by typing messages manually.

**Independent Test**: Can be fully tested by selecting a template, verifying variables are highlighted, and sending a message with variables replaced.

**Acceptance Scenarios**:

1. **Given** a coordinator is composing a message, **When** they select a template from the library, **Then** the template content populates in the message input with variables highlighted (e.g., `{{firstName}}`)
2. **Given** a template contains variables, **When** the coordinator attempts to send without replacing all variables, **Then** the system prompts to complete missing values
3. **Given** a coordinator views templates, **When** they browse the template library, **Then** templates display organized by category (welcome, reminder, follow-up, education, general) with preview text

---

### User Story 5 - Create and Manage Templates (Priority: P2)

As a care coordinator or administrator, I want to create, edit, and delete message templates, so that I can maintain a library of approved messages for the team.

**Why this priority**: Enables customization and scaling of template library over time, but initial templates can be pre-seeded.

**Independent Test**: Can be fully tested by creating a new template with variables, editing it, and verifying it appears in the template library for use.

**Acceptance Scenarios**:

1. **Given** a coordinator clicks "New Template", **When** they enter a name, category, and content with `{{variable}}` placeholders, **Then** the template is saved and variables are automatically detected and listed
2. **Given** a coordinator views an existing template, **When** they click "Edit", **Then** they can modify the content and save changes
3. **Given** a coordinator views a template, **When** they click "Delete" and confirm, **Then** the template is removed from the library
4. **Given** a coordinator copies a template, **When** they click "Copy", **Then** the template content is copied to clipboard for external use

---

### User Story 6 - Monitor Response SLA (Priority: P2)

As a care coordinator, I want to be alerted when a patient reply has been waiting more than 10 minutes, so that I can respond promptly and maintain service levels.

**Why this priority**: Directly impacts patient satisfaction and engagement outcomes - timely responses are critical for conversion.

**Independent Test**: Can be fully tested by receiving a patient message and verifying an alert appears after 10 minutes without response.

**Acceptance Scenarios**:

1. **Given** a patient sends a reply, **When** 10 minutes pass without a coordinator response, **Then** the conversation is flagged with a visual SLA alert indicator
2. **Given** an SLA alert is active, **When** a coordinator sends a response, **Then** the alert is cleared and response time is logged
3. **Given** multiple conversations have SLA alerts, **When** viewing the conversation list, **Then** overdue conversations appear highlighted or sorted to the top

---

### User Story 7 - View Engagement Analytics (Priority: P3)

As a care coordinator or manager, I want to view analytics on message delivery, response rates, and response times, so that I can measure outreach effectiveness.

**Why this priority**: Valuable for optimization but not required for core messaging functionality.

**Independent Test**: Can be fully tested by viewing the analytics dashboard and verifying metrics reflect actual conversation data.

**Acceptance Scenarios**:

1. **Given** a coordinator navigates to Analytics, **When** the dashboard loads, **Then** key metrics display: active conversations count, average response time, response rate percentage, and delivery rate
2. **Given** conversations have occurred, **When** viewing engagement metrics, **Then** the system shows aggregated statistics across campaigns and time periods
3. **Given** an administrator views analytics, **When** they examine response time trends, **Then** they can identify patterns and outliers in coordinator performance

---

### User Story 8 - AI Tone Analysis (Priority: P3)

As a care coordinator, I want AI-powered tone analysis on patient messages, so that I can adjust my communication approach based on patient sentiment.

**Why this priority**: Enhances communication quality but is an optimization layer on top of functional messaging.

**Independent Test**: Can be fully tested by viewing a conversation with varied patient messages and verifying tone indicators appear with appropriate recommendations.

**Acceptance Scenarios**:

1. **Given** a patient sends a message, **When** the message is received, **Then** an AI-generated sentiment indicator displays (positive, neutral, negative)
2. **Given** a patient message has negative sentiment, **When** a coordinator views the conversation, **Then** the system suggests softer follow-up language or escalation
3. **Given** a patient responds quickly with positive sentiment, **When** viewing the conversation, **Then** the system highlights this as a "quick win" for engagement

---

### Edge Cases

- What happens when a patient phone number is unreachable or invalid?
  - System displays delivery failure status and logs the error for review
- What happens when Twilio service is temporarily unavailable?
  - Messages queue locally and retry automatically when service resumes; user sees "pending" status
- How does the system handle a patient opting out (STOP message)?
  - System marks the conversation as opted-out, prevents further outgoing messages, and displays opt-out status
- What happens when a coordinator sends a message while offline?
  - Message queues locally and syncs when connection restores with appropriate status indicators
- How does the system handle concurrent coordinators messaging the same patient?
  - All coordinators see real-time updates; conversation lock or warning when multiple are typing

## Requirements *(mandatory)*

### Functional Requirements

#### Core Messaging

- **FR-001**: System MUST send SMS messages to patient phone numbers via Twilio API
- **FR-002**: System MUST receive inbound SMS messages from patients in real-time (within 3 seconds of receipt)
- **FR-003**: System MUST display message delivery status (sending, sent, delivered, read, failed)
- **FR-004**: System MUST validate phone numbers are US E.164 format (+1 followed by valid area code 2-9 and 9 digits, e.g., +12025551234) before allowing message send
- **FR-004a**: System MUST detect patient opt-out (STOP message) and mark conversation as opted-out, preventing further outbound messages
- **FR-005**: System MUST handle SMS character limits and display segment count for long messages

#### Conversations

- **FR-006**: System MUST allow creation of new conversations with patient phone number and friendly name
- **FR-007**: System MUST prevent duplicate conversations for the same phone number within a coordinator's view
- **FR-008**: System MUST display all messages in chronological order with timestamps
- **FR-008a**: System MUST display message timestamps in the user's browser/local timezone
- **FR-008b**: System MUST store all timestamps in UTC using PostgreSQL TIMESTAMPTZ type (per Constitution Principle VII)
- **FR-009**: System MUST identify message sender (coordinator vs. patient) in the conversation view
- **FR-010**: System MUST persist all conversation data via Lambda functions for durability
- **FR-011**: System MUST support pagination/infinite scroll for conversations with many messages
- **FR-012**: System MUST associate conversations with the creating coordinator (user-scoped visibility)
- **FR-013**: System MUST allow coordinators to archive conversations (moves to separate archived view)
- **FR-013a**: System MUST allow coordinators to unarchive conversations (restore from archived view to active)
- **FR-014**: System MUST retain all conversation data indefinitely (no automatic deletion per Constitution Principle I)
- **FR-014a**: System MUST allow coordinators to search conversations by patient name or phone number
- **FR-014b**: System MUST allow coordinators to filter conversations by status: active, archived, SLA overdue

#### Templates

- **FR-015**: System MUST provide a global shared template library accessible as read-only to all coordinators (only administrators can create/edit global templates)
- **FR-016**: System MUST allow coordinators to create private templates visible only to themselves
- **FR-017**: System MUST allow creation of message templates with name, category, and content
- **FR-018**: System MUST support dynamic variables in templates using `{{variableName}}` syntax
- **FR-019**: System MUST auto-detect variables in template content when saving
- **FR-020**: System MUST organize templates by categories: welcome, reminder, follow-up, education, general
- **FR-021**: System MUST allow private templates to be copied, edited, and deleted by their owner
- **FR-022**: System MUST warn when sending a message with unresolved template variables

#### Analytics & SLA

- **FR-023**: System MUST track and display average response time across conversations
- **FR-024**: System MUST track and display overall response rate percentage
- **FR-025**: System MUST track and display message delivery rate
- **FR-026**: System MUST visually highlight conversations in the list when patient replies wait more than 10 minutes (in-app indicator only, no external notifications)
- **FR-027**: System MUST log response times for SLA reporting

#### AI/Insights

- **FR-028**: System MUST analyze incoming patient messages for sentiment (positive, neutral, negative)
- **FR-029**: System MUST display sentiment indicators on patient messages
- **FR-030**: System MUST suggest communication adjustments based on detected sentiment

#### Integration

- **FR-031**: System MUST integrate with SleepConnect (`/home/dan/code/SAX/sleepconnect`) via Next.js multi-zones architecture
- **FR-031a**: SleepConnect MUST configure rewrites to proxy `/outreach/*` routes to this Outreach zone application
- **FR-032**: System MUST authenticate users via SleepConnect's existing authorization system (Auth0)
- **FR-033**: System MUST use a unique asset prefix (`/outreach-static/`) to avoid conflicts with other zones
- **FR-034**: System MUST handle navigation between zones appropriately (hard navigation for cross-zone)

#### Security & Compliance

- **FR-035**: System MUST encrypt all message data at rest in PostgreSQL/RDS
- **FR-036**: System MUST maintain audit logs of all message access and modifications
- **FR-037**: System MUST transmit all data over TLS/HTTPS
- **FR-038**: System MUST operate under a Business Associate Agreement (BAA) with Twilio for HIPAA compliance

### Key Entities

- **Conversation**: Represents an SMS thread with a patient; contains phone number, friendly name, created_on timestamp, last message preview, unread status, and SLA status
- **Message**: Individual SMS within a conversation; contains body text, author (system/phone number), created_on timestamp, delivery status, and sentiment analysis
- **Template**: Reusable message pattern; contains name, category, content body, detected variables list, visibility scope (global or private), and owner coordinator ID (null for global; only administrators can create global templates)
- **Coordinator**: Authenticated user who manages conversations; inherits identity from SleepConnect
- **Analytics Event**: Logged metrics for reporting; includes response times, delivery status changes, and engagement actions

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Coordinators can send an SMS message and see delivery confirmation within 5 seconds
- **SC-002**: Patient replies appear in the coordinator's view within 3 seconds of receipt
- **SC-003**: 95% of messages deliver successfully on first attempt
- **SC-004**: Average coordinator response time to patient messages is under 10 minutes
- **SC-005**: Coordinators can create and use a template to send a personalized message in under 30 seconds
- **SC-006**: SLA alerts trigger within 1 minute of the 10-minute threshold being exceeded
- **SC-007**: Complete conversation history loads within 2 seconds for conversations with up to 500 messages
- **SC-008**: System supports at least 100 concurrent active conversations without performance degradation
- **SC-009**: Sentiment analysis provides accurate categorization for 85% of patient messages
- **SC-010**: Response rate increases by 20% compared to manual outreach tracking

## Assumptions

- Twilio account is configured with appropriate phone numbers for SMS sending
- Expected message volume is 100-500 messages per coordinator per day
- Lambda functions and persistence layer are available and configured
- SleepConnect authentication/authorization infrastructure is accessible
- Coordinators have access to patient phone numbers through existing workflows
- Standard web application performance expectations apply (sub-second page loads)
- Users have modern browsers with JavaScript enabled
- **All data storage uses PostgreSQL on RDS via Lambda functions (DynamoDB must NOT be used)**

## Dependencies

- **Twilio Conversations API**: For bi-directional SMS messaging
- **AWS Lambda + PostgreSQL/RDS**: For data persistence and business logic (NOT DynamoDB)
- **SleepConnect Platform**: For user authentication and authorization context
- **AI/ML Service**: For sentiment analysis (specific provider TBD based on existing infrastructure)
