import { jwtVerify } from "jose";

/**
 * User context data stored in JWT
 */
export interface UserContext {
  email: string;
  name: string;
  practice_id: string;
  practice_name?: string;
  sax_id: number;
  tenant_id: string;
}

/**
 * Get JWT secret as Uint8Array for jose
 */
function getJwtSecret(): Uint8Array {
  const secret = process.env.AUTH0_CLIENT_SECRET;
  if (!secret) {
    throw new Error("AUTH0_CLIENT_SECRET environment variable is required");
  }
  return new TextEncoder().encode(secret);
}

/**
 * Verify and decode a user context JWT token
 * Uses jose library which is compatible with Edge Runtime
 *
 * @param token - JWT token to verify
 * @returns Decoded user context or null if invalid
 */
export async function verifyUserContextToken(
  token: string,
): Promise<UserContext | null> {
  try {
    const secret = getJwtSecret();

    const { payload } = await jwtVerify(token, secret, {
      issuer: "sleepconnect",
      audience: "outreach",
    });

    // DIAGNOSTIC: Log the complete payload structure to understand what we're receiving
    console.log("[JWT] ===== JWT PAYLOAD DIAGNOSTIC =====");
    console.log(
      "[JWT] Full payload structure:",
      JSON.stringify(payload, null, 2),
    );
    console.log("[JWT] Payload keys:", Object.keys(payload));
    console.log("[JWT] =====================================");

    const decoded = payload as unknown as UserContext;

    // DIAGNOSTIC: Log what fields we found and what we expected
    console.log("[JWT] Field validation:");
    console.log(
      "[JWT]   - sax_id:",
      decoded.sax_id,
      "(exists:",
      !!decoded.sax_id,
      ")",
    );
    console.log(
      "[JWT]   - tenant_id:",
      decoded.tenant_id,
      "(exists:",
      !!decoded.tenant_id,
      ")",
    );
    console.log(
      "[JWT]   - practice_id:",
      decoded.practice_id,
      "(exists:",
      !!decoded.practice_id,
      ")",
    );

    // Validate required fields
    if (!decoded.sax_id || !decoded.tenant_id || !decoded.practice_id) {
      console.error("[JWT] Missing required fields in token");
      console.error("[JWT] Expected fields: sax_id, tenant_id, practice_id");
      console.error("[JWT] Received fields:", Object.keys(payload).join(", "));
      return null;
    }

    return decoded;
  } catch (error) {
    console.error("[JWT] Token verification failed:", error);
    return null;
  }
}
