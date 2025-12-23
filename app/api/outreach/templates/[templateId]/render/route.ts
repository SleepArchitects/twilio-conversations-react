import { NextResponse } from "next/server";
import { ApiError, api, buildPath } from "@/lib/api";
import { type UserContext, withUserContext, getAccessToken } from "@/lib/auth";
import type {
  RenderTemplateRequest,
  // RenderTemplateResponse,
} from "@/types/sms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lambda API base path for SMS outreach
 */
const LAMBDA_API_BASE = "/outreach";

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
  created_on: string;
  active: boolean;
}

/**
 * Lambda render template request format
 */
interface LambdaRenderRequest {
  variables: Record<string, string>;
}

/**
 * Lambda render template response format
 */
interface LambdaRenderResponse {
  rendered_content: string;
  character_count?: number;
  segment_count?: number;
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
 * Extract variable names from template content using {{variable}} pattern
 */
function extractVariables(content: string): string[] {
  const variablePattern = /\{\{(\w+)\}\}/g;
  const variables = new Set<string>();
  let match;

  while ((match = variablePattern.exec(content)) !== null) {
    variables.add(match[1]);
  }

  return Array.from(variables);
}

/**
 * POST /api/outreach/templates/[templateId]/render
 *
 * Render template content with provided variable values.
 * Returns the final message text ready to send.
 *
 * Request Body:
 * - variables: Record<string, string> - Variable values to substitute
 *
 * @returns RenderTemplateResponse with renderedContent, characterCount, segmentCount
 */
export const POST = withUserContext(
  async (req: Request, userContext: UserContext) => {
    // Extract templateId from URL path
    const url = new URL(req.url);
    const pathParts = url.pathname.split("/");
    const templateIdIndex = pathParts.indexOf("templates") + 1;
    const templateId = pathParts[templateIdIndex];

    if (!templateId) {
      return errorResponse(
        "TEMPLATE_ID_REQUIRED",
        "Template ID is required",
        400,
      );
    }

    try {
      // Parse and validate request body
      let body: RenderTemplateRequest;
      try {
        const requestBody = await req.json();
        body = {
          templateId,
          variables: requestBody.variables || {},
        };
      } catch {
        return errorResponse("INVALID_JSON", "Invalid JSON body", 400);
      }

      // Validate variables is an object
      if (!body.variables || typeof body.variables !== "object") {
        return errorResponse(
          "INVALID_VARIABLES",
          "Variables must be an object",
          400,
        );
      }

      // Get template first to validate access and extract required variables
      let template: LambdaTemplate;
      try {
        // Get access token for Authorization header
        const accessToken = await getAccessToken();
        const headers: Record<string, string> = getLambdaHeaders(userContext);
        if (accessToken) {
          headers["Authorization"] = `Bearer ${accessToken}`;
        }

        template = await api.get<LambdaTemplate>(
          buildPath(LAMBDA_API_BASE, "templates", templateId),
          {
            params: {
              tenant_id: userContext.tenantId,
              practice_id: userContext.practiceId,
              coordinator_sax_id: userContext.saxId,
            },
            headers,
          },
        );
      } catch (error) {
        if (error instanceof ApiError && error.status === 404) {
          return errorResponse("TEMPLATE_NOT_FOUND", "Template not found", 404);
        }
        throw error;
      }

      // Verify template access (must be global or owned by coordinator)
      if (
        template.tenant_id !== userContext.tenantId ||
        (template.practice_id !== null &&
          template.practice_id !== userContext.practiceId) ||
        (template.owner_sax_id !== null &&
          template.owner_sax_id !== userContext.saxId)
      ) {
        return errorResponse(
          "FORBIDDEN",
          "You don't have permission to access this template",
          403,
        );
      }

      // Extract required variables from template content
      const requiredVariables = extractVariables(template.content);
      const providedVariables = Object.keys(body.variables || {});

      // Check for missing required variables
      const missingVariables = requiredVariables.filter(
        (varName) => !providedVariables.includes(varName),
      );

      if (missingVariables.length > 0) {
        return errorResponse(
          "MISSING_VARIABLES",
          `Missing required variables: ${missingVariables.join(", ")}`,
          400,
        );
      }

      // Call Lambda API to render template
      const renderPayload: LambdaRenderRequest = {
        variables: body.variables,
      };

      // Get access token for Authorization header
      const accessToken = await getAccessToken();
      const headers: Record<string, string> = getLambdaHeaders(userContext);
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`;
      }

      const lambdaResponse = await api.post<LambdaRenderResponse>(
        buildPath(LAMBDA_API_BASE, "templates", templateId, "render"),
        renderPayload,
        {
          headers,
        },
      );

      // Transform Lambda response to match API spec format
      // API spec uses renderedContent, characterCount, segmentCount
      const response = {
        renderedContent: lambdaResponse.rendered_content,
        characterCount:
          lambdaResponse.character_count ||
          lambdaResponse.rendered_content.length,
        segmentCount: lambdaResponse.segment_count || 1,
      };

      return NextResponse.json(response, { status: 200 });
    } catch (error) {
      // Log error without PHI
      console.error("Failed to render template", {
        templateId,
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

      return errorResponse("INTERNAL_ERROR", "Failed to render template", 500);
    }
  },
);
