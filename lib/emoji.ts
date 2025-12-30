/**
 * Utility functions for emoji operations including cursor-based insertion
 * and recently used emoji tracking.
 *
 * @reasoning Used shannonthinking to determine optimal approach:
 * - Constraint: Need to support cursor-based emoji insertion in text inputs
 * - Decision: Use localStorage for persistent recent emoji tracking
 * - Rationale: Provides consistent user experience across sessions
 *
 * @example
 * // Insert emoji at cursor position
 * const textarea = document.getElementById('message-input') as HTMLTextAreaElement;
 * insertEmojiAtCursor(textarea, '😀');
 *
 * // Get recently used emojis
 * const recent = getRecentEmojis();
 *
 * // Add emoji to recent list
 * addToRecentEmojis('😀');
 */

// Define TypeScript interfaces
export interface EmojiData {
  emoji: string;
  timestamp: number;
}

export interface EmojiInsertOptions {
  /** Whether to add a space after the inserted emoji */
  addSpace?: boolean;
}

// Constants
const RECENT_EMOJIS_KEY = "recent_emojis";
const MAX_RECENT_EMOJIS = 20;

/**
 * Inserts an emoji at the current cursor position in a text input or textarea.
 *
 * @param element - The input or textarea element where the emoji should be inserted
 * @param emoji - The emoji string to insert
 * @param options - Optional settings for the insertion
 * @returns boolean indicating whether the insertion was successful
 *
 * @reasoning Used shannonthinking to determine optimal approach:
 * - Constraint: Must work with both input and textarea elements
 * - Decision: Use selectionStart/selectionEnd properties for cursor positioning
 * - Rationale: These properties provide accurate cursor/selection positions
 */
export function insertEmojiAtCursor(
  element: HTMLInputElement | HTMLTextAreaElement,
  emoji: string,
  options: EmojiInsertOptions = {},
): boolean {
  try {
    // Validate inputs
    if (!element || !emoji) {
      return false;
    }

    // Check if element is focused, focus if not
    if (document.activeElement !== element) {
      element.focus();
    }

    const { addSpace = false } = options;
    const textToAdd = addSpace ? `${emoji} ` : emoji;

    // Get current cursor position
    const startPos = element.selectionStart || 0;
    const endPos = element.selectionEnd || 0;

    // Get the current value of the element
    const currentValue = element.value;

    // Insert the emoji at the cursor position
    const newValue =
      currentValue.substring(0, startPos) +
      textToAdd +
      currentValue.substring(endPos);

    // Update the element's value
    element.value = newValue;

    // Calculate the new cursor position after insertion
    const newCursorPos = startPos + textToAdd.length;

    // Set the new cursor position
    element.setSelectionRange(newCursorPos, newCursorPos);

    // Trigger input event to notify any listeners
    element.dispatchEvent(new Event("input", { bubbles: true }));

    return true;
  } catch (error) {
    console.error("Error inserting emoji at cursor:", error);
    return false;
  }
}

/**
 * Retrieves the list of recently used emojis from localStorage.
 *
 * @param limit - Optional limit on the number of emojis to return (defaults to 10)
 * @returns Array of recently used emojis sorted by most recent first
 *
 * @reasoning Used shannonthinking to determine optimal approach:
 * - Constraint: Need to persist recent emojis across sessions
 * - Decision: Use localStorage with timestamp-based ordering
 * - Rationale: Provides persistent storage without server dependency
 */
export function getRecentEmojis(limit: number = 10): string[] {
  try {
    // Check if localStorage is available
    if (typeof localStorage === "undefined") {
      return [];
    }

    const stored = localStorage.getItem(RECENT_EMOJIS_KEY);
    if (!stored) {
      return [];
    }

    let recentEmojis: EmojiData[] = [];
    try {
      recentEmojis = JSON.parse(stored);
    } catch (error) {
      console.error("Error parsing recent emojis from localStorage:", error);
      return [];
    }

    // Sort by timestamp (most recent first) and limit the results
    return recentEmojis
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, Math.min(limit, MAX_RECENT_EMOJIS))
      .map((item) => item.emoji);
  } catch (error) {
    console.error("Error retrieving recent emojis:", error);
    return [];
  }
}

/**
 * Adds an emoji to the list of recently used emojis in localStorage.
 *
 * @param emoji - The emoji to add to the recent list
 * @returns boolean indicating whether the operation was successful
 *
 * @reasoning Used shannonthinking to determine optimal approach:
 * - Constraint: Need to maintain unique emojis and prevent duplicates
 * - Decision: Filter out existing emoji before adding new one at the beginning
 * - Rationale: Provides clean de-duplication while maintaining recency order
 */
export function addToRecentEmojis(emoji: string): boolean {
  try {
    // Validate input
    if (!emoji || typeof emoji !== "string") {
      return false;
    }

    // Check if localStorage is available
    if (typeof localStorage === "undefined") {
      return false;
    }

    // Get existing recent emojis
    let recentEmojis: EmojiData[] = [];
    const stored = localStorage.getItem(RECENT_EMOJIS_KEY);
    if (stored) {
      try {
        recentEmojis = JSON.parse(stored);
      } catch (error) {
        console.error("Error parsing recent emojis from localStorage:", error);
        recentEmojis = [];
      }
    }

    // Remove the emoji if it already exists (to update its position)
    recentEmojis = recentEmojis.filter((item) => item.emoji !== emoji);

    // Add the new emoji with current timestamp
    recentEmojis.unshift({
      emoji,
      timestamp: Date.now(),
    });

    // Limit the number of recent emojis
    if (recentEmojis.length > MAX_RECENT_EMOJIS) {
      recentEmojis = recentEmojis.slice(0, MAX_RECENT_EMOJIS);
    }

    // Store the updated list
    localStorage.setItem(RECENT_EMOJIS_KEY, JSON.stringify(recentEmojis));

    return true;
  } catch (error) {
    console.error("Error adding emoji to recent list:", error);
    return false;
  }
}

/**
 * Clears all recently used emojis from localStorage.
 *
 * @returns boolean indicating whether the operation was successful
 */
export function clearRecentEmojis(): boolean {
  try {
    // Check if localStorage is available
    if (typeof localStorage === "undefined") {
      return false;
    }

    localStorage.removeItem(RECENT_EMOJIS_KEY);
    return true;
  } catch (error) {
    console.error("Error clearing recent emojis:", error);
    return false;
  }
}
