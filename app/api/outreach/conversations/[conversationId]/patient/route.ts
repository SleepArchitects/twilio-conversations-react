/**
 * Patient Linking API Route
 *
 * GET /api/outreach/conversations/:conversationId/patient
 * - Fetch patient context for a linked conversation
 *
 * PATCH /api/outreach/conversations/:conversationId/patient
 * - Link a patient to a conversation
 *
 * @see FR-039 - Display patient context in conversation header
 * @see FR-041 - Link patient to conversation
 * @see T202 - Patient linking API implementation
 */

import { NextRequest, NextResponse } from "next/server";
import { type UserContext, withUserContext } from "@/lib/auth";
import { api, buildPath } from "@/lib/api";

/**
 * Lambda API base path for SMS outreach
 */
const LAMBDA_API_BASE = "/outreach";

/**
 * Get headers for Lambda API calls with user context
 */
function getLambdaHeaders(userContext: UserContext): Record<string, string> {
  return {
    "x-tenant-id": userContext.tenantId,
    "x-practice-id": userContext.practiceId,
    "x-coordinator-sax-id": String(userContext.saxId),
  };
}

// =============================================================================
// Type Definitions
// =============================================================================

interface PatientContext {
  patient_id: string;
  first_name: string;
  last_name: string;
  dob: string | null;
}

interface LinkPatientRequest {
  patient_id: string;
}

// =============================================================================
// GET - Fetch Patient Context
// =============================================================================

/**
 * Fetch patient context for a conversation
 *
 * Returns patient demographic information if the conversation is linked to a patient.
 * Returns 404 if conversation is not linked to a patient.
 *
 * @param request - Next.js request object
 * @param userContext - User context from authentication
 * @param conversationId - Conversation ID from route params
 * @returns Patient context or error response
 */
async function handleGet(
  request: NextRequest,
  userContext: UserContext,
  conversationId: string,
) {
  try {
    // Fetch patient context from Lambda API
    // The Lambda API will query the conversation record and join with patient data
    const response = await api.get(
      buildPath(LAMBDA_API_BASE, "conversations", conversationId, "patient"),
      {
        params: {
          tenant_id: userContext.tenantId,
          practice_id: userContext.practiceId,
          coordinator_sax_id: String(userContext.saxId),
        },
        headers: getLambdaHeaders(userContext),
      },
    );

    const patientContext = response as PatientContext;

    return NextResponse.json(patientContext, { status: 200 });
  } catch (error: unknown) {
    console.error(
      "[GET /api/outreach/conversations/:id/patient] Error:",
      error,
    );

    // Handle API errors
    if (error && typeof error === "object" && "status" in error) {
      const apiError = error as { status: number; message?: string };
      if (apiError.status === 404) {
        return NextResponse.json(
          { error: "Patient not linked to this conversation" },
          { status: 404 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to fetch patient context" },
      { status: 500 },
    );
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
): Promise<NextResponse> {
  const { conversationId } = await params;

  const handler = withUserContext(async (request, userContext) => {
    return handleGet(request as NextRequest, userContext, conversationId);
  });

  return handler(req) as Promise<NextResponse>;
}

// =============================================================================
// PATCH - Link Patient to Conversation
// =============================================================================

/**
 * Link a patient to a conversation
 *
 * Updates the conversation record to associate it with a patient from SleepConnect.
 * This enables patient context display in the conversation header.
 *
 * @param request - Next.js request object with patient_id in body
 * @param userContext - User context from authentication
 * @param conversationId - Conversation ID from route params
 * @returns Success response or error
 */
async function handlePatch(
  request: NextRequest,
  userContext: UserContext,
  conversationId: string,
) {
  try {
    // Parse request body
    const body = (await request.json()) as LinkPatientRequest;
    const { patient_id } = body;

    // Validate request
    if (!patient_id) {
      return NextResponse.json(
        { error: "patient_id is required" },
        { status: 400 },
      );
    }

    // Link patient via Lambda API
    // The Lambda API will:
    // 1. Validate patient exists in SleepConnect
    // 2. Update conversation record with patient_id
    // 3. Return updated conversation with patient context
    const response = await api.patch(
      buildPath(LAMBDA_API_BASE, "conversations", conversationId, "patient"),
      {
        patient_id,
        tenant_id: userContext.tenantId,
        practice_id: userContext.practiceId,
        coordinator_sax_id: String(userContext.saxId),
      },
      {
        headers: getLambdaHeaders(userContext),
      },
    );

    return NextResponse.json(response, { status: 200 });
  } catch (error: unknown) {
    console.error(
      "[PATCH /api/outreach/conversations/:id/patient] Error:",
      error,
    );

    // Handle API errors
    if (error && typeof error === "object" && "status" in error) {
      const apiError = error as { status: number; message?: string };

      if (apiError.status === 404) {
        return NextResponse.json(
          { error: "Conversation or patient not found" },
          { status: 404 },
        );
      }

      if (apiError.status === 400) {
        return NextResponse.json(
          { error: apiError.message || "Invalid request" },
          { status: 400 },
        );
      }
    }

    return NextResponse.json(
      { error: "Failed to link patient to conversation" },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ conversationId: string }> },
): Promise<NextResponse> {
  const { conversationId } = await params;

  const handler = withUserContext(async (request, userContext) => {
    return handlePatch(request as NextRequest, userContext, conversationId);
  });

  return handler(req) as Promise<NextResponse>;
}
