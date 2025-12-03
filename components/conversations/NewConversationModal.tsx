"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import { api, ApiError } from "@/lib/api";
import {
  formatPhoneNumber,
  formatDisplayPhoneNumber,
  isValidUSPhoneNumber,
  getPhoneValidationError,
} from "@/lib/validation";

// =============================================================================
// Types & Interfaces
// =============================================================================

export interface NewConversationModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal is closed */
  onClose: () => void;
  /** Callback when a new conversation is created */
  onConversationCreated: (conversationId: string) => void;
  /** Callback when an existing conversation is found (for redirect) */
  onExistingConversation?: (conversationId: string) => void;
  /** Coordinator's name from Auth0 session */
  coordinatorName?: string;
  /** Practice name from Auth0 claims */
  practiceName?: string;
}

interface CreateConversationRequest {
  patientPhone: string;
  patientName?: string;
  initialMessage?: string;
}

interface CreateConversationResponse {
  id: string;
  twilioSid: string;
  patientPhone: string;
  friendlyName: string;
}

interface ConversationListResponse {
  data: Array<{
    id: string;
    patientPhone: string;
    friendlyName: string;
  }>;
  pagination: {
    total: number;
  };
}

// =============================================================================
// Constants
// =============================================================================

const MAX_NAME_LENGTH = 255;
const MAX_MESSAGE_LENGTH = 1600;

// Default greeting template
const DEFAULT_GREETING_TEMPLATE =
  "Hi, this is {coordinatorName} from Sleep Architects on behalf of {practiceName}. I'm reaching out to help you with your sleep health journey.";

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Escapes HTML entities to prevent XSS attacks
 */
function escapeHtml(text: string): string {
  const htmlEntities: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#x27;",
    "/": "&#x2F;",
  };
  return text.replace(/[&<>"'/]/g, (char) => htmlEntities[char] || char);
}

/**
 * Strips URLs/links from a string
 */
function stripUrls(text: string): string {
  // Match common URL patterns
  const urlPattern =
    /(?:https?:\/\/|www\.)[^\s]+|[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}(?:\/[^\s]*)?/gi;
  return text.replace(urlPattern, "").replace(/\s+/g, " ").trim();
}

/**
 * Sanitizes a friendly name according to requirements:
 * - Escape HTML entities
 * - Strip URLs
 * - Append practice name in parentheses
 * - Enforce max length
 */
function sanitizeFriendlyName(name: string, practiceName?: string): string {
  // Step 1: Escape HTML entities
  let sanitized = escapeHtml(name.trim());

  // Step 2: Strip URLs
  sanitized = stripUrls(sanitized);

  // Step 3: Append practice name if provided
  if (practiceName) {
    const suffix = ` (${practiceName})`;
    // Ensure total length doesn't exceed max
    const maxNamePart = MAX_NAME_LENGTH - suffix.length;
    if (sanitized.length > maxNamePart) {
      sanitized = sanitized.slice(0, maxNamePart);
    }
    sanitized = `${sanitized}${suffix}`;
  }

  // Step 4: Enforce max length
  if (sanitized.length > MAX_NAME_LENGTH) {
    sanitized = sanitized.slice(0, MAX_NAME_LENGTH);
  }

  return sanitized;
}

/**
 * Generates the initial greeting message from the template
 */
function generateGreeting(
  coordinatorName?: string,
  practiceName?: string,
): string {
  let greeting = DEFAULT_GREETING_TEMPLATE;

  greeting = greeting.replace(
    "{coordinatorName}",
    coordinatorName || "your care coordinator",
  );
  greeting = greeting.replace("{practiceName}", practiceName || "our practice");

  return greeting;
}

/**
 * Calculate SMS segment count for character display
 */
function calculateSegmentCount(characterCount: number): number {
  if (characterCount === 0) return 0;
  if (characterCount <= 160) return 1;
  return Math.ceil(characterCount / 153);
}

// =============================================================================
// Icon Components
// =============================================================================

interface IconProps extends React.SVGProps<SVGSVGElement> {
  className?: string;
}

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

function SpinnerIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      className={cn("h-5 w-5 animate-spin", className)}
      {...props}
    >
      <circle
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray="45 30"
      />
    </svg>
  );
}

function PhoneIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M2 3.5A1.5 1.5 0 0 1 3.5 2h1.148a1.5 1.5 0 0 1 1.465 1.175l.716 3.223a1.5 1.5 0 0 1-1.052 1.767l-.933.267c-.41.117-.643.555-.48.95a11.542 11.542 0 0 0 6.254 6.254c.395.163.833-.07.95-.48l.267-.933a1.5 1.5 0 0 1 1.767-1.052l3.223.716A1.5 1.5 0 0 1 18 15.352V16.5a1.5 1.5 0 0 1-1.5 1.5H15c-1.149 0-2.263-.15-3.326-.43A13.022 13.022 0 0 1 2.43 8.326 13.019 13.019 0 0 1 2 5V3.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function UserIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <path d="M10 8a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM3.465 14.493a1.23 1.23 0 0 0 .41 1.412A9.957 9.957 0 0 0 10 18c2.31 0 4.438-.784 6.131-2.1.43-.333.604-.903.408-1.41a7.002 7.002 0 0 0-13.074.003Z" />
    </svg>
  );
}

function ChatBubbleIcon({ className, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      className={cn("h-5 w-5", className)}
      {...props}
    >
      <path
        fillRule="evenodd"
        d="M10 2c-2.236 0-4.43.18-6.57.524C1.993 2.755 1 4.014 1 5.426v5.148c0 1.413.993 2.67 2.43 2.902 1.168.188 2.352.327 3.55.414.28.02.521.18.642.413l1.713 3.293a.75.75 0 0 0 1.33 0l1.713-3.293a.783.783 0 0 1 .642-.413 41.102 41.102 0 0 0 3.55-.414c1.437-.231 2.43-1.49 2.43-2.902V5.426c0-1.413-.993-2.67-2.43-2.902A41.289 41.289 0 0 0 10 2ZM6.75 6a.75.75 0 0 0 0 1.5h6.5a.75.75 0 0 0 0-1.5h-6.5Zm0 2.5a.75.75 0 0 0 0 1.5h3.5a.75.75 0 0 0 0-1.5h-3.5Z"
        clipRule="evenodd"
      />
    </svg>
  );
}

// =============================================================================
// NewConversationModal Component
// =============================================================================

/**
 * Modal for creating a new SMS conversation.
 *
 * Features:
 * - Phone number input with validation and formatting
 * - Friendly name input with sanitization
 * - Pre-populated initial message with greeting template
 * - Duplicate phone detection with auto-redirect
 * - Focus trap and keyboard accessibility
 */
export function NewConversationModal({
  isOpen,
  onClose,
  onConversationCreated,
  onExistingConversation,
  coordinatorName,
  practiceName,
}: NewConversationModalProps) {
  // Form state
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [displayPhone, setDisplayPhone] = React.useState("");
  const [friendlyName, setFriendlyName] = React.useState("");
  const [initialMessage, setInitialMessage] = React.useState("");

  // UI state
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [phoneError, setPhoneError] = React.useState<string | null>(null);
  const [nameError, setNameError] = React.useState<string | null>(null);
  const [messageError, setMessageError] = React.useState<string | null>(null);
  const [submitError, setSubmitError] = React.useState<string | null>(null);

  // Refs
  const modalRef = React.useRef<HTMLDivElement>(null);
  const phoneInputRef = React.useRef<HTMLInputElement>(null);
  const firstFocusableRef = React.useRef<HTMLButtonElement>(null);

  // Derived state
  const messageCharCount = initialMessage.length;
  const messageSegments = calculateSegmentCount(messageCharCount);

  // ==========================================================================
  // Effects
  // ==========================================================================

  // Initialize form when modal opens
  React.useEffect(() => {
    if (isOpen) {
      // Reset form state
      setPhoneNumber("");
      setDisplayPhone("");
      setFriendlyName("");
      setInitialMessage(generateGreeting(coordinatorName, practiceName));
      setPhoneError(null);
      setNameError(null);
      setMessageError(null);
      setSubmitError(null);
      setIsSubmitting(false);

      // Focus the phone input after render
      requestAnimationFrame(() => {
        phoneInputRef.current?.focus();
      });
    }
  }, [isOpen, coordinatorName, practiceName]);

  // Handle Escape key to close modal
  React.useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus trap
  React.useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    function handleTabKey(event: KeyboardEvent) {
      if (event.key !== "Tab") return;

      if (event.shiftKey) {
        if (document.activeElement === firstElement) {
          event.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          event.preventDefault();
          firstElement?.focus();
        }
      }
    }

    document.addEventListener("keydown", handleTabKey);
    return () => document.removeEventListener("keydown", handleTabKey);
  }, [isOpen]);

  // Prevent body scroll when modal is open
  React.useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // ==========================================================================
  // Handlers
  // ==========================================================================

  /**
   * Handle phone number input changes
   * Auto-formats to display format as user types
   */
  const handlePhoneChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setDisplayPhone(value);

      // Clear error on change
      if (phoneError) {
        setPhoneError(null);
      }

      // Format to E.164 for storage
      const formatted = formatPhoneNumber(value);
      setPhoneNumber(formatted);
    },
    [phoneError],
  );

  /**
   * Validate phone on blur and format for display
   */
  const handlePhoneBlur = React.useCallback(() => {
    if (!displayPhone.trim()) {
      setPhoneError(null);
      return;
    }

    const formatted = formatPhoneNumber(displayPhone);
    if (formatted && isValidUSPhoneNumber(formatted)) {
      // Show formatted display version
      setDisplayPhone(formatDisplayPhoneNumber(formatted));
      setPhoneNumber(formatted);
      setPhoneError(null);
    } else {
      const error = getPhoneValidationError(formatted || displayPhone);
      setPhoneError(error || "Invalid phone number format");
    }
  }, [displayPhone]);

  /**
   * Handle friendly name input
   */
  const handleNameChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const value = event.target.value;
      setFriendlyName(value);

      if (nameError) {
        setNameError(null);
      }
    },
    [nameError],
  );

  /**
   * Handle initial message input with auto-resize
   */
  const handleMessageChange = React.useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      const value = event.target.value;
      if (value.length <= MAX_MESSAGE_LENGTH) {
        setInitialMessage(value);
      }

      if (messageError) {
        setMessageError(null);
      }

      // Auto-resize
      const textarea = event.target;
      textarea.style.height = "auto";
      textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
    },
    [messageError],
  );

  /**
   * Check for duplicate phone number
   */
  const checkDuplicatePhone = React.useCallback(
    async (phone: string): Promise<string | null> => {
      try {
        const response = await api.get<ConversationListResponse>(
          "/api/outreach/conversations",
          { params: { phone, limit: 1 } },
        );

        if (response.data && response.data.length > 0) {
          return response.data[0].id;
        }
        return null;
      } catch (error) {
        // If the endpoint doesn't exist or returns an error, assume no duplicate
        console.error("Error checking for duplicate:", error);
        return null;
      }
    },
    [],
  );

  /**
   * Validate all form fields
   */
  const validateForm = React.useCallback((): boolean => {
    let isValid = true;

    // Validate phone
    if (!phoneNumber) {
      setPhoneError("Phone number is required");
      isValid = false;
    } else if (!isValidUSPhoneNumber(phoneNumber)) {
      setPhoneError("Invalid US phone number format");
      isValid = false;
    }

    // Validate name
    if (!friendlyName.trim()) {
      setNameError("Patient name is required");
      isValid = false;
    }

    // Validate message
    if (!initialMessage.trim()) {
      setMessageError("Initial message is required");
      isValid = false;
    }

    return isValid;
  }, [phoneNumber, friendlyName, initialMessage]);

  /**
   * Handle form submission
   */
  const handleSubmit = React.useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();

      // Clear previous submit error
      setSubmitError(null);

      // Validate form
      if (!validateForm()) {
        return;
      }

      setIsSubmitting(true);

      try {
        // Check for duplicate phone number first
        const existingConversationId = await checkDuplicatePhone(phoneNumber);

        if (existingConversationId) {
          // Redirect to existing conversation
          if (onExistingConversation) {
            onExistingConversation(existingConversationId);
          }
          onClose();
          return;
        }

        // Create new conversation
        const sanitizedName = sanitizeFriendlyName(friendlyName, practiceName);

        const request: CreateConversationRequest = {
          patientPhone: phoneNumber,
          patientName: sanitizedName,
          initialMessage: initialMessage.trim(),
        };

        const response = await api.post<CreateConversationResponse>(
          "/api/outreach/conversations",
          request,
        );

        // Success - call callback and close modal
        onConversationCreated(response.id);
        onClose();
      } catch (error) {
        if (error instanceof ApiError) {
          setSubmitError(error.message);
        } else {
          setSubmitError("An unexpected error occurred. Please try again.");
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [
      validateForm,
      checkDuplicatePhone,
      phoneNumber,
      onExistingConversation,
      onClose,
      friendlyName,
      practiceName,
      initialMessage,
      onConversationCreated,
    ],
  );

  /**
   * Handle backdrop click to close
   */
  const handleBackdropClick = React.useCallback(
    (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) {
        onClose();
      }
    },
    [onClose],
  );

  // Don't render if not open
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-conversation-title"
      aria-describedby="new-conversation-description"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={handleBackdropClick}
        aria-hidden="true"
      />

      {/* Modal */}
      <div
        ref={modalRef}
        className={cn(
          "relative z-10 w-full max-w-lg mx-4",
          "bg-gray-800 rounded-xl shadow-2xl",
          "border border-gray-700",
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-700">
          <div>
            <h2
              id="new-conversation-title"
              className="text-lg font-semibold text-white"
            >
              New Conversation
            </h2>
            <p
              id="new-conversation-description"
              className="text-sm text-gray-400 mt-0.5"
            >
              Start a new SMS conversation with a patient
            </p>
          </div>
          <button
            ref={firstFocusableRef}
            type="button"
            onClick={onClose}
            className={cn(
              "p-2 rounded-lg text-gray-400",
              "hover:text-white hover:bg-gray-700",
              "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800",
              "transition-colors",
            )}
            aria-label="Close modal"
          >
            <CloseIcon aria-hidden="true" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <div className="px-6 py-4 space-y-4">
            {/* Phone Number Input */}
            <div>
              <label
                htmlFor="phone-input"
                className="flex items-center gap-2 text-sm font-medium text-gray-200 mb-1.5"
              >
                <PhoneIcon
                  className="h-4 w-4 text-gray-400"
                  aria-hidden="true"
                />
                Phone Number
                <span className="text-red-400" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                ref={phoneInputRef}
                id="phone-input"
                type="tel"
                value={displayPhone}
                onChange={handlePhoneChange}
                onBlur={handlePhoneBlur}
                placeholder="(555) 123-4567"
                aria-required="true"
                aria-invalid={!!phoneError}
                aria-describedby={phoneError ? "phone-error" : undefined}
                disabled={isSubmitting}
                className={cn(
                  "w-full px-4 py-2.5 rounded-lg text-sm",
                  "bg-gray-900 text-white placeholder:text-gray-500",
                  "border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-colors",
                  phoneError
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-600 focus:ring-purple-500",
                )}
              />
              {phoneError && (
                <p
                  id="phone-error"
                  className="mt-1.5 text-sm text-red-400"
                  role="alert"
                >
                  {phoneError}
                </p>
              )}
            </div>

            {/* Friendly Name Input */}
            <div>
              <label
                htmlFor="name-input"
                className="flex items-center gap-2 text-sm font-medium text-gray-200 mb-1.5"
              >
                <UserIcon
                  className="h-4 w-4 text-gray-400"
                  aria-hidden="true"
                />
                Patient Name
                <span className="text-red-400" aria-hidden="true">
                  *
                </span>
              </label>
              <input
                id="name-input"
                type="text"
                value={friendlyName}
                onChange={handleNameChange}
                placeholder="John Doe"
                aria-required="true"
                aria-invalid={!!nameError}
                aria-describedby={nameError ? "name-error" : "name-hint"}
                disabled={isSubmitting}
                maxLength={MAX_NAME_LENGTH}
                className={cn(
                  "w-full px-4 py-2.5 rounded-lg text-sm",
                  "bg-gray-900 text-white placeholder:text-gray-500",
                  "border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-colors",
                  nameError
                    ? "border-red-500 focus:ring-red-500"
                    : "border-gray-600 focus:ring-purple-500",
                )}
              />
              {nameError ? (
                <p
                  id="name-error"
                  className="mt-1.5 text-sm text-red-400"
                  role="alert"
                >
                  {nameError}
                </p>
              ) : (
                <p id="name-hint" className="mt-1.5 text-xs text-gray-500">
                  {practiceName
                    ? `Will be saved as "${friendlyName || "Name"} (${practiceName})"`
                    : "Enter the patient's display name"}
                </p>
              )}
            </div>

            {/* Initial Message Input */}
            <div>
              <label
                htmlFor="message-input"
                className="flex items-center gap-2 text-sm font-medium text-gray-200 mb-1.5"
              >
                <ChatBubbleIcon
                  className="h-4 w-4 text-gray-400"
                  aria-hidden="true"
                />
                Initial Message
                <span className="text-red-400" aria-hidden="true">
                  *
                </span>
              </label>
              <textarea
                id="message-input"
                value={initialMessage}
                onChange={handleMessageChange}
                placeholder="Enter your initial message..."
                aria-required="true"
                aria-invalid={!!messageError}
                aria-describedby="message-status"
                disabled={isSubmitting}
                rows={4}
                className={cn(
                  "w-full px-4 py-2.5 rounded-lg text-sm resize-none",
                  "bg-gray-900 text-white placeholder:text-gray-500",
                  "border focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  "transition-colors",
                  messageError
                    ? "border-red-500 focus:ring-red-500"
                    : messageCharCount > 160
                      ? "border-yellow-500/50 focus:ring-yellow-500"
                      : "border-gray-600 focus:ring-purple-500",
                )}
                style={{ minHeight: "100px", maxHeight: "200px" }}
              />
              <div
                id="message-status"
                className="flex items-center justify-between mt-1.5 text-xs"
              >
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      "tabular-nums",
                      messageCharCount > 160
                        ? "text-yellow-500"
                        : "text-gray-400",
                    )}
                  >
                    {messageCharCount} / 160
                  </span>
                  {messageSegments > 1 && (
                    <>
                      <span className="text-gray-600">•</span>
                      <span className="text-gray-400">
                        {messageSegments} segments
                      </span>
                    </>
                  )}
                </div>
                {messageError && (
                  <span className="text-red-400" role="alert">
                    {messageError}
                  </span>
                )}
              </div>
            </div>

            {/* Submit Error */}
            {submitError && (
              <div
                className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20"
                role="alert"
              >
                <p className="text-sm text-red-400">{submitError}</p>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-700">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium",
                "text-gray-300 bg-gray-700",
                "hover:bg-gray-600 hover:text-white",
                "focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "transition-colors",
              )}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium",
                "text-white",
                "bg-gradient-to-r from-purple-600 to-blue-600",
                "hover:from-purple-500 hover:to-blue-500",
                "focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2 focus:ring-offset-gray-800",
                "disabled:opacity-50 disabled:cursor-not-allowed",
                "shadow-lg shadow-purple-500/25",
                "transition-all",
                "flex items-center gap-2",
              )}
            >
              {isSubmitting ? (
                <>
                  <SpinnerIcon className="h-4 w-4" aria-hidden="true" />
                  Creating...
                </>
              ) : (
                "Start Conversation"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default NewConversationModal;
