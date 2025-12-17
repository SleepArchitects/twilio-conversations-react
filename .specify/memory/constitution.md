<!--
  SYNC IMPACT REPORT
  ==================
  Version Change: 1.0.0 → 1.1.0 (MINOR)
  Rationale: Addition of two new principles (Data Retention, UTC Timestamp Storage)
  
  Modified Principles:
    - I. Patient-First Privacy & Security → II. Patient-First Privacy & Security (renumbered)
    - II. Spec-Driven Development → III. Spec-Driven Development (renumbered)
    - III. Clear, Maintainable, and Testable Code → IV. Clear, Maintainable, and Testable Code (renumbered)
    - IV. Comprehensive Documentation → V. Comprehensive Documentation (renumbered)
    - V. Consistent Code Quality & Style → VI. Consistent Code Quality & Style (renumbered)
    - VI. Documentation Organization → VIII. Documentation Organization (renumbered)
  
  Added Sections:
    - I. Data Retention (NEW) - Indefinite retention, soft delete/archive only
    - VII. UTC Timestamp Storage (NEW) - DB stores UTC, browser displays local time
  
  Removed Sections: None
  
  Templates Requiring Updates:
    - .specify/templates/plan-template.md: ✅ No update needed (Constitution Check is dynamic)
    - .specify/templates/spec-template.md: ✅ No update needed (requirements template is generic)
    - .specify/templates/tasks-template.md: ✅ No update needed (task phases are generic)
  
  Follow-up TODOs: None
-->

# SleepConnect Constitution

**Branch**: `main` | **Date**: 2025-12-08

**Input**: Amendment to add Data Retention and UTC Timestamp Storage principles.

## Summary

This document outlines the guiding principles and standards for the SleepConnect project. It serves as the foundational document for all development, ensuring consistency, quality, and alignment with the project's goals. All development artifacts and processes MUST adhere to this constitution.

## Core Principles

### I. Data Retention (NON-NEGOTIABLE)

All data MUST be retained indefinitely. Under **NO circumstances** shall any data be permanently deleted. All removal operations MUST use soft delete (logical deletion via status flag) or archival mechanisms. This applies to all entities including but not limited to: user records, patient data, messages, logs, and audit trails.

**Rationale**: Healthcare data has long-term legal, regulatory, and clinical value. Permanent deletion creates compliance risks and prevents historical analysis. Soft delete enables data recovery, audit compliance, and maintains referential integrity.

**Implementation Requirements**:

- Under **NO circumstances** shall records be permanently deleted as part of normal application behavior.
- All "delete" operations MUST be implemented as **archival** / **deactivation** using fields such as `active` (boolean) and/or `archived_at` timestamps (or equivalent status flags).
- All queries MUST filter out archived/inactive records by default unless explicitly requested.
- Archive operations MUST preserve full data fidelity with restoration capability.
- Cascade deletes are PROHIBITED; use archival/deactivation cascades instead.

### II. Patient-First Privacy & Security (NON-NEGOTIABLE)

All features, data handling, and infrastructure MUST prioritize the security and privacy of patient data, ensuring full HIPAA compliance. Access to Protected Health Information (PHI) is strictly controlled and audited. All data must be encrypted in transit and at rest.

### III. Spec-Driven Development

All development MUST follow a specification-driven workflow. This includes creating and validating feature specifications, technical plans, and task lists before implementation begins. The process is Constitution → Spec → Plan → Tasks → Implementation.

### IV. Clear, Maintainable, and Testable Code

All code MUST be clear, well-documented, and easy for others to understand. Components should be small and focused, adhering to the Single Responsibility Principle.

Testing MUST be performed for all new features and bug fixes. At minimum, the feature's **manual verification steps** (from `spec.md` acceptance scenarios / independent tests and/or `tasks.md` checkpoints) MUST be executed by a human (typically the developer/user) and recorded in the PR description or release notes. Automated tests (unit/integration/E2E) are encouraged where practical.

### V. Comprehensive Documentation

All features MUST be accompanied by thorough documentation, including API endpoints, architectural decisions, and user guides. Documentation must be kept up-to-date with the latest changes.

### VI. Consistent Code Quality & Style

The project enforces a strict code style using Biome for linting and formatting. All code MUST pass linting and formatting checks before being committed. Naming conventions and file organization standards outlined in `docs/CONTRIBUTING.md` MUST be followed.

### VII. UTC Timestamp Storage

All timestamps stored in the database MUST be in UTC (Coordinated Universal Time). Browser-side display MUST always convert to and display the user's local timezone.

**Rationale**: UTC storage ensures consistency across distributed systems, prevents timezone-related bugs during daylight saving transitions, and simplifies data aggregation and reporting. Local display ensures users see times relevant to their context.

**Implementation Requirements**:

- Database columns storing timestamps MUST use `TIMESTAMP WITH TIME ZONE` (or equivalent) with values normalized to UTC
- Backend APIs MUST accept and return timestamps in ISO 8601 format with UTC timezone indicator (`Z` suffix or `+00:00`)
- Frontend components MUST convert UTC to local time for display using the browser's timezone
- All date/time comparisons and calculations MUST be performed in UTC before conversion
- Audit logs and system events MUST record UTC timestamps exclusively

## Development Workflow

The project follows the GitHub Spec Kit methodology. All new features and significant changes must adhere to the following workflow:

1. **Specification (`spec.md`)**: Define user stories, functional requirements, and success criteria.
1. **Planning (`plan.md`)**: Outline the technical approach, project structure, and technology stack.
1. **Implementation (`tasks.md`)**: Break down the implementation into a series of actionable tasks.
1. **Implementation**: Write code, following the established plan.
1. **Testing**: Write and pass all required tests. Manual verification is acceptable as a minimum when automated coverage is not yet present, but it MUST be executed and recorded.
1. **Code Review**: All code must be peer-reviewed and approved before merging.

## Governance

This Constitution supersedes all other practices and conventions. Any amendments to this document require a formal review and approval process. All pull requests and code reviews must verify compliance with the principles outlined in this constitution.

### VIII. Documentation Organization

All speckit-related documentation (specifications, plans, tasks, checklists) MUST be stored in the `specs` directory, organized by feature branch name.

**Version**: 1.1.0 | **Ratified**: 2025-11-28 | **Last Amended**: 2025-12-08
