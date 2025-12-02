import { NextResponse } from "next/server";
import { getSession, withApiAuthRequired, SaxClaims } from "@/lib/auth";
import { generateAccessToken } from "@/lib/twilio";

// Token TTL in seconds (1 hour)
const TOKEN_TTL = 3600;

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/outreach/token
 *
 * Generates a Twilio access token for authenticated users.
 * The token is used by the Twilio Conversations SDK on the frontend.
 *
 * @returns { token: string, identity: string, expiresAt: string }
 */
export const POST = withApiAuthRequired(async () => {
  try {
    // Get the authenticated user's session
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = session.user as SaxClaims;
    const saxId = user.sax_id;

    if (!saxId) {
      return NextResponse.json(
        { error: "User SAX ID not found in session" },
        { status: 401 },
      );
    }

    // Use sax_id as the identity for Twilio
    const identity = String(saxId);

    // Generate the Twilio access token
    const token = generateAccessToken(identity);

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + TOKEN_TTL * 1000).toISOString();

    return NextResponse.json(
      {
        token,
        identity,
        expiresAt,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("Error generating Twilio access token:", error);

    // Check for specific Twilio configuration errors
    if (error instanceof Error && error.message.includes("Missing")) {
      return NextResponse.json(
        { error: "Twilio configuration error" },
        { status: 500 },
      );
    }

    return NextResponse.json(
      { error: "Failed to generate access token" },
      { status: 500 },
    );
  }
});
