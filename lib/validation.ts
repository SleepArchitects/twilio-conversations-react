/**
 * Phone number validation utilities
 * Supports E.164 format for international numbers
 */

/** Regex for valid US phone number in E.164 format: +1 followed by area code (2-9) and 9 more digits */
export const US_PHONE_REGEX = /^\+1[2-9]\d{9}$/;

/** Regex for any valid E.164 international phone number: + followed by 7-15 digits */
export const INTERNATIONAL_PHONE_REGEX = /^\+[1-9]\d{6,14}$/;

/** Regex for 10 digits only (no country code or formatting) */
export const PHONE_DIGITS_ONLY_REGEX = /^\d{10}$/;

/** Flag to allow all international phone numbers - uses NEXT_PUBLIC_ for client-side access */
const ALLOW_ALL_PHONE_NUMBERS =
  process.env.NEXT_PUBLIC_ALLOW_INTERNATIONAL_PHONES === "true" ||
  process.env.ALLOW_INTERNATIONAL_PHONES === "true";

/**
 * Validates if a phone number is a valid US phone number in E.164 format
 * @param phone - The phone number to validate
 * @returns true if the phone number is valid, false otherwise
 * @example
 * isValidUSPhoneNumber("+12025551234") // true
 * isValidUSPhoneNumber("+10125551234") // false (area code starts with 0)
 * isValidUSPhoneNumber("2025551234")   // false (missing +1)
 */
export function isValidUSPhoneNumber(phone: string): boolean {
  if (!phone || typeof phone !== "string") {
    return false;
  }

  // If international phones are allowed, accept any valid international number
  if (ALLOW_ALL_PHONE_NUMBERS) {
    return INTERNATIONAL_PHONE_REGEX.test(phone.trim());
  }

  return US_PHONE_REGEX.test(phone.trim());
}

/**
 * Formats a phone number to E.164 format (+1XXXXXXXXXX for US, or keeps international format)
 * Handles various input formats and strips non-digit characters
 * @param phone - The phone number in any common format
 * @returns The phone number in E.164 format, or empty string if invalid
 * @example
 * formatPhoneNumber("5551234567")       // "+15551234567"
 * formatPhoneNumber("555-123-4567")     // "+15551234567"
 * formatPhoneNumber("(555) 123-4567")   // "+15551234567"
 * formatPhoneNumber("1-555-123-4567")   // "+15551234567"
 * formatPhoneNumber("+1 555 123 4567")  // "+15551234567"
 * formatPhoneNumber("+52 55 1234 5678") // "+5255123456789" (Mexico)
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone || typeof phone !== "string") {
    return "";
  }

  // Remove all non-digit characters except leading +
  const trimmed = phone.trim();

  // Check if it starts with + and preserve that info
  const hasPlus = trimmed.startsWith("+");

  // Extract only digits
  const digitsOnly = trimmed.replace(/\D/g, "");

  if (!digitsOnly) {
    return "";
  }

  // If it already has + prefix, validate and return as international
  if (hasPlus && digitsOnly.length >= 7 && digitsOnly.length <= 15) {
    return `+${digitsOnly}`;
  }

  // Handle different cases based on digit count
  if (digitsOnly.length === 10) {
    // 10 digits: assume US number without country code
    return `+1${digitsOnly}`;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
    // 11 digits starting with 1: US number with country code
    return `+${digitsOnly}`;
  } else if (digitsOnly.length >= 7 && digitsOnly.length <= 15) {
    // Other lengths: could be international, return with +
    return `+${digitsOnly}`;
  }

  // For other formats, return empty string as we can't reliably format them
  return "";
}

/**
 * Formats a phone number in E.164 format to human-readable display format
 * @param phone - The phone number in E.164 format (+1XXXXXXXXXX)
 * @returns The phone number in display format "(XXX) XXX-XXXX", or the original if invalid
 * @example
 * formatDisplayPhoneNumber("+15551234567") // "(555) 123-4567"
 */
export function formatDisplayPhoneNumber(phone: string): string {
  if (!phone || typeof phone !== "string") {
    return "";
  }

  const trimmed = phone.trim();

  // Validate it's in E.164 format
  if (!US_PHONE_REGEX.test(trimmed)) {
    // Try to extract 10 digits if possible
    const digits = trimmed.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) {
      const areaCode = digits.slice(1, 4);
      const exchange = digits.slice(4, 7);
      const subscriber = digits.slice(7, 11);
      return `(${areaCode}) ${exchange}-${subscriber}`;
    } else if (digits.length === 10) {
      const areaCode = digits.slice(0, 3);
      const exchange = digits.slice(3, 6);
      const subscriber = digits.slice(6, 10);
      return `(${areaCode}) ${exchange}-${subscriber}`;
    }
    return trimmed;
  }

  // Extract parts from E.164 format (+1XXXXXXXXXX)
  const areaCode = trimmed.slice(2, 5);
  const exchange = trimmed.slice(5, 8);
  const subscriber = trimmed.slice(8, 12);

  return `(${areaCode}) ${exchange}-${subscriber}`;
}

/**
 * Returns a validation error message for a phone number, or null if valid
 * @param phone - The phone number to validate
 * @returns Error message string if invalid, null if valid
 * @example
 * getPhoneValidationError("")              // "Phone number is required"
 * getPhoneValidationError("+442012345678") // "US phone numbers only (+1 format)" (in prod)
 * getPhoneValidationError("+10125551234")  // "Invalid area code"
 * getPhoneValidationError("+12025551234")  // null
 */
export function getPhoneValidationError(phone: string): string | null {
  // Check for null, undefined, empty, or whitespace-only
  if (!phone || typeof phone !== "string" || !phone.trim()) {
    return "Phone number is required";
  }

  const trimmed = phone.trim();

  // Check if it's in E.164 format (starts with +)
  if (!trimmed.startsWith("+")) {
    return "Invalid phone number format. Must start with + and country code";
  }

  // If international phones are allowed, accept any valid international number
  if (ALLOW_ALL_PHONE_NUMBERS) {
    if (INTERNATIONAL_PHONE_REGEX.test(trimmed)) {
      return null; // Valid international number
    }
    return "Invalid phone number format. Use + followed by country code and number (7-15 digits)";
  }

  // Production mode: US numbers only
  // Check if it's a US number (+1)
  if (!trimmed.startsWith("+1")) {
    return "US phone numbers only (+1 format)";
  }

  // Check length (should be +1 followed by 10 digits = 12 characters total)
  if (trimmed.length !== 12) {
    return "Invalid phone number format. Use +1 followed by 10 digits";
  }

  // Check if remaining characters are digits
  const digitsAfterCountryCode = trimmed.slice(2);
  if (!/^\d{10}$/.test(digitsAfterCountryCode)) {
    return "Invalid phone number format. Use +1 followed by 10 digits";
  }

  // Check area code (first digit after +1 must be 2-9)
  const areaCodeFirstDigit = trimmed.charAt(2);
  if (areaCodeFirstDigit === "0" || areaCodeFirstDigit === "1") {
    return "Invalid area code";
  }

  // All validations passed
  return null;
}
