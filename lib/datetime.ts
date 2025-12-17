/**
 * Datetime utilities for timezone conversion
 *
 * All timestamps are stored as UTC in ISO 8601 format.
 * Display timestamps are converted to user's browser local timezone.
 *
 * @see FR-008a, FR-008b, Constitution VII
 */

/**
 * Checks if a given ISO date string represents today in local timezone.
 *
 * @param isoString - UTC ISO 8601 date string
 * @returns true if the date is today, false otherwise
 */
export function isToday(isoString: string | null | undefined): boolean {
  if (!isoString) return false;

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return false;

    const today = new Date();
    return (
      date.getFullYear() === today.getFullYear() &&
      date.getMonth() === today.getMonth() &&
      date.getDate() === today.getDate()
    );
  } catch {
    return false;
  }
}

/**
 * Checks if a given ISO date string represents yesterday in local timezone.
 *
 * @param isoString - UTC ISO 8601 date string
 * @returns true if the date is yesterday, false otherwise
 */
export function isYesterday(isoString: string | null | undefined): boolean {
  if (!isoString) return false;

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return false;

    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    return (
      date.getFullYear() === yesterday.getFullYear() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getDate() === yesterday.getDate()
    );
  } catch {
    return false;
  }
}

/**
 * Checks if a given ISO date string is within the current week (last 7 days).
 *
 * @param isoString - UTC ISO 8601 date string
 * @returns true if the date is within this week, false otherwise
 */
export function isThisWeek(isoString: string | null | undefined): boolean {
  if (!isoString) return false;

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return false;

    const now = new Date();
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    weekAgo.setHours(0, 0, 0, 0);

    return date >= weekAgo && date <= now;
  } catch {
    return false;
  }
}

/**
 * Checks if two ISO date strings represent the same day in local timezone.
 *
 * @param iso1 - First UTC ISO 8601 date string
 * @param iso2 - Second UTC ISO 8601 date string
 * @returns true if both dates are on the same day, false otherwise
 */
export function isSameDay(
  iso1: string | null | undefined,
  iso2: string | null | undefined,
): boolean {
  if (!iso1 || !iso2) return false;

  try {
    const date1 = new Date(iso1);
    const date2 = new Date(iso2);

    if (isNaN(date1.getTime()) || isNaN(date2.getTime())) return false;

    return (
      date1.getFullYear() === date2.getFullYear() &&
      date1.getMonth() === date2.getMonth() &&
      date1.getDate() === date2.getDate()
    );
  } catch {
    return false;
  }
}

/**
 * Converts a UTC ISO string to a local timezone ISO string.
 *
 * @param isoString - UTC ISO 8601 date string
 * @returns Local timezone ISO string, or empty string if invalid
 */
export function toLocalISOString(isoString: string | null | undefined): string {
  if (!isoString) return "";

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";

    const offset = date.getTimezoneOffset();
    const localDate = new Date(date.getTime() - offset * 60 * 1000);

    return localDate.toISOString().slice(0, -1);
  } catch {
    return "";
  }
}

/**
 * Formats a message timestamp based on how recent it is.
 *
 * - For messages within today: show time only "3:45 PM"
 * - For messages within this week: show day and time "Mon 3:45 PM"
 * - For older messages: show date "Nov 28, 3:45 PM"
 *
 * @param isoString - UTC ISO 8601 date string
 * @returns Formatted time string, or empty string if invalid
 */
export function formatMessageTime(
  isoString: string | null | undefined,
): string {
  if (!isoString) return "";

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";

    const timeFormatter = new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });

    if (isToday(isoString)) {
      // Today: show time only "3:45 PM"
      return timeFormatter.format(date);
    }

    if (isThisWeek(isoString)) {
      // This week: show day and time "Mon 3:45 PM"
      const dayFormatter = new Intl.DateTimeFormat(undefined, {
        weekday: "short",
      });
      return `${dayFormatter.format(date)} ${timeFormatter.format(date)}`;
    }

    // Older: show date "Nov 28, 3:45 PM"
    const dateFormatter = new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "numeric",
    });
    return `${dateFormatter.format(date)}, ${timeFormatter.format(date)}`;
  } catch {
    return "";
  }
}

/**
 * Formats a timestamp as a relative time string.
 *
 * - "just now" for < 1 minute
 * - "2 minutes ago" for < 1 hour
 * - "3 hours ago" for < 24 hours
 * - Otherwise uses formatMessageTime
 *
 * @param isoString - UTC ISO 8601 date string
 * @returns Relative time string, or empty string if invalid
 */
export function formatRelativeTime(
  isoString: string | null | undefined,
): string {
  if (!isoString) return "";

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";

    const now = new Date();
    const diffMs = now.getTime() - date.getTime();

    // Handle future dates
    if (diffMs < 0) {
      return formatMessageTime(isoString);
    }

    const diffMinutes = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMinutes < 1) {
      return "just now";
    }

    if (diffMinutes < 60) {
      return diffMinutes === 1 ? "1 minute ago" : `${diffMinutes} minutes ago`;
    }

    if (diffHours < 24) {
      return diffHours === 1 ? "1 hour ago" : `${diffHours} hours ago`;
    }

    return formatMessageTime(isoString);
  } catch {
    return "";
  }
}

/**
 * Formats a date for use as a message group header.
 *
 * - For today: "Today"
 * - For yesterday: "Yesterday"
 * - For this week: "Monday", "Tuesday", etc.
 * - Otherwise: "November 28, 2025"
 *
 * @param isoString - UTC ISO 8601 date string
 * @returns Formatted date header string, or empty string if invalid
 */
export function formatDateHeader(isoString: string | null | undefined): string {
  if (!isoString) return "";

  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "";

    if (isToday(isoString)) {
      return "Today";
    }

    if (isYesterday(isoString)) {
      return "Yesterday";
    }

    if (isThisWeek(isoString)) {
      const dayFormatter = new Intl.DateTimeFormat(undefined, {
        weekday: "long",
      });
      return dayFormatter.format(date);
    }

    // Older dates: "November 28, 2025"
    const dateFormatter = new Intl.DateTimeFormat(undefined, {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    return dateFormatter.format(date);
  } catch {
    return "";
  }
}
