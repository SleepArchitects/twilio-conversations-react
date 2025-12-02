# Checklist: Phase 4 - Start New Patient Conversation

**Purpose**: Validate requirements for User Story 2 (Start New Patient Conversation)
**Context**: `specs/001-sms-outreach-integration/`
**Created**: 2025-12-02

## Requirement Completeness

- [ ] CHK001 - Is the "Initial Message" field explicitly required in the New Conversation modal? [Completeness, Gap]
- [ ] CHK002 - Is the default content for the initial message defined with the specific template: "this is {user first name} of sleep architects on behalf of {practice name}..."? [Completeness, Gap]
- [ ] CHK003 - Are the data sources for `{user first name}` and `{practice name}` placeholders explicitly identified? [Completeness]
- [ ] CHK004 - Is the "Automatic Redirect" behavior for duplicate phone numbers specified? [Completeness, FR-007 Revision]
- [ ] CHK005 - Does the spec define whether the redirect happens immediately upon phone number entry or after form submission? [Clarity]

## Requirement Clarity

- [ ] CHK006 - Is "Friendly Name" sanitization explicitly defined (e.g., "escape HTML", "remove links")? [Clarity, Security]
- [ ] CHK007 - Is the requirement to append the practice name to the "Friendly Name" (e.g., "John Doe (SleepArchitects)") clearly specified? [Clarity]
- [ ] CHK008 - Is the behavior defined if the initial message fails to send but the conversation is successfully created? [Edge Case]
- [ ] CHK009 - Is the behavior defined if the user attempts to create a conversation for a phone number that is already "Opted Out"? [Edge Case, FR-004a]

## Requirement Consistency

- [ ] CHK010 - Does the phone number validation (+1 format) align with FR-004? [Consistency, Spec §FR-004]
- [ ] CHK011 - Is the "Friendly Name" length limit consistent with the database schema (if applicable)? [Consistency]
- [ ] CHK012 - Does the initial message template align with the tone/branding guidelines? [Consistency]

## Scenario Coverage

- [ ] CHK013 - Are requirements defined for when a user clicks "New Conversation" but cancels? [Coverage]
- [ ] CHK014 - Is the behavior defined for when the "Friendly Name" is left empty (is it required)? [Coverage]
- [ ] CHK015 - Are requirements defined for handling "Archived" conversations when a duplicate is detected (should it unarchive)? [Coverage, Edge Case]
- [ ] CHK016 - Is the behavior defined for when the user is offline when attempting to create a conversation? [Coverage, Non-Functional]

## Measurability

- [ ] CHK017 - Can the "Automatic Redirect" speed be objectively measured (e.g., < 1s)? [Measurability]
- [ ] CHK018 - Is the success criteria for "Friendly Name" sanitization testable (e.g., "input containing `<script>` is escaped")? [Measurability]
