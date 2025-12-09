"use client";

import * as React from "react";
import { Dropdown, DropdownHeader, DropdownItem } from "flowbite-react";
import { cn } from "@/lib/utils";
import type { Template } from "@/types/sms";
import LightningIcon from "@/components/icons/LightningIcon";
import { customDropdownTheme } from "@/lib/flowbite-theme";

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface QuickTemplateButtonProps {
  /** List of frequent templates to display */
  templates: Template[];
  /** Callback when a template is selected */
  onSelect: (template: Template) => void;
  /** Whether the button is disabled */
  disabled?: boolean;
  /** Custom class name */
  className?: string;
}

// =============================================================================
// Component
// =============================================================================

/**
 * QuickTemplateButton - Icon button with popover for accessing frequent templates
 *
 * Features:
 * - Lightning bolt icon button
 * - Dropdown/popover showing frequent templates
 * - Click to select template
 * - Flowbite styling
 */
export function QuickTemplateButton({
  templates,
  onSelect,
  disabled = false,
  className,
}: QuickTemplateButtonProps): React.ReactElement | null {
  const handleSelect = React.useCallback(
    (template: Template) => {
      onSelect(template);
    },
    [onSelect],
  );

  if (templates.length === 0) {
    return null;
  }

  return (
    <div className={cn("inline-flex", className)}>
      <Dropdown
        arrowIcon={false}
        inline
        label={
          <button
            type="button"
            disabled={disabled}
            className={cn(
              "inline-flex items-center justify-center",
              "h-10 w-10 rounded-lg",
              "transition-all duration-200",
              "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900",
              disabled
                ? "cursor-not-allowed bg-gray-700 text-gray-500 opacity-50"
                : [
                    "bg-gray-800 text-yellow-400",
                    "hover:bg-gray-700 hover:text-yellow-300",
                    "border border-gray-700",
                  ],
            )}
            aria-label="Quick templates"
            title="Quick templates"
          >
            <LightningIcon className="h-5 w-5" />
          </button>
        }
        theme={customDropdownTheme}
        className="min-w-[280px]"
      >
        <DropdownHeader className="border-b border-gray-700 bg-gray-800 px-4 py-3">
          <span className="text-sm font-semibold text-gray-100">
            Quick Templates
          </span>
        </DropdownHeader>
        <div className="max-h-64 overflow-y-auto">
          {templates.map((template) => (
            <DropdownItem
              key={template.id}
              onClick={() => handleSelect(template)}
              className="flex flex-col items-start gap-1 px-4 py-3 text-left hover:bg-purple-900/30"
            >
              <div className="flex w-full items-start justify-between gap-2">
                <span className="text-sm font-medium text-gray-100">
                  {template.name}
                </span>
                {template.usageCount > 0 && (
                  <span className="text-xs text-gray-500">
                    {template.usageCount}
                  </span>
                )}
              </div>
              <p className="line-clamp-2 text-xs text-gray-400">
                {template.content}
              </p>
              {template.variables.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {template.variables.slice(0, 2).map((variable) => (
                    <span
                      key={variable}
                      className="rounded bg-purple-900/30 px-1.5 py-0.5 text-[10px] font-mono text-purple-300"
                    >
                      {`{{${variable}}}`}
                    </span>
                  ))}
                  {template.variables.length > 2 && (
                    <span className="text-[10px] text-gray-500">
                      +{template.variables.length - 2}
                    </span>
                  )}
                </div>
              )}
            </DropdownItem>
          ))}
        </div>
      </Dropdown>
    </div>
  );
}

export default QuickTemplateButton;
