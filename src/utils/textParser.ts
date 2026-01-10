/**
 * Text Parser Utility
 *
 * Parses text content and identifies URLs, @mentions, and #hashtags
 * for rendering as interactive links in the LinkedText component.
 */

export type TextSegment =
  | { type: "text"; content: string }
  | { type: "url"; content: string; url: string }
  | { type: "mention"; content: string; username: string }
  | { type: "hashtag"; content: string; tag: string };

// Regex patterns
// URL: matches http/https URLs, handles trailing punctuation
const URL_REGEX = /https?:\/\/[^\s<>"]+/gi;
// Mention: @username with 1-30 alphanumeric chars or underscores
const MENTION_REGEX = /@([a-zA-Z0-9_]{1,30})/g;
// Hashtag: #tag with 1-50 alphanumeric chars or underscores
const HASHTAG_REGEX = /#([a-zA-Z0-9_]{1,50})/g;

// Combined pattern to find all matches in order
const COMBINED_REGEX =
  /(https?:\/\/[^\s<>"]+)|(@[a-zA-Z0-9_]{1,30})|(#[a-zA-Z0-9_]{1,50})/gi;

/**
 * Strips trailing punctuation from URLs that shouldn't be part of the link
 * e.g., "https://example.com." -> "https://example.com"
 */
function cleanUrl(url: string): string {
  // Remove trailing punctuation that's likely sentence-ending
  // but preserve valid URL characters like / and -
  let cleaned = url;

  // Handle trailing punctuation: . , ! ? ) ] } ; :
  // But be careful with ) - only strip if no matching (
  const trailingPunctuation = /[.,!?;:]+$/;
  cleaned = cleaned.replace(trailingPunctuation, "");

  // Handle unbalanced closing parentheses/brackets
  const openParens = (cleaned.match(/\(/g) || []).length;
  const closeParens = (cleaned.match(/\)/g) || []).length;
  if (closeParens > openParens && cleaned.endsWith(")")) {
    cleaned = cleaned.slice(0, -1);
  }

  const openBrackets = (cleaned.match(/\[/g) || []).length;
  const closeBrackets = (cleaned.match(/\]/g) || []).length;
  if (closeBrackets > openBrackets && cleaned.endsWith("]")) {
    cleaned = cleaned.slice(0, -1);
  }

  return cleaned;
}

/**
 * Parses text and returns an array of segments
 * Each segment is either plain text, a URL, an @mention, or a #hashtag
 */
export function parseText(text: string): TextSegment[] {
  if (!text || text.length === 0) {
    return [];
  }

  const segments: TextSegment[] = [];
  let lastIndex = 0;

  // Find all matches using the combined regex
  const matches: Array<{
    match: string;
    index: number;
    type: "url" | "mention" | "hashtag";
  }> = [];

  // Reset regex state
  COMBINED_REGEX.lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = COMBINED_REGEX.exec(text)) !== null) {
    const fullMatch = match[0];
    const index = match.index;

    if (match[1]) {
      // URL match
      matches.push({ match: fullMatch, index, type: "url" });
    } else if (match[2]) {
      // Mention match
      matches.push({ match: fullMatch, index, type: "mention" });
    } else if (match[3]) {
      // Hashtag match
      matches.push({ match: fullMatch, index, type: "hashtag" });
    }
  }

  // Process matches in order
  for (const { match: matchStr, index, type } of matches) {
    // Add any text before this match
    if (index > lastIndex) {
      const textBefore = text.slice(lastIndex, index);
      if (textBefore) {
        segments.push({ type: "text", content: textBefore });
      }
    }

    // Process the match based on type
    if (type === "url") {
      const cleanedUrl = cleanUrl(matchStr);
      const trailingChars = matchStr.slice(cleanedUrl.length);

      segments.push({
        type: "url",
        content: cleanedUrl,
        url: cleanedUrl,
      });

      // If there were trailing characters stripped, add them as text
      if (trailingChars) {
        segments.push({ type: "text", content: trailingChars });
      }

      lastIndex = index + matchStr.length;
    } else if (type === "mention") {
      const username = matchStr.slice(1); // Remove @
      segments.push({
        type: "mention",
        content: matchStr,
        username,
      });
      lastIndex = index + matchStr.length;
    } else if (type === "hashtag") {
      const tag = matchStr.slice(1); // Remove #
      segments.push({
        type: "hashtag",
        content: matchStr,
        tag,
      });
      lastIndex = index + matchStr.length;
    }
  }

  // Add any remaining text after the last match
  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  // If no matches were found, return the entire text as a single segment
  if (segments.length === 0 && text.length > 0) {
    return [{ type: "text", content: text }];
  }

  return segments;
}

/**
 * Validates if a string is a valid URL
 */
export function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

/**
 * Extracts all URLs from text
 */
export function extractUrls(text: string): string[] {
  const segments = parseText(text);
  return segments
    .filter((s): s is Extract<TextSegment, { type: "url" }> => s.type === "url")
    .map((s) => s.url);
}

/**
 * Extracts all @mentions from text
 */
export function extractMentions(text: string): string[] {
  const segments = parseText(text);
  return segments
    .filter(
      (s): s is Extract<TextSegment, { type: "mention" }> =>
        s.type === "mention"
    )
    .map((s) => s.username);
}

/**
 * Extracts all #hashtags from text
 */
export function extractHashtags(text: string): string[] {
  const segments = parseText(text);
  return segments
    .filter(
      (s): s is Extract<TextSegment, { type: "hashtag" }> =>
        s.type === "hashtag"
    )
    .map((s) => s.tag);
}

/**
 * Truncates a URL for display while preserving the domain
 * e.g., "https://ragestate.com/very/long/path/here" -> "ragestate.com/very/lon..."
 */
export function truncateUrl(url: string, maxLength: number = 40): string {
  if (url.length <= maxLength) {
    return url;
  }

  try {
    const urlObj = new URL(url);
    const domain = urlObj.hostname.replace(/^www\./, "");
    const path = urlObj.pathname + urlObj.search + urlObj.hash;

    // If domain alone is too long, just truncate the whole thing
    if (domain.length >= maxLength - 3) {
      return url.slice(0, maxLength - 3) + "...";
    }

    // Calculate how much path we can show
    const availableForPath = maxLength - domain.length - 3; // -3 for "..."
    if (availableForPath <= 0 || path.length <= 1) {
      return domain;
    }

    const truncatedPath = path.slice(0, availableForPath);
    return domain + truncatedPath + "...";
  } catch {
    // If URL parsing fails, just truncate the string
    return url.slice(0, maxLength - 3) + "...";
  }
}
