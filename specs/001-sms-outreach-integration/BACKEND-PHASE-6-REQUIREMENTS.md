# Backend Implementation Requirements - Phase 6 (Templates)

**Created**: December 9, 2025  
**Status**: REQUIRED - Frontend complete, backend missing  
**Priority**: HIGH - Blocks Phase 6 completion

---

## Problem Statement

Phase 6 frontend implementation is complete, but **all template-related Lambda functions and database infrastructure are missing**. The frontend makes API calls to non-existent Lambda endpoints.

### Current State

✅ **Frontend (twilio-conversations-react)**: 100% complete
- Components: TemplateSelector, TemplatePreview, QuickTemplateButton
- Hooks: useTemplates, useFrequentTemplates
- API Routes: All routes call Lambda endpoints
- Variable detection/validation: Fully implemented

❌ **Backend (sleepconnect)**: 0% complete
- Database schema: sms_templates table does not exist
- Stored procedures: None for templates
- Lambda functions: None for templates

---

## Required Database Schema

### Table: `sms_templates`

Location: `/home/dan/code/SAX/sleepconnect/database/migrations/sms/`

```sql
CREATE TABLE sms_templates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    practice_id UUID REFERENCES practices(id),
    owner_sax_id INTEGER, -- NULL for global templates
    name VARCHAR(255) NOT NULL,
    category VARCHAR(50) NOT NULL CHECK (category IN ('welcome', 'reminder', 'follow-up', 'education', 'general')),
    content TEXT NOT NULL,
    variables TEXT[], -- Array of variable names extracted from content
    usage_count INTEGER DEFAULT 0,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by INTEGER,
    updated_on TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_by INTEGER,
    archived_on TIMESTAMP WITH TIME ZONE,
    archived_by INTEGER,
    active BOOLEAN DEFAULT TRUE,
    
    -- Indexes
    CONSTRAINT sms_templates_tenant_name_unique UNIQUE (tenant_id, name, active) WHERE active = TRUE
);

CREATE INDEX idx_sms_templates_tenant ON sms_templates(tenant_id) WHERE active = TRUE;
CREATE INDEX idx_sms_templates_category ON sms_templates(category) WHERE active = TRUE;
CREATE INDEX idx_sms_templates_owner ON sms_templates(owner_sax_id) WHERE active = TRUE;
CREATE INDEX idx_sms_templates_usage ON sms_templates(usage_count DESC, last_used_at DESC) WHERE active = TRUE;
```

---

## Required Database Functions

Location: `/home/dan/code/SAX/sleepconnect/database/functions/sms/`

### 1. `get_sms_templates.sql`

```sql
CREATE OR REPLACE FUNCTION get_sms_templates(
    p_tenant_id UUID,
    p_practice_id UUID DEFAULT NULL,
    p_coordinator_sax_id INTEGER DEFAULT NULL,
    p_category VARCHAR(50) DEFAULT NULL,
    p_include_global BOOLEAN DEFAULT TRUE,
    p_limit INTEGER DEFAULT 100,
    p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    practice_id UUID,
    owner_sax_id INTEGER,
    name VARCHAR(255),
    category VARCHAR(50),
    content TEXT,
    variables TEXT[],
    usage_count INTEGER,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_on TIMESTAMP WITH TIME ZONE,
    created_by INTEGER,
    updated_on TIMESTAMP WITH TIME ZONE,
    updated_by INTEGER,
    archived_on TIMESTAMP WITH TIME ZONE,
    archived_by INTEGER,
    active BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id, t.tenant_id, t.practice_id, t.owner_sax_id,
        t.name, t.category, t.content, t.variables,
        t.usage_count, t.last_used_at,
        t.created_on, t.created_by, t.updated_on, t.updated_by,
        t.archived_on, t.archived_by, t.active
    FROM sms_templates t
    WHERE t.tenant_id = p_tenant_id
        AND t.active = TRUE
        AND (p_category IS NULL OR t.category = p_category)
        AND (
            (p_include_global AND t.owner_sax_id IS NULL) -- Global templates
            OR (t.practice_id = p_practice_id AND t.owner_sax_id = p_coordinator_sax_id) -- User's templates
        )
    ORDER BY t.name ASC
    LIMIT p_limit OFFSET p_offset;
END;
$$;
```

### 2. `get_frequent_sms_templates.sql`

```sql
CREATE OR REPLACE FUNCTION get_frequent_sms_templates(
    p_tenant_id UUID,
    p_practice_id UUID,
    p_coordinator_sax_id INTEGER,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    practice_id UUID,
    owner_sax_id INTEGER,
    name VARCHAR(255),
    category VARCHAR(50),
    content TEXT,
    variables TEXT[],
    usage_count INTEGER,
    last_used_at TIMESTAMP WITH TIME ZONE,
    created_on TIMESTAMP WITH TIME ZONE,
    active BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id, t.tenant_id, t.practice_id, t.owner_sax_id,
        t.name, t.category, t.content, t.variables,
        t.usage_count, t.last_used_at,
        t.created_on, t.active
    FROM sms_templates t
    WHERE t.tenant_id = p_tenant_id
        AND t.active = TRUE
        AND (
            t.owner_sax_id IS NULL -- Global templates
            OR (t.practice_id = p_practice_id AND t.owner_sax_id = p_coordinator_sax_id)
        )
        AND t.usage_count > 0 -- Only templates that have been used
    ORDER BY t.usage_count DESC, t.last_used_at DESC NULLS LAST
    LIMIT p_limit;
END;
$$;
```

### 3. `get_sms_template_by_id.sql`

```sql
CREATE OR REPLACE FUNCTION get_sms_template_by_id(
    p_template_id UUID,
    p_tenant_id UUID
)
RETURNS TABLE (
    id UUID,
    tenant_id UUID,
    practice_id UUID,
    owner_sax_id INTEGER,
    name VARCHAR(255),
    category VARCHAR(50),
    content TEXT,
    variables TEXT[],
    usage_count INTEGER,
    created_on TIMESTAMP WITH TIME ZONE,
    active BOOLEAN
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT 
        t.id, t.tenant_id, t.practice_id, t.owner_sax_id,
        t.name, t.category, t.content, t.variables,
        t.usage_count, t.created_on, t.active
    FROM sms_templates t
    WHERE t.id = p_template_id
        AND t.tenant_id = p_tenant_id
        AND t.active = TRUE;
END;
$$;
```

### 4. `increment_sms_template_usage.sql`

```sql
CREATE OR REPLACE FUNCTION increment_sms_template_usage(
    p_template_id UUID,
    p_tenant_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE sms_templates
    SET 
        usage_count = usage_count + 1,
        last_used_at = NOW()
    WHERE id = p_template_id
        AND tenant_id = p_tenant_id
        AND active = TRUE;
    
    RETURN FOUND;
END;
$$;
```

### 5. `insert_sms_template.sql` (Phase 7)

```sql
CREATE OR REPLACE FUNCTION insert_sms_template(
    p_tenant_id UUID,
    p_practice_id UUID,
    p_owner_sax_id INTEGER,
    p_name VARCHAR(255),
    p_category VARCHAR(50),
    p_content TEXT,
    p_created_by INTEGER
)
RETURNS UUID
LANGUAGE plpgsql
AS $$
DECLARE
    v_template_id UUID;
    v_variables TEXT[];
BEGIN
    -- Extract variables from content ({{variableName}})
    v_variables := (
        SELECT array_agg(DISTINCT matches[1])
        FROM regexp_matches(p_content, '\{\{(\w+)\}\}', 'g') AS matches
    );
    
    INSERT INTO sms_templates (
        tenant_id, practice_id, owner_sax_id,
        name, category, content, variables,
        created_by, updated_by
    ) VALUES (
        p_tenant_id, p_practice_id, p_owner_sax_id,
        p_name, p_category, p_content, COALESCE(v_variables, '{}'),
        p_created_by, p_created_by
    )
    RETURNING id INTO v_template_id;
    
    RETURN v_template_id;
END;
$$;
```

### 6. `update_sms_template.sql` (Phase 7)

```sql
CREATE OR REPLACE FUNCTION update_sms_template(
    p_template_id UUID,
    p_tenant_id UUID,
    p_name VARCHAR(255) DEFAULT NULL,
    p_category VARCHAR(50) DEFAULT NULL,
    p_content TEXT DEFAULT NULL,
    p_updated_by INTEGER DEFAULT NULL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
DECLARE
    v_variables TEXT[];
BEGIN
    -- Extract variables if content is being updated
    IF p_content IS NOT NULL THEN
        v_variables := (
            SELECT array_agg(DISTINCT matches[1])
            FROM regexp_matches(p_content, '\{\{(\w+)\}\}', 'g') AS matches
        );
    END IF;
    
    UPDATE sms_templates
    SET 
        name = COALESCE(p_name, name),
        category = COALESCE(p_category, category),
        content = COALESCE(p_content, content),
        variables = COALESCE(v_variables, variables),
        updated_on = NOW(),
        updated_by = COALESCE(p_updated_by, updated_by)
    WHERE id = p_template_id
        AND tenant_id = p_tenant_id
        AND active = TRUE;
    
    RETURN FOUND;
END;
$$;
```

### 7. `delete_sms_template.sql` (Phase 7)

```sql
CREATE OR REPLACE FUNCTION delete_sms_template(
    p_template_id UUID,
    p_tenant_id UUID,
    p_deleted_by INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
AS $$
BEGIN
    UPDATE sms_templates
    SET 
        active = FALSE,
        archived_on = NOW(),
        archived_by = p_deleted_by
    WHERE id = p_template_id
        AND tenant_id = p_tenant_id
        AND active = TRUE;
    
    RETURN FOUND;
END;
$$;
```

---

## Required Lambda Functions

Location: `/home/dan/code/SAX/sleepconnect/lambdas/lambda-sms-outreach/`

### 1. `get_sms_templates/` (T043)

**Endpoint**: `GET /outreach/templates`

**Handler**: `index.mjs`

```javascript
import pg from 'pg';
import { getSecret } from '../shared/secrets.mjs';

const { Pool } = pg;

export const handler = async (event) => {
    const headers = event.headers || {};
    const tenantId = headers['x-tenant-id'];
    const practiceId = headers['x-practice-id'];
    const coordinatorSaxId = headers['x-coordinator-sax-id'];
    
    const params = event.queryStringParameters || {};
    const category = params.category;
    const includeGlobal = params.includeGlobal !== 'false';
    const limit = parseInt(params.limit || '100', 10);
    const offset = parseInt(params.offset || '0', 10);
    
    if (!tenantId || !practiceId || !coordinatorSaxId) {
        return {
            statusCode: 400,
            body: JSON.stringify({ error: 'Missing required headers' })
        };
    }
    
    const secret = await getSecret();
    const pool = new Pool({
        host: process.env.HOST,
        port: parseInt(process.env.PORT || '5432'),
        database: process.env.PG_DB,
        user: secret.username,
        password: secret.password
    });
    
    try {
        const result = await pool.query(
            `SELECT * FROM get_sms_templates($1, $2, $3, $4, $5, $6, $7)`,
            [tenantId, practiceId, parseInt(coordinatorSaxId), category, includeGlobal, limit, offset]
        );
        
        return {
            statusCode: 200,
            body: JSON.stringify({ templates: result.rows })
        };
    } catch (error) {
        console.error('Error fetching templates:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Internal server error' })
        };
    } finally {
        await pool.end();
    }
};
```

### 2. `get_frequent_sms_templates/` (T043a)

**Endpoint**: `GET /outreach/templates/frequent`

Similar structure to above, calls `get_frequent_sms_templates()` function.

### 3. `get_sms_template_by_id/` (T044)

**Endpoint**: `GET /outreach/templates/{templateId}`

Calls `get_sms_template_by_id()` function.

### 4. `increment_template_usage/` (T048)

**Endpoint**: `POST /outreach/templates/{templateId}/usage`

Calls `increment_sms_template_usage()` function.

### 5. `insert_sms_template/` (Phase 7 - T051)

**Endpoint**: `POST /outreach/templates`

### 6. `update_sms_template/` (Phase 7 - T052)

**Endpoint**: `PATCH /outreach/templates/{templateId}`

### 7. `delete_sms_template/` (Phase 7 - T052)

**Endpoint**: `DELETE /outreach/templates/{templateId}`

---

## Implementation Order

### Phase 6A: Backend Foundation (REQUIRED for Phase 6 frontend to work)

1. **Database Migration** - Create `sms_templates` table
2. **Core Stored Procedures**:
   - `get_sms_templates.sql`
   - `get_frequent_sms_templates.sql`
   - `get_sms_template_by_id.sql`
   - `increment_sms_template_usage.sql`
3. **Lambda Functions**:
   - `get_sms_templates/` (T043 backend)
   - `get_frequent_sms_templates/` (T043a backend)
   - `get_sms_template_by_id/` (T044 backend)
   - `increment_template_usage/` (T048 backend)
4. **Seed Data** - Create default global templates
5. **Deploy & Test** - Deploy to development environment

### Phase 7A: Template Management Backend (REQUIRED for Phase 7)

6. **Template CRUD Stored Procedures**:
   - `insert_sms_template.sql`
   - `update_sms_template.sql`
   - `delete_sms_template.sql`
7. **Lambda Functions**:
   - `insert_sms_template/` (T051 backend)
   - `update_sms_template/` (T052 backend)
   - `delete_sms_template/` (T052 backend)

---

## Seed Data Templates

Location: `/home/dan/code/SAX/sleepconnect/database/migrations/sms/seed-templates.sql`

```sql
-- Global welcome templates
INSERT INTO sms_templates (tenant_id, practice_id, owner_sax_id, name, category, content, created_by) VALUES
(
    'GLOBAL_TENANT_ID', -- Replace with actual global tenant ID
    NULL,
    NULL,
    'Welcome New Patient',
    'welcome',
    'Hi {{firstName}}, this is {{coordinatorName}} from Sleep Architects. Welcome! We''re here to help you with your sleep health journey.',
    0
),
(
    'GLOBAL_TENANT_ID',
    NULL,
    NULL,
    'Appointment Reminder',
    'reminder',
    'Hi {{firstName}}, this is a reminder about your appointment on {{appointmentDate}} at {{appointmentTime}}. Please reply CONFIRM to confirm.',
    0
),
(
    'GLOBAL_TENANT_ID',
    NULL,
    NULL,
    'Follow-up Check-in',
    'follow-up',
    'Hi {{firstName}}, checking in to see how you''re doing with your CPAP therapy. Any questions or concerns?',
    0
);
```

---

## Testing Plan

### Database Function Tests

```sql
-- Test get_sms_templates
SELECT * FROM get_sms_templates(
    'tenant-uuid'::UUID,
    'practice-uuid'::UUID,
    1234,
    NULL,
    TRUE,
    100,
    0
);

-- Test increment usage
SELECT increment_sms_template_usage('template-uuid'::UUID, 'tenant-uuid'::UUID);

-- Verify usage count incremented
SELECT usage_count, last_used_at FROM sms_templates WHERE id = 'template-uuid'::UUID;
```

### Lambda Function Tests

Use existing test scripts pattern from `/home/dan/code/SAX/sleepconnect/lambdas/lambda-sms-outreach/test-lambdas.sh`

---

## File Locations Summary

### sleepconnect Repository

```
/home/dan/code/SAX/sleepconnect/
├── database/
│   ├── migrations/sms/
│   │   └── 006_sms_templates.sql (NEW)
│   │   └── seed-templates.sql (NEW)
│   └── functions/sms/
│       ├── get_sms_templates.sql (NEW)
│       ├── get_frequent_sms_templates.sql (NEW)
│       ├── get_sms_template_by_id.sql (NEW)
│       ├── increment_sms_template_usage.sql (NEW)
│       ├── insert_sms_template.sql (NEW - Phase 7)
│       ├── update_sms_template.sql (NEW - Phase 7)
│       └── delete_sms_template.sql (NEW - Phase 7)
└── lambdas/lambda-sms-outreach/
    ├── get_sms_templates/ (NEW)
    │   ├── index.mjs
    │   └── package.json
    ├── get_frequent_sms_templates/ (NEW)
    │   ├── index.mjs
    │   └── package.json
    ├── get_sms_template_by_id/ (NEW)
    │   ├── index.mjs
    │   └── package.json
    ├── increment_template_usage/ (NEW)
    │   ├── index.mjs
    │   └── package.json
    ├── insert_sms_template/ (NEW - Phase 7)
    ├── update_sms_template/ (NEW - Phase 7)
    └── delete_sms_template/ (NEW - Phase 7)
```

---

## Next Steps

1. **Create GitHub Issue** in sleepconnect repository: "SMS Templates Backend Infrastructure"
2. **Implement Phase 6A** (database + Lambda functions) in sleepconnect
3. **Deploy to Development** environment
4. **Test Integration** with existing twilio-conversations-react frontend
5. **Mark Phase 6 Complete** once backend is deployed and working
6. **Implement Phase 7A** for template CRUD operations

---

## Notes

- All Lambda functions follow existing naming convention: `sax-lam-us-east-1-1x-p-0x-sms-*`
- Database functions follow existing SMS outreach patterns
- Template variables use `{{variableName}}` syntax (mustache-style)
- Global templates have `owner_sax_id = NULL` and `practice_id = NULL`
- User templates have `owner_sax_id` set to coordinator's SAX ID
