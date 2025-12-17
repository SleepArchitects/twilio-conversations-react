# Phase 7: Template Management - Complete

**Date**: December 10, 2025  
**User Story**: US5 - Create and Manage Templates (Priority: P2)  
**Status**: ✅ **COMPLETE**

## Overview

Phase 7 enables coordinators to create, edit, and delete their own private message templates for SMS outreach. This builds upon Phase 6 (template usage) by adding full CRUD capabilities.

## Implementation Summary

### Phase 7A: Frontend (twilio-conversations-react) ✅

**Components Created**:

- `components/templates/TemplateEditor.tsx` - Form for creating/editing templates with:
  - Name input (max 100 chars)
  - Category selector (welcome, reminder, follow-up, education, general)
  - Content textarea with character count
  - Quick variable insertion buttons (`{{patientFirstName}}`, etc.)
  - Auto-detection of variables using regex `/\{\{(\w+)\}\}/g`
  - Validation via Zod schema
  
- `components/templates/TemplateList.tsx` - Grid view of templates with:
  - Search by name/content
  - Category filter dropdown
  - Template cards showing name, category, content preview, usage count
  - Edit/Delete/Copy actions via dropdown menu
  - Delete confirmation modal
  - "Global" badge for tenant-wide templates

- `app/templates/page.tsx` - Template management page with:
  - List/Grid view of all templates
  - "New Template" button
  - Modal for TemplateEditor
  - Toast notifications for CRUD operations
  - Real-time refresh after changes

**API Routes Implemented**:

- `app/api/outreach/templates/route.ts`:
  - `POST` - Create new template (calls Lambda `create_sms_template`)
  - `GET` - List templates (already existed from Phase 6A)
  
- `app/api/outreach/templates/[templateId]/route.ts`:
  - `GET` - Get single template details
  - `PATCH` - Update template fields
  - `DELETE` - Soft-delete (archive) template

**Key Features**:

- ✅ Variable auto-detection with regex
- ✅ Category validation (5 predefined categories)
- ✅ Copy to clipboard functionality
- ✅ Search and filter UI
- ✅ Usage count display
- ✅ Soft delete (active=false)
- ✅ Toast notifications (success/error)
- ✅ Modal-based editor

### Phase 7B: Backend (sleepconnect) ✅

**Database Functions** (deployed to SAXDBDEV):

- `public.insert_sms_template(...)` - Creates template with validation, audit fields
- `public.update_sms_template(...)` - Updates fields via COALESCE (partial updates)
- `public.delete_sms_template(...)` - Soft-deletes with archived_on/archived_by

**Lambda Functions** (deployed to AWS):

- `sax-lam-us-east-1-1x-p-0x-sms-create-template` - POST handler
- `sax-lam-us-east-1-1x-p-0x-sms-update-template` - PATCH handler
- `sax-lam-us-east-1-1x-p-0x-sms-delete-template` - DELETE handler

**API Gateway Routes** (added to temp API `kwp0fzixn9`):

- POST `/outreach/templates`
- PATCH `/outreach/templates/{id}`
- DELETE `/outreach/templates/{id}`

## Bug Fixes

### Fixed: Missing `x-user-sax-id` Header

**Issue**: Lambda functions expect `x-user-sax-id` header for `created_by`, `updated_by`, and `archived_by` fields, but API routes were only sending `x-coordinator-sax-id`.

**Fix**: Updated `getLambdaHeaders()` function in both route files to include:

```typescript
"x-user-sax-id": String(userContext.saxId),
```

**Files Modified**:

- `app/api/outreach/templates/route.ts`
- `app/api/outreach/templates/[templateId]/route.ts`

## Testing Recommendations

### Manual Testing Checklist

1. **Create Template**:
   - Navigate to `/templates`
   - Click "New Template"
   - Fill form: name, category, content with variables
   - Verify variables detected and highlighted
   - Click "Save"
   - Verify success toast and template appears in list

2. **Edit Template**:
   - Click edit (pencil icon) on a template
   - Modify name/category/content
   - Click "Save"
   - Verify changes persisted

3. **Delete Template**:
   - Click delete (trash icon) on a template
   - Confirm deletion in modal
   - Verify template removed from list
   - Verify soft-delete in database (`active=false`)

4. **Copy Content**:
   - Click "Copy Content" from template dropdown
   - Paste into message composer
   - Verify content matches

5. **Search and Filter**:
   - Search by template name
   - Filter by category
   - Verify results update correctly

### Integration Test

```bash
# Example: Create template via API
curl -X POST https://kwp0fzixn9.execute-api.us-east-1.amazonaws.com/dev/outreach/templates \
  -H "Content-Type: application/json" \
  -H "x-tenant-id: YOUR_TENANT_ID" \
  -H "x-practice-id: YOUR_PRACTICE_ID" \
  -H "x-user-sax-id: YOUR_SAX_ID" \
  -d '{
    "name": "Test Template",
    "content": "Hello {{patientFirstName}}, your appointment is {{appointmentDate}}.",
    "category": "reminder",
    "variables": ["patientFirstName", "appointmentDate"]
  }'
```

## Database Schema

```sql
-- sms_templates table (already existed)
CREATE TABLE public.sms_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  practice_id UUID,
  owner_sax_id BIGINT,
  name VARCHAR(100) NOT NULL,
  body TEXT NOT NULL,
  category sms_template_category NOT NULL,
  language VARCHAR(10) DEFAULT 'en',
  variables TEXT[],
  requires_approval BOOLEAN DEFAULT FALSE,
  is_default BOOLEAN DEFAULT FALSE,
  usage_count INTEGER DEFAULT 0,
  created_on TIMESTAMPTZ DEFAULT NOW(),
  created_by BIGINT,
  updated_on TIMESTAMPTZ DEFAULT NOW(),
  updated_by BIGINT,
  archived_on TIMESTAMPTZ,
  archived_by BIGINT,
  active BOOLEAN DEFAULT TRUE
);
```

## Dependencies

**Requires**:

- Phase 6B backend (templates read operations) ✅
- Phase 2 foundational (auth, API client) ✅

**Enables**:

- Coordinators can create custom templates for their workflow
- Templates can be edited without IT/admin involvement
- Soft-delete preserves audit trail

## Next Steps

**Phase 8: SLA Monitoring** (US6):

- Implement SLA indicators for overdue patient responses
- Add SLA status to conversation list
- Create SLA alerts and sorting

**Production Readiness**:

- Add E2E tests for template CRUD
- Load testing for concurrent template operations
- Validate HIPAA compliance for template content (no PHI)
- Add rate limiting for template creation (prevent abuse)

## Files Changed

### Frontend (twilio-conversations-react)

- `app/api/outreach/templates/route.ts` - Added POST handler
- `app/api/outreach/templates/[templateId]/route.ts` - Added GET/PATCH/DELETE handlers
- `components/templates/TemplateEditor.tsx` - Created (211 lines)
- `components/templates/TemplateList.tsx` - Created (215 lines)
- `app/templates/page.tsx` - Created (110 lines)
- `specs/001-sms-outreach-integration/tasks.md` - Updated Phase 7A/7B status

### Backend (sleepconnect)

- `database/functions/sms/insert_sms_template.sql` - Created
- `database/functions/sms/update_sms_template.sql` - Created
- `database/functions/sms/delete_sms_template.sql` - Created
- `lambdas/lambda-sms-outreach/create_sms_template/` - Created
- `lambdas/lambda-sms-outreach/update_sms_template/` - Created
- `lambdas/lambda-sms-outreach/delete_sms_template/` - Created
- `lambdas/lambda-sms-outreach/deploy-single.sh` - Added new lambda mappings
- `lambdas/lambda-sms-outreach/add-template-routes.sh` - Added CRUD routes

## Metrics

- **Total Tasks**: 15 (7 frontend + 8 backend)
- **Components**: 3 new React components
- **API Routes**: 2 route files (1 new, 1 extended)
- **Lambda Functions**: 3 new functions
- **Database Functions**: 3 new stored procedures
- **Lines of Code**: ~650 lines (frontend + backend)

---

**Phase 7 Status**: ✅ **READY FOR TESTING**

All Phase 7A and 7B tasks complete. Template CRUD functionality is deployed and ready for coordinator use.
