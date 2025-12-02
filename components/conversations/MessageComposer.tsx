"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface MessageComposerProps {
  /** Callback when message is sent */
  onSend: (message: string) => Promise<void>;
  /** Whether the composer is disabled */
  disabled?: boolean;
  /** Placeholder text for the textarea */
  placeholder?: string;
  /** Maximum character length (default: 1600 for 10 segments) */
  maxLength?: number;
}

// =============================================================================
// SMS Segment Calculation Utilities
// =============================================================================

/**
 * GSM-7 character limits for SMS segments
 * - First segment: 160 characters
 * - Subsequent segments: 153 characters (7 chars used for UDH header)
 */
const GSM7_FIRST_SEGMENT = 160;
const GSM7_SUBSEQUENT_SEGMENT = 153;

/**
 * Calculate the number of SMS segments for a given message length
 * Assumes GSM-7 encoding (ASCII characters)
 */
function calculateSegmentCount(characterCount: number): number {
  if (characterCount === 0) return 0;
  if (characterCount <= GSM7_FIRST_SEGMENT) return 1;

  // For multi-segment messages, each segment uses 153 chars
  // because 7 chars are reserved for the UDH (User Data Header)
  return Math.ceil(characterCount / GSM7_SUBSEQUENT_SEGMENT);
}

/**
 * Get the character count color class based on count thresholds
 */
function getCharacterCountColor(count: number): string {
  if (count > GSM7_FIRST_SEGMENT) return "text-red-500";
  if (count > 140) return "text-yellow-500";
  return "text-gray-400";
}

// =============================================================================
// Icon Components
// =============================================================================

interface IconProps {
  className?: string;
  "aria-hidden"?: boolean;
}

/** Send icon (paper airplane) */
function SendIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <path d="M3.105 2.288a.75.75 0 0 0-.826.95l1.414 4.926A1.5 1.5 0 0 0 5.135 9.25h6.115a.75.75 0 0 1 0 1.5H5.135a1.5 1.5 0 0 0-1.442 1.086l-1.414 4.926a.75.75 0 0 0 .826.95 28.897 28.897 0 0 0 15.293-7.155.75.75 0 0 0 0-1.114A28.897 28.897 0 0 0 3.105 2.288Z" />
    </svg>
  );
}

/** Loading spinner icon */
function SpinnerIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="none"
      className={cn("h-5 w-5 animate-spin", className)}
      {...props}
    >
      <circle
        cx="10"
        cy="10"
        r="8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray="40 20"
      />
    </svg>
  );
}

// =============================================================================
// MessageComposer Component
// =============================================================================

/**
 * MessageComposer - A textarea-based message input component for SMS messaging
 *
 * Features:
 * - Character count display with color-coded warnings
 * - SMS segment count display for multi-segment messages
 * - Keyboard shortcuts: Enter to send, Shift+Enter for newline
 * - Disabled state handling for empty input or sending in progress
 * - Accessible with proper ARIA attributes
 */
export function MessageComposer({
  onSend,
  disabled = false,
  placeholder = "Type a message...",
  maxLength = 1600,
}: MessageComposerProps) {
  // State
  const [message, setMessage] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);

  // Refs
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Derived state
  const characterCount = message.length;
  const segmentCount = calculateSegmentCount(characterCount);
  const isOverLimit = characterCount > maxLength;
  const isEmpty = message.trim().length === 0;
  const isSendDisabled = disabled || isEmpty || isSending || isOverLimit;

  // Character count color
  const charCountColor = getCharacterCountColor(characterCount);

  /**
   * Handle sending the message
   */
  const handleSend = React.useCallback(async () => {
    if (isSendDisabled) return;

    const trimmedMessage = message.trim();
    if (!trimmedMessage) return;

    setIsSending(true);
    try {
      await onSend(trimmedMessage);
      setMessage("");
      // Reset textarea height after clearing
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    } catch (error) {
      // Error handling is delegated to the parent component
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
      // Refocus the textarea after sending
      textareaRef.current?.focus();
    }
  }, [isSendDisabled, message, onSend]);

  /**
   * Handle keyboard events
   * - Enter: Send message
   * - Shift+Enter: Insert newline
   */
  const handleKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        handleSend();
      }
    },
    [handleSend],
  );

  /**
   * Handle textarea input changes with auto-resize
   */
  const handleChange = React.useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const newValue = event.target.value;

      // Only update if within max length or if deleting
      if (newValue.length <= maxLength || newValue.length < message.length) {
        setMessage(newValue);
      }

      // Auto-resize textarea
      const textarea = event.target;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    },
    [maxLength, message.length],
  );

  /**
   * Generate segment info text
   */
  const segmentInfo = React.useMemo(() => {
    if (segmentCount <= 1) return null;
    return `${segmentCount} segments`;
  }, [segmentCount]);

  /**
   * Generate accessible description for screen readers
   */
  const ariaDescription = React.useMemo(() => {
    const parts = [`${characterCount} of ${maxLength} characters`];
    if (segmentCount > 1) {
      parts.push(`${segmentCount} SMS segments`);
    }
    if (characterCount > 140 && characterCount <= GSM7_FIRST_SEGMENT) {
      parts.push("Approaching character limit");
    }
    if (characterCount > GSM7_FIRST_SEGMENT) {
      parts.push("Message will be sent as multiple segments");
    }
    return parts.join(". ");
  }, [characterCount, maxLength, segmentCount]);

  return (
    <div className="flex flex-col gap-2 p-4 border-t border-gray-700 bg-gray-900">
      {/* Textarea container */}
      <div className="flex gap-3 items-end">
        <div className="relative flex-1">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled || isSending}
            rows={1}
            aria-label="Message input"
            aria-describedby="message-composer-status"
            aria-invalid={isOverLimit}
            className={cn(
              "w-full resize-none rounded-lg border bg-gray-800 px-4 py-3 text-sm text-gray-100",
              "placeholder:text-gray-500",
              "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900",
              "disabled:cursor-not-allowed disabled:opacity-50",
              "transition-colors duration-200",
              // Border colors based on state
              isOverLimit
                ? "border-red-500 focus:ring-red-500"
                : characterCount > 140
                  ? "border-yellow-500/50 focus:ring-yellow-500"
                  : "border-gray-600 focus:ring-purple-500",
            )}
            style={{ minHeight: "44px", maxHeight: "200px" }}
          />
        </div>

        {/* Send button */}
        <button
          type="button"
          onClick={handleSend}
          disabled={isSendDisabled}
          aria-label={isSending ? "Sending message" : "Send message"}
          className={cn(
            "flex-shrink-0 inline-flex items-center justify-center",
            "h-11 w-11 rounded-lg",
            "transition-all duration-200",
            "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900",
            // Enabled state: purple/blue gradient
            !isSendDisabled && [
              "bg-gradient-to-r from-purple-600 to-blue-600",
              "hover:from-purple-500 hover:to-blue-500",
              "text-white",
              "focus:ring-purple-500",
              "shadow-lg shadow-purple-500/25",
            ],
            // Disabled state: gray
            isSendDisabled && [
              "bg-gray-700",
              "text-gray-500",
              "cursor-not-allowed",
            ],
          )}
        >
          {isSending ? (
            <SpinnerIcon aria-hidden={true} />
          ) : (
            <SendIcon aria-hidden={true} />
          )}
        </button>
      </div>

      {/* Status bar: character count and segment info */}
      <div
        id="message-composer-status"
        className="flex items-center justify-between text-xs"
        role="status"
        aria-live="polite"
      >
        {/* Character count */}
        <div className="flex items-center gap-2">
          <span className={cn("tabular-nums", charCountColor)}>
            {characterCount} / {GSM7_FIRST_SEGMENT}
          </span>

          {/* Segment count (only shown for multi-segment messages) */}
          {segmentInfo && (
            <>
              <span className="text-gray-600">•</span>
              <span className="text-gray-400">{segmentInfo}</span>
            </>
          )}
        </div>

        {/* Keyboard shortcut hint */}
        <div className="text-gray-500 hidden sm:block">
          <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 text-[10px] font-mono">
            Enter
          </kbd>
          <span className="mx-1">to send</span>
          <kbd className="px-1.5 py-0.5 rounded bg-gray-800 text-gray-400 text-[10px] font-mono">
            Shift+Enter
          </kbd>
          <span className="ml-1">for newline</span>
        </div>
      </div>

      {/* Screen reader only: full description */}
      <span className="sr-only">{ariaDescription}</span>
    </div>
  );
}

export default MessageComposer;
