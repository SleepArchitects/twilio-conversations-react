import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";

// Force dynamic rendering - this route should never be cached
export const dynamic = "force-dynamic";
export const revalidate = 0;

/**
 * Simple session check endpoint for client-side auth verification
 * Returns user context if valid session exists
 */
export async function GET() {
  const headers = {
    "Cache-Control": "no-store, no-cache, must-revalidate",
    Pragma: "no-cache",
  };

  try {
    const session = await getSession();

    if (!session?.user) {
      return NextResponse.json(
        { authenticated: false },
        { status: 401, headers },
      );
    }

    const user = session.user as {
      sax_id: number;
      tenant_id: string;
      practice_id: string;
      email?: string;
      name?: string;
    };

    return NextResponse.json(
      {
        authenticated: true,
        sax_id: user.sax_id,
        tenant_id: user.tenant_id,
        practice_id: user.practice_id,
      },
      { headers },
    );
  } catch (error) {
    console.error("[Session API] Error checking session:", error);
    return NextResponse.json(
      { authenticated: false },
      { status: 401, headers },
    );
  }
}
