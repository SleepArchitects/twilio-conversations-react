# Critical Fixes for Momus Review

## Issue 2: twilio_sid Request Contract (CRITICAL)

**Current Reality** (verified at line 174 of index.mjs):

```javascript
if (!twilio_sid) {
  // Only creates Twilio conversation when NOT provided
}
```

**Fix Required in Plan**:

Add "API Request Contract" section showing:

```javascript
// Request body (from index.mjs lines 106-115)
{
  tenant_id: UUID,           // required
  practice_id: UUID,          // required
  coordinator_sax_id: BIGINT, // required
  patient_phone: VARCHAR(20), // required
  friendly_name: VARCHAR(255),// optional
  twilio_sid: VARCHAR(34),    // OPTIONAL - if provided, Lambda uses it instead of creating
  created_by: BIGINT          // optional
}
```

**Orphan Cleanup Implication**:

```javascript
// ONLY delete twilioCreatedSid if WE created it
if (twilioCreatedSid && twilioCreatedSid !== providedTwilioSid) {
  await client.conversations.v1.conversations(twilioCreatedSid).remove();
}
```

---

## Issue 3: Add Missing API Request Contract Section (CRITICAL)

Add full section before "Current Implementation (Verified)":

```markdown
## API Request Contract

### POST /outreach/conversations

**Request Body** (all fields read from JSON body, NOT headers):

| Field                | Type         | Required | Description                                      |
| -------------------- | ------------ | -------- | ------------------------------------------------ |
| `tenant_id`          | UUID         | ✅ Yes   | Tenant identifier                                |
| `practice_id`        | UUID         | ✅ Yes   | Practice identifier                              |
| `coordinator_sax_id` | BIGINT       | ✅ Yes   | Coordinator SAX ID                               |
| `patient_phone`      | VARCHAR(20)  | ✅ Yes   | E.164 format phone                               |
| `friendly_name`      | VARCHAR(255) | No       | Display name                                     |
| `twilio_sid`         | VARCHAR(34)  | **No**   | If provided, reuses existing Twilio conversation |
| `created_by`         | BIGINT       | No       | Creator SAX ID (defaults to coordinator_sax_id)  |

**Twilio SID Behavior**:

- If `twilio_sid` provided: Lambda uses it (does NOT create new conversation)
- If `twilio_sid` omitted: Lambda creates new Twilio conversation
- Orphan cleanup only deletes Twilio conversations that Lambda created
```

---

## Issue 4: Practice Scoping Clarification (USER DECISION: Practice-scoped)

**Fix in Plan (line 57)**:

```markdown
- Cross-coordinator scope: **PRACTICE-SCOPED**. Different practices CAN have separate active conversations for the same phone.
```

**Fix in DB Function Pseudocode** (line 567 and beyond):

```sql
-- Step 2: Cross-coordinator active check (PRACTICE-SCOPED)
SELECT INTO v_conflict FROM sms_conversations
WHERE tenant_id = p_tenant_id
  AND practice_id = p_practice_id  -- ADD THIS LINE
  AND patient_phone = p_patient_phone
  AND status = 'active' AND active = true
  AND coordinator_sax_id != p_coordinator_sax_id;

-- Step 3: Archived check (PRACTICE-SCOPED)
SELECT INTO v_archived FROM sms_conversations
WHERE tenant_id = p_tenant_id
  AND practice_id = p_practice_id  -- ADD THIS LINE
  AND patient_phone = p_patient_phone
  AND status = 'archived' AND active = true;
```

**Fix Advisory Lock** (line 555):

```sql
-- Lock on tenant + practice + phone (not just tenant + phone)
SELECT pg_advisory_xact_lock(
    hashtext(p_tenant_id::text || '|' || p_practice_id::text || '|' || p_patient_phone)
);
```

---

## Issue 5: Concrete 50416 Integration (USER DECISION: Integrate with new flow)

**Add to Task 2** after step 3 "Keep Twilio creation":

````markdown
3. **Preserve existing 50416 duplicate binding handling** (lines 199-258):

   ```javascript
   let twilioCreatedSid = null;
   let twilioWasReused = false;
   const providedTwilioSid = twilio_sid; // Track what caller gave us

   // If caller provided twilio_sid, use it (skip creation)
   if (providedTwilioSid) {
     twilio_sid = providedTwilioSid;
   } else {
     // Create new Twilio conversation
     try {
       const newConvo = await client.conversations.v1.conversations.create({
         friendlyName: friendly_name || patient_phone,
       });
       twilioCreatedSid = newConvo.sid;

       // Try to add participant
       try {
         await client.conversations.v1
           .conversations(twilioCreatedSid)
           .participants.create({
             "messagingBinding.address": patient_phone,
             "messagingBinding.proxyAddress": TWILIO_PHONE_NUMBER,
           });
         twilio_sid = twilioCreatedSid;
       } catch (participantError) {
         // PRESERVE EXISTING 50416 LOGIC HERE (lines 199-258)
         if (participantError.code === 50416) {
           // Phone already bound - fetch existing conversation SID
           const existingConvo =
             await fetchExistingTwilioConversation(patient_phone);

           // Delete the conversation we just created (unused)
           await client.conversations.v1
             .conversations(twilioCreatedSid)
             .remove();

           // Use the existing bound conversation
           twilio_sid = existingConvo.sid;
           twilioWasReused = true;
           twilioCreatedSid = null; // We didn't create this one
         } else {
           throw participantError;
         }
       }
     } catch (twilioError) {
       // ... existing error handling
     }
   }

   // NOW call DB function with twilio_sid (created, reused, or provided)
   // ... continue to step 4
   ```
````

4. **Call DB function and handle orphan cleanup**:
   - Only delete `twilioCreatedSid` if WE created it AND DB returned existing/conflict
   - Don't delete if `twilioWasReused` (it's not ours)
   - Don't delete if `providedTwilioSid` (caller owns it)

```

---

## Summary of Changes Needed

1. ✅ Issue 1 (deployment) - User says "doesn't matter much"
2. 🔴 Issue 2 (twilio_sid) - Add request contract, fix orphan cleanup logic
3. 🔴 Issue 3 (missing section) - Add full API Request Contract section
4. 🔴 Issue 4 (scoping) - Change TENANT-WIDE to PRACTICE-SCOPED everywhere
5. 🔴 Issue 5 (50416) - Add concrete code snippet to Task 2

All fixes documented above. Apply to plan then re-review with Momus.
```
