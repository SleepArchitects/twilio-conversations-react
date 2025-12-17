/**
 * SleepConnect Shell Integration - PROXY-LEVEL RENDERING (Cleanest Approach)
 *
 * Multi-Zone Architecture Pattern:
 * ================================
 * In production, SleepConnect acts as the reverse proxy and renders the complete
 * shell (header + footer) at the proxy level. Each zone (core, outreach, admin)
 * only renders its content area.
 *
 * How It Works:
 * 1. User requests: https://sleepconnect.com/outreach/conversations
 * 2. SleepConnect proxy (main zone) intercepts the request
 * 3. Proxy fetches content from Outreach zone: GET /outreach/conversations
 * 4. Proxy wraps Outreach content with SleepConnect header/footer
 * 5. User receives: SleepConnect shell + Outreach content (seamless)
 *
 * Benefits:
 * - Single source of truth for header/footer (no duplication)
 * - Automatic consistency across all zones
 * - No need for shared component packages or imports
 * - Header updates propagate instantly to all zones
 * - Auth context shared via cookies/headers (no API calls)
 *
 * Implementation (T018a - COMPLETE):
 * - Outreach layout.tsx does NOT render header/footer
 * - SleepConnect next.config.js has rewrites: /outreach/* → Outreach zone
 * - Cross-zone navigation uses <a href> (hard navigation, not <Link>)
 * - This file exists only for documentation and standalone dev mode
 *
 * Standalone Dev Mode:
 * - When running Outreach zone independently (pnpm dev), use these stubs
 * - For production multi-zone, these components are never used
 */

/**
 * NOTE: These components are ONLY used in standalone dev mode.
 * In production, SleepConnect proxy provides the actual header/footer.
 */

import React from "react";

export interface ShellHeaderProps {
  /**
   * User display name from Auth0 session
   */
  userName?: string;
  /**
   * Current zone/app identifier for navigation highlighting
   */
  currentZone?: "outreach" | "core" | "admin";
}

export interface ShellFooterProps {
  /**
   * Optional footer variant for different contexts
   */
  variant?: "default" | "minimal";
}

/**
 * ShellHeader - STUB FOR STANDALONE DEV MODE ONLY
 *
 * ⚠️ WARNING: This component is NOT used in production!
 *
 * Production Multi-Zone Flow:
 * - SleepConnect proxy renders actual header at reverse proxy level
 * - Outreach zone layout.tsx does NOT include <ShellHeader>
 * - This stub only exists for standalone development (pnpm dev)
 *
 * @param props - Header configuration (ignored in production)
 */

export function ShellHeader({
  userName,
  currentZone = "outreach",
}: ShellHeaderProps) {
  return (
    <header className="bg-primary-600 text-white shadow-md">
      <div className="container mx-auto flex items-center justify-between px-4 py-3">
        {/* Logo - Use <a> for hard navigation to core zone */}
        <a href="/" className="flex items-center gap-2 hover:opacity-90">
          <div className="h-8 w-8 rounded-full bg-white/10 flex items-center justify-center">
            <span className="text-sm font-bold">SC</span>
          </div>
          <span className="text-lg font-semibold">SleepConnect</span>
        </a>

        {/* Navigation - Use <a> for cross-zone links */}
        <nav className="flex items-center gap-6">
          <a
            href={`${process.env.NEXT_PUBLIC_APP_BASE_URL}/dashboard`}
            className="hover:text-white/80 transition-colors"
          >
            Dashboard
          </a>
          <a
            href={`${process.env.NEXT_PUBLIC_APP_BASE_URL}/patients`}
            className="hover:text-white/80 transition-colors"
          >
            Patients
          </a>
          <a
            href={`${process.env.NEXT_PUBLIC_APP_BASE_URL}/outreach`}
            className={
              currentZone === "outreach"
                ? "font-semibold"
                : "hover:text-white/80 transition-colors"
            }
          >
            Outreach
          </a>
        </nav>

        {/* User menu */}
        <div className="flex items-center gap-3">
          {userName && (
            <span className="text-sm hidden sm:inline">{userName}</span>
          )}
          <a
            href="/api/auth/logout"
            className="text-sm px-3 py-1.5 rounded hover:bg-white/10 transition-colors"
          >
            Logout
          </a>
        </div>
      </div>
    </header>
  );
}

/**
 * ShellFooter - Bottom footer from SleepConnect
 *
 * TODO (T018a Implementation):
 * - Replace this stub with actual import from SleepConnect shared package
 * - Should match SleepConnect footer styling and content
 *
 * @param props - Footer configuration
 */
export function ShellFooter({ variant = "default" }: ShellFooterProps) {
  if (variant === "minimal") {
    return (
      <footer className="bg-gray-100 border-t border-gray-200 py-3">
        <div className="container mx-auto px-4 text-center text-xs text-gray-600">
          © {new Date().getFullYear()} SleepConnect. All rights reserved.
        </div>
      </footer>
    );
  }

  return (
    <footer className="bg-gray-800 text-gray-300 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Company Info */}
          <div>
            <h3 className="text-white font-semibold mb-3">SleepConnect</h3>
            <p className="text-sm">
              HIPAA-compliant patient engagement and care coordination platform.
            </p>
          </div>

          {/* Quick Links - Use <a> for cross-zone navigation */}
          <div>
            <h3 className="text-white font-semibold mb-3">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a
                  href={`${process.env.NEXT_PUBLIC_APP_BASE_URL}/dashboard`}
                  className="hover:text-white transition-colors"
                >
                  Dashboard
                </a>
              </li>
              <li>
                <a
                  href={`${process.env.NEXT_PUBLIC_APP_BASE_URL}/patients`}
                  className="hover:text-white transition-colors"
                >
                  Patients
                </a>
              </li>
              <li>
                <a
                  href={`${process.env.NEXT_PUBLIC_APP_BASE_URL}/outreach`}
                  className="hover:text-white transition-colors"
                >
                  SMS Outreach
                </a>
              </li>
            </ul>
          </div>

          {/* Support */}
          <div>
            <h3 className="text-white font-semibold mb-3">Support</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="/help" className="hover:text-white transition-colors">
                  Help Center
                </a>
              </li>
              <li>
                <a
                  href="/privacy"
                  className="hover:text-white transition-colors"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a href="/terms" className="hover:text-white transition-colors">
                  Terms of Service
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Copyright */}
        <div className="border-t border-gray-700 mt-8 pt-6 text-center text-sm">
          © {new Date().getFullYear()} SleepConnect. All rights reserved. |
          HIPAA Compliant
        </div>
      </div>
    </footer>
  );
}
