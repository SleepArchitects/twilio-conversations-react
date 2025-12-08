# Checklist: Tasks Requirements Quality

**Purpose**: Validate the quality, clarity, and completeness of task definitions in `tasks.md`  
**Created**: 2025-12-08  
**Focus**: Task specification quality (NOT implementation verification)  
**Depth**: Standard  
**Audience**: Reviewer (PR) / Planning

---

## Task Definition Completeness

- [ ] CHK001 - Are all Phase 5a (Patient Context) tasks traceable to specific FRs? [Traceability, Spec §FR-039–FR-042]
- [ ] CHK002 - Are all Phase 5b (Status Filters) tasks traceable to specific FRs? [Traceability, Spec §FR-014c, FR-014d]
- [ ] CHK003 - Is every task that touches PHI explicitly tagged with HIPAA compliance note? [Completeness, Constitution I]
- [ ] CHK004 - Are stored procedure dependencies documented for each API route task? [Completeness, Gap]
- [ ] CHK005 - Does T018a specify which Header/Footer components to import from SleepConnect? [Clarity, NFR-005]
- [ ] CHK006 - Are acceptance criteria or test hints defined for Phase 5a/5b checkpoints? [Measurability, Gap]

## Task Definition Clarity

- [ ] CHK007 - Is "patient context" in T200–T205 quantified with specific data fields (name, DOB, MRN)? [Clarity, Spec §FR-039]
- [ ] CHK008 - Are filter enum values (`all`, `unread`, `sla_risk`, `archived`) specified in T206? [Clarity, Spec §FR-014c]
- [ ] CHK009 - Is "frequent templates" in T043a quantified (top N, recency window, usage count)? [Clarity, FR-022b]
- [ ] CHK010 - Is "hard navigation" in T205 defined with specific implementation (window.location vs router)? [Clarity, NFR-005]
- [ ] CHK011 - Are error states specified for T202 (patient link API) failures? [Clarity, Gap]
- [ ] CHK012 - Is the DOB format (`MMM DD, YYYY`) explicitly referenced in T205a? [Clarity, Spec §US3a]

## Task Dependency Consistency

- [ ] CHK013 - Does T212 correctly reference T043a as a prerequisite? [Consistency]
- [ ] CHK014 - Are superseded tasks (T061, T080) clearly marked and not in critical path? [Consistency]
- [ ] CHK015 - Does the dependency diagram include Phase 5a and 5b correctly? [Consistency]
- [ ] CHK016 - Are Phase 6 Quick Template tasks (T211–T213) in the correct dependency order? [Consistency]
- [ ] CHK017 - Is T028a (patient search) dependency on sleepconnect `/api/patients` documented? [Dependency, Gap]

## Task Scope & Granularity

- [ ] CHK018 - Are Phase 5a tasks appropriately sized (single responsibility each)? [Granularity]
- [ ] CHK019 - Is T203 (extend Conversation type) small enough or should it split types vs. API contract? [Granularity]
- [ ] CHK020 - Are UI component tasks (T200, T201, T206, T211) independent and parallelizable? [Granularity]
- [ ] CHK021 - Is T091 (SleepConnect rewrites) scoped correctly or should it live in sleepconnect repo? [Scope, Gap]

## Constitution Alignment

- [ ] CHK022 - Are all tasks touching timestamps referencing UTC storage requirement? [Constitution VII, Gap]
- [ ] CHK023 - Are archive/delete tasks (T081, T090) aligned with soft-delete-only policy? [Constitution I, Gap]
- [ ] CHK024 - Is audit logging task (T086) aligned with HIPAA and encryption requirements? [Constitution I, FR-035–FR-037]
- [ ] CHK025 - Do API tasks specify TLS/HTTPS requirement per Constitution I? [Consistency, Gap]

## Edge Case & Recovery Coverage

- [ ] CHK026 - Is error handling specified for T202 when patient lookup fails? [Edge Case, Gap]
- [ ] CHK027 - Are loading/skeleton states specified for PatientContextHeader (T200)? [Edge Case, Gap]
- [ ] CHK028 - Is fallback behavior defined when conversation has no linked patient? [Edge Case, Spec §US3a-3]
- [ ] CHK029 - Are filter transitions specified when conversation status changes mid-view? [Edge Case, FR-014d]
- [ ] CHK030 - Is empty state defined for each filter (no unread, no SLA risk, no archived)? [Edge Case, Gap]

## API Contract Alignment

- [ ] CHK031 - Does T202 reference the contracts/sms-api.yaml for patient endpoint schema? [Traceability, Gap]
- [ ] CHK032 - Does T043a specify response schema for frequent templates? [Completeness, Gap]
- [ ] CHK033 - Does T209 specify query parameter format for status filter? [Clarity, Gap]
- [ ] CHK034 - Are new API routes (T043a, T202) added to contracts/sms-api.yaml? [Consistency, Gap]

## Data Model Alignment

- [ ] CHK035 - Does T203 align with data-model.md patient_id column definition? [Consistency, data-model.md]
- [ ] CHK036 - Are patient context fields (patient_id, first_name, last_name, dob) consistent across T200, T203, T204? [Consistency]
- [ ] CHK037 - Is index for patient_id referenced in DB migration tasks? [Completeness, data-model.md]

## Parallel Execution Clarity

- [ ] CHK038 - Are all parallelizable tasks correctly marked with [P]? [Clarity]
- [ ] CHK039 - Are Phase 5a and 5b correctly shown as parallel-eligible in the diagram? [Consistency]
- [ ] CHK040 - Is agent workstream allocation table updated for new phases (5a, 5b)? [Completeness, Gap]

## Multi-Zone Integration

- [ ] CHK041 - Is T091 (SleepConnect rewrites) dependency on Outreach deployment documented? [Dependency]
- [ ] CHK042 - Are cross-zone navigation rules (hard nav via `<a>`) documented in T092? [Clarity]
- [ ] CHK043 - Does T018a specify how to handle Auth0 session in multi-zone context? [Clarity, Gap]
- [ ] CHK044 - Are assetPrefix conflicts addressed in T003 and T091? [Consistency, NFR-005]

## Summary Accuracy

- [ ] CHK045 - Does the Summary table correctly count 137 total tasks? [Accuracy]
- [ ] CHK046 - Are superseded tasks excluded from phase counts? [Accuracy]
- [ ] CHK047 - Is MVP Scope definition complete with US3a and US3b? [Completeness]
- [ ] CHK048 - Are new tasks (T018a, T043a, T205a) included in summary counts? [Accuracy]

---

## Metrics

| Metric | Value |
|--------|-------|
| Total Items | 48 |
| Completeness | 12 |
| Clarity | 10 |
| Consistency | 10 |
| Edge Cases | 5 |
| Traceability | 5 |
| Other | 6 |

---

## Identified Gaps Summary

| Gap ID | Category | Description | Suggested Remediation |
|--------|----------|-------------|----------------------|
| G1 | Traceability | T200–T205 missing explicit FR references | Add `per FR-039` to each task |
| G2 | Clarity | T043a "frequent" not quantified | Add "top 5 by usage_count, last 7 days" |
| G3 | Completeness | T202 missing error handling spec | Add "handle 404 patient not found" |
| G4 | Consistency | Agent allocation missing Phase 5a/5b | Update Agent C workstream |
| G5 | Traceability | T043a, T202 not in contracts/sms-api.yaml | Add OpenAPI definitions |
| G6 | Clarity | T018a missing specific component imports | Add "import { Header, Footer } from '@sleepconnect/ui'" |
