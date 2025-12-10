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
 * Lambda template format from API response
 * Note: Lambda returns camelCase, not snake_case with out_ prefix
 */
interface LambdaTemplate {
  id: string;
  tenantId: string;
  practiceId: string | null;
  ownerSaxId: string | null;
  name: string;
  category: string;
  content: string;
  variables: string[];
  usageCount: number;
  createdAt: string;
  updatedAt: string;
  active: boolean;
}

/**
 * Lambda templates response format
 */
interface LambdaTemplatesResponse {
  templates: LambdaTemplate[];
}

/**
 * Transform Lambda template to frontend Template format
 * Lambda already returns camelCase, just need to rename timestamp fields
 */
function transformTemplate(template: LambdaTemplate): Template {
  return {
    id: template.id,
    tenantId: template.tenantId,
    practiceId: template.practiceId,
    ownerSaxId: template.ownerSaxId ? Number(template.ownerSaxId) : null,
    name: template.name,
    category: template.category as TemplateCategory,
    content: template.content,
    variables: template.variables,
    usageCount: template.usageCount || 0,
    createdOn: template.createdAt,
    createdBy: null, // Not returned by Lambda
    updatedOn: template.updatedAt,
    updatedBy: null, // Not returned by Lambda
    archivedOn: null, // Not returned by Lambda
    archivedBy: null, // Not returned by Lambda
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
 * GET /api/outreach/templates
 *
 * List available templates for the coordinator.
 * Includes global templates and coordinator-specific templates.
 *
 * Query Parameters:
 * - category: TemplateCategory (optional) - Filter by category
 * - includeGlobal: boolean (default true) - Include tenant-wide global templates
 *
 * @returns { data: Template[] }
 */
export const GET = withUserContext(
  async (req: Request, userContext: UserContext) => {
    console.log(`[TEMPLATES API] START`);
    try {
      const { searchParams } = new URL(req.url);
      const category = searchParams.get("category");
      // const includeGlobalParam = searchParams.get("includeGlobal");
      // const includeGlobal =
      //   includeGlobalParam === null || includeGlobalParam === "true";

      // Build query parameters for Lambda API
      // Based on PHASE-6B-BACKEND-HANDOVER.md:
      // GET /outreach/templates?tenant_id=X&practice_id=Y&category_id=Z (optional)
      const queryParams: Record<string, string> = {
        tenant_id: userContext.tenantId,
        practice_id: userContext.practiceId,
      };

      // Note: Backend stored procedure accepts category_id (UUID), not category name
      // For now, we'll omit category filtering until we have category mapping
      // TODO: Add category name -> category_id lookup when implementing full template management
      if (category) {
        // Validate category name
        const validCategories: TemplateCategory[] = [
          "welcome",
          "reminder",
          "follow-up",
          "education",
          "general",
        ];
        if (!validCategories.includes(category as TemplateCategory)) {
          return errorResponse(
            "INVALID_CATEGORY",
            `Invalid category. Must be one of: ${validCategories.join(", ")}`,
            400,
          );
        }
        // TODO: Map category name to category_id UUID and add to queryParams
        // queryParams.category_id = categoryNameToId(category);
      }

      // Call Lambda API to get templates
      const lambdaResponse = await api.get<LambdaTemplatesResponse>(
        buildPath(LAMBDA_API_BASE, "templates"),
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
      console.error("Failed to fetch templates", {
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

      return errorResponse("INTERNAL_ERROR", "Failed to fetch templates", 500);
    }
  },
);
