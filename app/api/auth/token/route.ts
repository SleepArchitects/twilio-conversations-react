import { NextResponse } from "next/server";
import { headers } from "next/headers";
export const dynamic = "force-dynamic";
export async function GET() {
  const baseUrl =
    process.env.NEXT_PUBLIC_SLEEPCONNECT_URL || "http://localhost:3000";
  const tokenUrl = `${baseUrl}/api/auth/token`;
  const headersList = headers();
  const cookieHeader = headersList.get("cookie") || "";
  const response = await fetch(tokenUrl, {
    method: "GET",
    headers: { cookie: cookieHeader },
  });
  if (!response.ok) {
    return NextResponse.json(
      {
        error: {
          code: "UNAUTHORIZED",
          message: "Failed to fetch access token",
        },
      },
      { status: response.status },
    );
  }
  const data = await response.json();
  return NextResponse.json(data);
}
