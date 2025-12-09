"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { Template } from "@/types/sms";

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface TemplatePreviewProps {
  /** Template to preview */
  template: Template | null;
  /** Variable values to substitute (optional, for preview) */
  variableValues?: Record<string, string>;
  /** Custom class name */
  className?: string;
}

// =============================================================================
// Utility Functions
// =============================================================================

// /**
//  * Extract variable names from template content using regex
//  * Matches {{variableName}} pattern
//  */
// function extractVariables(content: string): string[] {
//   const regex = /\{\{(\w+)\}\}/g;
//   const matches = Array.from(content.matchAll(regex));
//   return [...new Set(matches.map((match) => match[1]))];
// }

/**
 * Highlight variables in template content
 * Returns an array of text segments with metadata about variables
 */
function highlightVariables(content: string): Array<{
  text: string;
  isVariable: boolean;
  variableName?: string;
}> {
  const regex = /\{\{(\w+)\}\}/g;
  const segments: Array<{
    text: string;
    isVariable: boolean;
    variableName?: string;
  }> = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(content)) !== null) {
    // Add text before the variable
    if (match.index > lastIndex) {
      segments.push({
        text: content.slice(lastIndex, match.index),
        isVariable: false,
      });
    }

    // Add the variable
    segments.push({
      text: match[0], // Full match including {{ }}
      isVariable: true,
      variableName: match[1], // Variable name without braces
    });

    lastIndex = regex.lastIndex;
  }

  // Add remaining text after last variable
  if (lastIndex < content.length) {
    segments.push({
      text: content.slice(lastIndex),
      isVariable: false,
    });
  }

  // If no variables found, return the whole content as a single segment
  if (segments.length === 0) {
    segments.push({ text: content, isVariable: false });
  }

  return segments;
}

/**
 * Render template content with variable substitution
 */
function renderTemplate(
  content: string,
  variableValues: Record<string, string>,
): string {
  let rendered = content;
  Object.entries(variableValues).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    rendered = rendered.replace(regex, value);
  });
  return rendered;
}

// =============================================================================
// Component
// =============================================================================

/**
 * TemplatePreview - Component for displaying template content with variable highlighting
 *
 * Features:
 * - Displays template content
 * - Highlights {{variables}} with visual styling
 * - Shows template metadata (name, category, usage)
 * - Optionally renders with variable substitution
 */
export function TemplatePreview({
  template,
  variableValues,
  className,
}: TemplatePreviewProps): React.ReactElement | null {
  if (!template) {
    return (
      <div
        className={cn(
          "rounded-lg border border-gray-700 bg-gray-800 p-4 text-sm text-gray-400",
          className,
        )}
      >
        Select a template to preview
      </div>
    );
  }

  const content = variableValues
    ? renderTemplate(template.content, variableValues)
    : template.content;
  const segments = variableValues
    ? [{ text: content, isVariable: false }]
    : highlightVariables(template.content);

  return (
    <div
      className={cn(
        "flex flex-col gap-4 rounded-lg border border-gray-700 bg-gray-800 p-4",
        className,
      )}
    >
      {/* Template Metadata */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1">
          <h3 className="text-base font-semibold text-gray-100">
            {template.name}
          </h3>
          <div className="mt-1 flex items-center gap-2 text-xs text-gray-400">
            <span className="capitalize">{template.category}</span>
            {template.usageCount > 0 && (
              <>
                <span>•</span>
                <span>{template.usageCount} uses</span>
              </>
            )}
            {template.practiceId === null && (
              <>
                <span>•</span>
                <span className="text-blue-400">Global template</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Template Content */}
      <div className="rounded-lg border border-gray-700 bg-gray-900 p-3">
        <div className="text-sm text-gray-200">
          {segments.map((segment, index) => {
            if (segment.isVariable) {
              return (
                <span
                  key={index}
                  className="rounded bg-purple-900/40 px-1 py-0.5 font-mono text-purple-300"
                  title={`Variable: ${segment.variableName}`}
                >
                  {segment.text}
                </span>
              );
            }
            return <span key={index}>{segment.text}</span>;
          })}
        </div>
      </div>

      {/* Variables List */}
      {template.variables.length > 0 && (
        <div className="flex flex-col gap-2">
          <h4 className="text-xs font-medium text-gray-400">
            Required Variables:
          </h4>
          <div className="flex flex-wrap gap-2">
            {template.variables.map((variable) => {
              const hasValue = variableValues?.[variable] !== undefined;
              return (
                <div
                  key={variable}
                  className={cn(
                    "flex items-center gap-1 rounded border px-2 py-1 text-xs",
                    hasValue
                      ? "border-green-600/50 bg-green-900/20 text-green-300"
                      : "border-yellow-600/50 bg-yellow-900/20 text-yellow-300",
                  )}
                >
                  <span className="font-mono">{`{{${variable}}}`}</span>
                  {hasValue && <span className="text-[10px]">✓</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default TemplatePreview;
