# Phase 7B Backend Handover - Template CRUD Operations

**Date**: December 10, 2025  
**Phase**: User Story 5 - Create and Manage Templates (Backend)  
**Repository**: `/home/dan/code/SAX/sleepconnect/`  
**Status**: ⏸️ **PENDING** - Awaiting implementation

---

## Executive Summary

Phase 7A (Frontend) for template management is complete in the `twilio-conversations-react` repository. This document specifies the required backend work in the `sleepconnect` repository to enable full template CRUD functionality.

### What's Complete

- ✅ Frontend UI components for template management
- ✅ API route stubs in twilio-conversations-react
- ✅ TypeScript types and validation schemas

### What's Needed

- ⏸️ PostgreSQL stored procedures for template CRUD
- ⏸️ Lambda functions to expose template operations
- ⏸️ Integration testing and deployment

---

## Database Schema Reference

The `sms_templates` table already exists in PostgreSQL (created in Phase 6B):

```sql
CREATE TABLE IF NOT EXISTS sms_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    practice_id UUID REFERENCES practices(id),  -- NULL for global templates
    created_by UUID NOT NULL REFERENCES users(id),
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('welcome', 'reminder', 'follow-up', 'education', 'general')),
    content TEXT NOT NULL,
    variables TEXT[] DEFAULT '{}',  -- Array of variable names extracted from {{variableName}}
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    archived BOOLEAN DEFAULT FALSE,
    archived_at TIMESTAMPTZ,
    archived_by UUID REFERENCES users(id)
);

-- Indexes for performance
CREATE INDEX idx_sms_templates_practice ON sms_templates(practice_id) WHERE NOT archived;
CREATE INDEX idx_sms_templates_category ON sms_templates(category) WHERE NOT archived;
CREATE INDEX idx_sms_templates_created_by ON sms_templates(created_by);
```

---

## Required Stored Procedures

### 1. Insert SMS Template (T051-BACKEND)

**Stored Procedure**: `insert_sms_template()`

```sql
CREATE OR REPLACE FUNCTION insert_sms_template(
    p_practice_id UUID,
    p_created_by UUID,
    p_name VARCHAR,
    p_category VARCHAR,
    p_content TEXT,
    p_variables TEXT[]
) RETURNS TABLE (
    template_id UUID,
    created_at TIMESTAMPTZ
) AS $$
DECLARE
    v_template_id UUID;
    v_created_at TIMESTAMPTZ;
BEGIN
    -- Validate category
    IF p_category NOT IN ('welcome', 'reminder', 'follow-up', 'education', 'general') THEN
        RAISE EXCEPTION 'Invalid template category: %', p_category;
    END IF;

    -- Insert template
    INSERT INTO sms_templates (
        practice_id,
        created_by,
        name,
        category,
        content,
        variables,
        usage_count,
        created_at,
        updated_at
    ) VALUES (
        p_practice_id,
        p_created_by,
        p_name,
        p_category,
        p_content,
        p_variables,
        0,
        NOW(),
        NOW()
    )
    RETURNING id, created_at INTO v_template_id, v_created_at;

    -- Return result
    RETURN QUERY SELECT v_template_id, v_created_at;
END;
$$ LANGUAGE plpgsql;
```

**Usage Example**:

```sql
SELECT * FROM insert_sms_template(
    'practice-uuid',
    'user-uuid',
    'Appointment Reminder',
    'reminder',
    'Hi {{patientName}}, this is a reminder for your appointment on {{appointmentDate}}.',
    ARRAY['patientName', 'appointmentDate']
);
```

---

### 2. Update SMS Template (T052-BACKEND)

**Stored Procedure**: `update_sms_template()`

```sql
CREATE OR REPLACE FUNCTION update_sms_template(
    p_template_id UUID,
    p_updated_by UUID,  -- For audit trail
    p_name VARCHAR DEFAULT NULL,
    p_category VARCHAR DEFAULT NULL,
    p_content TEXT DEFAULT NULL,
    p_variables TEXT[] DEFAULT NULL
) RETURNS TABLE (
    success BOOLEAN,
    updated_at TIMESTAMPTZ
) AS $$
DECLARE
    v_updated_at TIMESTAMPTZ;
    v_practice_id UUID;
BEGIN
    -- Check if template exists and get practice_id
    SELECT practice_id INTO v_practice_id
    FROM sms_templates
    WHERE id = p_template_id AND NOT archived;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found or archived: %', p_template_id;
    END IF;

    -- Validate category if provided
    IF p_category IS NOT NULL AND p_category NOT IN ('welcome', 'reminder', 'follow-up', 'education', 'general') THEN
        RAISE EXCEPTION 'Invalid template category: %', p_category;
    END IF;

    -- Validate authorization: only creator or practice admins can update
    -- (Add your auth logic here based on sleepconnect patterns)

    -- Update template (only update fields that are provided)
    UPDATE sms_templates
    SET
        name = COALESCE(p_name, name),
        category = COALESCE(p_category, category),
        content = COALESCE(p_content, content),
        variables = COALESCE(p_variables, variables),
        updated_at = NOW()
    WHERE id = p_template_id AND NOT archived
    RETURNING updated_at INTO v_updated_at;

    -- Return result
    RETURN QUERY SELECT TRUE, v_updated_at;
END;
$$ LANGUAGE plpgsql;
```

**Usage Example**:

```sql
SELECT * FROM update_sms_template(
    'template-uuid',
    'user-uuid',
    'Updated Appointment Reminder',  -- new name
    NULL,  -- keep existing category
    'Hi {{patientName}}, your appointment is on {{appointmentDate}} at {{appointmentTime}}.',  -- new content
    ARRAY['patientName', 'appointmentDate', 'appointmentTime']  -- new variables
);
```

---

### 3. Delete SMS Template (T052-BACKEND - Soft Delete)

**Stored Procedure**: `delete_sms_template()`

```sql
CREATE OR REPLACE FUNCTION delete_sms_template(
    p_template_id UUID,
    p_archived_by UUID
) RETURNS TABLE (
    success BOOLEAN,
    archived_at TIMESTAMPTZ
) AS $$
DECLARE
    v_archived_at TIMESTAMPTZ;
    v_practice_id UUID;
BEGIN
    -- Check if template exists
    SELECT practice_id INTO v_practice_id
    FROM sms_templates
    WHERE id = p_template_id AND NOT archived;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Template not found or already archived: %', p_template_id;
    END IF;

    -- Validate authorization: only creator or practice admins can delete
    -- (Add your auth logic here based on sleepconnect patterns)

    -- Soft delete the template
    UPDATE sms_templates
    SET
        archived = TRUE,
        archived_at = NOW(),
        archived_by = p_archived_by,
        updated_at = NOW()
    WHERE id = p_template_id AND NOT archived
    RETURNING archived_at INTO v_archived_at;

    -- Return result
    RETURN QUERY SELECT TRUE, v_archived_at;
END;
$$ LANGUAGE plpgsql;
```

**Usage Example**:

```sql
SELECT * FROM delete_sms_template(
    'template-uuid',
    'user-uuid'
);
```

---

## Required Lambda Functions

### 1. POST /outreach/templates (T051-BACKEND)

**Lambda Function**: `insert_sms_template/`

**Handler**: `src/insert_sms_template/index.ts`

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';

const pool = new Pool({
  // Your PostgreSQL connection config
});

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // 1. Extract user context from Auth0 headers
    const userId = event.headers['x-user-id'];
    const practiceId = event.headers['x-practice-id'];

    if (!userId) {
      return {
        statusCode: 401,
        body: JSON.stringify({ error: 'Unauthorized' })
      };
    }

    // 2. Parse request body
    const body = JSON.parse(event.body || '{}');
    const { name, category, content, variables } = body;

    // 3. Validate input
    if (!name || !category || !content) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing required fields: name, category, content' })
      };
    }

    // 4. Call stored procedure
    const result = await pool.query(
      'SELECT * FROM insert_sms_template($1, $2, $3, $4, $5, $6)',
      [practiceId, userId, name, category, content, variables || []]
    );

    // 5. Return created template
    return {
      statusCode: 201,
      body: JSON.stringify({
        id: result.rows[0].template_id,
        name,
        category,
        content,
        variables,
        createdAt: result.rows[0].created_at,
        practiceId,
        createdBy: userId
      })
    };
  } catch (error) {
    console.error('Error creating template:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to create template' })
    };
  }
}
```

---

### 2. PATCH /outreach/templates/{templateId} (T052-BACKEND)

**Lambda Function**: `update_sms_template/`

**Handler**: `src/update_sms_template/index.ts`

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';

const pool = new Pool({
  // Your PostgreSQL connection config
});

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // 1. Extract user context
    const userId = event.headers['x-user-id'];
    const templateId = event.pathParameters?.templateId;

    if (!userId || !templateId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing user ID or template ID' })
      };
    }

    // 2. Parse request body
    const body = JSON.parse(event.body || '{}');
    const { name, category, content, variables } = body;

    // 3. Call stored procedure
    const result = await pool.query(
      'SELECT * FROM update_sms_template($1, $2, $3, $4, $5, $6)',
      [templateId, userId, name, category, content, variables]
    );

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Template not found' })
      };
    }

    // 4. Return updated template
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        updatedAt: result.rows[0].updated_at
      })
    };
  } catch (error) {
    console.error('Error updating template:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to update template' })
    };
  }
}
```

---

### 3. DELETE /outreach/templates/{templateId} (T052-BACKEND)

**Lambda Function**: `delete_sms_template/`

**Handler**: `src/delete_sms_template/index.ts`

```typescript
import { APIGatewayProxyEvent, APIGatewayProxyResult } from 'aws-lambda';
import { Pool } from 'pg';

const pool = new Pool({
  // Your PostgreSQL connection config
});

export async function handler(event: APIGatewayProxyEvent): Promise<APIGatewayProxyResult> {
  try {
    // 1. Extract user context
    const userId = event.headers['x-user-id'];
    const templateId = event.pathParameters?.templateId;

    if (!userId || !templateId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'Missing user ID or template ID' })
      };
    }

    // 2. Call stored procedure (soft delete)
    const result = await pool.query(
      'SELECT * FROM delete_sms_template($1, $2)',
      [templateId, userId]
    );

    if (result.rows.length === 0) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: 'Template not found' })
      };
    }

    // 3. Return success
    return {
      statusCode: 200,
      body: JSON.stringify({
        success: true,
        archivedAt: result.rows[0].archived_at
      })
    };
  } catch (error) {
    console.error('Error deleting template:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'Failed to delete template' })
    };
  }
}
```

---

## SST Configuration

Add the new Lambda functions to your `sst.config.ts`:

```typescript
// In your API stack definition
const insertTemplateFunction = new Function(stack, "InsertSmsTemplate", {
  handler: "src/insert_sms_template/index.handler",
  environment: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
});

const updateTemplateFunction = new Function(stack, "UpdateSmsTemplate", {
  handler: "src/update_sms_template/index.handler",
  environment: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
});

const deleteTemplateFunction = new Function(stack, "DeleteSmsTemplate", {
  handler: "src/delete_sms_template/index.handler",
  environment: {
    DATABASE_URL: process.env.DATABASE_URL,
  },
});

// Add routes to API Gateway
api.addRoutes(stack, {
  "POST /outreach/templates": insertTemplateFunction,
  "PATCH /outreach/templates/{templateId}": updateTemplateFunction,
  "DELETE /outreach/templates/{templateId}": deleteTemplateFunction,
});
```

---

## Testing Checklist

### Database Testing

- [ ] Test `insert_sms_template()` with valid data
- [ ] Test `insert_sms_template()` with invalid category
- [ ] Test `update_sms_template()` with partial updates
- [ ] Test `update_sms_template()` on non-existent template
- [ ] Test `delete_sms_template()` (verify soft delete)
- [ ] Test `delete_sms_template()` on already archived template

### Lambda Testing

- [ ] POST /outreach/templates - successful creation
- [ ] POST /outreach/templates - validation errors
- [ ] POST /outreach/templates - unauthorized access
- [ ] PATCH /outreach/templates/{id} - successful update
- [ ] PATCH /outreach/templates/{id} - not found error
- [ ] DELETE /outreach/templates/{id} - successful delete
- [ ] DELETE /outreach/templates/{id} - not found error

### Integration Testing

- [ ] Create template via frontend → verify in database
- [ ] Update template via frontend → verify changes
- [ ] Delete template via frontend → verify soft delete
- [ ] Global templates visible across practices
- [ ] Practice-specific templates only visible to that practice

---

## Deployment Steps

1. **Database Migration** (if stored procedures don't exist)

   ```bash
   cd /home/dan/code/SAX/sleepconnect
   psql $DATABASE_URL < migrations/add_template_crud_procedures.sql
   ```

2. **Lambda Deployment**

   ```bash
   cd /home/dan/code/SAX/sleepconnect
   pnpm run deploy:dev  # or appropriate deployment command
   ```

3. **Smoke Testing**

   ```bash
   # Test POST
   curl -X POST https://dev-api.sleepconnect.com/outreach/templates \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Test","category":"general","content":"Test {{var}}"}'
   
   # Test PATCH
   curl -X PATCH https://dev-api.sleepconnect.com/outreach/templates/$TEMPLATE_ID \
     -H "Authorization: Bearer $TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"name":"Updated Test"}'
   
   # Test DELETE
   curl -X DELETE https://dev-api.sleepconnect.com/outreach/templates/$TEMPLATE_ID \
     -H "Authorization: Bearer $TOKEN"
   ```

4. **Frontend Integration Verification**
   - Navigate to `/templates` in twilio-conversations-react
   - Create a new template
   - Edit the template
   - Delete the template
   - Verify all operations succeed

---

## Rollback Plan

If deployment fails or issues arise:

1. **Database Rollback**

   ```sql
   DROP FUNCTION IF EXISTS insert_sms_template(...);
   DROP FUNCTION IF EXISTS update_sms_template(...);
   DROP FUNCTION IF EXISTS delete_sms_template(...);
   ```

2. **Lambda Rollback**
   - Use AWS Console to rollback to previous version
   - Or redeploy previous git commit

3. **Frontend Graceful Degradation**
   - Frontend will show error messages for failed operations
   - Read-only template viewing will continue to work (Phase 6B functions)

---

## Success Criteria

Phase 7B is complete when:

- ✅ All stored procedures deployed and tested
- ✅ All Lambda functions deployed and tested
- ✅ Integration tests passing
- ✅ Frontend can create/edit/delete templates successfully
- ✅ No PHI exposure in logs or error messages
- ✅ Audit trails working (created_by, archived_by tracked)

---

## Contact & Support

**Frontend Team** (twilio-conversations-react):

- Phase 7A complete and ready for integration
- API contracts defined in `app/api/outreach/templates/`

**Backend Team** (sleepconnect):

- Implement stored procedures and Lambda functions per this spec
- Follow existing sleepconnect patterns for auth and error handling
- Deploy to SAXDBDEV first for testing

**Questions?**

- Reference: `specs/001-sms-outreach-integration/plan/contracts/sms-api.yaml`
- Frontend code: `twilio-conversations-react/app/templates/`
- Phase 6B reference: Similar implementation for template listing
