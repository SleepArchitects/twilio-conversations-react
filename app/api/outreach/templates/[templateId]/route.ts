import { NextRequest, NextResponse } from "next/server";
import { ApiError, api, buildPath } from "@/lib/api";
import { type UserContext, withUserContext, getAccessToken } from "@/lib/auth";
import type {
  Template,
  TemplateCategory,
  UpdateTemplateRequest,
} from "@/types/sms";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Lambda API base path for SMS outreach
 */
const LAMBDA_API_BASE = "/outreach";

/**
 * Lambda template format from API response
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
 * Transform Lambda template to frontend Template format
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
    createdBy: null,
    updatedOn: template.updatedAt,
    updatedBy: null,
    archivedOn: null,
    archivedBy: null,
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
    "x-user-sax-id": String(userContext.saxId),
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
 * GET /api/outreach/templates/[templateId]
 *
 * Get a single template by ID.
 *
 * @returns { data: Template }
 */
async function handleGet(
  req: NextRequest,
  userContext: UserContext,
  templateId: string,
): Promise<NextResponse> {
  console.log(`[TEMPLATES API] GET ${templateId}`);
  try {
    if (!templateId) {
      return errorResponse("INVALID_REQUEST", "Template ID is required", 400);
    }

    // Get access token for Authorization header
    const accessToken = await getAccessToken();
    const headers: Record<string, string> = getLambdaHeaders(userContext);
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    // Call Lambda API to get template
    const lambdaResponse = await api.get<LambdaTemplate>(
      buildPath(LAMBDA_API_BASE, "templates", templateId),
      {
        headers,
      },
    );

    // Transform Lambda response to frontend format
    const template = transformTemplate(lambdaResponse);

    return NextResponse.json({ data: template }, { status: 200 });
  } catch (error) {
    console.error("Failed to fetch template", {
      saxId: userContext.saxId,
      tenantId: userContext.tenantId,
      templateId: templateId,
      errorType: error instanceof Error ? error.name : "Unknown",
    });

    if (error instanceof ApiError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }

    return errorResponse("INTERNAL_ERROR", "Failed to fetch template", 500);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
): Promise<NextResponse> {
  const { templateId } = await params;

  const handler = withUserContext(async (request, userContext) => {
    return handleGet(request, userContext, templateId);
  });

  return handler(req) as Promise<NextResponse>;
}

/**
 * PATCH /api/outreach/templates/[templateId]
 *
 * Update an existing template.
 *
 * Request Body: UpdateTemplateRequest
 *
 * @returns { data: Template }
 */
async function handlePatch(
  req: NextRequest,
  userContext: UserContext,
  templateId: string,
): Promise<NextResponse> {
  console.log(`[TEMPLATES API] UPDATE ${templateId}`);
  try {
    if (!templateId) {
      return errorResponse("INVALID_REQUEST", "Template ID is required", 400);
    }

    const body = (await req.json()) as UpdateTemplateRequest;

    // Get access token for Authorization header
    const accessToken = await getAccessToken();
    const headers: Record<string, string> = getLambdaHeaders(userContext);
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    // Call Lambda API to update template
    const lambdaResponse = await api.patch<LambdaTemplate>(
      buildPath(LAMBDA_API_BASE, "templates", templateId),
      {
        name: body.name,
        content: body.content ?? body.body,
        category: body.category,
        variables: body.variables,
      },
      {
        headers,
      },
    );

    // Transform Lambda response to frontend format
    const template = transformTemplate(lambdaResponse);

    return NextResponse.json({ data: template }, { status: 200 });
  } catch (error) {
    console.error("Failed to update template", {
      saxId: userContext.saxId,
      tenantId: userContext.tenantId,
      templateId: templateId,
      errorType: error instanceof Error ? error.name : "Unknown",
    });

    if (error instanceof ApiError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }

    return errorResponse("INTERNAL_ERROR", "Failed to update template", 500);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
): Promise<NextResponse> {
  const { templateId } = await params;

  const handler = withUserContext(async (request, userContext) => {
    return handlePatch(request, userContext, templateId);
  });

  return handler(req) as Promise<NextResponse>;
}

/**
 * DELETE /api/outreach/templates/[templateId]
 *
 * Delete (soft delete) a template.
 *
 * @returns { success: boolean }
 */
async function handleDelete(
  req: NextRequest,
  userContext: UserContext,
  templateId: string,
): Promise<NextResponse> {
  console.log(`[TEMPLATES API] DELETE ${templateId}`);
  try {
    if (!templateId) {
      return errorResponse("INVALID_REQUEST", "Template ID is required", 400);
    }

    // Get access token for Authorization header
    const accessToken = await getAccessToken();
    const headers: Record<string, string> = getLambdaHeaders(userContext);
    if (accessToken) {
      headers["Authorization"] = `Bearer ${accessToken}`;
    }

    // Call Lambda API to delete template
    await api.delete(buildPath(LAMBDA_API_BASE, "templates", templateId), {
      headers,
    });

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (error) {
    console.error("Failed to delete template", {
      saxId: userContext.saxId,
      tenantId: userContext.tenantId,
      templateId: templateId,
      errorType: error instanceof Error ? error.name : "Unknown",
    });

    if (error instanceof ApiError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.status },
      );
    }

    return errorResponse("INTERNAL_ERROR", "Failed to delete template", 500);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ templateId: string }> },
): Promise<NextResponse> {
  const { templateId } = await params;

  const handler = withUserContext(async (request, userContext) => {
    return handleDelete(request, userContext, templateId);
  });

  return handler(req) as Promise<NextResponse>;
}
