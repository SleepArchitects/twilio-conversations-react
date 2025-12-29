"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";

/**
 * AuthGuard component that verifies user authentication on the client side.
 *
 * This component checks for a valid session by calling the session API route,
 * which validates the x-sax-user-context cookie forwarded from sleepconnect.
 *
 * Note: The cookie is HttpOnly so we cannot read it directly with document.cookie.
 * Instead, we call /api/auth/session which reads it server-side.
 *
 * If no valid session exists, redirects to sleepconnect login.
 * Renders children once authentication is confirmed.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    // Skip auth check if disabled (development only)
    const isAuthDisabled = process.env.NEXT_PUBLIC_DISABLE_AUTH === "true";

    if (isAuthDisabled) {
      console.log("[AuthGuard] Auth disabled - bypassing check");
      setIsAuthenticated(true);
      return;
    }

    // Don't check auth on auth routes (they're handled by middleware)
    if (pathname?.includes("/auth")) {
      setIsAuthenticated(true);
      return;
    }

    // Verify session by calling our session API endpoint
    const checkAuth = async () => {
      try {
        // First, try to set the cookie from the header (in case rewrite didn't forward it)
        const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";
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
            setIsAuthenticated(true);
            return;
          }
        }

        // No valid session - redirect to login
        console.log("[AuthGuard] ❌ No valid session - redirecting to login");
        const sleepconnectUrl =
          process.env.NEXT_PUBLIC_SLEEPCONNECT_URL || "http://localhost:3000";
        const returnTo = encodeURIComponent(`/outreach${pathname}`);
        const loginUrl = `${sleepconnectUrl}/login?returnTo=${returnTo}`;
        console.log("[AuthGuard] 🔀 Redirecting to:", loginUrl);
        window.location.href = loginUrl;
      } catch (error) {
        console.error("[AuthGuard] ❌ Auth check failed:", error);

        // On error, redirect to login as fallback
        const sleepconnectUrl =
          process.env.NEXT_PUBLIC_SLEEPCONNECT_URL || "http://localhost:3000";
        const returnTo = encodeURIComponent(`/outreach${pathname}`);
        const loginUrl = `${sleepconnectUrl}/login?returnTo=${returnTo}`;
        console.log(
          "[AuthGuard] 🔀 Error fallback - redirecting to:",
          loginUrl,
        );
        window.location.href = loginUrl;
      }
    };

    checkAuth();
  }, [pathname, router]);

  // Show loading state while checking auth
  if (isAuthenticated === null) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]" />
          <p className="mt-2 text-sm text-gray-500">
            Verifying authentication...
          </p>
        </div>
      </div>
    );
  }

  // Render children only when authenticated
  return isAuthenticated ? <>{children}</> : null;
}
