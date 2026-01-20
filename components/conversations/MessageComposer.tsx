"use client";

import * as React from "react";
import { HiTemplate, HiChevronDown, HiChevronUp } from "react-icons/hi";
import { Tooltip } from "flowbite-react";
import { cn } from "@/lib/utils";
import { TemplateSelector } from "@/components/templates/TemplateSelector";
import { TemplatePreview } from "@/components/templates/TemplatePreview";
import { QuickTemplateButton } from "@/components/templates/QuickTemplateButton";
import { useTemplates, useFrequentTemplates } from "@/hooks/useTemplates";
import {
  EmojiPicker,
  type EmojiSelectData,
} from "@/components/conversations/EmojiPicker";
import { EmojiPickerButton } from "@/components/conversations/EmojiPickerButton";
import { insertEmojiAtCursor, addToRecentEmojis } from "@/lib/emoji";
import {
  detectUnresolvedVariables,
  renderTemplate,
  validateTemplateVariables,
} from "@/lib/templates";
import type { Template, TemplateCategory } from "@/types/sms";

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface MessageComposerProps {
  /** Callback when message is sent - includes optional templateId for usage tracking */
  onSend: (message: string, templateId?: string) => Promise<void>;
  /** Whether the composer is disabled */
  disabled?: boolean;
  /** Placeholder text for the textarea */
  placeholder?: string;
  /** Maximum character length (default: 1600 for 10 segments) */
  maxLength?: number;
  /** Values to substitute into templates (e.g., patient context) */
  variableValues?: Record<string, string>;
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

/** Close icon */
function CloseIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
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
  variableValues,
}: MessageComposerProps) {
  // State
  const [message, setMessage] = React.useState("");
  const [isSending, setIsSending] = React.useState(false);
  const [showTemplateSelector, setShowTemplateSelector] = React.useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = React.useState(false);
  const [showVariablePrompt, setShowVariablePrompt] = React.useState(false);
  const [pendingSend, setPendingSend] = React.useState<string | null>(null);
  const [categoryFilter, setCategoryFilter] = React.useState<
    TemplateCategory | "all"
  >("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [isPreviewExpanded, setIsPreviewExpanded] = React.useState(false);

  // Refs
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const modalRef = React.useRef<HTMLDivElement>(null);
  const variablePromptRef = React.useRef<HTMLDivElement>(null);
  const emojiPickerRef = React.useRef<HTMLDivElement>(null);

  // Template hooks
  const {
    templates,
    selectedTemplate,
    isLoading: isLoadingTemplates,
    selectTemplate,
    selectTemplateObject,
  } = useTemplates({
    category: categoryFilter,
    searchQuery,
  });

  const { data: frequentTemplates = [], isLoading: isLoadingFrequent } =
    useFrequentTemplates(5);

  // Prefer frequent templates; fall back to a handful of all templates so the
  // quick button is never empty in environments where frequent usage data is
  // unavailable.
  const quickTemplates = React.useMemo(() => {
    if (frequentTemplates && frequentTemplates.length > 0) {
      return frequentTemplates;
    }

    if (templates && templates.length > 0) {
      return templates.slice(0, 5);
    }

    return [] as typeof templates;
  }, [frequentTemplates, templates]);

  // Detect unresolved variables for validation
  const unresolvedVariables = React.useMemo(
    () => detectUnresolvedVariables(message || ""),
    [message],
  );
  const hasUnresolvedVars = unresolvedVariables.length > 0;

  // Derived state
  const characterCount = (message || "").length;
  const segmentCount = calculateSegmentCount(characterCount);
  const isOverLimit = characterCount > maxLength;
  const isEmpty = (message || "").trim().length === 0;
  // Per FR-022: Prevent sending if unresolved variables exist
  const isSendDisabled =
    disabled || isEmpty || isSending || isOverLimit || hasUnresolvedVars;

  // Character count color
  const charCountColor = getCharacterCountColor(characterCount);

  /**
   * Handle sending the message with variable validation and template tracking
   */
  const handleSend = React.useCallback(async () => {
    if (isSendDisabled) return;

    const trimmedMessage = (message || "").trim();
    if (!trimmedMessage) return;

    // Check for unresolved template variables
    const validation = validateTemplateVariables(trimmedMessage);
    if (!validation.isValid) {
      // Show variable prompt modal
      setPendingSend(trimmedMessage);
      setShowVariablePrompt(true);
      return;
    }

    // Proceed with sending
    setIsSending(true);
    try {
      // Pass template ID if message was created from a template (for usage tracking)
      await onSend(trimmedMessage, selectedTemplate?.id);
      setMessage("");
      // Reset textarea height after clearing
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      // Clear template selection
      selectTemplate(null);
    } catch (error) {
      // Error handling is delegated to the parent component
      console.error("Failed to send message:", error);
    } finally {
      setIsSending(false);
      // Refocus the textarea after sending
      textareaRef.current?.focus();
    }
  }, [isSendDisabled, message, onSend, selectTemplate, selectedTemplate]);

  /**
   * Handle emoji selection
   */
  const handleEmojiSelect = React.useCallback((emojiData: EmojiSelectData) => {
    if (textareaRef.current) {
      insertEmojiAtCursor(textareaRef.current, emojiData.emoji);
      // Update local state since insertEmojiAtCursor modifies the DOM element directly
      setMessage(textareaRef.current.value);
      addToRecentEmojis(emojiData.emoji);
    }
    // Keep picker open for multiple insertions, or close it?
    // Usually, it's better to keep it open for multiple emojis but close on click outside.
    // However, some UX patterns close it. Let's keep it open for now as it's more flexible.
  }, []);

  /**
   * Handle template selection
   */
  const handleTemplateSelect = React.useCallback(
    (template: Template) => {
      selectTemplateObject(template);
      const resolvedContent =
        variableValues && Object.keys(variableValues).length > 0
          ? renderTemplate(template.content || "", variableValues)
          : template.content || "";
      setMessage(resolvedContent);
      setShowTemplateSelector(false);
      // Focus textarea after template selection
      setTimeout(() => {
        textareaRef.current?.focus();
      }, 100);
    },
    [selectTemplateObject, variableValues],
  );

  /**
   * Handle quick template selection
   */
  const handleQuickTemplateSelect = React.useCallback(
    (template: Template) => {
      handleTemplateSelect(template);
    },
    [handleTemplateSelect],
  );

  /**
   * Handle variable prompt - user must close modal and fix variables
   * Per FR-022: System MUST prevent sending messages with unresolved variables
   */
  const handleVariablePromptClose = React.useCallback(() => {
    setShowVariablePrompt(false);
    setPendingSend(null);
    // Focus textarea so user can fix variables
    setTimeout(() => {
      textareaRef.current?.focus();
    }, 100);
  }, []);

  /**
   * Close template selector modal on backdrop click
   */
  const handleTemplateModalBackdrop = React.useCallback(
    (event: React.MouseEvent) => {
      if (
        modalRef.current &&
        !modalRef.current.contains(event.target as Node)
      ) {
        setShowTemplateSelector(false);
      }
    },
    [],
  );

  /**
   * Close emoji picker on click outside
   */
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        emojiPickerRef.current &&
        !emojiPickerRef.current.contains(event.target as Node)
      ) {
        setShowEmojiPicker(false);
      }
    };

    if (showEmojiPicker) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showEmojiPicker]);

  /**
   * Close variable prompt modal on backdrop click
   */
  const handleVariablePromptBackdrop = React.useCallback(
    (event: React.MouseEvent) => {
      if (
        variablePromptRef.current &&
        !variablePromptRef.current.contains(event.target as Node)
      ) {
        handleVariablePromptClose();
      }
    },
    [handleVariablePromptClose],
  );

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
      if (
        newValue.length <= maxLength ||
        newValue.length < (message || "").length
      ) {
        setMessage(newValue);
      }

      // Auto-resize textarea
      const textarea = event.target;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    },
    [maxLength, message],
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
    <>
      <div className="flex flex-col gap-2 p-4 border-t border-gray-700 bg-gray-900">
        {/* Template Preview (if template selected) */}
        {selectedTemplate && (
          <div className="mb-2 rounded-lg border border-gray-700 bg-gray-800/50 overflow-hidden">
            <button
              type="button"
              onClick={() => setIsPreviewExpanded(!isPreviewExpanded)}
              className="flex w-full items-center justify-between px-3 py-2 text-xs text-gray-400 hover:bg-gray-800 hover:text-gray-300 transition-colors focus:outline-none"
            >
              <span className="flex items-center gap-2">
                <span className="font-medium">Template:</span>
                <span className="text-gray-300">{selectedTemplate.name}</span>
              </span>
              {isPreviewExpanded ? (
                <HiChevronUp className="h-4 w-4" />
              ) : (
                <HiChevronDown className="h-4 w-4" />
              )}
            </button>

            {isPreviewExpanded && (
              <div className="px-3 pb-3 pt-1 border-t border-gray-700/50">
                <TemplatePreview
                  template={selectedTemplate}
                  variableValues={variableValues}
                />
              </div>
            )}
          </div>
        )}

        {/* Unresolved Variables Warning */}
        {hasUnresolvedVars && (
          <div
            className="flex items-center gap-2 rounded-lg border border-yellow-600/50 bg-yellow-900/20 px-3 py-2 text-xs text-yellow-300"
            role="alert"
          >
            <span>⚠️</span>
            <span>
              The following snippets need to be filled in:{" "}
              {unresolvedVariables.map((v) => `{{${v}}}`).join(", ")}
            </span>
          </div>
        )}

        {/* Textarea container */}
        <div className="flex gap-2 items-end">
          {/* Quick Template Button - show once we have any templates available */}
          {!isLoadingFrequent &&
            !isLoadingTemplates &&
            quickTemplates.length > 0 && (
              <QuickTemplateButton
                templates={quickTemplates}
                onSelect={handleQuickTemplateSelect}
                disabled={disabled || isSending}
              />
            )}

          {/* Template Selector Button */}
          <Tooltip content="Select message template" placement="top">
            <button
              type="button"
              onClick={() => setShowTemplateSelector(true)}
              disabled={disabled || isSending}
              aria-label="Select template"
              className={cn(
                "flex-shrink-0 inline-flex items-center justify-center",
                "h-11 w-11 rounded-lg",
                "transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900",
                disabled || isSending
                  ? "bg-gray-700 text-gray-500 cursor-not-allowed opacity-50"
                  : [
                      "bg-gray-800 text-gray-300 border border-gray-700",
                      "hover:bg-gray-700 hover:text-white",
                      "focus:ring-purple-500",
                    ],
              )}
            >
              <HiTemplate className="h-5 w-5" aria-hidden={true} />
            </button>
          </Tooltip>

          {/* Emoji Picker Button & Popup */}
          <Tooltip content="Add emoji" placement="top">
            <div className="relative flex-shrink-0">
              <EmojiPickerButton
                isOpen={showEmojiPicker}
                onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                disabled={disabled || isSending}
                className="h-11 w-11 rounded-lg bg-gray-800 border border-gray-700 hover:bg-gray-700"
              />
              {showEmojiPicker && (
                <div
                  ref={emojiPickerRef}
                  className="absolute bottom-full left-0 mb-2 z-50"
                >
                  <EmojiPicker
                    onEmojiSelect={handleEmojiSelect}
                    onClose={() => setShowEmojiPicker(false)}
                  />
                </div>
              )}
            </div>
          </Tooltip>

          <div className="relative flex-1 flex items-end">
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
              aria-invalid={isOverLimit || hasUnresolvedVars}
              className={cn(
                "w-full resize-none rounded-lg border bg-gray-800 px-4 py-3 text-sm text-gray-100",
                "placeholder:text-gray-500",
                "focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-900",
                "disabled:cursor-not-allowed disabled:opacity-50",
                "transition-colors duration-200",
                // Border colors based on state
                isOverLimit
                  ? "border-red-500 focus:ring-red-500"
                  : hasUnresolvedVars
                    ? "border-yellow-500/50 focus:ring-yellow-500"
                    : characterCount > 140
                      ? "border-yellow-500/50 focus:ring-yellow-500"
                      : "border-gray-600 focus:ring-purple-500",
              )}
              style={{ minHeight: "44px", maxHeight: "200px" }}
            />
          </div>

          {/* Send button */}
          <Tooltip
            content={isSending ? "Sending message" : "Send message"}
            placement="top"
          >
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
          </Tooltip>
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

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleTemplateModalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="template-selector-title"
        >
          <div
            ref={modalRef}
            className={cn(
              "relative z-10 w-full max-w-2xl mx-4",
              "bg-gray-800 rounded-xl shadow-2xl",
              "border border-gray-700",
              "max-h-[90vh] overflow-hidden flex flex-col",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2
                id="template-selector-title"
                className="text-lg font-semibold text-white"
              >
                Select Template
              </h2>
              <button
                type="button"
                onClick={() => setShowTemplateSelector(false)}
                className={cn(
                  "p-2 rounded-lg text-gray-400",
                  "hover:text-white hover:bg-gray-700",
                  "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800",
                  "transition-colors",
                )}
                aria-label="Close template selector"
              >
                <CloseIcon aria-hidden={true} />
              </button>
            </div>

            {/* Template Selector */}
            <div className="flex-1 overflow-y-auto p-6">
              <TemplateSelector
                templates={templates}
                selectedTemplateId={selectedTemplate?.id || null}
                onSelect={handleTemplateSelect}
                categoryFilter={categoryFilter}
                onCategoryChange={setCategoryFilter}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                isLoading={isLoadingTemplates}
              />
            </div>
          </div>
        </div>
      )}

      {/* Variable Prompt Modal */}
      {showVariablePrompt && pendingSend && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={handleVariablePromptBackdrop}
          role="dialog"
          aria-modal="true"
          aria-labelledby="variable-prompt-title"
        >
          <div
            ref={variablePromptRef}
            className={cn(
              "relative z-10 w-full max-w-md mx-4",
              "bg-gray-800 rounded-xl shadow-2xl",
              "border border-gray-700",
            )}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
              <h2
                id="variable-prompt-title"
                className="text-lg font-semibold text-yellow-300"
              >
                Unresolved Template Variables
              </h2>
              <button
                type="button"
                onClick={handleVariablePromptClose}
                className={cn(
                  "p-2 rounded-lg text-gray-400",
                  "hover:text-white hover:bg-gray-700",
                  "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800",
                  "transition-colors",
                )}
                aria-label="Close"
              >
                <CloseIcon aria-hidden={true} />
              </button>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              <p className="text-sm text-gray-300 mb-4">
                Your message contains unresolved template variables that must be
                replaced before sending:
              </p>
              <div className="mb-4 rounded-lg border border-red-600/50 bg-red-900/20 p-3">
                <div className="flex flex-wrap gap-2">
                  {unresolvedVariables.map((variable) => (
                    <span
                      key={variable}
                      className="rounded bg-red-900/40 px-2 py-1 text-xs font-mono text-red-300"
                    >
                      {`{{${variable}}}`}
                    </span>
                  ))}
                </div>
              </div>
              <p className="text-sm text-gray-400">
                Please replace all variables in the message before sending. The
                send button is disabled until all variables are resolved.
              </p>
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end px-6 py-4 border-t border-gray-700">
              <button
                type="button"
                onClick={handleVariablePromptClose}
                className={cn(
                  "px-4 py-2 rounded-lg text-sm font-medium",
                  "bg-purple-600 text-white",
                  "hover:bg-purple-500",
                  "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800",
                  "transition-colors",
                )}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default MessageComposer;
