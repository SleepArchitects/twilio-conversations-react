import { NextResponse } from "next/server";
import { ApiError, api, buildPath } from "@/lib/api";
import { type UserContext, withUserContext } from "@/lib/auth";
import type { Template, TemplateCategory } from "@/types/sms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lambda API base path for SMS outreach
 */
const LAMBDA_API_BASE = "/outreach";

/**
 * Default limit for frequent templates
 */
const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 20;

/**
 * Lambda template format (snake_case from database)
 */
interface LambdaTemplate {
  id: string;
  tenant_id: string;
  practice_id: string | null;
  owner_sax_id: number | null;
  name: string;
  category: string;
  content: string;
  variables: string[];
  usage_count: number;
  last_used_at: string | null;
  created_on: string;
  created_by: number | null;
  updated_on: string;
  updated_by: number | null;
  archived_on: string | null;
  archived_by: number | null;
  active: boolean;
}

/**
 * Lambda templates response format
 */
interface LambdaTemplatesResponse {
  templates: LambdaTemplate[];
}

/**
 * Transform Lambda template (snake_case) to frontend Template (camelCase)
 */
function transformTemplate(template: LambdaTemplate): Template {
  return {
    id: template.id,
    tenantId: template.tenant_id,
    practiceId: template.practice_id,
    ownerSaxId: template.owner_sax_id,
    name: template.name,
    category: template.category as TemplateCategory,
    content: template.content,
    variables: template.variables || [],
    usageCount: template.usage_count || 0,
    createdOn: template.created_on,
    createdBy: template.created_by,
    updatedOn: template.updated_on,
    updatedBy: template.updated_by,
    archivedOn: template.archived_on,
    archivedBy: template.archived_by,
    active: template.active ?? true,
  };
}

/**
 * Get Lambda API headers with user context
 */
function getLambdaHeaders(userContext: UserContext): Record<string, string> {
  return {
    "x-tenant-id": userContext.tenantId,
    "x-practice-id": userContext.practiceId,
    "x-coordinator-sax-id": String(userContext.saxId),
  };
}

/**
 * Create standardized error response
 */
function errorResponse(
  code: string,
  message: string,
  status: number,
): NextResponse {
  return NextResponse.json(
    {
      code,
      message,
    },
    { status },
  );
}

/**
 * GET /api/outreach/templates/frequent
 *
 * Get frequently used templates for the current coordinator.
 * Returns top N templates used in last 7 days (recent) OR top usage count last 30 days (frequent).
 *
 * Query Parameters:
 * - limit: number (default 10, max 20) - Maximum number of templates to return
 *
 * @returns { data: Template[] }
 */
export const GET = withUserContext(
  async (req: Request, userContext: UserContext) => {
    try {
      const { searchParams } = new URL(req.url);
      let limit = parseInt(
        searchParams.get("limit") || String(DEFAULT_LIMIT),
        10,
      );

      // Validate and clamp limit
      if (Number.isNaN(limit) || limit < 1) limit = DEFAULT_LIMIT;
      if (limit > MAX_LIMIT) limit = MAX_LIMIT;

      // Build query parameters for Lambda API
      const queryParams: Record<string, string | number | undefined> = {
        tenant_id: userContext.tenantId,
        practice_id: userContext.practiceId,
        coordinator_sax_id: userContext.saxId,
        limit,
      };

      // Call Lambda API to get frequent templates
      const lambdaResponse = await api.get<LambdaTemplatesResponse>(
        buildPath(LAMBDA_API_BASE, "templates", "frequent"),
        {
          params: queryParams,
          headers: getLambdaHeaders(userContext),
        },
      );

      // Transform Lambda response (snake_case) to frontend format (camelCase)
      const templates = (lambdaResponse.templates || []).map(transformTemplate);

      return NextResponse.json({ data: templates }, { status: 200 });
    } catch (error) {
      // Log error without PHI
      console.error("Failed to fetch frequent templates", {
        saxId: userContext.saxId,
        tenantId: userContext.tenantId,
        errorType: error instanceof Error ? error.name : "Unknown",
      });

      if (error instanceof ApiError) {
        return NextResponse.json(
          { code: error.code, message: error.message },
          { status: error.status },
        );
      }

      return errorResponse(
        "INTERNAL_ERROR",
        "Failed to fetch frequent templates",
        500,
      );
    }
  },
);
