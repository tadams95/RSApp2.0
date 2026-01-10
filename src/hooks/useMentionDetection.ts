import { useCallback, useState } from "react";

/**
 * Selection state from TextInput
 */
export interface TextSelection {
  start: number;
  end: number;
}

/**
 * Result of the useMentionDetection hook
 */
export interface UseMentionDetectionResult {
  /** Whether the autocomplete dropdown should be visible */
  showAutocomplete: boolean;
  /** Current mention query (text after @, before cursor) */
  mentionQuery: string;
  /** Start index of the @ symbol in the text */
  mentionStartIndex: number;
  /** Update state when text or selection changes */
  handleTextChange: (text: string, selection: TextSelection) => void;
  /** Insert a selected username at the mention position, returns new text */
  insertMention: (text: string, username: string) => string;
  /** Manually dismiss the autocomplete */
  clearMention: () => void;
}

/**
 * Detects when a user is typing an @mention in a text input
 *
 * @example
 * ```tsx
 * const {
 *   showAutocomplete,
 *   mentionQuery,
 *   handleTextChange,
 *   insertMention,
 *   clearMention,
 * } = useMentionDetection();
 *
 * <TextInput
 *   value={content}
 *   onChangeText={(text) => {
 *     setContent(text);
 *     handleTextChange(text, selection);
 *   }}
 *   onSelectionChange={(e) => {
 *     const sel = e.nativeEvent.selection;
 *     setSelection(sel);
 *     handleTextChange(content, sel);
 *   }}
 * />
 *
 * {showAutocomplete && (
 *   <MentionAutocomplete
 *     query={mentionQuery}
 *     onSelect={(user) => {
 *       const newContent = insertMention(content, user.username);
 *       setContent(newContent);
 *       clearMention();
 *     }}
 *   />
 * )}
 * ```
 */
export function useMentionDetection(): UseMentionDetectionResult {
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [mentionQuery, setMentionQuery] = useState("");
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);

  /**
   * Detects if the user is currently typing a mention
   * Rules:
   * 1. @ must be at start of text OR preceded by whitespace
   * 2. Characters after @ must be valid username chars (alphanumeric + underscore)
   * 3. Cursor must be within or at the end of the mention
   */
  const detectMention = useCallback(
    (text: string, cursorPosition: number): void => {
      // Early exit if no text or cursor at start
      if (!text || cursorPosition === 0) {
        setShowAutocomplete(false);
        setMentionQuery("");
        setMentionStartIndex(-1);
        return;
      }

      // Get text before cursor
      const beforeCursor = text.slice(0, cursorPosition);

      // Find the last @ before cursor
      const atIndex = beforeCursor.lastIndexOf("@");

      // No @ found
      if (atIndex === -1) {
        setShowAutocomplete(false);
        setMentionQuery("");
        setMentionStartIndex(-1);
        return;
      }

      // Check if @ is at valid position (start or after whitespace)
      const charBeforeAt = atIndex > 0 ? text[atIndex - 1] : null;
      const isValidPosition = charBeforeAt === null || /\s/.test(charBeforeAt);

      if (!isValidPosition) {
        // @ is mid-word (e.g., "email@example"), don't trigger
        setShowAutocomplete(false);
        setMentionQuery("");
        setMentionStartIndex(-1);
        return;
      }

      // Extract the query (text after @ up to cursor)
      const query = beforeCursor.slice(atIndex + 1);

      // Check if query contains only valid username characters
      // Valid: alphanumeric and underscore, max 30 chars
      const isValidQuery = /^[a-zA-Z0-9_]{0,30}$/.test(query);

      if (!isValidQuery) {
        // Query contains invalid characters (space, special chars, etc.)
        setShowAutocomplete(false);
        setMentionQuery("");
        setMentionStartIndex(-1);
        return;
      }

      // Valid mention being typed!
      setShowAutocomplete(true);
      setMentionQuery(query);
      setMentionStartIndex(atIndex);
    },
    []
  );

  /**
   * Handle text or selection changes from TextInput
   */
  const handleTextChange = useCallback(
    (text: string, selection: TextSelection): void => {
      // Use cursor position (start of selection)
      detectMention(text, selection.start);
    },
    [detectMention]
  );

  /**
   * Insert the selected username at the mention position
   * Returns the new text with the mention inserted
   */
  const insertMention = useCallback(
    (text: string, username: string): string => {
      if (mentionStartIndex === -1) {
        return text;
      }

      // Find where the current partial mention ends
      // Look for the next whitespace or end of string after @
      let endIndex = mentionStartIndex + 1; // Start after @
      while (endIndex < text.length && /[a-zA-Z0-9_]/.test(text[endIndex])) {
        endIndex++;
      }

      // Build new text: before @ + @username + space + rest
      const before = text.slice(0, mentionStartIndex);
      const after = text.slice(endIndex);

      // Add space after username if not already followed by space
      const needsSpace = !after.startsWith(" ") && after.length > 0;
      const spacer = needsSpace || after.length === 0 ? " " : "";

      return `${before}@${username}${spacer}${after}`;
    },
    [mentionStartIndex]
  );

  /**
   * Clear mention state / dismiss autocomplete
   */
  const clearMention = useCallback((): void => {
    setShowAutocomplete(false);
    setMentionQuery("");
    setMentionStartIndex(-1);
  }, []);

  return {
    showAutocomplete,
    mentionQuery,
    mentionStartIndex,
    handleTextChange,
    insertMention,
    clearMention,
  };
}

// ============================================================================
// Pure utility functions for testing mention detection logic
// ============================================================================

/**
 * Pure function to detect mention from text and cursor position
 * Useful for unit testing without React hooks
 */
export function detectMentionAt(
  text: string,
  cursorPosition: number
): { isActive: boolean; query: string; startIndex: number } {
  const result = { isActive: false, query: "", startIndex: -1 };

  if (!text || cursorPosition === 0) {
    return result;
  }

  const beforeCursor = text.slice(0, cursorPosition);
  const atIndex = beforeCursor.lastIndexOf("@");

  if (atIndex === -1) {
    return result;
  }

  // Check valid position (start or after whitespace)
  const charBeforeAt = atIndex > 0 ? text[atIndex - 1] : null;
  const isValidPosition = charBeforeAt === null || /\s/.test(charBeforeAt);

  if (!isValidPosition) {
    return result;
  }

  // Extract and validate query
  const query = beforeCursor.slice(atIndex + 1);
  const isValidQuery = /^[a-zA-Z0-9_]{0,30}$/.test(query);

  if (!isValidQuery) {
    return result;
  }

  return {
    isActive: true,
    query,
    startIndex: atIndex,
  };
}

/**
 * Pure function to insert a mention into text
 * Useful for unit testing without React hooks
 */
export function insertMentionAt(
  text: string,
  mentionStartIndex: number,
  username: string
): string {
  if (mentionStartIndex === -1) {
    return text;
  }

  let endIndex = mentionStartIndex + 1;
  while (endIndex < text.length && /[a-zA-Z0-9_]/.test(text[endIndex])) {
    endIndex++;
  }

  const before = text.slice(0, mentionStartIndex);
  const after = text.slice(endIndex);
  const needsSpace = !after.startsWith(" ") && after.length > 0;
  const spacer = needsSpace || after.length === 0 ? " " : "";

  return `${before}@${username}${spacer}${after}`;
}
