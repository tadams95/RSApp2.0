/**
 * SoundCloud Utilities
 * Handles URL parsing, validation, and oEmbed API integration
 */

// ============================================
// Types
// ============================================

export interface SoundCloudTrackInfo {
  title: string;
  artist: string;
  artworkUrl: string | null;
  duration: number; // milliseconds (if available)
  description: string | null;
  embedUrl: string; // URL for the widget iframe
  originalUrl: string;
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

/**
 * Fetch track info from SoundCloud oEmbed API
 * Returns cached result if available
 */
export async function fetchSoundCloudTrackInfo(
  url: string
): Promise<SoundCloudTrackInfo | null> {
  if (!isValidSoundCloudUrl(url)) {
    console.warn("[SoundCloud] Invalid URL:", url);
    return null;
  }

  const normalizedUrl = normalizeSoundCloudUrl(url);

  // Check cache first
  const cached = trackInfoCache.get(normalizedUrl);
  if (cached) {
    return cached;
  }

  try {
    const oembedUrl = `${OEMBED_ENDPOINT}?url=${encodeURIComponent(
      normalizedUrl
    )}&format=json`;
    const response = await fetch(oembedUrl);

    if (!response.ok) {
      console.warn("[SoundCloud] oEmbed API error:", response.status);
      return null;
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

    return trackInfo;
  } catch (error) {
    console.error("[SoundCloud] Error fetching track info:", error);
    return null;
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
 * Clear the track info cache
 */
export function clearSoundCloudCache(): void {
  trackInfoCache.clear();
}

/**
 * Get cache size (for debugging)
 */
export function getSoundCloudCacheSize(): number {
  return trackInfoCache.size;
}
