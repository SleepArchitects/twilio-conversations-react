# Specification Analysis: Remediation Guide

**Purpose**: Concrete fixes for the 3 critical/high findings blocking implementation  
**Total Time**: ~40 minutes  
**Priority**: Complete before Phase 3 design work begins

---

## 1. Fix C1: assetPrefix Configuration (15 minutes)

### File: `next.config.mjs`

**Current Code** (lines 7-8):
```javascript
basePath: "/outreach",
assetPrefix: "/outreach-static",
```

**Issue**: Works in production but breaks local development (styles 404)

**Fixed Code**:
```javascript
const nextConfig = {
  basePath: "/outreach",
  assetPrefix: process.env.NODE_ENV === "production" 
    ? "/outreach-static"  // CloudFront CDN path for production
    : "/outreach",        // basePath for local development
  // ... rest of config remains same
};
```

**Verification**:
1. Save change
2. Restart dev server: `pnpm dev`
3. Navigate to `http://localhost:3000/outreach/conversations`
4. Open DevTools Network tab
5. Verify CSS bundle loads with 200 status (not 404)
6. Confirm Tailwind styles render (blue button, dark background, etc.)

**Related Documents**:
- `spec.md` §FR-031 (multi-zone architecture)
- `spec.md` §NFR-005 (multi-zone shell integration)
- `plan.md` §Technical Context

---

## 2. Clarify H1: FR-022 Template Variables (15 minutes)

### File: `spec.md`

**Current Text** (around line 260):
```
FR-022: System MUST warn when sending a message with unresolved template variables.
```

**Issue**: "Warn" is ambiguous - does it block send or just show notification?

**Risk**: Non-blocking behavior could allow coordinators to send malformed messages like "Hi {{firstName}}, your appointment is {{appointmentDate}}" to patients

**Recommended Fix**:

**Option 1 - Blocking Behavior (RECOMMENDED for PHI context)**:

Replace FR-022 with:
```
FR-022: System MUST prevent sending messages containing unresolved template variables 
(e.g., {{firstName}}, {{appointmentDate}} remaining in message body). When send is 
attempted with unresolved variables:
1. Display modal showing list of unresolved variables
2. Disable send button with message: "Please fill in required fields: {{firstName}}, {{appointmentDate}}"
3. Send only enabled after coordinator replaces all variables

This prevents patients from receiving malformed messages with unfilled placeholders.
```

**Option 2 - Non-Blocking (Higher Risk)**:

```
FR-022: System MUST warn when send is attempted with unresolved template variables. 
Display confirmation dialog: "Your message contains unfilled template variables: 
{{firstName}}, {{appointmentDate}}. Send anyway?" with Cancel/Send buttons. 
Allow coordinator to override warning.
```

**Recommendation**: Choose **Option 1** (blocking) to maintain professional patient communication

**Impact on Tasks**:
- **T047** (Add variable detection): Update to implement blocking behavior
- **T054** (Auto-detect variables): Add test case for unresolved variable send attempt

**Related Documents**:
- `spec.md` §US4 acceptance scenario 2 (template send flow)
- `tasks.md` T047, T054 (template variable tasks)

---

## 3. Clarify H2: SLA Timing Inconsistency (10 minutes)

### File: `spec.md`

**Current Conflict**:

**Line ~267** (FR-026):
```
FR-026: conversations in the list when patient replies wait more than 10 minutes
```

**Line ~328** (SC-006):
```
SC-006: SLA alerts trigger within 1 minute of the 10-minute threshold being exceeded
```

**Issue**: Unclear if alert appears at 10:00 or 11:00

**Clarification Needed**: Reconcile the timing

**Recommended Fix**:

Add explicit clarification to SC-006 success criteria section:

```
SC-006 - SLA Timing Clarification:
Threshold: 10 minutes wait time from last patient message with no coordinator reply
Detection Latency: System checks SLA status every 60 seconds (polling-based)
Alert Window: SLA visual indicator may appear between 10:00-11:00 (acceptable 1-minute detection lag)
User Behavior: Coordinator sees "SLA Risk" badge on conversation in list within 1 minute of 10-minute threshold
Backend Tracking: Response time metrics calculated from message timestamps (exact 10:00 threshold for reporting)

Example Timeline:
- 10:00:00 - Last patient message received, counter starts
- 10:00:00-10:59:59 - No SLA alert yet (threshold not reached)
- 10:59:59-11:00:59 - Polling detects threshold crossed, badge appears in next UI refresh (±60s)
- 11:00:00+ - SLA visual indicator definitely present
```

**Update Both**:

1. **FR-026** (line ~267): Add precision
   ```
   FR-026: System MUST display visual SLA risk indicator for conversations where patient 
   wait time exceeds 10 minutes. Indicator appears in conversation list view (e.g., orange 
   badge, "SLA Risk" label, clock icon).
   ```

2. **SC-006** (line ~328): Clarify acceptable detection lag
   ```
   SC-006: SLA Risk visual indicator MUST appear within 1 minute of the 10-minute wait 
   threshold being exceeded (acceptable window: 10:00-11:00 due to 60-second polling interval).
   ```

**Impact on Tasks**:
- **T056** (SLA monitoring setup): Uses 10-minute threshold
- **T057** (useSlaMonitor hook): Update to document 60-second polling interval
- **T058-T060** (SLA display): Update expectations for detection lag

**Related Documents**:
- `spec.md` §FR-026, §SC-006
- `tasks.md` T056-T060 (SLA implementation tasks)

---

## How to Apply These Fixes

### Option A: Manual Editing

Edit the three files directly using your editor:

1. **next.config.mjs**: Update assetPrefix line (10 seconds)
2. **spec.md FR-022**: Replace with Option 1 recommended text (5 minutes)
3. **spec.md SC-006**: Add timing clarification (5 minutes)

### Option B: Request Agent Assistance

Run `/speckit.refine` with instruction:
```
Implement the three remediation fixes from ANALYSIS-FINDINGS-SUMMARY.md:
1. Fix assetPrefix in next.config.mjs
2. Clarify FR-022 template variables (use Option 1 blocking behavior)
3. Add timing clarification to SC-006
```

---

## Verification Checklist

After applying fixes:

- [ ] **C1 Fix**: Restart `pnpm dev`, verify CSS loads, styles render correctly
- [ ] **H1 Clarification**: Review updated FR-022 - clearly blocks unresolved variables
- [ ] **H2 Clarification**: Review updated SC-006 - explains 10-11 minute detection window
- [ ] **Git Commit**: Commit changes with message: `chore(spec): apply analysis remediation fixes (C1, H1, H2)`
- [ ] **Phase 3 Readiness**: Confirm no implementation blockers remain

---

## Total Time to Implementation Ready

| Task | Time |
|------|------|
| C1 - assetPrefix fix | 15 min |
| H1 - FR-022 clarification | 15 min |
| H2 - SLA timing clarification | 10 min |
| Testing verification | 5 min |
| **Total** | **45 min** |

After completing these fixes, specification is **READY FOR PHASE 2-3 IMPLEMENTATION**.

---

## Questions?

Refer to:
- **ANALYSIS-FINDINGS-SUMMARY.md** - Quick overview of all findings
- **SPECIFICATION-ANALYSIS-REPORT.md** - Detailed analysis with full evidence
- **spec.md**, **plan.md**, **tasks.md** - Source documents

All remediation instructions are self-contained and can be applied independently.
