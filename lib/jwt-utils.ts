import { jwtVerify, decodeJwt } from "jose";

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
  /** SAX role flag — set by SleepConnect in JWT, optional for backward compat */
  is_sax_user?: boolean;
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
 * Decode JWT without verification (for diagnostics only)
 * This allows inspecting the payload structure without validating the signature
 *
 * @param token - JWT token to decode
 * @returns Decoded payload or null if invalid format
 */
export function decodeJwtWithoutVerification(token: string): unknown {
  try {
    const payload = decodeJwt(token);
    return payload;
  } catch (error) {
    console.error(
      "[JWT] Failed to decode JWT without verification:",
      error instanceof Error ? error.message : String(error),
    );
    throw error;
  }
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

    const decoded = payload as unknown as UserContext;

    // Validate required fields
    if (!decoded.sax_id || !decoded.tenant_id || !decoded.practice_id) {
      console.error(
        "[JWT] Missing required fields: sax_id, tenant_id, practice_id",
      );
      return null;
    }

    return decoded;
  } catch (error) {
    if (error instanceof Error) {
      const errorMessage = error.message;

      if (errorMessage.includes("signature")) {
        console.error("[JWT] Verification failed: invalid signature");
      } else if (errorMessage.includes("issuer")) {
        console.error("[JWT] Verification failed: invalid issuer");
      } else if (errorMessage.includes("audience")) {
        console.error("[JWT] Verification failed: invalid audience");
      } else if (errorMessage.includes("expired")) {
        console.error("[JWT] Verification failed: token expired");
      } else if (errorMessage.includes("malformed")) {
        console.error("[JWT] Verification failed: malformed token");
      } else {
        console.error("[JWT] Verification failed:", errorMessage);
      }
    } else {
      console.error("[JWT] Verification failed:", String(error));
    }

    return null;
  }
}
