"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useUser } from "@auth0/nextjs-auth0";
import { createPlainUserObject } from "@/lib/auth/claims-transformer";

export interface UseAuthOptions {
  required?: boolean;
  redirectTo?: string;
  redirectIfAuthenticated?: string;
}

// Default ID Token claims included by the SDK; extend with namespaced custom claims as needed.
export type Auth0DefaultUser = {
  sub: string;
  name?: string;
  nickname?: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
  email?: string;
  email_verified?: boolean;
  access_token?: string;
  org_id?: string;
  practiceId?: string;
  tenantId?: string;
  saxId?: string;
  practiceName?: string;
};

// Support typical namespaced custom claim keys like "https://example.com/role"
export type NamespacedClaimKey =
  | `https://${string}/${string}`
  | `${string}:${string}`
  | `${string}/${string}`;

export type Auth0CustomClaims = {
  [K in NamespacedClaimKey]?: unknown;
} & {
  // Allow additional custom keys if needed
  [key: string]: unknown;
};

export type Auth0User = Auth0DefaultUser & Partial<Auth0CustomClaims>;

export interface UseAuthResult {
  user: Auth0User | undefined;
  accessToken?: string;
  practiceId?: string;
  tenantId?: string;
  saxId?: string;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: Error | undefined;
  status: "loading" | "authenticated" | "unauthenticated";
  login: (returnTo?: string) => void;
  logout: (returnTo?: string) => void;
  refreshSession: () => Promise<{ success: boolean; error?: string }>;
}

// GLOBAL flag to prevent multiple simultaneous access token fetches
// This is shared across ALL instances of useAuth()
// eslint-disable-next-line @typescript-eslint/no-unused-vars
let globalAccessTokenFetched = false;
let globalAccessToken: string | undefined = undefined;

// Callback registry to notify all instances when token is fetched
type TokenCallback = (token: string | undefined) => void;
const tokenCallbacks: Set<TokenCallback> = new Set();

/**
 * Auth hook backed by Auth0 Next.js SDK.
 *
 * - Uses useUser() for client-side session state.
 * - Redirects to /auth/login when required is true and unauthenticated.
 * - Exposes login/logout helpers that honor optional returnTo redirects.
 * - Removes all NextAuth-specific logic.
 */
export function useAuth(options: UseAuthOptions = {}): UseAuthResult {
  const router = useRouter();
  const {
    required = false,
    redirectTo = "/auth/login",
    redirectIfAuthenticated,
  } = options;

  const { user, error, isLoading } = useUser();
  const [accessToken, setAccessToken] = useState<string | undefined>(
    () => globalAccessToken,
  );

  // Register this instance to receive token updates
  useEffect(() => {
    const callback: TokenCallback = (token) => {
      setAccessToken(token);
    };
    tokenCallbacks.add(callback);
    return () => {
      tokenCallbacks.delete(callback);
    };
  }, []);

  // Handle both transformed (new sessions) and legacy (existing sessions) user objects
  const typedUser = useMemo(() => {
    if (!user) return undefined;

    // Check if user object is already transformed (has plain properties)
    const hasTransformedClaims = user.practiceId || user.tenantId;

    let plainUser: Auth0User;

    if (hasTransformedClaims) {
      // User object is already transformed by server-side beforeSessionSaved hook
      plainUser = user as Auth0User;
    } else {
      // Legacy user object - apply transformation for existing sessions
      plainUser = createPlainUserObject(user) as Auth0User;
    }

    if (accessToken) {
      plainUser.access_token = accessToken;
    }
    return plainUser;
  }, [user, accessToken]);

  useEffect(() => {
    if (!user) {
      globalAccessToken = undefined;
      setAccessToken(undefined);
      globalAccessTokenFetched = false;
      tokenCallbacks.forEach((callback) => {
        callback(undefined);
      });
    } else if (user && globalAccessToken) {
      setAccessToken(globalAccessToken);
    }
  }, [user]);

  // Store user's timezone to localStorage on login
  useEffect(() => {
    if (user && !isLoading) {
      try {
        // Get user's local timezone using Intl API
        const userTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

        // Store to localStorage
        if (typeof window !== "undefined") {
          localStorage.setItem("dreamconnect-user-time-zone", userTimezone);
        }
      } catch (error) {
        console.error("[useAuth] Failed to detect/store timezone:", error);
      }
    }
  }, [user, isLoading]);

  // Track user login - fire once per session
  useEffect(() => {
    if (user && !isLoading && typeof window !== "undefined") {
      // Check if we've already tracked this session
      const sessionKey = `login-tracked-${user.sub}`;
      const hasTracked = sessionStorage.getItem(sessionKey);

      if (!hasTracked) {
        console.log(
          "[useAuth] 📊 Tracking login for user:",
          user.email || user.sub,
        );

        // Mark as tracked immediately to prevent duplicate calls
        sessionStorage.setItem(sessionKey, "true");

        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

        // Call login tracking API (fire and forget)
        fetch(`${basePath}/api/track-login`, {
          method: "POST",
          credentials: "include",
        })
          .then((res) => {
            if (res.ok) {
              console.log("[useAuth] ✅ Login tracked successfully");
            } else {
              console.warn("[useAuth] ⚠️ Login tracking failed:", res.status);
            }
          })
          .catch((error) => {
            console.error("[useAuth] ❌ Login tracking error:", error);
          });
      }
    }
  }, [user, isLoading]);

  const status: UseAuthResult["status"] = isLoading
    ? "loading"
    : typedUser
      ? "authenticated"
      : "unauthenticated";

  // Enforce authentication when required
  useEffect(() => {
    if (!isLoading && required && (!typedUser || error)) {
      // Optionally support custom returnTo
      router.push(redirectTo);
    }
  }, [isLoading, required, typedUser, error, redirectTo, router]);

  // Redirect authenticated users away from public pages (e.g., login)
  useEffect(() => {
    if (!isLoading && typedUser && redirectIfAuthenticated) {
      router.push(redirectIfAuthenticated);
    }
  }, [isLoading, typedUser, redirectIfAuthenticated, router]);

  const login = useCallback((returnTo?: string) => {
    if (typeof window === "undefined") return;
    const url =
      "/auth/login" +
      (returnTo ? `?returnTo=${encodeURIComponent(returnTo)}` : "");
    window.location.href = url;
  }, []);

  const logout = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    (_returnTo?: string) => {
      if (typeof window === "undefined") return;
      const url = "/auth/logout";
      window.location.href = url;
    },
    [],
  );

  // Best-effort session refresh placeholder to keep API compatibility.
  const refreshSession = useCallback(async () => {
    try {
      // Auth routes must NOT use base path - they need to be at root level
      // to share cookies with SleepConnect proxy at localhost:3000
      const profileRoute = "http://localhost:3000/api/auth/profile";

      await fetch(profileRoute, {
        method: "GET",
        cache: "no-store",
        credentials: "include",
      });
      return { success: true };
    } catch {
      return { success: false, error: "Failed to refresh session." };
    }
  }, []);

  return useMemo(
    () => ({
      accessToken,
      user: typedUser,
      practiceId: typedUser?.practiceId,
      tenantId: typedUser?.tenantId,
      saxId: typedUser?.saxId,
      isAuthenticated: !!typedUser,
      isLoading,
      error: error as Error | undefined,
      status,
      login,
      logout,
      refreshSession,
    }),
    [
      typedUser,
      isLoading,
      error,
      status,
      login,
      logout,
      refreshSession,
      accessToken,
    ],
  );
}
