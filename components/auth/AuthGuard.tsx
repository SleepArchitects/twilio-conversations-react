"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useIsSAXUser, checkIsSAXUserFromStorage } from "@/hooks/useIsSAXUser";
import { useSessionHeartbeat } from "@/hooks/useSessionHeartbeat";

type AuthState =
  | "loading"
  | "authenticated"
  | "unauthenticated"
  | "unauthorized";

/**
 * AuthGuard component that verifies user authentication AND authorization on the client side.
 *
 * This component:
 * 1. Checks for a valid session by calling the session API route,
 *    which validates the x-sax-user-context cookie forwarded from sleepconnect.
 * 2. Verifies the user has the "Sax" role required to access Outreach.
 *
 * Note: The cookie is HttpOnly so we cannot read it directly with document.cookie.
 * Instead, we call /api/auth/session which reads it server-side.
 *
 * If no valid session exists, redirects to sleepconnect login.
 * If session exists but user lacks SAX role, shows access denied message.
 * Renders children once authentication AND authorization are confirmed.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [authState, setAuthState] = useState<AuthState>("loading");
  const { data: hasSaxRole, isLoading: isRoleLoading } = useIsSAXUser();
  useSessionHeartbeat();

  useEffect(() => {
    // Don't check auth on auth routes (they're handled by middleware)
    if (pathname?.includes("/auth")) {
      setAuthState("authenticated");
      return;
    }

    // Verify session by calling our session API endpoint
    const checkAuth = async () => {
      try {
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

        // First, try to set the cookie from the header (in case rewrite didn't forward it)
        const setCookieResponse = await fetch(
          `${basePath}/api/auth/set-cookie`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          },
        );

        console.log(
          "[AuthGuard] set-cookie response status:",
          setCookieResponse.status,
        );

        // Then call our local API endpoint which can read the HttpOnly cookie
        const response = await fetch(`${basePath}/api/auth/session`, {
          method: "GET",
          credentials: "include",
          cache: "no-store",
        });

        console.log("[AuthGuard] session response status:", response.status);

        if (response.ok) {
          const data = await response.json();
          console.log("[AuthGuard] session data:", data);

          if (
            data.authenticated &&
            data.sax_id &&
            data.tenant_id &&
            data.practice_id
          ) {
            console.log("[AuthGuard] ✅ Valid session found");
            // Session is valid, now check SAX role
            // Do a quick localStorage check first while the hook loads
            const hasSaxFromStorage = checkIsSAXUserFromStorage();
            console.log(
              "[AuthGuard] SAX role from storage:",
              hasSaxFromStorage,
            );

            if (hasSaxFromStorage) {
              setAuthState("authenticated");
            } else {
              // Wait for the hook to confirm (it might still be loading)
              setAuthState("loading");
            }
            return;
          }
        }

        // No valid session - redirect to login
        console.log("[AuthGuard] ❌ No valid session - redirecting to login");
        redirectToLogin();
      } catch (error) {
        console.error("[AuthGuard] ❌ Auth check failed:", error);
        // On error, redirect to login as fallback
        redirectToLogin();
      }
    };

    const redirectToLogin = () => {
      const sleepconnectUrl =
        process.env.NEXT_PUBLIC_SLEEPCONNECT_URL || "http://localhost:3000";
      const returnTo = encodeURIComponent(`/outreach${pathname}`);
      const loginUrl = `${sleepconnectUrl}/login?returnTo=${returnTo}`;
      console.log("[AuthGuard] 🔀 Redirecting to:", loginUrl);
      window.location.href = loginUrl;
    };

    checkAuth();
  }, [pathname, router]);

  // Once role loading is done, check if user has SAX role
  useEffect(() => {
    if (authState === "loading" && !isRoleLoading) {
      console.log("[AuthGuard] Role loading complete, hasSaxRole:", hasSaxRole);
      if (hasSaxRole) {
        setAuthState("authenticated");
      } else {
        // User is authenticated but lacks SAX role
        setAuthState("unauthorized");
      }
    }
  }, [authState, hasSaxRole, isRoleLoading]);

  // Listen for worker 401 errors and redirect to logout
  useEffect(() => {
    const handleWorkerMessage = (event: MessageEvent) => {
      if (event.data?.type === "AUTH_ERROR" && event.data?.status === 401) {
        console.log(
          "[AuthGuard] 🔐 Received 401 from worker - redirecting to logout",
        );
        window.location.href = "/auth/logout";
      }
    };

    self.addEventListener("message", handleWorkerMessage);

    return () => {
      self.removeEventListener("message", handleWorkerMessage);
    };
  }, []);

  // Show loading state while checking auth
  if (authState === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Verifying authentication...
          </p>
        </div>
      </div>
    );
  }

  // Show access denied if user is authenticated but lacks SAX role
  if (authState === "unauthorized") {
    const sleepconnectUrl =
      process.env.NEXT_PUBLIC_SLEEPCONNECT_URL || "http://localhost:3000";

    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="max-w-md w-full p-8 bg-white rounded-lg shadow-lg text-center">
          <div className="mx-auto w-16 h-16 flex items-center justify-center rounded-full bg-red-100 mb-4">
            <svg
              className="w-8 h-8 text-red-600"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Access Denied
          </h1>
          <p className="text-gray-600 mb-6">
            You don&apos;t have permission to access the Outreach application.
            This feature is only available to SAX employees.
          </p>
          <p className="text-sm text-gray-500 mb-6">
            If you believe you should have access, please contact your
            administrator to request the SAX role.
          </p>
          <a
            href={sleepconnectUrl}
            className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            Return to SleepConnect
          </a>
        </div>
      </div>
    );
  }

  // Render children only when authenticated AND authorized
  return authState === "authenticated" ? <>{children}</> : null;
}
