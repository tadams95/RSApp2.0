/**
 * Social Links Utilities
 * Handles URL validation, parsing, and deep linking for social media platforms
 */

// ============================================
// Types
// ============================================

export type SocialPlatform =
  | "twitter"
  | "instagram"
  | "tiktok"
  | "soundcloud"
  | "spotify"
  | "youtube";

export interface SocialLinkConfig {
  platform: SocialPlatform;
  name: string;
  icon: string; // MaterialCommunityIcons name
  color: string;
  urlPatterns: RegExp[];
  usernamePattern: RegExp;
  deepLinkTemplate: string;
  webUrlTemplate: string;
}

// ============================================
// Platform Configurations
// ============================================

export const SOCIAL_PLATFORMS: Record<SocialPlatform, SocialLinkConfig> = {
  twitter: {
    platform: "twitter",
    name: "X",
    icon: "alpha-x-box",
    color: "#000000",
    urlPatterns: [
      /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[\w]+\/?$/i,
      /^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[\w]+\/?(\?.*)?$/i,
    ],
    usernamePattern: /(?:twitter\.com|x\.com)\/([\w]+)/i,
    deepLinkTemplate: "twitter://user?screen_name={username}",
    webUrlTemplate: "https://x.com/{username}",
  },
  instagram: {
    platform: "instagram",
    name: "Instagram",
    icon: "instagram", // Custom InstagramLogo SVG used in SocialLinksRow
    color: "#E4405F",
    urlPatterns: [
      /^https?:\/\/(www\.)?instagram\.com\/[\w.]+\/?$/i,
      /^https?:\/\/(www\.)?instagram\.com\/[\w.]+\/?(\?.*)?$/i,
    ],
    usernamePattern: /instagram\.com\/([\w.]+)/i,
    deepLinkTemplate: "instagram://user?username={username}",
    webUrlTemplate: "https://instagram.com/{username}",
  },
  tiktok: {
    platform: "tiktok",
    name: "TikTok",
    icon: "music-note", // Custom TikTokLogo SVG used in SocialLinksRow
    color: "#000000",
    urlPatterns: [
      /^https?:\/\/(www\.)?tiktok\.com\/@[\w.]+\/?$/i,
      /^https?:\/\/(www\.)?tiktok\.com\/@[\w.]+\/?(\?.*)?$/i,
      /^https?:\/\/vm\.tiktok\.com\/[\w]+\/?$/i, // Short links
    ],
    usernamePattern: /tiktok\.com\/@?([\w.]+)/i,
    deepLinkTemplate: "snssdk1233://user/profile/{username}",
    webUrlTemplate: "https://tiktok.com/@{username}",
  },
  soundcloud: {
    platform: "soundcloud",
    name: "SoundCloud",
    icon: "soundcloud",
    color: "#FF5500",
    urlPatterns: [
      /^https?:\/\/(www\.)?soundcloud\.com\/[\w-]+\/?$/i,
      /^https?:\/\/(www\.)?soundcloud\.com\/[\w-]+\/?(\?.*)?$/i,
      /^https?:\/\/on\.soundcloud\.com\/[\w]+\/?$/i,
    ],
    usernamePattern: /soundcloud\.com\/([\w-]+)/i,
    deepLinkTemplate: "soundcloud://users:{username}",
    webUrlTemplate: "https://soundcloud.com/{username}",
  },
  spotify: {
    platform: "spotify",
    name: "Spotify",
    icon: "spotify",
    color: "#1DB954",
    urlPatterns: [
      /^https?:\/\/(www\.)?open\.spotify\.com\/artist\/[\w]+\/?$/i,
      /^https?:\/\/(www\.)?open\.spotify\.com\/artist\/[\w]+\/?(\/.*)?$/i,
      /^https?:\/\/(www\.)?open\.spotify\.com\/user\/[\w]+\/?$/i,
      /^https?:\/\/spotify\.link\/[\w]+\/?$/i,
    ],
    usernamePattern: /open\.spotify\.com\/(artist|user)\/([\w]+)/i,
    deepLinkTemplate: "spotify://user?id={username}",
    webUrlTemplate: "https://open.spotify.com/user/{username}",
  },
  youtube: {
    platform: "youtube",
    name: "YouTube",
    icon: "youtube",
    color: "#FF0000",
    urlPatterns: [
      /^https?:\/\/(www\.)?youtube\.com\/@[\w-]+\/?$/i,
      /^https?:\/\/(www\.)?youtube\.com\/channel\/[\w-]+\/?$/i,
      /^https?:\/\/(www\.)?youtube\.com\/c\/[\w-]+\/?$/i,
      /^https?:\/\/(www\.)?youtube\.com\/user\/[\w-]+\/?$/i,
      /^https?:\/\/youtu\.be\/[\w-]+\/?$/i,
    ],
    usernamePattern:
      /youtube\.com\/(@[\w-]+|channel\/[\w-]+|c\/[\w-]+|user\/[\w-]+)/i,
    deepLinkTemplate: "vnd.youtube://www.youtube.com/{username}",
    webUrlTemplate: "https://youtube.com/{username}",
  },
};

// ============================================
// URL Validation
// ============================================

/**
 * Check if a URL is valid for a specific platform
 */
export function isValidSocialUrl(
  url: string | null | undefined,
  platform: SocialPlatform
): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  const trimmedUrl = url.trim();
  const config = SOCIAL_PLATFORMS[platform];

  return config.urlPatterns.some((pattern) => pattern.test(trimmedUrl));
}

/**
 * Check if a URL is valid for any supported platform
 */
export function isValidAnySocialUrl(url: string | null | undefined): boolean {
  if (!url || typeof url !== "string") {
    return false;
  }

  return Object.keys(SOCIAL_PLATFORMS).some((platform) =>
    isValidSocialUrl(url, platform as SocialPlatform)
  );
}

/**
 * Detect which platform a URL belongs to
 */
export function detectPlatform(
  url: string | null | undefined
): SocialPlatform | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  const trimmedUrl = url.trim().toLowerCase();

  if (trimmedUrl.includes("twitter.com") || trimmedUrl.includes("x.com")) {
    return "twitter";
  }
  if (trimmedUrl.includes("instagram.com")) {
    return "instagram";
  }
  if (trimmedUrl.includes("tiktok.com")) {
    return "tiktok";
  }
  if (trimmedUrl.includes("soundcloud.com")) {
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

  return null;
}

// ============================================
// Username Extraction
// ============================================

/**
 * Extract username from a social media URL
 */
export function extractUsername(
  url: string | null | undefined,
  platform: SocialPlatform
): string | null {
  if (!url || typeof url !== "string") {
    return null;
  }

  const config = SOCIAL_PLATFORMS[platform];
  const match = url.match(config.usernamePattern);

  if (match && match[1]) {
    // Remove @ prefix if present for consistency
    return match[1].replace(/^@/, "");
  }

  return null;
}

/**
 * Extract username from Twitter/X URL
 */
export function extractTwitterUsername(
  url: string | null | undefined
): string | null {
  return extractUsername(url, "twitter");
}

/**
 * Extract username from Instagram URL
 */
export function extractInstagramUsername(
  url: string | null | undefined
): string | null {
  return extractUsername(url, "instagram");
}

/**
 * Extract username from TikTok URL
 */
export function extractTikTokUsername(
  url: string | null | undefined
): string | null {
  return extractUsername(url, "tiktok");
}

/**
 * Extract username from SoundCloud URL
 */
export function extractSoundCloudUsername(
  url: string | null | undefined
): string | null {
  return extractUsername(url, "soundcloud");
}

// ============================================
// Deep Linking
// ============================================

/**
 * Generate a deep link URL for a platform, with web URL fallback
 * Returns the web URL since deep linking requires canOpenURL checks at runtime
 */
export function getSocialWebUrl(
  url: string | null | undefined,
  platform: SocialPlatform
): string | null {
  if (!url) return null;

  const username = extractUsername(url, platform);
  if (!username) {
    // If we can't extract username, return the original URL
    return url;
  }

  const config = SOCIAL_PLATFORMS[platform];
  return config.webUrlTemplate.replace("{username}", username);
}

/**
 * Generate a deep link URL for a platform
 * Note: Deep links may not work if app isn't installed
 */
export function getSocialDeepLink(
  url: string | null | undefined,
  platform: SocialPlatform
): string | null {
  if (!url) return null;

  const username = extractUsername(url, platform);
  if (!username) {
    return null;
  }

  const config = SOCIAL_PLATFORMS[platform];
  return config.deepLinkTemplate.replace("{username}", username);
}

/**
 * Get the best URL to open for a social link
 * Returns web URL (deep linking handled at component level with Linking.canOpenURL)
 */
export function getOpenableUrl(
  url: string | null | undefined,
  platform: SocialPlatform
): string | null {
  if (!url) return null;

  // Normalize to web URL for consistency
  const webUrl = getSocialWebUrl(url, platform);
  return webUrl || url;
}

// ============================================
// URL Normalization
// ============================================

/**
 * Normalize a social media URL to a consistent format
 */
export function normalizeSocialUrl(
  url: string | null | undefined,
  platform: SocialPlatform
): string | null {
  if (!url) return null;

  const username = extractUsername(url, platform);
  if (!username) {
    return url.trim();
  }

  const config = SOCIAL_PLATFORMS[platform];
  return config.webUrlTemplate.replace("{username}", username);
}

// ============================================
// Validation Messages
// ============================================

/**
 * Get validation error message for a platform URL
 */
export function getValidationError(
  url: string | null | undefined,
  platform: SocialPlatform
): string | null {
  if (!url || url.trim() === "") {
    return null; // Empty is valid (optional field)
  }

  const config = SOCIAL_PLATFORMS[platform];

  if (!isValidSocialUrl(url, platform)) {
    return `Please enter a valid ${config.name} URL`;
  }

  return null;
}

/**
 * Check if any social links exist in a socialLinks object
 */
export function hasSocialLinks(socialLinks?: {
  twitter?: string;
  instagram?: string;
  tiktok?: string;
  soundcloud?: string;
  spotify?: string;
  youtube?: string;
}): boolean {
  if (!socialLinks) return false;

  return Object.values(socialLinks).some((url) => url && url.trim().length > 0);
}
