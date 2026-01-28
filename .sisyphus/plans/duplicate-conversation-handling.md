# Fix Duplicate Conversation Handling

## Repository & Working Directory

**IMPORTANT**: All code changes are in the **sleepconnect** repository, NOT this repo (twilio-conversations-react).

```
Base path: /home/dan/code/SAX/sleepconnect/
```

All file paths in this plan are relative to that repo root unless otherwise specified.

---

## ⚠️ CRITICAL: Deployment Architecture

**Outreach SMS system has a unique architecture:**

| Component                 | Environments             | Reality                                            |
| ------------------------- | ------------------------ | -------------------------------------------------- |
| **Frontend (Next.js)**    | 3 separate environments  | dev, staging, prod                                 |
| **Backend API Gateway**   | **1 shared environment** | ALL frontends use the SAME "dev" API Gateway       |
| **WebSocket API Gateway** | **1 shared environment** | ALL frontends use the SAME "dev" WebSocket Gateway |
| **Database (PostgreSQL)** | **1 shared instance**    | ALL frontends use the SAME "dev" database          |

**⚠️ CRITICAL IMPLICATION**:

- When this plan says "deploy to dev", it means deploying to the **ONLY** backend/database instance
- This instance serves **ALL** frontend environments including production
- There is **NO separate staging or production backend** to test against
- Any database migration or Lambda change **immediately affects production users**

**Risk Mitigation Required**:

- DB function changes must be backward-compatible (old Lambda can still call old function during rollout)
- Consider deploying DB function first, testing with manual psql calls, before updating Lambda
- Lambda changes should be deployed with immediate rollback plan ready
- Monitor production traffic during/after deployment

---

## Context

### Original Request

User reported concern about what happens when someone tries to create a conversation with a phone/patient that already has a conversation. Investigation revealed a mismatch between Lambda pre-check (uses `tenant_id + patient_phone`) and DB constraint (uses full 5-field key).

### Interview Summary

**Key Discussions**:

- Lambda pre-check bug: Missing `practice_id`, `coordinator_sax_id` in duplicate detection query
- Different coordinator scenario: Should show 409 error (unless SAX user)
- Inactive conversation: Should reactivate instead of blocking (original coordinator or SAX user)
- SAX user bypass: SAX users can access any conversation (no ownership change for active, takes ownership only on reactivation)
- Multiple archived: Priority is same-tenant first, then most recent
- Cross-coordinator scope: **TENANT-WIDE** (not practice-scoped)

### Momus Review (All Fixes Applied)

1. **Logic location**: All duplicate/reactivation logic lives in **DB function** (authoritative)
2. **DB function signature**: Explicitly defined with 9 parameters
3. **Response shapes**: Verified against current implementation (201 returns minimal 5 fields, 200 returns full object)
4. **Twilio patterns**: Copied exact patterns from current `index.mjs` lines 188-193
5. **Cross-coordinator concurrency**: Handled by DB function with deterministic selection

---

## Work Objectives

### Core Objective

Fix duplicate conversation detection by making the DB function the single source of truth for all duplicate detection, cross-coordinator conflict handling, and reactivation logic.

### Concrete Deliverables

- **NEW** DB function: `database/functions/sms/find_or_create_conversation.sql`
- **KEEP** old DB function: `database/functions/sms/insert_sms_conversation.sql` (for backward compatibility)
- Modified Lambda handler: `lambdas/lambda-sms-outreach/insert_sms_conversation/index.mjs`
- DB migration file to deploy new function
- Manual QA verification of all scenarios

### Definition of Done

- [ ] DB function handles all duplicate/reactivation logic atomically
- [ ] Lambda is simplified to: check SAX → create Twilio → call DB → return result
- [ ] Different coordinator gets 409 with clear error message
- [ ] SAX user can access any conversation
- [ ] Archived conversations are reactivated
- [ ] Race conditions return 409 (not 500)
- [ ] All manual QA scenarios pass

### Must Have

- All logic in DB function (single source of truth)
- SAX user bypass for accessing/reactivating conversations
- Reactivation flow for archived conversations
- Graceful 409 responses for race conditions

### Must NOT Have (Guardrails)

- No changes to the DB unique constraint
- No frontend changes
- No new Lambda files
- No changes to existing response field names (additive only)

## Deployment Procedure

### ⚠️ Pre-Deployment Safety Check

**REMEMBER**: This is the ONLY backend/database instance - ALL frontends (including production) use it.

**Before deploying, verify**:

- [ ] No active production incidents or high-traffic periods
- [ ] Rollback plan documented and ready
- [ ] Database backup recent (within last hour)
- [ ] Can manually test DB function via psql before Lambda deployment

### DB Function Deployment

**Strategy**: Deploy DB function FIRST, test independently, THEN update Lambda (minimizes production risk)

1. **Create function file**: `database/functions/sms/find_or_create_conversation.sql`
2. **Create migration file**: `database/migrations/sms/015_add_find_or_create_conversation.sql`
3. **Update deploy script**: In `database/functions/sms/deploy-mvp-functions.sh`:
   - **Add to MVP_FUNCTIONS array**: `"find_or_create_conversation.sql"`
   - Insert in appropriate position (after dependencies like `is_sax_user`)

   Example:

   ```bash
   MVP_FUNCTIONS=(
       # ... existing functions ...
       "check_duplicate_conversation.sql"
       "find_or_create_conversation.sql"  # ADD THIS LINE
       # ... rest of functions ...
   )
   ```

4. **Deploy to shared database** (⚠️ affects ALL environments):

   ```bash
   cd /home/dan/code/SAX/sleepconnect
   export DATABASE_URL=$DEV_DATABASE_URL  # This is the ONLY database instance
   ./database/functions/sms/deploy-mvp-functions.sh
   ```

5. **Test DB function independently** (BEFORE updating Lambda):

   ```bash
   # Connect to the shared database
   psql $DEV_DATABASE_URL

   # Run test queries (see Task 1 acceptance criteria)
   SELECT * FROM public.find_or_create_conversation(...);
   ```

### Lambda Deployment

**Only deploy Lambda AFTER DB function is tested and confirmed working**

1. **Build Lambda locally**: Test changes don't break build
2. **Deploy to shared API Gateway** (⚠️ affects ALL frontend environments):
   - Via existing CI/CD pipeline
   - OR manual deploy script
3. **Monitor immediately**: Watch for errors in CloudWatch logs
4. **Have rollback ready**: Previous Lambda version should still work (backward compatible)

---

## Twilio Duplicate Binding (50416) Handling

**Current Behavior**: The existing Lambda already handles Twilio duplicate binding errors (code 50416) when a phone is already bound to a conversation. This logic MUST be preserved.

**Preservation Strategy**:

The new flow is: **Create Twilio first, then call DB function**. The existing 50416 handling fits into this as follows:

```javascript
let twilioCreatedSid = null;
let twilioWasReused = false;

try {
  // Step 1: Try to create NEW Twilio conversation
  const newConvo = await client.conversations.v1.conversations.create({
    friendlyName: friendly_name || patient_phone
  });
  twilioCreatedSid = newConvo.sid;

  // Step 2: Try to add participant
  try {
    await client.conversations.v1.conversations(twilioCreatedSid).participants.create({
      "messagingBinding.address": patient_phone,
      "messagingBinding.proxyAddress": TWILIO_PHONE_NUMBER,
    });
  } catch (participantError) {
    // PRESERVE EXISTING 50416 LOGIC
    if (participantError.code === 50416) {
      // Phone already bound - fetch the existing Twilio conversation
      const existingBinding = await client...// (existing logic to get SID)

      // Cleanup the unused conversation we just created
      await client.conversations.v1.conversations(twilioCreatedSid).remove();

      // Use the existing bound conversation instead
      twilioCreatedSid = existingBinding.conversationSid;
      twilioWasReused = true;
    } else {
      throw participantError;
    }
  }

  // Step 3: Call DB function with Twilio SID (new or reused)
  const result = await db.query(`SELECT * FROM public.find_or_create_conversation(...)`, [...]);

  // Step 4: Handle DB result and orphan cleanup...
} catch (error) {
  // Cleanup orphans ONLY if we created a new conversation that wasn't bound
  if (twilioCreatedSid && !twilioWasReused) {
    // ... cleanup logic
  }
}
```

**Key Point**: When Twilio forces SID reuse (50416), we must NOT delete that conversation on orphan cleanup - it's not an orphan, it's a pre-existing binding.

---

## Request Behavior: Provided vs Generated twilio_sid

**Current behavior**: Lambda generates `twilio_sid` by creating a new Twilio conversation. Callers do NOT provide `twilio_sid` in the request body.

**New behavior**: UNCHANGED - Lambda always generates `twilio_sid` via Twilio API.

**Rationale**:

- The request contract (verified in "API Request Contract" section) does NOT include `twilio_sid` as an input field
- Lambda creates the Twilio conversation as part of the request flow
- DB function receives the Lambda-generated SID

**No caller-supplied SID case to handle** - this simplifies orphan cleanup (we always own the SID we create).

---

## Twilio Orphan Handling (CRITICAL)

**Situation**: Lambda creates Twilio conversation BEFORE calling DB function. If DB returns `existing` or throws `OWNED_BY_OTHER`, the newly created Twilio conversation is orphaned.

**Solution**: Delete orphaned Twilio conversation on conflict.

```javascript
// After creating Twilio conversation...
const twilio_sid = newConvo.sid;

try {
  const result = await db.query(`SELECT * FROM public.find_or_create_conversation(...)`, [...]);
  const row = result.rows[0];

  if (row.out_result_type === 'existing' || row.out_result_type === 'reactivated') {
    // We created a Twilio conversation but DB returned existing - delete orphan
    if (twilio_sid !== row.out_twilio_sid) {
      await client.conversations.v1.conversations(twilio_sid).remove();
    }
  }
  // ... continue with response
} catch (error) {
  // On ANY error (including OWNED_BY_OTHER), delete orphaned Twilio conversation
  try {
    await client.conversations.v1.conversations(twilio_sid).remove();
  } catch (cleanupError) {
    console.error('Failed to cleanup orphaned Twilio conversation:', twilio_sid, cleanupError);
  }
  // ... continue with error response
}
```

---

## Error Mapping Specification

### Unique Constraint Violations (SQLSTATE 23505)

The `sms_conversations` table has two unique constraints:

1. `uq_sms_conversations_active_phone UNIQUE (tenant_id, practice_id, coordinator_sax_id, patient_phone, status)`
2. `twilio_sid VARCHAR(34) UNIQUE NOT NULL`

**Mapping logic**:

```javascript
if (error.code === "23505") {
  // Check constraint name to distinguish
  if (error.constraint === "uq_sms_conversations_active_phone") {
    return json(409, {
      error: "Race condition: conversation just created",
      code: "RACE_CONDITION",
    });
  }
  if (error.constraint === "sms_conversations_twilio_sid_key") {
    return json(409, {
      error: "Twilio conversation ID conflict",
      code: "TWILIO_SID_CONFLICT",
    });
  }
  // Fallback for any other unique violation
  return json(409, { error: "Duplicate record", code: "DUPLICATE" });
}
```

### Custom Business Errors (SQLSTATE P0001)

```javascript
if (error.code === "P0001" && error.hint === "OWNED_BY_OTHER") {
  return json(409, {
    error:
      "This phone number is already in an active conversation with another coordinator",
    code: "OWNED_BY_OTHER",
  });
}
```

---

## API Verification Details

### Base URL

The Lambda is deployed behind API Gateway. Get the base URL from:

```bash
# Option 1: From environment variable
echo $OUTREACH_API_URL

# Option 2: From API Gateway console
aws apigatewayv2 get-apis --query 'Items[?Name==`sms-outreach-api`].ApiEndpoint' --output text
```

**Dev environment example**: `https://xxxxxxxx.execute-api.us-east-1.amazonaws.com/dev`

### Required Headers

The Lambda reads from JSON body, not headers. However, API Gateway may require:

- `Content-Type: application/json` (required)
- `Authorization: Bearer <token>` (if auth is enabled on route)

### Complete Curl Example

```bash
# Get real IDs from dev database
TENANT_ID=$(psql $DEV_DATABASE_URL -t -c "SELECT id FROM tenants LIMIT 1" | tr -d ' ')
PRACTICE_ID=$(psql $DEV_DATABASE_URL -t -c "SELECT id FROM practices LIMIT 1" | tr -d ' ')
COORDINATOR_ID=$(psql $DEV_DATABASE_URL -t -c "SELECT sax_id FROM people WHERE people_type != 'Sax' LIMIT 1" | tr -d ' ')

# Create conversation
curl -X POST "$OUTREACH_API_URL/outreach/conversations" \
  -H "Content-Type: application/json" \
  -d "{
    \"tenant_id\": \"$TENANT_ID\",
    \"practice_id\": \"$PRACTICE_ID\",
    \"coordinator_sax_id\": $COORDINATOR_ID,
    \"patient_phone\": \"+15559990099\",
    \"friendly_name\": \"Test Patient\"
  }"
```

---

### Current Lambda Response Shapes (from `index.mjs`)

**201 Created** (lines 284-290 - minimal response):

```json
{
  "id": "uuid",
  "twilio_sid": "CHxxxxx",
  "status": "active",
  "sla_status": "ok",
  "created_on": "2024-01-01T00:00:00Z"
}
```

**200 Existing** (lines 150-170 - full response):

```json
{
  "id": "uuid",
  "tenant_id": "uuid",
  "practice_id": "uuid",
  "twilio_sid": "CHxxxxx",
  "coordinator_sax_id": 12345,
  "patient_phone": "+15551234567",
  "friendly_name": "Patient Name",
  "status": "active",
  "sla_status": "ok",
  "unread_count": 0,
  "last_message_at": null,
  "last_message_preview": null,
  "created_on": "2024-01-01T00:00:00Z",
  "created_by": 12345,
  "updated_on": "2024-01-01T00:00:00Z",
  "updated_by": 12345,
  "archived_on": null,
  "archived_by": null,
  "active": true,
  "existing": true
}
```

### Current DB Function Signature (7 params)

```sql
CREATE OR REPLACE FUNCTION public.insert_sms_conversation(
    p_tenant_id UUID,
    p_practice_id UUID,
    p_coordinator_sax_id BIGINT,
    p_patient_phone VARCHAR(20),
    p_friendly_name VARCHAR(255),
    p_twilio_sid VARCHAR(34),
    p_created_by BIGINT
)
RETURNS TABLE(
    out_id UUID,
    out_twilio_sid VARCHAR(34),
    out_status sms_conversation_status,
    out_sla_status sla_status,
    out_created_on TIMESTAMPTZ
)
```

### Current Twilio Participant Pattern (lines 188-193)

```javascript
await client.conversations.v1.conversations(twilio_sid).participants.create({
  "messagingBinding.address": patient_phone,
  "messagingBinding.proxyAddress": TWILIO_PHONE_NUMBER,
});
```

---

## New Response Shapes (Additive Changes Only)

**201 Created** (unchanged):

```json
{
  "id": "uuid",
  "twilio_sid": "CHxxxxx",
  "status": "active",
  "sla_status": "ok",
  "created_on": "2024-01-01T00:00:00Z"
}
```

**200 Existing** (unchanged + flag already exists):

```json
{
  // ... all current fields ...
  "existing": true
}
```

**200 Reactivated** (same as existing + new flag):

```json
{
  // ... all current fields ...
  "existing": false,
  "reactivated": true
}
```

**409 Owned By Other Coordinator** (new):

```json
{
  "error": "This phone number is already in an active conversation with another coordinator",
  "code": "OWNED_BY_OTHER"
}
```

**409 Race Condition** (improved):

```json
{
  "error": "A conversation was just created for this phone number. Please try again.",
  "code": "RACE_CONDITION"
}
```

---

## New DB Function Specification

### Function Signature (9 params → replaces current 7 params)

```sql
CREATE OR REPLACE FUNCTION public.find_or_create_conversation(
    p_tenant_id UUID,
    p_practice_id UUID,
    p_coordinator_sax_id BIGINT,
    p_patient_phone VARCHAR(20),
    p_friendly_name VARCHAR(255),
    p_twilio_sid VARCHAR(34),        -- For new conversations OR reactivation
    p_created_by BIGINT,
    p_is_sax_user BOOLEAN,           -- NEW: caller is SAX type
    p_reactivate_twilio_sid VARCHAR(34)  -- NEW: for reactivation (may differ from p_twilio_sid)
)
RETURNS TABLE(
    out_id UUID,
    out_twilio_sid VARCHAR(34),
    out_status sms_conversation_status,
    out_sla_status sla_status,
    out_created_on TIMESTAMPTZ,
    out_result_type VARCHAR(20)      -- NEW: 'created', 'existing', 'reactivated' (NOT 'conflict' - uses RAISE instead)
)
```

### Cross-Coordinator Concurrency Strategy (CRITICAL)

**Problem**: The existing unique constraint `UNIQUE (tenant_id, practice_id, coordinator_sax_id, patient_phone, status)` does NOT prevent two different coordinators from creating active conversations for the same phone simultaneously.

**Solution**: Use PostgreSQL advisory locks to serialize cross-coordinator checks.

```sql
-- At the start of the function, acquire advisory lock on (tenant_id, patient_phone hash)
SELECT pg_advisory_xact_lock(
    hashtext(p_tenant_id::text || '|' || p_patient_phone)
);

-- This ensures only ONE transaction at a time can check/create for this tenant+phone combo
-- Lock is automatically released at transaction end (COMMIT or ROLLBACK)
```

**Why this works**:

- Advisory lock serializes all attempts to create for the same `(tenant, phone)`
- First concurrent request acquires lock, checks, creates
- Second concurrent request waits for lock, then checks and sees existing → returns 'existing' or throws OWNED_BY_OTHER
- Guarantees QA scenario #8: "one gets 201, other gets 409"

### Function Logic (Pseudocode)

```sql
-- Step 0: Acquire advisory lock for cross-coordinator serialization
PERFORM pg_advisory_xact_lock(
    hashtext(p_tenant_id::text || '|' || p_patient_phone)
);
-- Lock automatically released at transaction end

-- Step 1: Same-coordinator active check
SELECT INTO v_existing FROM sms_conversations
WHERE tenant_id = p_tenant_id
  AND practice_id = p_practice_id
  AND coordinator_sax_id = p_coordinator_sax_id
  AND patient_phone = p_patient_phone
  AND status = 'active' AND active = true;

IF FOUND THEN
    RETURN QUERY SELECT ..., 'existing';
    RETURN;
END IF;

-- Step 2: Cross-coordinator active check (TENANT-WIDE)
SELECT INTO v_conflict FROM sms_conversations
WHERE tenant_id = p_tenant_id
  AND patient_phone = p_patient_phone
  AND status = 'active' AND active = true
  AND coordinator_sax_id != p_coordinator_sax_id
ORDER BY updated_on DESC  -- Deterministic: most recently updated wins
LIMIT 1;

IF FOUND THEN
    IF p_is_sax_user THEN
        -- SAX can access (no ownership change)
        RETURN QUERY SELECT ..., 'existing';
        RETURN;
    ELSE
        RAISE EXCEPTION 'OWNED_BY_OTHER'
            USING ERRCODE = 'P0001',
                  HINT = 'OWNED_BY_OTHER';
    END IF;
END IF;

-- Step 3: Archived check (TENANT-WIDE, prioritize same coordinator)
SELECT INTO v_archived FROM sms_conversations
WHERE tenant_id = p_tenant_id
  AND patient_phone = p_patient_phone
  AND status = 'archived' AND active = true
ORDER BY
    CASE WHEN coordinator_sax_id = p_coordinator_sax_id THEN 0 ELSE 1 END,
    archived_on DESC
LIMIT 1;

IF FOUND THEN
    v_can_reactivate := (v_archived.coordinator_sax_id = p_coordinator_sax_id) OR p_is_sax_user;

    IF v_can_reactivate THEN
        -- Reactivate: update status, twilio_sid, and coordinator if SAX
        UPDATE sms_conversations SET
            status = 'active',
            twilio_sid = COALESCE(p_reactivate_twilio_sid, twilio_sid),
            coordinator_sax_id = CASE
                WHEN p_is_sax_user AND coordinator_sax_id != p_coordinator_sax_id
                THEN p_coordinator_sax_id
                ELSE coordinator_sax_id
            END,
            updated_on = NOW(),
            updated_by = p_created_by,
            archived_on = NULL,
            archived_by = NULL
        WHERE id = v_archived.id;

        RETURN QUERY SELECT ..., 'reactivated';
        RETURN;
    END IF;
    -- If can't reactivate, fall through to create new
END IF;

-- Step 4: Create new conversation
INSERT INTO sms_conversations (...) VALUES (...);
RETURN QUERY SELECT ..., 'created';
```

---

## Task Flow

```
Task 1 (DB function) → Task 2 (Lambda handler) → Task 3 (Integration QA)
```

## Parallelization

| Task | Depends On | Reason                             |
| ---- | ---------- | ---------------------------------- |
| 1    | None       | DB function changes first          |
| 2    | 1          | Lambda calls DB function           |
| 3    | 2          | Integration testing of all changes |

---

## TODOs

- [ ] 1. Create new DB function `find_or_create_conversation`

  **What to do**:
  1. Create new function file `database/functions/sms/find_or_create_conversation.sql` with:
     - 9 parameters as specified above
     - Extended RETURNS TABLE with `out_result_type`
     - All 4 steps of logic (same-coord, cross-coord, archived, create)
     - Uses `ERRCODE = 'P0001'` and `HINT = 'OWNED_BY_OTHER'` for conflicts
  2. Create migration file `database/migrations/sms/015_add_find_or_create_conversation.sql`:

     ```sql
     -- Migration: Add find_or_create_conversation function
     -- Depends on: is_sax_user() from 012_add_sax_user_check.sql

     \i database/functions/sms/find_or_create_conversation.sql
     ```

  3. Update deploy script `database/functions/sms/deploy-mvp-functions.sh`:
     - Add line: `psql ... -f database/functions/sms/find_or_create_conversation.sql`
  4. Keep old `insert_sms_conversation.sql` for backward compatibility (deprecate later)
  5. Use `is_sax_user()` function pattern from `012_add_sax_user_check.sql`

  **Exact RETURNS TABLE columns** (for each result type):

  | out_result_type | out_id               | out_twilio_sid                      | out_status      | out_sla_status      | out_created_on      |
  | --------------- | -------------------- | ----------------------------------- | --------------- | ------------------- | ------------------- |
  | 'created'       | new UUID             | p_twilio_sid                        | 'active'        | 'ok'                | NOW()               |
  | 'existing'      | existing row's id    | existing twilio_sid                 | existing status | existing sla_status | existing created_on |
  | 'reactivated'   | reactivated row's id | p_reactivate_twilio_sid or existing | 'active'        | existing sla_status | existing created_on |

  **Must NOT do**:
  - Change the DB unique constraint
  - Delete the old function (yet)
  - Add complex nested logic beyond the 4 steps

  **Parallelizable**: NO (must complete before Lambda changes)

  **References**:
  - `database/functions/sms/insert_sms_conversation.sql` - Current function to base new one on
  - `database/migrations/sms/012_add_sax_user_check.sql` - `is_sax_user()` pattern
  - `database/functions/sms/check_duplicate_conversation.sql` - Duplicate check pattern

  **Acceptance Criteria**:

  **Manual Execution Verification (psql):**

  ```sql
  -- Test 1: New conversation
  SELECT * FROM public.find_or_create_conversation(
    'tenant-uuid'::uuid, 'practice-uuid'::uuid, 12345, '+15559990001',
    'Test', 'CHtest001', 12345, false, NULL
  );
  -- Expected: out_result_type = 'created'

  -- Test 2: Same coordinator duplicate
  SELECT * FROM public.find_or_create_conversation(
    'tenant-uuid'::uuid, 'practice-uuid'::uuid, 12345, '+15559990001',
    'Test', 'CHtest002', 12345, false, NULL
  );
  -- Expected: out_result_type = 'existing'

  -- Test 3: Different coordinator (non-SAX)
  SELECT * FROM public.find_or_create_conversation(
    'tenant-uuid'::uuid, 'practice-uuid'::uuid, 99999, '+15559990001',
    'Test', 'CHtest003', 99999, false, NULL
  );
  -- Expected: EXCEPTION with HINT = 'OWNED_BY_OTHER'

  -- Test 4: Different coordinator (SAX user)
  SELECT * FROM public.find_or_create_conversation(
    'tenant-uuid'::uuid, 'practice-uuid'::uuid, 99999, '+15559990001',
    'Test', 'CHtest004', 99999, true, NULL
  );
  -- Expected: out_result_type = 'existing'
  ```

  **Commit**: YES
  - Message: `feat(db): add find_or_create_conversation with duplicate detection and reactivation`
  - Files: `database/functions/sms/find_or_create_conversation.sql`

---

- [ ] 2. Update Lambda to use new DB function

  **What to do**:
  1. **Add SAX user detection** (before any other logic):
     ```javascript
     const saxResult = await db.query(
       `SELECT public.is_sax_user($1) as is_sax`,
       [coordinator_sax_id],
     );
     const isSaxUser = saxResult.rows[0]?.is_sax || false;
     ```
  2. **Remove the current pre-check logic** (lines 133-171) - DB function handles this now
  3. **Keep Twilio creation** (lines 174-193) but wrap with cleanup logic
  4. **Replace DB function call** (around line 263) and add orphan cleanup:

     ```javascript
     let twilioCreatedSid = null; // Track for cleanup

     try {
       // Create Twilio conversation (existing logic)
       const newConvo = await client.conversations.v1.conversations.create({...});
       twilioCreatedSid = newConvo.sid;
       await client.conversations.v1.conversations(twilioCreatedSid).participants.create({
         "messagingBinding.address": patient_phone,
         "messagingBinding.proxyAddress": TWILIO_PHONE_NUMBER,
       });

       // Call DB function
       const result = await db.query(
         `SELECT * FROM public.find_or_create_conversation($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
         [tenant_id, practice_id, coordinator_sax_id, patient_phone,
          friendly_name || null, twilioCreatedSid, created_by || coordinator_sax_id,
          isSaxUser, twilioCreatedSid]
       );

       const row = result.rows[0];

       // Cleanup orphaned Twilio conversation if DB returned existing/reactivated
       if ((row.out_result_type === 'existing' || row.out_result_type === 'reactivated')
           && twilioCreatedSid !== row.out_twilio_sid) {
         await client.conversations.v1.conversations(twilioCreatedSid).remove();
       }

       // ... continue with response handling
     } catch (error) {
       // Cleanup orphaned Twilio conversation on ANY error
       if (twilioCreatedSid) {
         try {
           await client.conversations.v1.conversations(twilioCreatedSid).remove();
         } catch (cleanupError) {
           console.error('Failed to cleanup orphan Twilio:', twilioCreatedSid, cleanupError);
         }
       }
       // ... continue with error handling
     }
     ```

  5. **Update response handling** based on `out_result_type`:

     ```javascript
     const row = result.rows[0];

     if (row.out_result_type === "existing") {
       const fullConvo = await db.query(
         `SELECT * FROM sms_conversations WHERE id = $1`,
         [row.out_id],
       );
       return json(200, { ...fullConvo.rows[0], existing: true });
     }

     if (row.out_result_type === "reactivated") {
       const fullConvo = await db.query(
         `SELECT * FROM sms_conversations WHERE id = $1`,
         [row.out_id],
       );
       return json(200, {
         ...fullConvo.rows[0],
         existing: false,
         reactivated: true,
       });
     }

     // 'created' - return minimal response (current behavior)
     return json(201, {
       id: row.out_id,
       twilio_sid: row.out_twilio_sid,
       status: row.out_status,
       sla_status: row.out_sla_status,
       created_on: row.out_created_on,
     });
     ```

  6. **Update error handling** with constraint-aware mapping:
     ```javascript
     if (error.code === "23505") {
       // Unique constraint violation - check which one
       if (error.constraint === "uq_sms_conversations_active_phone") {
         return json(409, {
           error: "Race condition: conversation just created",
           code: "RACE_CONDITION",
         });
       }
       if (error.constraint === "sms_conversations_twilio_sid_key") {
         return json(409, {
           error: "Twilio conversation ID conflict",
           code: "TWILIO_SID_CONFLICT",
         });
       }
       return json(409, { error: "Duplicate record", code: "DUPLICATE" });
     }
     if (error.code === "P0001" && error.hint === "OWNED_BY_OTHER") {
       return json(409, {
         error:
           "This phone number is already in an active conversation with another coordinator",
         code: "OWNED_BY_OTHER",
       });
     }
     ```
  7. **Remove the current pre-check logic** (lines 133-171) - DB function handles this now
  8. **Handle reactivation Twilio SID** before calling DB:
     - For new conversations: create Twilio conversation as usual
     - For potential reactivation: Lambda doesn't know yet, so create Twilio first anyway
     - DB function will use the new SID if reactivating
  9. **Replace DB function call** (around line 263):
     ```javascript
     const result = await db.query(
       `SELECT * FROM public.find_or_create_conversation($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
       [
         tenant_id,
         practice_id,
         coordinator_sax_id,
         patient_phone,
         friendly_name || null,
         twilio_sid,
         created_by || coordinator_sax_id,
         isSaxUser,
         twilio_sid, // Same SID for reactivation
       ],
     );
     ```
  10. **Update response handling** based on `out_result_type`:

      ```javascript
      const row = result.rows[0];

      if (row.out_result_type === "existing") {
        // Fetch full conversation for existing response
        const fullConvo = await db.query(
          `SELECT * FROM sms_conversations WHERE id = $1`,
          [row.out_id],
        );
        return json(200, { ...fullConvo.rows[0], existing: true });
      }

      if (row.out_result_type === "reactivated") {
        const fullConvo = await db.query(
          `SELECT * FROM sms_conversations WHERE id = $1`,
          [row.out_id],
        );
        return json(200, {
          ...fullConvo.rows[0],
          existing: false,
          reactivated: true,
        });
      }

      // 'created' - return minimal response (current behavior)
      return json(201, {
        id: row.out_id,
        twilio_sid: row.out_twilio_sid,
        status: row.out_status,
        sla_status: row.out_sla_status,
        created_on: row.out_created_on,
      });
      ```

  11. **Update error handling** (around line 292):
      ```javascript
      if (error.code === "23505") {
        return json(409, {
          error:
            "A conversation was just created for this phone number. Please try again.",
          code: "RACE_CONDITION",
        });
      }
      if (error.code === "P0001" && error.hint === "OWNED_BY_OTHER") {
        return json(409, {
          error:
            "This phone number is already in an active conversation with another coordinator",
          code: "OWNED_BY_OTHER",
        });
      }
      ```

  **Must NOT do**:
  - Change the Twilio creation logic (lines 174-193)
  - Change the minimal 201 response shape
  - Add new npm dependencies

  **Parallelizable**: NO (depends on Task 1)

  **References**:
  - `lambdas/lambda-sms-outreach/insert_sms_conversation/index.mjs` - Current handler
  - Lines 150-170: Current "existing" response pattern
  - Lines 188-193: Current Twilio participant creation pattern
  - Lines 284-290: Current "created" response pattern
  - Lines 292-303: Current error handling

  **Acceptance Criteria**:

  **Manual Execution Verification (curl):**

  ```bash
  # Test 1: New conversation
  curl -X POST https://api-dev.../outreach/conversations \
    -H "Content-Type: application/json" \
    -d '{
      "tenant_id": "<uuid>",
      "practice_id": "<uuid>",
      "coordinator_sax_id": 12345,
      "patient_phone": "+15559990002",
      "friendly_name": "New Patient"
    }'
  # Expected: 201, { "id": "...", "twilio_sid": "...", ... }

  # Test 2: Same coordinator duplicate
  # (run same curl again)
  # Expected: 200, { ..., "existing": true }

  # Test 3: Different coordinator (non-SAX)
  curl -X POST ... -d '{"coordinator_sax_id": 99999, "patient_phone": "+15559990002", ...}'
  # Expected: 409, { "code": "OWNED_BY_OTHER" }
  ```

  **Commit**: YES
  - Message: `fix(lambda): use find_or_create_conversation for atomic duplicate handling`
  - Files: `lambdas/lambda-sms-outreach/insert_sms_conversation/index.mjs`

---

- [ ] 3. Integration QA - Test all scenarios

  **What to do**:

  Test ALL scenarios in dev environment:

  | #   | Scenario                                       | Expected                               | Verify                   |
  | --- | ---------------------------------------------- | -------------------------------------- | ------------------------ |
  | 1   | New conversation, no conflicts                 | 201 + minimal response                 | Has id, twilio_sid       |
  | 2   | Same coordinator, active exists                | 200 + full response + `existing: true` | Check flag               |
  | 3   | Different coordinator, active exists, non-SAX  | 409 `OWNED_BY_OTHER`                   | Check error code         |
  | 4   | Different coordinator, active exists, SAX user | 200 + full response + `existing: true` | SAX can access           |
  | 5   | Same coordinator, archived exists              | 200 + `reactivated: true`              | Check flag               |
  | 6   | SAX user, archived exists (other coord)        | 200 + `reactivated: true`, new owner   | Check coordinator_sax_id |
  | 7   | Different coord, archived exists (non-SAX)     | 201 + new conversation                 | Creates separate conv    |
  | 8   | Race condition (2 concurrent creates)          | One gets 201, other gets 409           | Both logged              |
  | 9   | Twilio SID used on reactivation                | twilio_sid updated in DB               | Query DB to verify       |

  **Must NOT do**:
  - Skip any scenario
  - Accept 500 errors
  - Modify production data

  **Parallelizable**: NO (final verification step)

  **Acceptance Criteria**:
  - [ ] All 9 scenarios pass
  - [ ] No 500 errors in any scenario
  - [ ] Response shapes match specification
  - [ ] Reactivated conversations show correct `coordinator_sax_id`

  **Commit**: NO (QA only)

---

## Commit Strategy

| After Task | Message                                                                               | Files                                                                                                                                                                         |
| ---------- | ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1          | `feat(db): add find_or_create_conversation with duplicate detection and reactivation` | `database/functions/sms/find_or_create_conversation.sql`, `database/migrations/sms/015_add_find_or_create_conversation.sql`, `database/functions/sms/deploy-mvp-functions.sh` |
| 2          | `fix(lambda): use find_or_create_conversation for atomic duplicate handling`          | `lambdas/lambda-sms-outreach/insert_sms_conversation/index.mjs`                                                                                                               |

---

## Success Criteria

### Final Checklist

- [ ] New DB function `find_or_create_conversation` created and working
- [ ] Lambda simplified to call new function
- [ ] SAX users can access any active conversation (no ownership change)
- [ ] SAX users can reactivate any archived conversation (takes ownership)
- [ ] Original coordinator can reactivate their own archived conversation
- [ ] Different coordinator (non-SAX) creates new conversation (not blocked by others' archived)
- [ ] 409 errors have proper `code` field
- [ ] No 500 errors for race conditions
- [ ] All 9 QA scenarios pass
- [ ] Response fields are additive only (backward compatible)
