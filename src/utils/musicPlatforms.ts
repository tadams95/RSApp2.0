/**
 * Music Platform Utilities
 * Handles platform detection, URL validation, oEmbed fetching, and deep linking
 * for multiple music platforms (SoundCloud, Spotify, YouTube)
 */

// ============================================
// Types
// ============================================

export type MusicPlatform = "soundcloud" | "spotify" | "youtube" | "unknown";

export interface PlatformConfig {
  name: string;
  icon: string; // MaterialCommunityIcons name
  color: string;
  oEmbedUrl: string | null;
  urlPatterns: RegExp[];
  supportsInAppPlayback: boolean;
  supportsPreview: boolean;
}

export interface MusicTrackInfo {
  title: string;
  artist: string;
  artworkUrl: string | null;
  duration?: number; // milliseconds
  platform: MusicPlatform;
  embedUrl: string | null;
  originalUrl: string;
}

export type MusicErrorType =
  | "invalid_url"
  | "not_found"
  | "private"
  | "network"
  | "unknown";

export interface MusicFetchResult {
  info: MusicTrackInfo | null;
  error: string | null;
  errorType: MusicErrorType | null;
}

// ============================================
// Platform Configurations
// ============================================

export const PLATFORM_CONFIGS: Record<MusicPlatform, PlatformConfig> = {
  soundcloud: {
    name: "SoundCloud",
    icon: "soundcloud",
    color: "#FF5500",
    oEmbedUrl: "https://soundcloud.com/oembed",
    urlPatterns: [
      /^https?:\/\/(www\.)?soundcloud\.com\/[\w-]+\/[\w-]+/i,
      /^https?:\/\/on\.soundcloud\.com\/[\w]+/i,
      /^https?:\/\/m\.soundcloud\.com\/[\w-]+\/[\w-]+/i,
    ],
    supportsInAppPlayback: true,
    supportsPreview: true,
  },
  spotify: {
    name: "Spotify",
    icon: "spotify",
    color: "#1DB954",
    oEmbedUrl: "https://open.spotify.com/oembed",
    urlPatterns: [
      /^https?:\/\/open\.spotify\.com\/(intl-[\w]+\/)?(track|album|playlist|episode)\/[\w]+/i,
      /^https?:\/\/spotify\.link\/[\w]+/i,
    ],
    supportsInAppPlayback: false, // 30s preview only without Premium
    supportsPreview: true,
  },
  youtube: {
    name: "YouTube",
    icon: "youtube",
    color: "#FF0000",
    oEmbedUrl: "https://www.youtube.com/oembed",
    urlPatterns: [
      /^https?:\/\/(www\.)?youtube\.com\/watch\?v=[\w-]+/i,
      /^https?:\/\/youtu\.be\/[\w-]+/i,
      /^https?:\/\/(www\.)?youtube\.com\/shorts\/[\w-]+/i,
      /^https?:\/\/music\.youtube\.com\/watch\?v=[\w-]+/i,
    ],
    supportsInAppPlayback: true, // WebView embed works
    supportsPreview: true,
  },
  unknown: {
    name: "Music",
    icon: "music",
    color: "#888888",
    oEmbedUrl: null,
    urlPatterns: [],
    supportsInAppPlayback: false,
    supportsPreview: false,
  },
};

// ============================================
// Platform Detection
// ============================================

/**
 * Detect which music platform a URL belongs to
 */
export function detectMusicPlatform(
  url: string | null | undefined
): MusicPlatform {
  if (!url || typeof url !== "string") {
    return "unknown";
  }

  const trimmedUrl = url.trim().toLowerCase();

  if (!trimmedUrl) {
    return "unknown";
  }

  // Check each platform's patterns
  for (const [platform, config] of Object.entries(PLATFORM_CONFIGS)) {
    if (platform === "unknown") continue;

    for (const pattern of config.urlPatterns) {
      // Create case-insensitive version of the pattern
      const caseInsensitivePattern = new RegExp(pattern.source, "i");
      if (caseInsensitivePattern.test(trimmedUrl)) {
        return platform as MusicPlatform;
      }
    }
  }

  // Fallback: simple domain detection for edge cases
  if (
    trimmedUrl.includes("soundcloud.com") ||
    trimmedUrl.includes("on.soundcloud.com")
  ) {
    return "soundcloud";
  }
  if (
    trimmedUrl.includes("spotify.com") ||
    trimmedUrl.includes("spotify.link")
  ) {
    return "spotify";
  }
  if (trimmedUrl.includes("youtube.com") || trimmedUrl.includes("youtu.be")) {
    return "youtube";
  }

  return "unknown";
}

/**
 * Check if a URL is a valid music URL from a supported platform
 */
export function isValidMusicUrl(url: string | null | undefined): boolean {
  return detectMusicPlatform(url) !== "unknown";
}

/**
 * Get the platform config for a given platform
 */
export function getMusicPlatformConfig(
  platform: MusicPlatform
): PlatformConfig {
  return PLATFORM_CONFIGS[platform] || PLATFORM_CONFIGS.unknown;
}

// ============================================
// Track ID Extraction
// ============================================

/**
 * Extract the track/video ID from a music URL
 */
export function extractTrackId(
  url: string | null | undefined,
  platform: MusicPlatform
): string | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  try {
    const urlObj = new URL(url.trim());

    switch (platform) {
      case "spotify": {
        // Pattern: /track/ID, /album/ID, /intl-xx/track/ID
        const pathParts = urlObj.pathname.split("/").filter(Boolean);
        // Handle intl paths like /intl-de/track/ID
        const typeIndex = pathParts.findIndex((p) =>
          ["track", "album", "playlist", "episode"].includes(p)
        );
        if (typeIndex !== -1 && pathParts[typeIndex + 1]) {
          return pathParts[typeIndex + 1];
        }
        return null;
      }

      case "youtube": {
        // Pattern: /watch?v=ID or /shorts/ID or youtu.be/ID
        const videoId = urlObj.searchParams.get("v");
        if (videoId) return videoId;

        // youtu.be/ID or /shorts/ID
        const pathParts = urlObj.pathname.split("/").filter(Boolean);
        if (urlObj.host === "youtu.be" && pathParts[0]) {
          return pathParts[0];
        }
        if (pathParts[0] === "shorts" && pathParts[1]) {
          return pathParts[1];
        }
        return null;
      }

      case "soundcloud": {
        // SoundCloud uses artist/track format, not simple IDs
        const pathParts = urlObj.pathname.split("/").filter(Boolean);
        if (pathParts.length >= 2) {
          return `${pathParts[0]}/${pathParts[1]}`;
        }
        return null;
      }

      default:
        return null;
    }
  } catch {
    return null;
  }
}

/**
 * Extract the content type from a Spotify URL (track, album, playlist, episode)
 */
export function extractSpotifyContentType(
  url: string
): "track" | "album" | "playlist" | "episode" | null {
  try {
    const urlObj = new URL(url.trim());
    const pathParts = urlObj.pathname.split("/").filter(Boolean);
    const types = ["track", "album", "playlist", "episode"];
    const found = pathParts.find((p) => types.includes(p));
    return (found as "track" | "album" | "playlist" | "episode") || null;
  } catch {
    return null;
  }
}

// ============================================
// Embed URL Generation
// ============================================

/**
 * Generate an embed URL for in-app playback
 */
export function getEmbedUrl(
  url: string | null | undefined,
  platform: MusicPlatform
): string | null {
  if (!url) return null;

  const trackId = extractTrackId(url, platform);

  switch (platform) {
    case "spotify": {
      if (!trackId) return null;
      const contentType = extractSpotifyContentType(url) || "track";
      return `https://open.spotify.com/embed/${contentType}/${trackId}`;
    }

    case "youtube": {
      if (!trackId) return null;
      // Use youtube-nocookie for privacy
      return `https://www.youtube-nocookie.com/embed/${trackId}`;
    }

    case "soundcloud": {
      // SoundCloud widget uses the full URL
      const encodedUrl = encodeURIComponent(url.trim());
      return `https://w.soundcloud.com/player/?url=${encodedUrl}&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false`;
    }

    default:
      return null;
  }
}

// ============================================
// Deep Link Generation
// ============================================

/**
 * Generate a deep link to open the track in the native app
 */
export function getDeepLink(
  url: string | null | undefined,
  platform: MusicPlatform
): string | null {
  if (!url) return null;

  const trackId = extractTrackId(url, platform);

  switch (platform) {
    case "spotify": {
      if (!trackId) return null;
      const contentType = extractSpotifyContentType(url) || "track";
      return `spotify:${contentType}:${trackId}`;
    }

    case "youtube": {
      if (!trackId) return null;
      return `youtube://watch?v=${trackId}`;
    }

    case "soundcloud": {
      // SoundCloud uses universal links, return the original URL
      return url.trim();
    }

    default:
      return null;
  }
}

// ============================================
// oEmbed Fetching
// ============================================

// Simple in-memory cache for track info
const trackInfoCache = new Map<string, MusicTrackInfo>();
const errorCache = new Map<
  string,
  { error: string; errorType: MusicErrorType }
>();

/**
 * Fetch track info from a music platform using oEmbed
 */
export async function fetchMusicTrackInfo(
  url: string | null | undefined
): Promise<MusicFetchResult> {
  if (!url || typeof url !== "string" || !url.trim()) {
    return {
      info: null,
      error: "Invalid or unsupported music URL",
      errorType: "invalid_url",
    };
  }

  const trimmedUrl = url.trim();
  const platform = detectMusicPlatform(trimmedUrl);

  if (platform === "unknown") {
    return {
      info: null,
      error: "Invalid or unsupported music URL",
      errorType: "invalid_url",
    };
  }

  // Check cache first
  const cacheKey = trimmedUrl.toLowerCase();
  if (trackInfoCache.has(cacheKey)) {
    return {
      info: trackInfoCache.get(cacheKey)!,
      error: null,
      errorType: null,
    };
  }
  if (errorCache.has(cacheKey)) {
    const cached = errorCache.get(cacheKey)!;
    return { info: null, error: cached.error, errorType: cached.errorType };
  }

  const config = PLATFORM_CONFIGS[platform];
  if (!config.oEmbedUrl) {
    return {
      info: null,
      error: `${config.name} does not support metadata fetching`,
      errorType: "unknown",
    };
  }

  try {
    const oEmbedRequestUrl = `${config.oEmbedUrl}?url=${encodeURIComponent(
      trimmedUrl
    )}&format=json`;

    const response = await fetch(oEmbedRequestUrl);

    if (!response.ok) {
      const errorResult = {
        error: "Track not found or unavailable",
        errorType: "not_found" as MusicErrorType,
      };
      errorCache.set(cacheKey, errorResult);
      return { info: null, ...errorResult };
    }

    const data = await response.json();

    // Parse oEmbed response based on platform
    const trackInfo = parseOEmbedResponse(data, platform, trimmedUrl);

    if (trackInfo) {
      trackInfoCache.set(cacheKey, trackInfo);
      return { info: trackInfo, error: null, errorType: null };
    }

    return {
      info: null,
      error: "Could not parse track info",
      errorType: "unknown",
    };
  } catch (error) {
    console.error(`[fetchMusicTrackInfo] Error fetching ${platform}:`, error);
    const errorResult = {
      error: `Failed to fetch track info from ${config.name}`,
      errorType: "network" as MusicErrorType,
    };
    errorCache.set(cacheKey, errorResult);
    return { info: null, ...errorResult };
  }
}

/**
 * Parse oEmbed response into normalized MusicTrackInfo
 */
function parseOEmbedResponse(
  data: any,
  platform: MusicPlatform,
  originalUrl: string
): MusicTrackInfo | null {
  if (!data) return null;

  switch (platform) {
    case "soundcloud": {
      // SoundCloud oEmbed response
      // title format is usually "Track Name by Artist Name"
      const fullTitle = data.title || "Unknown Track";
      const [title, ...artistParts] = fullTitle.split(" by ");
      const artist =
        artistParts.join(" by ") || data.author_name || "Unknown Artist";

      return {
        title: title || fullTitle,
        artist,
        artworkUrl: data.thumbnail_url || null,
        duration: undefined, // SoundCloud oEmbed doesn't include duration
        platform: "soundcloud",
        embedUrl: getEmbedUrl(originalUrl, "soundcloud"),
        originalUrl,
      };
    }

    case "spotify": {
      // Spotify oEmbed response
      // title is the track name, no separate artist field
      const title = data.title || "Unknown Track";

      // Extract embed URL from html if available
      let embedUrl = getEmbedUrl(originalUrl, "spotify");
      if (data.html) {
        const srcMatch = data.html.match(/src="([^"]+)"/);
        if (srcMatch) {
          embedUrl = srcMatch[1];
        }
      }

      return {
        title,
        artist: "Spotify", // oEmbed doesn't include artist separately
        artworkUrl: data.thumbnail_url || null,
        duration: undefined,
        platform: "spotify",
        embedUrl,
        originalUrl,
      };
    }

    case "youtube": {
      // YouTube oEmbed response
      return {
        title: data.title || "Unknown Video",
        artist: data.author_name || "Unknown Channel",
        artworkUrl: data.thumbnail_url || null,
        duration: undefined, // YouTube oEmbed doesn't include duration
        platform: "youtube",
        embedUrl: getEmbedUrl(originalUrl, "youtube"),
        originalUrl,
      };
    }

    default:
      return null;
  }
}

/**
 * Clear the track info cache (useful for testing or forcing refresh)
 */
export function clearMusicTrackCache(): void {
  trackInfoCache.clear();
  errorCache.clear();
}

// ============================================
// Utility Functions
// ============================================

/**
 * Get a user-friendly validation error message for a music URL
 */
export function getMusicValidationError(
  url: string | null | undefined
): string | null {
  if (!url || url.trim() === "") {
    return null; // Empty is valid (optional field)
  }

  const platform = detectMusicPlatform(url);

  if (platform === "unknown") {
    return "Please enter a valid music URL (SoundCloud, Spotify, or YouTube)";
  }

  return null;
}

/**
 * Check if a platform supports in-app playback
 */
export function supportsInAppPlayback(platform: MusicPlatform): boolean {
  return PLATFORM_CONFIGS[platform]?.supportsInAppPlayback ?? false;
}

/**
 * Check if a platform supports preview playback
 */
export function supportsPreview(platform: MusicPlatform): boolean {
  return PLATFORM_CONFIGS[platform]?.supportsPreview ?? false;
}
