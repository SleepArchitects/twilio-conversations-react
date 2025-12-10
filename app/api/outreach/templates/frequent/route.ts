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
 * Lambda template format
 * Supports both camelCase (standard Lambda) and snake_case with out_ prefix (raw stored proc)
 */
interface LambdaTemplate {
  // Standard Lambda response (camelCase)
  id?: string;
  tenantId?: string;
  practiceId?: string | null;
  name?: string;
  content?: string;
  category?: string;
  usageCount?: number;
  createdAt?: string;
  updatedAt?: string;
  active?: boolean;
  variables?: string[];

  // Raw stored procedure response (snake_case with out_ prefix)
  out_id?: string;
  out_tenant_id?: string;
  out_practice_id?: string | null;
  out_category_id?: string | null;
  out_category_name?: string;
  out_name?: string;
  out_content?: string;
  out_is_default?: boolean;
  out_usage_count?: number;
  out_active?: boolean;
  out_created_by?: string | null;
  out_updated_by?: string | null;
  out_created_on?: string;
  out_updated_on?: string;
}

/**
 * Lambda templates response format
 */
interface LambdaTemplatesResponse {
  templates: LambdaTemplate[];
}

/**
 * Extract variables from template content
 * Looks for {variable_name} tokens
 */
function extractVariables(content: string): string[] {
  const regex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  const variables: string[] = [];
  let match;
  while ((match = regex.exec(content)) !== null) {
    if (!variables.includes(match[1])) {
      variables.push(match[1]);
    }
  }
  return variables;
}

/**
 * Transform Lambda template to frontend Template
 * Handles both camelCase and out_ prefix formats
 */
function transformTemplate(template: LambdaTemplate): Template {
  const content = template.content ?? template.out_content ?? "";

  return {
    id: template.id ?? template.out_id ?? "",
    tenantId: template.tenantId ?? template.out_tenant_id ?? "",
    practiceId: template.practiceId ?? template.out_practice_id ?? null,
    ownerSaxId: null,
    name: template.name ?? template.out_name ?? "",
    category: (template.category ??
      template.out_category_name ??
      "general") as TemplateCategory,
    content: content,
    variables: template.variables ?? extractVariables(content),
    usageCount: template.usageCount ?? template.out_usage_count ?? 0,
    createdOn:
      template.createdAt ?? template.out_created_on ?? new Date().toISOString(),
    createdBy: null,
    updatedOn:
      template.updatedAt ?? template.out_updated_on ?? new Date().toISOString(),
    updatedBy: null,
    archivedOn: null,
    archivedBy: null,
    active: template.active ?? template.out_active ?? true,
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
      // Based on PHASE-6B-BACKEND-HANDOVER.md:
      // GET /outreach/templates/frequent?tenant_id=X&practice_id=Y&limit=N
      const queryParams: Record<string, string> = {
        tenant_id: userContext.tenantId,
        practice_id: userContext.practiceId,
        limit: String(limit),
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
