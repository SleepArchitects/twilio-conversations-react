/**
 * Template utility functions for variable detection and validation
 */

// =============================================================================
// Constants
// =============================================================================

/**
 * Regex pattern to match template variables: {{variableName}}
 * Matches: {{variableName}} where variableName is alphanumeric + underscore
 */
const VARIABLE_PATTERN = /\{\{(\w+)\}\}/g;

// =============================================================================
// Variable Detection
// =============================================================================

/**
 * Extract all variable names from template content
 * @param content - Template content string
 * @returns Array of unique variable names (without braces)
 *
 * @example
 * extractVariables("Hello {{firstName}}, your appointment is on {{appointmentDate}}")
 * // Returns: ["firstName", "appointmentDate"]
 */
export function extractVariables(content: string): string[] {
  const matches = Array.from(content.matchAll(VARIABLE_PATTERN));
  const variables = matches.map((match) => match[1]);
  return [...new Set(variables)]; // Return unique variables
}

/**
 * Check if a message contains unresolved template variables
 * @param message - Message content to check
 * @returns Array of unresolved variable names found in the message
 *
 * @example
 * detectUnresolvedVariables("Hello {{firstName}}, your appointment is on {{appointmentDate}}")
 * // Returns: ["firstName", "appointmentDate"]
 */
export function detectUnresolvedVariables(message: string): string[] {
  return extractVariables(message);
}

/**
 * Check if a message has any unresolved template variables
 * @param message - Message content to check
 * @returns True if message contains unresolved variables
 */
export function hasUnresolvedVariables(message: string): boolean {
  return VARIABLE_PATTERN.test(message);
}

/**
 * Validate that all variables in a template are resolved
 * @param message - Message content to validate
 * @returns Object with isValid flag and list of unresolved variables
 */
export function validateTemplateVariables(message: string): {
  isValid: boolean;
  unresolvedVariables: string[];
} {
  const unresolvedVariables = detectUnresolvedVariables(message);
  return {
    isValid: unresolvedVariables.length === 0,
    unresolvedVariables,
  };
}

// =============================================================================
// Variable Substitution
// =============================================================================

/**
 * Substitute variables in template content with provided values
 * @param content - Template content with {{variable}} placeholders
 * @param variableValues - Object mapping variable names to their values
 * @returns Rendered content with variables substituted
 *
 * @example
 * renderTemplate("Hello {{firstName}}", { firstName: "John" })
 * // Returns: "Hello John"
 */
export function renderTemplate(
  content: string,
  variableValues: Record<string, string>,
): string {
  let rendered = content;
  Object.entries(variableValues).forEach(([key, value]) => {
    const regex = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    rendered = rendered.replace(regex, value);
  });
  return rendered;
}
