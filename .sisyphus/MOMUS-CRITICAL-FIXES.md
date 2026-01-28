# ADDENDUM: Momus Critical Fixes Required

## Issue 1: Deployment Mechanism Contradiction

**Problem**: Plan says both "create migration file 015" AND "add to deploy-mvp-functions.sh", but:

- `run-migrations.sh` stops at migration 010
- Migration 012 (is_sax_user) exists but NOT in migrations list
- Functions are deployed via `deploy-mvp-functions.sh`, not migrations

**Fix**: Use function-only deployment (no migration file needed):

- ✅ Create `database/functions/sms/find_or_create_conversation.sql`
- ✅ Add to `MVP_FUNCTIONS` array in `deploy-mvp-functions.sh`
- ❌ Remove migration file 015 from plan (not used in practice)

## Issue 2: twilio_sid Request Contract - CRITICAL

**Problem**: Plan claims "callers never provide twilio_sid" but current code accepts it:

- Line 174: `if (!twilio_sid)` - only creates when NOT provided
- Callers CAN provide twilio_sid in request body

**Fix**: Clarify actual behavior:

- **Current**: twilio_sid is OPTIONAL input
- **New behavior decision needed**: Keep optional OR make required-empty?
- **Implications for orphan cleanup**: If provided, don't delete it (caller owns it)

## Issue 3: Missing API Request Contract Section

**Problem**: Plan references "API Request Contract section" but section doesn't exist

**Fix**: Add actual section showing current contract from index.mjs lines 106-115

## Issue 4: Practice vs Tenant Scoping Inconsistency

**Problem**: Plan says "tenant-wide" but Step 1 uses practice_id

**Fix**: Clarify scoping rules explicitly:

- Same-coordinator check: practice-scoped (includes practice_id)
- Cross-coordinator check: tenant-wide (omits practice_id)
- This is INTENTIONAL - document why

## Issue 5: Twilio 50416 Integration Not Concrete

**Problem**: Narrative section exists but Task 2 doesn't show WHERE to integrate it

**Fix**: Task 2 needs specific line-level instructions on preserving existing 199-258 block

---

## Recommended Action

Given shared-backend production risk, suggest:

1. Fix these 5 issues in plan
2. Re-review with Momus
3. OR: Ship simpler fix first (just fix the pre-check bug without reactivation/SAX features)

The reactivation+SAX+advisory-locks is complex. Consider phased approach?
