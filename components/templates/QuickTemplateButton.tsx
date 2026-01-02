"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { Tooltip } from "flowbite-react";
import type { Template } from "@/types/sms";
import LightningIcon from "@/components/icons/LightningIcon";

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
 * - Custom Dropdown/popover showing frequent templates
 * - Click to select template
 */
export function QuickTemplateButton({
  templates,
  onSelect,
  disabled = false,
  className,
}: QuickTemplateButtonProps): React.ReactElement | null {
  const [isOpen, setIsOpen] = React.useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  const handleSelect = React.useCallback(
    (template: Template) => {
      onSelect(template);
      setIsOpen(false);
    },
    [onSelect],
  );

  // Close on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Early return when there are no templates
  if (!templates || templates.length === 0) {
    return null;
  }

  console.log("QuickTemplateButton rendering with templates:", templates);

  return (
    <div className={cn("relative inline-flex", className)} ref={dropdownRef}>
      <Tooltip content="Quick templates" placement="top">
        <button
          type="button"
          onClick={() => !disabled && setIsOpen(!isOpen)}
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
          aria-haspopup="true"
          aria-expanded={isOpen}
        >
          <LightningIcon className="h-5 w-5" />
        </button>
      </Tooltip>

      {isOpen && (
        <div className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-gray-700 bg-gray-800 shadow-xl z-50 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-700 bg-gray-800/50">
            <span className="text-sm font-semibold text-gray-100">
              Quick Templates ({templates.length})
            </span>
          </div>
          <div className="max-h-64 overflow-y-auto py-1 min-h-[2rem]">
            {templates.map((template, index) => {
              if (!template) return null;
              return (
                <button
                  key={template.id || `template-${index}`}
                  onClick={() => handleSelect(template)}
                  className={cn(
                    "w-full text-left px-4 py-2 text-sm text-gray-300",
                    "hover:bg-gray-700 hover:text-white transition-colors",
                    "focus:outline-none focus:bg-gray-700 focus:text-white",
                    "border-b border-gray-700/50 last:border-0", // Add separators to see items better
                  )}
                >
                  <div className="font-medium truncate">
                    {template.name || "Untitled Template"}
                  </div>
                  <div className="text-xs text-gray-500 truncate mt-0.5">
                    {template.content || "No content"}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default QuickTemplateButton;
