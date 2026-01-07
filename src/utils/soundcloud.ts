/**
 * SoundCloud Utilities
 * Handles URL parsing, validation, and oEmbed API integration
 */

// ============================================
// Types
// ============================================

export type SoundCloudErrorType =
  | "invalid_url"
  | "private"
  | "deleted"
  | "network"
  | "unknown";

export interface SoundCloudTrackInfo {
  title: string;
  artist: string;
  artworkUrl: string | null;
  duration: number; // milliseconds (if available)
  description: string | null;
  embedUrl: string; // URL for the widget iframe
  originalUrl: string;
}

export interface SoundCloudFetchResult {
  info: SoundCloudTrackInfo | null;
  error: string | null;
  errorType: SoundCloudErrorType | null;
}

export interface OEmbedResponse {
  version: number;
  type: string;
  provider_name: string;
  provider_url: string;
  height: number;
  width: string;
  title: string;
  description: string;
  thumbnail_url: string;
  html: string;
  author_name?: string;
  author_url?: string;
}

// ============================================
// URL Validation & Parsing
// ============================================

/**
 * Valid SoundCloud URL patterns:
 * - https://soundcloud.com/artist/track
 * - https://soundcloud.com/artist/track?si=xxx
 * - https://soundcloud.com/artist/sets/playlist
 * - https://on.soundcloud.com/xxxxx (short links)
 * - https://m.soundcloud.com/artist/track (mobile)
 */
const SOUNDCLOUD_PATTERNS = [
  /^https?:\/\/(www\.)?soundcloud\.com\/[\w-]+\/[\w-]+/,
  /^https?:\/\/on\.soundcloud\.com\/[\w]+/,
  /^https?:\/\/m\.soundcloud\.com\/[\w-]+\/[\w-]+/,
];

/**
 * Check if a URL is a valid SoundCloud URL
 */
export function isValidSoundCloudUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  const trimmedUrl = url.trim();
  return SOUNDCLOUD_PATTERNS.some((pattern) => pattern.test(trimmedUrl));
}

/**
 * Normalize a SoundCloud URL (remove query params except essential ones)
 */
export function normalizeSoundCloudUrl(url: string): string {
  try {
    const urlObj = new URL(url.trim());

    // Keep only the base URL without query params for consistency
    // The oEmbed API handles redirects and normalization
    return `${urlObj.protocol}//${urlObj.host}${urlObj.pathname}`;
  } catch {
    return url.trim();
  }
}

/**
 * Extract artist and track slugs from a SoundCloud URL
 */
export function parseSoundCloudUrl(url: string): {
  artist: string | null;
  track: string | null;
  isPlaylist: boolean;
} {
  try {
    const urlObj = new URL(url.trim());
    const pathParts = urlObj.pathname.split("/").filter(Boolean);

    // Short link format (on.soundcloud.com/xxxxx)
    if (urlObj.host === "on.soundcloud.com") {
      return { artist: null, track: null, isPlaylist: false };
    }

    // Standard format: /artist/track or /artist/sets/playlist
    if (pathParts.length >= 2) {
      const artist = pathParts[0];
      const isPlaylist = pathParts[1] === "sets";
      const track = isPlaylist ? pathParts[2] || null : pathParts[1];

      return { artist, track, isPlaylist };
    }

    return { artist: null, track: null, isPlaylist: false };
  } catch {
    return { artist: null, track: null, isPlaylist: false };
  }
}

// ============================================
// oEmbed API
// ============================================

const OEMBED_ENDPOINT = "https://soundcloud.com/oembed";

// Simple in-memory cache to avoid repeated API calls
const trackInfoCache = new Map<string, SoundCloudTrackInfo>();
// Cache for failed fetches (to avoid repeated failed requests)
const errorCache = new Map<
  string,
  { error: string; errorType: SoundCloudErrorType }
>();

/**
 * Fetch track info from SoundCloud oEmbed API
 * Returns result object with info or error details
 */
export async function fetchSoundCloudTrackInfo(
  url: string
): Promise<SoundCloudFetchResult> {
  if (!isValidSoundCloudUrl(url)) {
    console.warn("[SoundCloud] Invalid URL:", url);
    return {
      info: null,
      error: "Invalid SoundCloud URL",
      errorType: "invalid_url",
    };
  }

  const normalizedUrl = normalizeSoundCloudUrl(url);

  // Check success cache first
  const cached = trackInfoCache.get(normalizedUrl);
  if (cached) {
    return { info: cached, error: null, errorType: null };
  }

  // Check error cache (don't retry known failures too quickly)
  const cachedError = errorCache.get(normalizedUrl);
  if (cachedError) {
    return {
      info: null,
      error: cachedError.error,
      errorType: cachedError.errorType,
    };
  }

  try {
    const oembedUrl = `${OEMBED_ENDPOINT}?url=${encodeURIComponent(
      normalizedUrl
    )}&format=json`;
    const response = await fetch(oembedUrl);

    if (!response.ok) {
      let errorType: SoundCloudErrorType = "unknown";
      let errorMessage = "Could not load track";

      // SoundCloud returns 403 for private tracks, 404 for deleted/non-existent
      if (response.status === 403) {
        errorType = "private";
        errorMessage = "This track is private";
      } else if (response.status === 404) {
        errorType = "deleted";
        errorMessage = "Track not found or deleted";
      } else if (response.status >= 500) {
        errorType = "network";
        errorMessage = "SoundCloud is temporarily unavailable";
      }

      console.warn(
        "[SoundCloud] oEmbed API error:",
        response.status,
        errorType
      );

      // Cache the error (but only for a shorter time for network errors)
      if (errorType !== "network") {
        errorCache.set(normalizedUrl, { error: errorMessage, errorType });
      }

      return { info: null, error: errorMessage, errorType };
    }

    const data: OEmbedResponse = await response.json();

    // Extract embed URL from the HTML iframe
    const embedUrl = extractEmbedUrl(data.html);

    // Parse title to extract track name and artist
    // oEmbed title format: "Track Name by Artist Name"
    const { trackTitle, artistName } = parseOEmbedTitle(
      data.title,
      data.author_name
    );

    const trackInfo: SoundCloudTrackInfo = {
      title: trackTitle,
      artist: artistName,
      artworkUrl: data.thumbnail_url || null,
      duration: 0, // oEmbed doesn't provide duration directly
      description: data.description || null,
      embedUrl: embedUrl,
      originalUrl: normalizedUrl,
    };

    // Cache the result
    trackInfoCache.set(normalizedUrl, trackInfo);

    return { info: trackInfo, error: null, errorType: null };
  } catch (error) {
    console.error("[SoundCloud] Error fetching track info:", error);

    // Network/fetch errors
    const isNetworkError =
      error instanceof TypeError &&
      (error.message.includes("network") || error.message.includes("fetch"));

    return {
      info: null,
      error: isNetworkError ? "Network error" : "Failed to load track",
      errorType: isNetworkError ? "network" : "unknown",
    };
  }
}

/**
 * Extract the widget embed URL from the oEmbed HTML
 */
function extractEmbedUrl(html: string): string {
  // Extract src from: <iframe ... src="https://w.soundcloud.com/player/?..." ...>
  const srcMatch = html.match(/src="([^"]+)"/);
  if (srcMatch && srcMatch[1]) {
    return srcMatch[1];
  }

  // Fallback: construct a basic widget URL
  return "https://w.soundcloud.com/player/";
}

/**
 * Parse oEmbed title to extract track name and artist
 * Format is typically "Track Name by Artist Name"
 */
function parseOEmbedTitle(
  title: string,
  authorName?: string
): { trackTitle: string; artistName: string } {
  // If we have author_name from oEmbed, use it
  if (authorName) {
    // Try to extract track title by removing " by AuthorName" suffix
    const byPattern = new RegExp(` by ${escapeRegex(authorName)}$`, "i");
    const trackTitle = title.replace(byPattern, "").trim();

    return {
      trackTitle: trackTitle || title,
      artistName: authorName,
    };
  }

  // Fallback: split by " by "
  const byIndex = title.lastIndexOf(" by ");
  if (byIndex > 0) {
    return {
      trackTitle: title.substring(0, byIndex).trim(),
      artistName: title.substring(byIndex + 4).trim(),
    };
  }

  // Can't parse, return title as-is
  return {
    trackTitle: title,
    artistName: "Unknown Artist",
  };
}

/**
 * Escape special regex characters in a string
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ============================================
// Cache Management
// ============================================

/**
 * Clear the track info cache (both success and error caches)
 */
export function clearSoundCloudCache(): void {
  trackInfoCache.clear();
  errorCache.clear();
}

/**
 * Clear only the error cache (to retry failed fetches)
 */
export function clearSoundCloudErrorCache(): void {
  errorCache.clear();
}

/**
 * Get cache size (for debugging)
 */
export function getSoundCloudCacheSize(): number {
  return trackInfoCache.size;
}

/**
 * Get error cache size (for debugging)
 */
export function getSoundCloudErrorCacheSize(): number {
  return errorCache.size;
}
