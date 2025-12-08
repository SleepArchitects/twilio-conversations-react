/**
 * SleepConnect Shell Integration
 *
 * Provides Header and Footer components from the SleepConnect multi-zone shell.
 * These components ensure consistent branding and navigation across all zones.
 *
 * Implementation Notes (T018a):
 * - This is a stub for multi-zone integration with SleepConnect
 * - In production, these components should be imported from a shared package or
 *   fetched from SleepConnect's component export endpoint
 * - Use <a href> for cross-zone navigation (not Next.js <Link>)
 * - Auth context is passed via cookies from SleepConnect middleware
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
 * ShellHeader - Top navigation bar from SleepConnect
 *
 * TODO (T018a Implementation):
 * - Replace this stub with actual import from SleepConnect shared package
 * - Possible approaches:
 *   1. NPM package: @sleepconnect/shell-components
 *   2. Git submodule: Import from ../sleepconnect/components/shell
 *   3. Component federation: Remote module via Module Federation
 *   4. Server-side fetch: Fetch component HTML from SleepConnect endpoint
 *
 * @param props - Header configuration
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
        <nav className="hidden md:flex items-center gap-6">
          <a
            href="/dashboard"
            className="hover:text-white/80 transition-colors"
          >
            Dashboard
          </a>
          <a href="/patients" className="hover:text-white/80 transition-colors">
            Patients
          </a>
          <a
            href="/outreach"
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
                  href="/dashboard"
                  className="hover:text-white transition-colors"
                >
                  Dashboard
                </a>
              </li>
              <li>
                <a
                  href="/patients"
                  className="hover:text-white transition-colors"
                >
                  Patients
                </a>
              </li>
              <li>
                <a
                  href="/outreach"
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
