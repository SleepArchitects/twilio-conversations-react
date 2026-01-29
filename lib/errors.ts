/**
 * Error handling utilities for consistent user-facing error messages
 */

import { ApiError } from "./api";

/**
 * Extract a user-friendly error message from any error type
 * Handles Error objects, ApiError, strings, and unknown types
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  // Handle plain objects with message property
  if (error && typeof error === "object" && "message" in error) {
    const msg = (error as any).message;
    if (typeof msg === "string") {
      return msg;
    }
  }

  return "An unexpected error occurred. Please try again.";
}

/**
 * Convert backend error messages to user-friendly text
 * Maps technical errors to readable messages
 */
export function getUserFriendlyError(error: unknown): string {
  const message = getErrorMessage(error);

  // Map common backend errors to user-friendly messages
  const errorMap: Record<string, string> = {
    "Failed to fetch":
      "Unable to connect to the server. Please check your internet connection.",
    "Network error":
      "Network error. Please check your connection and try again.",
    UNAUTHORIZED: "Your session has expired. Please log in again.",
    FORBIDDEN: "You do not have permission to perform this action.",
    NOT_FOUND: "The requested resource was not found.",
    VALIDATION_ERROR: "Please check your input and try again.",
    DUPLICATE_PHONE: "A conversation with this phone number already exists.",
    INVALID_PHONE: "Please enter a valid US phone number (10 digits).",
  };

  // Check for exact matches
  for (const [key, friendlyMessage] of Object.entries(errorMap)) {
    if (message.includes(key)) {
      return friendlyMessage;
    }
  }

  // Return original message if no mapping found
  return message;
}

/**
 * Log error for debugging while returning user-friendly message
 */
export function logAndFormatError(error: unknown, context?: string): string {
  const contextStr = context ? `[${context}]` : "";
  console.error(`${contextStr} Error:`, error);
  return getUserFriendlyError(error);
}
