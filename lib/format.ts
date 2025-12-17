/**
 * Formatting utilities for patient and conversation data
 *
 * Used for consistent display of dates, timestamps, and patient information
 * across the SMS Outreach application.
 *
 * @see FR-008a, FR-008b, Constitution VII
 */

/**
 * Formats a patient's date of birth for display.
 *
 * Converts ISO 8601 date string to human-readable format: "MMM DD, YYYY"
 * Example: "1980-01-02" → "Jan 02, 1980"
 *
 * @param dateString - ISO 8601 date string (YYYY-MM-DD or full timestamp)
 * @returns Formatted date string in "MMM DD, YYYY" format
 * @throws Error if dateString is invalid
 *
 * @example
 * formatPatientDob("1980-01-02") // Returns "Jan 02, 1980"
 * formatPatientDob("1995-12-25T00:00:00Z") // Returns "Dec 25, 1995"
 */
export function formatPatientDob(dateString: string): string {
  if (!dateString) {
    throw new Error("Date string is required");
  }

  try {
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
      throw new Error("Invalid date string");
    }

    // Use Intl.DateTimeFormat for locale-aware formatting
    // Force UTC to avoid timezone conversion (DOB is stored as date-only)
    const formatter = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      timeZone: "UTC",
    });

    return formatter.format(date);
  } catch (error) {
    console.error("Error formatting patient DOB:", error);
    throw new Error(`Invalid date format: ${dateString}`);
  }
}

/**
 * Formats a UTC timestamp to local time with timezone information.
 *
 * Converts ISO 8601 UTC timestamp to user's local timezone.
 * Example: "2025-01-15T14:30:00Z" → "Jan 15, 2025 at 9:30 AM EST"
 *
 * @param utcString - ISO 8601 UTC timestamp string
 * @returns Formatted timestamp in user's local timezone
 * @throws Error if utcString is invalid
 *
 * @example
 * formatLocalTimestamp("2025-01-15T14:30:00Z")
 * // Returns "Jan 15, 2025 at 9:30 AM EST" (when in Eastern timezone)
 */
export function formatLocalTimestamp(utcString: string): string {
  if (!utcString) {
    throw new Error("UTC timestamp string is required");
  }

  try {
    const date = new Date(utcString);
    if (isNaN(date.getTime())) {
      throw new Error("Invalid timestamp string");
    }

    // Format date part
    const dateFormatter = new Intl.DateTimeFormat("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });

    // Format time part with timezone
    const timeFormatter = new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZoneName: "short",
    });

    const datePart = dateFormatter.format(date);
    const timePart = timeFormatter.format(date);

    return `${datePart} at ${timePart}`;
  } catch (error) {
    console.error("Error formatting local timestamp:", error);
    throw new Error(`Invalid timestamp format: ${utcString}`);
  }
}

/**
 * Formats patient's full name for display.
 *
 * Combines first and last name with proper spacing and capitalization.
 *
 * @param firstName - Patient's first name
 * @param lastName - Patient's last name
 * @returns Formatted full name or fallback text
 *
 * @example
 * formatPatientName("John", "Doe") // Returns "John Doe"
 * formatPatientName("John", null) // Returns "John"
 * formatPatientName(null, null) // Returns "Unknown Patient"
 */
export function formatPatientName(
  firstName: string | null | undefined,
  lastName: string | null | undefined,
): string {
  const first = firstName?.trim() || "";
  const last = lastName?.trim() || "";

  if (first && last) {
    return `${first} ${last}`;
  }
  if (first) {
    return first;
  }
  if (last) {
    return last;
  }

  return "Unknown Patient";
}
