"use client";

import * as React from "react";
import { Smile } from "lucide-react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types & Interfaces
// =============================================================================

/**
 * Props for the EmojiPickerButton component
 */
export interface EmojiPickerButtonProps {
  /**
   * Whether the emoji picker is currently visible
   */
  isOpen: boolean;

  /**
   * Callback function when the button is clicked
   */
  onClick: () => void;

  /**
   * Optional CSS class name for custom styling
   */
  className?: string;

  /**
   * Optional aria-label for accessibility
   * @default "Toggle emoji picker"
   */
  ariaLabel?: string;

  /**
   * Optional title attribute for tooltip
   * @default "Add emoji"
   */
  title?: string;

  /**
   * Whether the button is disabled
   * @default false
   */
  disabled?: boolean;
}

// =============================================================================
// EmojiPickerButton Component
// =============================================================================

/**
 * EmojiPickerButton - A button component that toggles the visibility of the emoji picker
 *
 * This component provides an accessible button to show/hide the emoji picker.
 * Features:
 * - Accessible with ARIA attributes (aria-label, aria-pressed)
 * - Visual feedback on hover, focus, and active states
 * - Responsive and mobile-friendly with proper touch target size
 * - Integrates with emoji picker state management
 * - Dark theme styling consistent with the application
 * - Uses lucide-react Smile icon
 *
 * @example
 * ```tsx
 * const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
 *
 * return (
 *   <>
 *     <EmojiPickerButton
 *       isOpen={isEmojiPickerOpen}
 *       onClick={() => setIsEmojiPickerOpen(!isEmojiPickerOpen)}
 *     />
 *     {isEmojiPickerOpen && <EmojiPicker onEmojiSelect={handleEmojiSelect} />}
 *   </>
 * );
 * ```
 */
export function EmojiPickerButton({
  isOpen,
  onClick,
  className,
  ariaLabel = "Toggle emoji picker",
  title = "Add emoji",
  disabled = false,
}: EmojiPickerButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      type="button"
      aria-label={ariaLabel}
      aria-pressed={isOpen}
      title={title}
      className={cn(
        // Layout and sizing
        "inline-flex items-center justify-center",
        "h-9 w-9",
        // Base styling
        "rounded-md",
        "text-gray-400",
        "bg-transparent",
        "transition-colors duration-200",
        // Hover state
        "hover:bg-gray-700 hover:text-gray-100",
        // Focus state (keyboard navigation)
        "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-900",
        // Active/Open state
        isOpen && "bg-gray-700 text-purple-400",
        // Disabled state
        "disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-gray-400",
        className,
      )}
    >
      <Smile className="h-5 w-5" aria-hidden="true" />
    </button>
  );
}

/**
 * Display name for React DevTools
 */
EmojiPickerButton.displayName = "EmojiPickerButton";

export default EmojiPickerButton;
