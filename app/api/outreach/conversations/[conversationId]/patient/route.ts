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
import { getSession } from "@auth0/nextjs-auth0";
import { api } from "@/lib/api";

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
 * @param params - Route parameters containing conversationId
 * @returns Patient context or error response
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { conversationId: string } },
) {
  try {
    // Verify authentication
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = params;

    // Fetch patient context from Lambda API
    // The Lambda API will query the conversation record and join with patient data
    const response = await api.get(
      `/api/outreach/conversations/${conversationId}/patient`,
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
 * @param params - Route parameters containing conversationId
 * @returns Success response or error
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: { conversationId: string } },
) {
  try {
    // Verify authentication
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { conversationId } = params;

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
      `/api/outreach/conversations/${conversationId}/patient`,
      { patient_id },
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
