"use client";

import * as React from "react";
import { EmojiPicker as EmojiPickerPrimitive } from "frimousse";
import { Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types & Interfaces
// =============================================================================

/**
 * Emoji selection event data
 * @property emoji - The emoji character (e.g., "😀")
 * @property label - The emoji label/description (e.g., "grinning face")
 */
export interface EmojiSelectData {
  emoji: string;
  label: string;
}

/**
 * Props for the EmojiPicker component
 */
export interface EmojiPickerProps {
  /**
   * Callback fired when an emoji is selected
   * @param emoji - The selected emoji data
   */
  onEmojiSelect: (emoji: EmojiSelectData) => void;

  /**
   * Optional callback fired when the picker should close
   * Useful for parent components managing open/close state
   */
  onClose?: () => void;

  /**
   * Additional CSS classes to apply to the picker container
   */
  className?: string;
}

// =============================================================================
// EmojiPicker Component
// =============================================================================

/**
 * EmojiPicker - A wrapper around frimousse's EmojiPicker with custom styling
 *
 * This component provides a searchable, categorized emoji picker that matches
 * the application's dark theme. It includes:
 * - Search functionality with icon
 * - Categorized emoji grid with sticky headers
 * - Loading and empty states
 * - Keyboard navigation support
 * - Full accessibility with ARIA attributes
 *
 * @example
 * ```tsx
 * <EmojiPicker
 *   onEmojiSelect={(emoji) => console.log(emoji.emoji)}
 *   onClose={() => setShowPicker(false)}
 * />
 * ```
 */
export function EmojiPicker({
  onEmojiSelect,
  // onClose,
  className,
}: EmojiPickerProps) {
  return (
    <div
      className={cn(
        // Container sizing and layout
        "w-80 max-w-[95vw]",
        // Dark theme styling
        "rounded-lg border border-gray-700 bg-gray-800",
        // Spacing and shadow
        "p-3 shadow-lg",
        className,
      )}
      role="dialog"
      aria-label="Emoji picker"
      aria-modal="false"
    >
      <EmojiPickerPrimitive.Root onEmojiSelect={onEmojiSelect}>
        {/* Search Input */}
        <div className="mb-2 flex items-center gap-2 rounded-md border border-gray-600 bg-gray-700 px-3 py-2">
          <Search
            className="h-4 w-4 text-gray-400 flex-shrink-0"
            aria-hidden="true"
          />
          <EmojiPickerPrimitive.Search
            className={cn(
              "flex-1 bg-transparent text-sm text-gray-100",
              "placeholder:text-gray-400",
              "focus:outline-none",
              "border-0 p-0",
            )}
            placeholder="Search emojis..."
            aria-label="Search emojis"
            role="searchbox"
          />
        </div>

        {/* Emoji Grid Viewport */}
        <EmojiPickerPrimitive.Viewport
          className={cn(
            "h-64 w-full overflow-y-auto",
            "rounded-md border border-gray-700 bg-gray-900",
            // Custom scrollbar styling for dark theme
            "scrollbar-thin scrollbar-thumb-gray-600 scrollbar-track-gray-800",
          )}
        >
          {/* Loading State */}
          <EmojiPickerPrimitive.Loading>
            <div
              className="flex h-full items-center justify-center text-gray-400"
              role="status"
              aria-live="polite"
            >
              <Loader2 className="h-6 w-6 animate-spin" aria-hidden="true" />
              <span className="sr-only">Loading emojis...</span>
            </div>
          </EmojiPickerPrimitive.Loading>

          {/* Empty State (No Results) */}
          <EmojiPickerPrimitive.Empty>
            <div
              className="flex h-full items-center justify-center text-sm text-gray-400"
              role="status"
              aria-live="polite"
            >
              No emoji found.
            </div>
          </EmojiPickerPrimitive.Empty>

          {/* Emoji List with Custom Components */}
          <EmojiPickerPrimitive.List
            className="select-none pb-1.5"
            components={{
              /**
               * Category Header Component
               * Sticky header for each emoji category (e.g., "Smileys & Emotion")
               */
              CategoryHeader: ({ category, ...props }) => (
                <div
                  className={cn(
                    "sticky top-0 z-10",
                    "bg-gray-900 px-3 pb-1.5 pt-3",
                    "text-xs font-medium text-gray-400",
                    "border-b border-gray-800",
                  )}
                  {...props}
                >
                  {category.label}
                </div>
              ),

              /**
               * Row Component
               * Container for a row of emojis in the grid
               */
              Row: ({ children, ...props }) => (
                <div className="flex scroll-my-1.5 gap-1 px-1.5" {...props}>
                  {children}
                </div>
              ),

              /**
               * Emoji Button Component
               * Individual emoji button with hover and focus states
               */
              Emoji: ({ emoji, ...props }) => (
                <button
                  type="button"
                  className={cn(
                    // Size and layout
                    "flex h-8 w-8 items-center justify-center",
                    "text-lg",
                    // Styling
                    "rounded-md",
                    "transition-colors duration-150",
                    // Hover state
                    "hover:bg-gray-700",
                    // Focus state (keyboard navigation)
                    "focus:bg-gray-700 focus:outline-none",
                    "focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900",
                  )}
                  aria-label={emoji.label}
                  title={emoji.label}
                  {...props}
                >
                  {emoji.emoji}
                </button>
              ),
            }}
          />
        </EmojiPickerPrimitive.Viewport>
      </EmojiPickerPrimitive.Root>
    </div>
  );
}

/**
 * Display name for React DevTools
 */
EmojiPicker.displayName = "EmojiPicker";

export default EmojiPicker;
