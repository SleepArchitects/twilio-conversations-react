/**
 * Utility functions for transforming Auth0 namespaced claims into plain user objects
 */

export interface AppMetadata {
  practice_id?: string;
  tenant_id?: string;
  sax_id?: string;
  [key: string]: unknown;
}

export interface UserMetadata {
  [key: string]: unknown;
}

export interface TransformedClaims {
  practiceId?: string;
  tenantId?: string;
  saxId?: string;
  practiceName?: string;
  userMetadata?: UserMetadata;
  appMetadata?: AppMetadata;
}

/**
 * Converts a value to its string representation.
 * @param value - The value to convert.
 * @returns The string representation of the value.
 */
const toStringHelper = (value: unknown): string => {
  return `${String(value)}`;
};

/**
 * Extracts and transforms namespaced claims from Auth0 user object
 * Supports multiple namespaces and extracts app_metadata/user_metadata
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function transformNamespacedClaims(user: any): TransformedClaims {
  if (!user) return {};

  const result: TransformedClaims = {};

  // Look for namespaced claims patterns
  const namespacedKeys = Object.keys(user).filter(
    (key) => key.includes("://") || key.includes("/"),
  );

  console.debug("[Claims Transformer] Found namespaced keys:", namespacedKeys);

  for (const key of namespacedKeys) {
    // Extract app_metadata claims
    if (key.includes("/app_metadata")) {
      const appMetadata = user[key] as AppMetadata;
      console.debug("[Claims Transformer] Found app_metadata:", {
        key,
        appMetadata,
      });
      if (appMetadata) {
        result.appMetadata = appMetadata;

        // Ensure all values of appMetadata are strings using toStringHelper
        for (const metaKey of Object.keys(appMetadata)) {
          if (
            appMetadata[metaKey] !== undefined &&
            appMetadata[metaKey] !== null
          ) {
            appMetadata[metaKey] = toStringHelper(appMetadata[metaKey]);
          }
        }

        // Transform specific known fields to camelCase
        if (appMetadata.practice_id) {
          result.practiceId = toStringHelper(appMetadata.practice_id);
          console.debug(
            "[Claims Transformer] Extracted practiceId:",
            appMetadata.practice_id,
          );
        }
        if (appMetadata.tenant_id) {
          result.tenantId = toStringHelper(appMetadata.tenant_id);
          console.debug(
            "[Claims Transformer] Extracted tenantId:",
            appMetadata.tenant_id,
          );
        }
        if (appMetadata.sax_id) {
          result.saxId = toStringHelper(appMetadata.sax_id);
          console.debug(
            "[Claims Transformer] Extracted saxId:",
            appMetadata.sax_id,
          );
        }

        if (appMetadata.practice_name) {
          result.practiceName = toStringHelper(appMetadata.practice_name);
          console.debug(
            "[Claims Transformer] Extracted practiceName:",
            appMetadata.practice_name,
          );
        }
      }
    }

    // Extract user_metadata claims
    if (key.includes("/user_metadata")) {
      const userMetadata = user[key] as UserMetadata;
      if (userMetadata) {
        result.userMetadata = userMetadata;
      }
    }

    // Handle direct namespaced claims (legacy support)
    if (key.includes("/tenant_id")) {
      result.tenantId = toStringHelper(user[key]);
    }
    if (key.includes("/practice_id")) {
      result.practiceId = toStringHelper(user[key]);
    }
    if (key.includes("/sax_id")) {
      result.saxId = toStringHelper(user[key]);
    }
    if (key.includes("/practice_name")) {
      result.practiceName = toStringHelper(user[key]);
    }
  }

  // Fallback to custom: prefixed claims for backwards compatibility
  if (!result.tenantId && user["custom:tenant_id"]) {
    result.tenantId = toStringHelper(user["custom:tenant_id"]);
  }
  if (!result.practiceId && user["custom:practice_id"]) {
    result.practiceId = toStringHelper(user["custom:practice_id"]);
  }
  if (!result.saxId && user["custom:sax_id"]) {
    result.saxId = toStringHelper(user["custom:sax_id"]);
  }

  if (!result.practiceName && user["custom:practice_name"]) {
    result.practiceName = toStringHelper(user["custom:practice_name"]);
  }

  return result;
}

/**
 * Creates a plain user object with transformed claims merged in
 * This merges the namespaced claims into the top level of the user object
 *
 * CRITICAL FIX (2025-11-02): Reduced session size to prevent 413 errors
 * Sessions were exceeding 6MB CloudFront/Lambda limit
 * Only storing essential fields needed for app functionality
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createPlainUserObject(user: any): any {
  if (!user) return null;

  console.debug("[Claims Transformer] Input user object:", user);
  const transformedClaims = transformNamespacedClaims(user);
  console.debug(
    "[Claims Transformer] Transformed claims result:",
    transformedClaims,
  );

  // MINIMAL session object - only essential fields to avoid 413 errors
  const plainUser = {
    // Essential Auth0 identity fields
    sub: user.sub,
    email: user.email,
    name: user.name,
    nickname: user.nickname,
    given_name: user.given_name, // Required for login tracking and booking form
    family_name: user.family_name, // Required for login tracking and booking form
    picture: user.picture,
    email_verified: user.email_verified,

    // Essential custom claims for app functionality
    practiceId: transformedClaims.practiceId,
    tenantId: transformedClaims.tenantId,
    saxId: toStringHelper(transformedClaims.saxId),
    practiceName: transformedClaims.practiceName,

    // Token validation fields
    exp: user.exp,
    iat: user.iat,
    iss: user.iss,
    aud: user.aud,

    // Session ID for tracking
    sid: user.sid,

    // DO NOT include full metadata objects - fetch separately via /api/profile if needed
    // DO NOT include all custom properties - this caused session bloat
  };

  return plainUser;
}

/**
 * Enhanced session object with transformed claims
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createPlainSessionObject(session: any): any {
  if (!session) return null;

  const plainSession = {
    ...session,
    user: session.user ? createPlainUserObject(session.user) : null,
  };

  return plainSession;
}

/**
 * Helper function to extract specific claim values with fallbacks
 */
export function extractClaimValue(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any,
  claimName: string,
): string | undefined {
  if (!user) return undefined;

  const transformedClaims = transformNamespacedClaims(user);

  switch (claimName) {
    case "tenantId":
    case "tenant_id":
      return transformedClaims.tenantId;
    case "practiceId":
    case "practice_id":
      return transformedClaims.practiceId;
    case "saxId":
    case "sax_id":
      return toStringHelper(transformedClaims.saxId);
    default:
      return undefined;
  }
}
