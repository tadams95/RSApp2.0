/**
 * Tests for Music Platform Utilities
 * @file src/__tests__/utils/musicPlatforms.test.ts
 */

import {
  detectMusicPlatform,
  extractTrackId,
  fetchMusicTrackInfo,
  getDeepLink,
  getEmbedUrl,
  getMusicPlatformConfig,
  isValidMusicUrl,
  MusicPlatform,
  PLATFORM_CONFIGS,
} from "../../utils/musicPlatforms";

// ============================================
// PLATFORM_CONFIGS Tests
// ============================================

describe("PLATFORM_CONFIGS", () => {
  it("has all required platforms", () => {
    expect(PLATFORM_CONFIGS).toHaveProperty("soundcloud");
    expect(PLATFORM_CONFIGS).toHaveProperty("spotify");
    expect(PLATFORM_CONFIGS).toHaveProperty("youtube");
    expect(PLATFORM_CONFIGS).toHaveProperty("unknown");
  });

  it("each platform has required properties", () => {
    const requiredProps = [
      "name",
      "icon",
      "color",
      "oEmbedUrl",
      "urlPatterns",
      "supportsInAppPlayback",
      "supportsPreview",
    ];

    Object.values(PLATFORM_CONFIGS).forEach((config) => {
      requiredProps.forEach((prop) => {
        expect(config).toHaveProperty(prop);
      });
    });
  });

  it("SoundCloud config is correct", () => {
    const config = PLATFORM_CONFIGS.soundcloud;
    expect(config.name).toBe("SoundCloud");
    expect(config.icon).toBe("soundcloud");
    expect(config.color).toBe("#FF5500");
    expect(config.supportsInAppPlayback).toBe(true);
  });

  it("Spotify config is correct", () => {
    const config = PLATFORM_CONFIGS.spotify;
    expect(config.name).toBe("Spotify");
    expect(config.icon).toBe("spotify");
    expect(config.color).toBe("#1DB954");
    expect(config.oEmbedUrl).toBe("https://open.spotify.com/oembed");
  });

  it("YouTube config is correct", () => {
    const config = PLATFORM_CONFIGS.youtube;
    expect(config.name).toBe("YouTube");
    expect(config.icon).toBe("youtube");
    expect(config.color).toBe("#FF0000");
    expect(config.oEmbedUrl).toBe("https://www.youtube.com/oembed");
  });
});

// ============================================
// detectMusicPlatform Tests
// ============================================

describe("detectMusicPlatform", () => {
  describe("SoundCloud URLs", () => {
    it("detects soundcloud.com URL", () => {
      expect(detectMusicPlatform("https://soundcloud.com/artist/track")).toBe(
        "soundcloud"
      );
    });

    it("detects on.soundcloud.com short link", () => {
      expect(detectMusicPlatform("https://on.soundcloud.com/abc123")).toBe(
        "soundcloud"
      );
    });

    it("detects m.soundcloud.com mobile link", () => {
      expect(detectMusicPlatform("https://m.soundcloud.com/artist/track")).toBe(
        "soundcloud"
      );
    });

    it("detects URL with query params", () => {
      expect(
        detectMusicPlatform("https://soundcloud.com/artist/track?si=abc")
      ).toBe("soundcloud");
    });
  });

  describe("Spotify URLs", () => {
    it("detects open.spotify.com track URL", () => {
      expect(
        detectMusicPlatform(
          "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"
        )
      ).toBe("spotify");
    });

    it("detects open.spotify.com album URL", () => {
      expect(detectMusicPlatform("https://open.spotify.com/album/abc123")).toBe(
        "spotify"
      );
    });

    it("detects spotify.link short URL", () => {
      expect(detectMusicPlatform("https://spotify.link/abc123")).toBe(
        "spotify"
      );
    });

    it("detects URL with query params", () => {
      expect(
        detectMusicPlatform(
          "https://open.spotify.com/track/abc123?si=xyz&utm_source=copy-link"
        )
      ).toBe("spotify");
    });

    it("detects intl-* subdomain URLs", () => {
      expect(
        detectMusicPlatform("https://open.spotify.com/intl-de/track/abc123")
      ).toBe("spotify");
    });
  });

  describe("YouTube URLs", () => {
    it("detects youtube.com/watch URL", () => {
      expect(
        detectMusicPlatform("https://www.youtube.com/watch?v=dQw4w9WgXcQ")
      ).toBe("youtube");
    });

    it("detects youtu.be short URL", () => {
      expect(detectMusicPlatform("https://youtu.be/dQw4w9WgXcQ")).toBe(
        "youtube"
      );
    });

    it("detects YouTube Shorts URL", () => {
      expect(detectMusicPlatform("https://youtube.com/shorts/abc123")).toBe(
        "youtube"
      );
    });

    it("detects YouTube Music URL", () => {
      expect(
        detectMusicPlatform("https://music.youtube.com/watch?v=abc123")
      ).toBe("youtube");
    });

    it("detects youtube.com without www", () => {
      expect(detectMusicPlatform("https://youtube.com/watch?v=abc123")).toBe(
        "youtube"
      );
    });
  });

  describe("Edge cases", () => {
    it("returns unknown for null", () => {
      expect(detectMusicPlatform(null as any)).toBe("unknown");
    });

    it("returns unknown for undefined", () => {
      expect(detectMusicPlatform(undefined as any)).toBe("unknown");
    });

    it("returns unknown for empty string", () => {
      expect(detectMusicPlatform("")).toBe("unknown");
    });

    it("returns unknown for non-music URL", () => {
      expect(detectMusicPlatform("https://google.com")).toBe("unknown");
    });

    it("returns unknown for invalid URL", () => {
      expect(detectMusicPlatform("not-a-url")).toBe("unknown");
    });

    it("is case insensitive", () => {
      expect(detectMusicPlatform("HTTPS://SOUNDCLOUD.COM/ARTIST/TRACK")).toBe(
        "soundcloud"
      );
    });

    it("handles URLs with trailing slash", () => {
      expect(detectMusicPlatform("https://soundcloud.com/artist/track/")).toBe(
        "soundcloud"
      );
    });
  });
});

// ============================================
// isValidMusicUrl Tests
// ============================================

describe("isValidMusicUrl", () => {
  it("returns true for valid SoundCloud URL", () => {
    expect(isValidMusicUrl("https://soundcloud.com/artist/track")).toBe(true);
  });

  it("returns true for valid Spotify URL", () => {
    expect(isValidMusicUrl("https://open.spotify.com/track/abc123")).toBe(true);
  });

  it("returns true for valid YouTube URL", () => {
    expect(isValidMusicUrl("https://youtube.com/watch?v=abc123")).toBe(true);
  });

  it("returns false for unknown platform", () => {
    expect(isValidMusicUrl("https://tidal.com/track/123")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isValidMusicUrl(null as any)).toBe(false);
  });

  it("returns false for empty string", () => {
    expect(isValidMusicUrl("")).toBe(false);
  });
});

// ============================================
// extractTrackId Tests
// ============================================

describe("extractTrackId", () => {
  describe("Spotify", () => {
    it("extracts track ID from standard URL", () => {
      expect(
        extractTrackId(
          "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
          "spotify"
        )
      ).toBe("4uLU6hMCjMI75M1A2tKUQC");
    });

    it("extracts track ID with query params", () => {
      expect(
        extractTrackId(
          "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC?si=abc",
          "spotify"
        )
      ).toBe("4uLU6hMCjMI75M1A2tKUQC");
    });

    it("extracts album ID", () => {
      expect(
        extractTrackId("https://open.spotify.com/album/abc123xyz", "spotify")
      ).toBe("abc123xyz");
    });

    it("handles intl subdomain paths", () => {
      expect(
        extractTrackId(
          "https://open.spotify.com/intl-de/track/abc123",
          "spotify"
        )
      ).toBe("abc123");
    });
  });

  describe("YouTube", () => {
    it("extracts video ID from watch URL", () => {
      expect(
        extractTrackId("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "youtube")
      ).toBe("dQw4w9WgXcQ");
    });

    it("extracts video ID from youtu.be short URL", () => {
      expect(extractTrackId("https://youtu.be/dQw4w9WgXcQ", "youtube")).toBe(
        "dQw4w9WgXcQ"
      );
    });

    it("extracts video ID from shorts URL", () => {
      expect(
        extractTrackId("https://youtube.com/shorts/abc123", "youtube")
      ).toBe("abc123");
    });

    it("handles extra query params", () => {
      expect(
        extractTrackId(
          "https://www.youtube.com/watch?v=abc123&list=PLxyz",
          "youtube"
        )
      ).toBe("abc123");
    });
  });

  describe("SoundCloud", () => {
    it("returns full path for SoundCloud (no simple ID)", () => {
      const result = extractTrackId(
        "https://soundcloud.com/artist-name/track-name",
        "soundcloud"
      );
      expect(result).toBe("artist-name/track-name");
    });
  });

  describe("Edge cases", () => {
    it("returns null for invalid URL", () => {
      expect(extractTrackId("not-a-url", "spotify")).toBeNull();
    });

    it("returns null for null input", () => {
      expect(extractTrackId(null as any, "spotify")).toBeNull();
    });
  });
});

// ============================================
// getEmbedUrl Tests
// ============================================

describe("getEmbedUrl", () => {
  describe("Spotify", () => {
    it("generates embed URL for track", () => {
      const embedUrl = getEmbedUrl(
        "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
        "spotify"
      );
      expect(embedUrl).toBe(
        "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC"
      );
    });

    it("generates embed URL for album", () => {
      const embedUrl = getEmbedUrl(
        "https://open.spotify.com/album/abc123",
        "spotify"
      );
      expect(embedUrl).toBe("https://open.spotify.com/embed/album/abc123");
    });
  });

  describe("YouTube", () => {
    it("generates embed URL from watch URL", () => {
      const embedUrl = getEmbedUrl(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "youtube"
      );
      expect(embedUrl).toBe(
        "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
      );
    });

    it("generates embed URL from youtu.be URL", () => {
      const embedUrl = getEmbedUrl("https://youtu.be/dQw4w9WgXcQ", "youtube");
      expect(embedUrl).toBe(
        "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ"
      );
    });
  });

  describe("SoundCloud", () => {
    it("generates widget URL", () => {
      const embedUrl = getEmbedUrl(
        "https://soundcloud.com/artist/track",
        "soundcloud"
      );
      expect(embedUrl).toContain("w.soundcloud.com/player");
      expect(embedUrl).toContain(
        encodeURIComponent("https://soundcloud.com/artist/track")
      );
    });
  });

  it("returns null for unknown platform", () => {
    expect(getEmbedUrl("https://example.com", "unknown")).toBeNull();
  });
});

// ============================================
// getDeepLink Tests
// ============================================

describe("getDeepLink", () => {
  describe("Spotify", () => {
    it("generates deep link for track", () => {
      const deepLink = getDeepLink(
        "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
        "spotify"
      );
      expect(deepLink).toBe("spotify:track:4uLU6hMCjMI75M1A2tKUQC");
    });

    it("generates deep link for album", () => {
      const deepLink = getDeepLink(
        "https://open.spotify.com/album/abc123",
        "spotify"
      );
      expect(deepLink).toBe("spotify:album:abc123");
    });
  });

  describe("YouTube", () => {
    it("generates deep link from watch URL", () => {
      const deepLink = getDeepLink(
        "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "youtube"
      );
      expect(deepLink).toBe("youtube://watch?v=dQw4w9WgXcQ");
    });

    it("generates deep link from youtu.be URL", () => {
      const deepLink = getDeepLink("https://youtu.be/dQw4w9WgXcQ", "youtube");
      expect(deepLink).toBe("youtube://watch?v=dQw4w9WgXcQ");
    });
  });

  describe("SoundCloud", () => {
    it("returns original URL (SoundCloud uses universal links)", () => {
      const deepLink = getDeepLink(
        "https://soundcloud.com/artist/track",
        "soundcloud"
      );
      expect(deepLink).toBe("https://soundcloud.com/artist/track");
    });
  });

  it("returns null for unknown platform", () => {
    expect(getDeepLink("https://example.com", "unknown")).toBeNull();
  });
});

// ============================================
// getMusicPlatformConfig Tests
// ============================================

describe("getMusicPlatformConfig", () => {
  it("returns config for valid platform", () => {
    const config = getMusicPlatformConfig("spotify");
    expect(config.name).toBe("Spotify");
    expect(config.color).toBe("#1DB954");
  });

  it("returns unknown config for invalid platform", () => {
    const config = getMusicPlatformConfig("invalid" as MusicPlatform);
    expect(config.name).toBe("Music");
  });
});

// ============================================
// fetchMusicTrackInfo Tests (mocked)
// ============================================

describe("fetchMusicTrackInfo", () => {
  // These tests mock the fetch API since we can't make real network requests
  const originalFetch = global.fetch;

  beforeEach(() => {
    global.fetch = jest.fn();
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns null for empty URL", async () => {
    const result = await fetchMusicTrackInfo("");
    expect(result.info).toBeNull();
    expect(result.error).toBe("Invalid or unsupported music URL");
  });

  it("returns null for unknown platform", async () => {
    const result = await fetchMusicTrackInfo("https://example.com");
    expect(result.info).toBeNull();
    expect(result.error).toBe("Invalid or unsupported music URL");
  });

  it("fetches Spotify track info via oEmbed", async () => {
    const mockResponse = {
      title: "Never Gonna Give You Up",
      thumbnail_url: "https://i.scdn.co/image/abc123",
      html: '<iframe src="https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC"></iframe>',
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await fetchMusicTrackInfo(
      "https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC"
    );

    expect(result.info).not.toBeNull();
    expect(result.info?.title).toBe("Never Gonna Give You Up");
    expect(result.info?.platform).toBe("spotify");
    expect(result.info?.artworkUrl).toBe("https://i.scdn.co/image/abc123");
  });

  it("fetches YouTube track info via oEmbed", async () => {
    const mockResponse = {
      title: "Rick Astley - Never Gonna Give You Up",
      author_name: "Rick Astley",
      thumbnail_url: "https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg",
    };

    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: true,
      json: async () => mockResponse,
    });

    const result = await fetchMusicTrackInfo(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ"
    );

    expect(result.info).not.toBeNull();
    expect(result.info?.title).toBe("Rick Astley - Never Gonna Give You Up");
    expect(result.info?.artist).toBe("Rick Astley");
    expect(result.info?.platform).toBe("youtube");
  });

  it("handles fetch errors gracefully", async () => {
    (global.fetch as jest.Mock).mockRejectedValueOnce(
      new Error("Network error")
    );

    const result = await fetchMusicTrackInfo(
      "https://open.spotify.com/track/abc123"
    );

    expect(result.info).toBeNull();
    expect(result.error).toContain("Failed to fetch");
  });

  it("handles non-ok response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({
      ok: false,
      status: 404,
    });

    const result = await fetchMusicTrackInfo(
      "https://open.spotify.com/track/invalidtrack"
    );

    expect(result.info).toBeNull();
    expect(result.error).toBe("Track not found or unavailable");
  });
});
