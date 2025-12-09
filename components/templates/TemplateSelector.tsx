"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Template, TemplateCategory } from "@/types/sms";
import SearchIcon from "@/components/icons/SearchIcon";

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface TemplateSelectorProps {
  /** List of templates to display */
  templates: Template[];
  /** Currently selected template ID */
  selectedTemplateId?: string | null;
  /** Callback when template is selected */
  onSelect: (template: Template) => void;
  /** Currently selected category filter */
  categoryFilter?: TemplateCategory | "all";
  /** Callback when category filter changes */
  onCategoryChange?: (category: TemplateCategory | "all") => void;
  /** Search query */
  searchQuery?: string;
  /** Callback when search query changes */
  onSearchChange?: (query: string) => void;
  /** Whether the selector is loading */
  isLoading?: boolean;
  /** Custom class name */
  className?: string;
}

interface CategoryOption {
  value: TemplateCategory | "all";
  label: string;
}

// =============================================================================
// Constants
// =============================================================================

const CATEGORY_OPTIONS: CategoryOption[] = [
  { value: "all", label: "All" },
  { value: "welcome", label: "Welcome" },
  { value: "reminder", label: "Reminder" },
  { value: "follow-up", label: "Follow-up" },
  { value: "education", label: "Education" },
  { value: "general", label: "General" },
];

// =============================================================================
// Component
// =============================================================================

/**
 * TemplateSelector - Component for browsing and selecting message templates
 *
 * Features:
 * - Category filter buttons
 * - Search functionality
 * - Template list with selection
 * - Flowbite styling with dark mode support
 */
export function TemplateSelector({
  templates,
  selectedTemplateId,
  onSelect,
  categoryFilter = "all",
  onCategoryChange,
  searchQuery = "",
  onSearchChange,
  isLoading = false,
  className,
}: TemplateSelectorProps): React.ReactElement {
  // Filter templates by category
  const filteredByCategory = React.useMemo(() => {
    if (categoryFilter === "all") return templates;
    return templates.filter((t) => t.category === categoryFilter);
  }, [templates, categoryFilter]);

  // Filter templates by search query
  const filteredTemplates = React.useMemo(() => {
    if (!searchQuery.trim()) return filteredByCategory;

    const query = searchQuery.toLowerCase().trim();
    return filteredByCategory.filter(
      (t) =>
        t.name.toLowerCase().includes(query) ||
        t.content.toLowerCase().includes(query),
    );
  }, [filteredByCategory, searchQuery]);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-gray-700 bg-gray-800 p-4",
        className,
      )}
    >
      {/* Category Filter */}
      {onCategoryChange && (
        <div
          className="inline-flex flex-wrap gap-2 rounded-lg bg-gray-900 p-1"
          role="tablist"
          aria-label="Template category filters"
        >
          {CATEGORY_OPTIONS.map((option) => (
            <button
              key={option.value}
              type="button"
              role="tab"
              aria-selected={categoryFilter === option.value}
              onClick={() => onCategoryChange(option.value)}
              className={cn(
                "rounded-md px-3 py-1.5 text-xs font-medium transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800",
                categoryFilter === option.value
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-gray-400 hover:bg-gray-700 hover:text-white",
              )}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      {/* Search Input */}
      {onSearchChange && (
        <div className="relative">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
            <SearchIcon className="h-4 w-4 text-gray-400" />
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search templates..."
            className={cn(
              "w-full rounded-lg border border-gray-600 bg-gray-900 py-2 pl-10 pr-4 text-sm text-gray-100",
              "placeholder:text-gray-500",
              "focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800",
            )}
          />
        </div>
      )}

      {/* Template List */}
      <div className="flex max-h-96 flex-col gap-2 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-400">
            Loading templates...
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-sm text-gray-400">
            {searchQuery.trim()
              ? "No templates match your search"
              : "No templates available"}
          </div>
        ) : (
          filteredTemplates.map((template) => (
            <button
              key={template.id}
              type="button"
              onClick={() => onSelect(template)}
              className={cn(
                "group flex flex-col gap-1 rounded-lg border p-3 text-left transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800",
                selectedTemplateId === template.id
                  ? "border-purple-500 bg-purple-900/20"
                  : "border-gray-700 bg-gray-900 hover:border-gray-600 hover:bg-gray-850",
              )}
            >
              {/* Template Name and Badge */}
              <div className="flex items-start justify-between gap-2">
                <span className="text-sm font-medium text-gray-100">
                  {template.name}
                </span>
                <div className="flex items-center gap-2">
                  {template.usageCount > 0 && (
                    <span className="text-xs text-gray-500">
                      {template.usageCount} uses
                    </span>
                  )}
                  {template.practiceId === null && (
                    <span className="rounded bg-blue-900/50 px-1.5 py-0.5 text-[10px] font-medium text-blue-300">
                      Global
                    </span>
                  )}
                </div>
              </div>

              {/* Template Preview */}
              <p className="line-clamp-2 text-xs text-gray-400">
                {template.content}
              </p>

              {/* Variables Indicator */}
              {template.variables.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {template.variables.slice(0, 3).map((variable) => (
                    <span
                      key={variable}
                      className="rounded bg-purple-900/30 px-1.5 py-0.5 text-[10px] font-mono text-purple-300"
                    >
                      {`{{${variable}}}`}
                    </span>
                  ))}
                  {template.variables.length > 3 && (
                    <span className="text-[10px] text-gray-500">
                      +{template.variables.length - 3} more
                    </span>
                  )}
                </div>
              )}
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default TemplateSelector;
