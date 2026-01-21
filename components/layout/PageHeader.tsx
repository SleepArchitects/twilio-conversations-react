import * as React from "react";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  subtitle?: React.ReactNode;
  children?: React.ReactNode;
  startAction?: React.ReactNode;
  className?: string;
}

/**
 * Reusable Page Header Component
 *
 * Standardizes the header layout across the application.
 * Features:
 * - Title and optional subtitle
 * - Optional start action (e.g. back button)
 * - Right-aligned action area (children)
 * - Consistent styling (dark mode compatible)
 * - Responsive layout
 */
export function PageHeader({
  title,
  subtitle,
  children,
  startAction,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "border-b border-gray-700 bg-gray-800 px-6 py-4",
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {startAction}
          <div>
            <h1 className="text-2xl font-bold text-white">{title}</h1>
            {subtitle && (
              <div className="mt-1 text-sm text-gray-400">{subtitle}</div>
            )}
          </div>
        </div>

        {children && (
          <div className="flex items-center gap-4 lg:flex-basis-1/2">
            {children}
          </div>
        )}
      </div>
    </header>
  );
}
