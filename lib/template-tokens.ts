/**
 * Template Token Replacement Utilities
 *
 * Handles personalization of SMS templates by replacing tokens like
 * {patient_name}, {date}, {time}, {doctor_name}, etc. with actual values.
 *
 * Based on PHASE-6B-BACKEND-HANDOVER.md token replacement requirements.
 */

/**
 * Token values that can be replaced in templates
 */
export interface TokenValues {
  patient_name?: string;
  date?: string;
  time?: string;
  doctor_name?: string;
  amount?: string;
  balance?: string;
  [key: string]: string | undefined; // Allow additional custom tokens
}

/**
 * Replace tokens in template content with provided values.
 *
 * Tokens use single curly braces: {token_name}
 * Case-sensitive matching.
 *
 * @param template - Template content with {token} placeholders
 * @param values - Object mapping token names to replacement values
 * @returns Template with tokens replaced by values
 *
 * @example
 * ```typescript
 * const message = replaceTokens(
 *   "Hi {patient_name}, your appointment is on {date} at {time}.",
 *   {
 *     patient_name: "John Doe",
 *     date: "December 10, 2025",
 *     time: "2:00 PM"
 *   }
 * );
 * // Returns: "Hi John Doe, your appointment is on December 10, 2025 at 2:00 PM."
 * ```
 */
export function replaceTokens(template: string, values: TokenValues): string {
  let result = template;

  // Replace each token with its value
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      // Use global regex to replace all occurrences of the token
      const tokenRegex = new RegExp(`\\{${key}\\}`, "g");
      result = result.replace(tokenRegex, value);
    }
  });

  return result;
}

/**
 * Extract all token names from a template.
 * Returns unique token names found in the template.
 *
 * @param template - Template content with {token} placeholders
 * @returns Array of unique token names (without braces)
 *
 * @example
 * ```typescript
 * const tokens = extractTokens("Hi {patient_name}, see you on {date} at {time}.");
 * // Returns: ["patient_name", "date", "time"]
 * ```
 */
export function extractTokens(template: string): string[] {
  const tokenRegex = /\{([a-zA-Z_][a-zA-Z0-9_]*)\}/g;
  const tokens: string[] = [];
  let match;

  while ((match = tokenRegex.exec(template)) !== null) {
    const tokenName = match[1];
    if (!tokens.includes(tokenName)) {
      tokens.push(tokenName);
    }
  }

  return tokens;
}

/**
 * Check if a template has any unfilled tokens (tokens without values).
 *
 * @param template - Template content after token replacement
 * @returns True if there are unfilled tokens remaining
 *
 * @example
 * ```typescript
 * const hasUnfilled = hasUnfilledTokens("Hi {patient_name}, see you soon!");
 * // Returns: true (patient_name token is not filled)
 *
 * const hasUnfilled2 = hasUnfilledTokens("Hi John Doe, see you soon!");
 * // Returns: false (no tokens remaining)
 * ```
 */
export function hasUnfilledTokens(template: string): boolean {
  return /\{[a-zA-Z_][a-zA-Z0-9_]*\}/.test(template);
}

/**
 * Get list of missing tokens (tokens present in template but not in values).
 *
 * @param template - Template content with {token} placeholders
 * @param values - Object mapping token names to replacement values
 * @returns Array of token names that are missing values
 *
 * @example
 * ```typescript
 * const missing = getMissingTokens(
 *   "Hi {patient_name}, appointment on {date} at {time}.",
 *   { patient_name: "John Doe", date: "Dec 10" }
 * );
 * // Returns: ["time"]
 * ```
 */
export function getMissingTokens(
  template: string,
  values: TokenValues,
): string[] {
  const allTokens = extractTokens(template);
  return allTokens.filter((token) => !values[token] || values[token] === "");
}

/**
 * Validate that all required tokens have values.
 *
 * @param template - Template content with {token} placeholders
 * @param values - Object mapping token names to replacement values
 * @returns Object with isValid flag and array of missing token names
 *
 * @example
 * ```typescript
 * const validation = validateTokens(
 *   "Hi {patient_name}, see you on {date}.",
 *   { patient_name: "John" }
 * );
 * // Returns: { isValid: false, missingTokens: ["date"] }
 * ```
 */
export function validateTokens(
  template: string,
  values: TokenValues,
): { isValid: boolean; missingTokens: string[] } {
  const missingTokens = getMissingTokens(template, values);
  return {
    isValid: missingTokens.length === 0,
    missingTokens,
  };
}

/**
 * Format a date for use in SMS templates.
 * Converts Date object to readable format: "December 10, 2025"
 *
 * @param date - Date object to format
 * @returns Formatted date string
 */
export function formatDateToken(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/**
 * Format a time for use in SMS templates.
 * Converts Date object to readable time format: "2:30 PM"
 *
 * @param date - Date object to format
 * @returns Formatted time string
 */
export function formatTimeToken(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/**
 * Format currency amount for use in SMS templates.
 * Converts number to currency format: "$123.45"
 *
 * @param amount - Numeric amount to format
 * @returns Formatted currency string
 */
export function formatAmountToken(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/**
 * Common token values builder from patient and appointment data.
 * Helper to construct token values object from typical data sources.
 *
 * @param data - Source data for token values
 * @returns TokenValues object ready for replaceTokens()
 *
 * @example
 * ```typescript
 * const tokens = buildCommonTokens({
 *   patientName: "John Doe",
 *   appointmentDate: new Date("2025-12-10T14:30:00"),
 *   doctorName: "Dr. Smith",
 *   amount: 150.00,
 * });
 * // Returns: {
 * //   patient_name: "John Doe",
 * //   date: "December 10, 2025",
 * //   time: "2:30 PM",
 * //   doctor_name: "Dr. Smith",
 * //   amount: "$150.00"
 * // }
 * ```
 */
export function buildCommonTokens(data: {
  patientName?: string;
  appointmentDate?: Date;
  doctorName?: string;
  amount?: number;
  balance?: number;
  practiceName?: string;
  [key: string]: string | number | Date | undefined;
}): TokenValues {
  const tokens: TokenValues = {};

  if (data.patientName) {
    tokens.patient_name = data.patientName;
  }

  if (data.appointmentDate) {
    tokens.date = formatDateToken(data.appointmentDate);
    tokens.time = formatTimeToken(data.appointmentDate);
  }

  if (data.doctorName) {
    tokens.doctor_name = data.doctorName;
  }

  if (typeof data.amount === "number") {
    tokens.amount = formatAmountToken(data.amount);
  }

  if (typeof data.balance === "number") {
    tokens.balance = formatAmountToken(data.balance);
  }

  if (data.practiceName) {
    tokens.practice_name = data.practiceName;
  }

  return tokens;
}
