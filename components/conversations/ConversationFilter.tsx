"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types & Interfaces
// =============================================================================

/** Canonical filter values per FR-014c */
export type ConversationFilterValue =
  | "all"
  | "unread"
  | "sla_risk"
  | "archived";

export interface ConversationFilterProps {
  /** Currently selected filter value */
  value: ConversationFilterValue;
  /** Callback when filter changes */
  onChange: (value: ConversationFilterValue) => void;
  /** Custom class name */
  className?: string;
}

interface FilterOption {
  value: ConversationFilterValue;
  label: string;
}

// =============================================================================
// Constants
// =============================================================================

/** Filter options per FR-014c */
const FILTER_OPTIONS: FilterOption[] = [
  { value: "all", label: "All" },
  { value: "unread", label: "Unread" },
  { value: "sla_risk", label: "SLA Risk" },
  { value: "archived", label: "Archived" },
];

// =============================================================================
// Component
// =============================================================================

/**
 * Segmented control for filtering conversations by status.
 * Implements FR-014c with canonical filter values.
 */
export function ConversationFilter({
  value,
  onChange,
  className,
}: ConversationFilterProps): React.ReactElement {
  return (
    <div
      className={cn("inline-flex rounded-lg bg-gray-800 p-1", className)}
      role="tablist"
      aria-label="Conversation filters"
    >
      {FILTER_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          role="tab"
          aria-selected={value === option.value}
          aria-controls="conversation-list"
          onClick={() => onChange(option.value)}
          className={cn(
            "rounded-md px-4 py-2 text-sm font-medium transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-900",
            value === option.value
              ? "bg-blue-600 text-white shadow-sm"
              : "text-gray-400 hover:bg-gray-700 hover:text-white",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export default ConversationFilter;
