/**
 * Tests for Social Links Utilities
 * @file src/__tests__/utils/socialLinks.test.ts
 */

import {
  detectPlatform,
  extractInstagramUsername,
  extractSoundCloudUsername,
  extractTikTokUsername,
  extractTwitterUsername,
  extractUsername,
  getOpenableUrl,
  getSocialDeepLink,
  getSocialWebUrl,
  getValidationError,
  hasSocialLinks,
  isValidAnySocialUrl,
  isValidSocialUrl,
  normalizeSocialUrl,
} from "../../utils/socialLinks";

// ============================================
// isValidSocialUrl Tests
// ============================================

describe("isValidSocialUrl", () => {
  describe("Twitter/X", () => {
    it("accepts valid twitter.com URL", () => {
      expect(isValidSocialUrl("https://twitter.com/username", "twitter")).toBe(
        true
      );
    });

    it("accepts valid x.com URL", () => {
      expect(isValidSocialUrl("https://x.com/username", "twitter")).toBe(true);
    });

    it("accepts URL with www prefix", () => {
      expect(
        isValidSocialUrl("https://www.twitter.com/username", "twitter")
      ).toBe(true);
    });

    it("accepts URL with trailing slash", () => {
      expect(isValidSocialUrl("https://x.com/username/", "twitter")).toBe(true);
    });

    it("accepts URL with query params", () => {
      expect(
        isValidSocialUrl("https://x.com/username?ref=abc", "twitter")
      ).toBe(true);
    });

    it("rejects Instagram URL for twitter platform", () => {
      expect(
        isValidSocialUrl("https://instagram.com/username", "twitter")
      ).toBe(false);
    });

    it("rejects invalid URL format", () => {
      expect(isValidSocialUrl("not-a-url", "twitter")).toBe(false);
    });
  });

  describe("Instagram", () => {
    it("accepts valid Instagram URL", () => {
      expect(
        isValidSocialUrl("https://instagram.com/username", "instagram")
      ).toBe(true);
    });

    it("accepts URL with www prefix", () => {
      expect(
        isValidSocialUrl("https://www.instagram.com/username", "instagram")
      ).toBe(true);
    });

    it("accepts username with dots", () => {
      expect(
        isValidSocialUrl("https://instagram.com/user.name", "instagram")
      ).toBe(true);
    });

    it("rejects Twitter URL for instagram platform", () => {
      expect(
        isValidSocialUrl("https://twitter.com/username", "instagram")
      ).toBe(false);
    });
  });

  describe("TikTok", () => {
    it("accepts valid TikTok URL with @", () => {
      expect(isValidSocialUrl("https://tiktok.com/@username", "tiktok")).toBe(
        true
      );
    });

    it("accepts TikTok short link", () => {
      expect(isValidSocialUrl("https://vm.tiktok.com/abc123", "tiktok")).toBe(
        true
      );
    });

    it("accepts URL with www prefix", () => {
      expect(
        isValidSocialUrl("https://www.tiktok.com/@username", "tiktok")
      ).toBe(true);
    });
  });

  describe("SoundCloud", () => {
    it("accepts valid SoundCloud URL", () => {
      expect(
        isValidSocialUrl("https://soundcloud.com/artist-name", "soundcloud")
      ).toBe(true);
    });

    it("accepts username with hyphens", () => {
      expect(
        isValidSocialUrl("https://soundcloud.com/my-artist-name", "soundcloud")
      ).toBe(true);
    });

    it("accepts on.soundcloud.com short link", () => {
      expect(
        isValidSocialUrl("https://on.soundcloud.com/abc123", "soundcloud")
      ).toBe(true);
    });
  });

  describe("Spotify", () => {
    it("accepts valid Spotify artist URL", () => {
      expect(
        isValidSocialUrl("https://open.spotify.com/artist/abc123xyz", "spotify")
      ).toBe(true);
    });

    it("accepts Spotify user URL", () => {
      expect(
        isValidSocialUrl("https://open.spotify.com/user/username", "spotify")
      ).toBe(true);
    });

    it("accepts spotify.link short URL", () => {
      expect(isValidSocialUrl("https://spotify.link/abc123", "spotify")).toBe(
        true
      );
    });
  });

  describe("YouTube", () => {
    it("accepts YouTube channel URL with @", () => {
      expect(
        isValidSocialUrl("https://youtube.com/@channelname", "youtube")
      ).toBe(true);
    });

    it("accepts YouTube channel/ID URL", () => {
      expect(
        isValidSocialUrl("https://youtube.com/channel/UCabc123", "youtube")
      ).toBe(true);
    });

    it("accepts YouTube /c/ URL", () => {
      expect(
        isValidSocialUrl("https://youtube.com/c/channelname", "youtube")
      ).toBe(true);
    });

    it("accepts YouTube /user/ URL", () => {
      expect(
        isValidSocialUrl("https://youtube.com/user/username", "youtube")
      ).toBe(true);
    });

    it("accepts youtu.be short URL", () => {
      expect(isValidSocialUrl("https://youtu.be/abc123", "youtube")).toBe(true);
    });
  });

  describe("Edge cases", () => {
    it("returns false for null", () => {
      expect(isValidSocialUrl(null, "twitter")).toBe(false);
    });

    it("returns false for undefined", () => {
      expect(isValidSocialUrl(undefined, "twitter")).toBe(false);
    });

    it("returns false for empty string", () => {
      expect(isValidSocialUrl("", "twitter")).toBe(false);
    });

    it("handles whitespace-only string", () => {
      expect(isValidSocialUrl("   ", "twitter")).toBe(false);
    });
  });
});

// ============================================
// isValidAnySocialUrl Tests
// ============================================

describe("isValidAnySocialUrl", () => {
  it("returns true for valid Twitter URL", () => {
    expect(isValidAnySocialUrl("https://twitter.com/user")).toBe(true);
  });

  it("returns true for valid Instagram URL", () => {
    expect(isValidAnySocialUrl("https://instagram.com/user")).toBe(true);
  });

  it("returns false for invalid URL", () => {
    expect(isValidAnySocialUrl("https://example.com/user")).toBe(false);
  });

  it("returns false for null", () => {
    expect(isValidAnySocialUrl(null)).toBe(false);
  });
});

// ============================================
// detectPlatform Tests
// ============================================

describe("detectPlatform", () => {
  it("detects Twitter from twitter.com", () => {
    expect(detectPlatform("https://twitter.com/user")).toBe("twitter");
  });

  it("detects Twitter from x.com", () => {
    expect(detectPlatform("https://x.com/user")).toBe("twitter");
  });

  it("detects Instagram", () => {
    expect(detectPlatform("https://instagram.com/user")).toBe("instagram");
  });

  it("detects TikTok", () => {
    expect(detectPlatform("https://tiktok.com/@user")).toBe("tiktok");
  });

  it("detects SoundCloud", () => {
    expect(detectPlatform("https://soundcloud.com/artist")).toBe("soundcloud");
  });

  it("detects Spotify from open.spotify.com", () => {
    expect(detectPlatform("https://open.spotify.com/artist/123")).toBe(
      "spotify"
    );
  });

  it("detects Spotify from spotify.link", () => {
    expect(detectPlatform("https://spotify.link/abc")).toBe("spotify");
  });

  it("detects YouTube from youtube.com", () => {
    expect(detectPlatform("https://youtube.com/@channel")).toBe("youtube");
  });

  it("detects YouTube from youtu.be", () => {
    expect(detectPlatform("https://youtu.be/video")).toBe("youtube");
  });

  it("returns null for unknown platform", () => {
    expect(detectPlatform("https://facebook.com/user")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(detectPlatform(null)).toBeNull();
  });

  it("returns null for undefined input", () => {
    expect(detectPlatform(undefined)).toBeNull();
  });

  it("is case insensitive", () => {
    expect(detectPlatform("HTTPS://TWITTER.COM/USER")).toBe("twitter");
  });
});

// ============================================
// extractUsername Tests
// ============================================

describe("extractUsername", () => {
  describe("Twitter", () => {
    it("extracts username from twitter.com URL", () => {
      expect(extractUsername("https://twitter.com/elonmusk", "twitter")).toBe(
        "elonmusk"
      );
    });

    it("extracts username from x.com URL", () => {
      expect(extractUsername("https://x.com/elonmusk", "twitter")).toBe(
        "elonmusk"
      );
    });
  });

  describe("Instagram", () => {
    it("extracts username from Instagram URL", () => {
      expect(
        extractUsername("https://instagram.com/therock", "instagram")
      ).toBe("therock");
    });

    it("handles username with dots", () => {
      expect(
        extractUsername("https://instagram.com/user.name", "instagram")
      ).toBe("user.name");
    });
  });

  describe("TikTok", () => {
    it("extracts username with @ from TikTok URL", () => {
      expect(extractUsername("https://tiktok.com/@username", "tiktok")).toBe(
        "username"
      );
    });
  });

  describe("SoundCloud", () => {
    it("extracts username from SoundCloud URL", () => {
      expect(
        extractUsername("https://soundcloud.com/artist-name", "soundcloud")
      ).toBe("artist-name");
    });
  });

  describe("Edge cases", () => {
    it("returns null for null input", () => {
      expect(extractUsername(null, "twitter")).toBeNull();
    });

    it("returns null for undefined input", () => {
      expect(extractUsername(undefined, "twitter")).toBeNull();
    });

    it("returns null for non-matching URL", () => {
      expect(extractUsername("https://example.com", "twitter")).toBeNull();
    });
  });
});

// ============================================
// Platform-specific extractors
// ============================================

describe("Platform-specific username extractors", () => {
  it("extractTwitterUsername works", () => {
    expect(extractTwitterUsername("https://x.com/testuser")).toBe("testuser");
  });

  it("extractInstagramUsername works", () => {
    expect(extractInstagramUsername("https://instagram.com/testuser")).toBe(
      "testuser"
    );
  });

  it("extractTikTokUsername works", () => {
    expect(extractTikTokUsername("https://tiktok.com/@testuser")).toBe(
      "testuser"
    );
  });

  it("extractSoundCloudUsername works", () => {
    expect(extractSoundCloudUsername("https://soundcloud.com/test-user")).toBe(
      "test-user"
    );
  });
});

// ============================================
// Deep Linking Tests
// ============================================

describe("getSocialWebUrl", () => {
  it("returns normalized web URL for Twitter", () => {
    expect(getSocialWebUrl("https://twitter.com/user", "twitter")).toBe(
      "https://x.com/user"
    );
  });

  it("returns normalized web URL for Instagram", () => {
    expect(getSocialWebUrl("https://instagram.com/user", "instagram")).toBe(
      "https://instagram.com/user"
    );
  });

  it("returns original URL if username cannot be extracted", () => {
    expect(getSocialWebUrl("https://example.com", "twitter")).toBe(
      "https://example.com"
    );
  });

  it("returns null for null input", () => {
    expect(getSocialWebUrl(null, "twitter")).toBeNull();
  });
});

describe("getSocialDeepLink", () => {
  it("generates Twitter deep link", () => {
    expect(getSocialDeepLink("https://x.com/testuser", "twitter")).toBe(
      "twitter://user?screen_name=testuser"
    );
  });

  it("generates Instagram deep link", () => {
    expect(
      getSocialDeepLink("https://instagram.com/testuser", "instagram")
    ).toBe("instagram://user?username=testuser");
  });

  it("returns null if username cannot be extracted", () => {
    expect(getSocialDeepLink("https://example.com", "twitter")).toBeNull();
  });

  it("returns null for null input", () => {
    expect(getSocialDeepLink(null, "twitter")).toBeNull();
  });
});

describe("getOpenableUrl", () => {
  it("returns web URL for valid social link", () => {
    expect(getOpenableUrl("https://twitter.com/user", "twitter")).toBe(
      "https://x.com/user"
    );
  });

  it("returns original URL if normalization fails", () => {
    expect(getOpenableUrl("https://example.com", "twitter")).toBe(
      "https://example.com"
    );
  });

  it("returns null for null input", () => {
    expect(getOpenableUrl(null, "twitter")).toBeNull();
  });
});

// ============================================
// URL Normalization Tests
// ============================================

describe("normalizeSocialUrl", () => {
  it("normalizes Twitter URL to x.com format", () => {
    expect(normalizeSocialUrl("https://twitter.com/user", "twitter")).toBe(
      "https://x.com/user"
    );
  });

  it("normalizes Instagram URL", () => {
    expect(
      normalizeSocialUrl("https://www.instagram.com/user/", "instagram")
    ).toBe("https://instagram.com/user");
  });

  it("returns trimmed URL if username cannot be extracted", () => {
    expect(normalizeSocialUrl("  https://example.com  ", "twitter")).toBe(
      "https://example.com"
    );
  });

  it("returns null for null input", () => {
    expect(normalizeSocialUrl(null, "twitter")).toBeNull();
  });
});

// ============================================
// Validation Error Tests
// ============================================

describe("getValidationError", () => {
  it("returns null for empty string (optional field)", () => {
    expect(getValidationError("", "twitter")).toBeNull();
  });

  it("returns null for null (optional field)", () => {
    expect(getValidationError(null, "twitter")).toBeNull();
  });

  it("returns null for valid URL", () => {
    expect(getValidationError("https://x.com/user", "twitter")).toBeNull();
  });

  it("returns error message for invalid Twitter URL", () => {
    expect(getValidationError("invalid-url", "twitter")).toBe(
      "Please enter a valid X URL"
    );
  });

  it("returns error message for invalid Instagram URL", () => {
    expect(getValidationError("invalid-url", "instagram")).toBe(
      "Please enter a valid Instagram URL"
    );
  });

  it("returns error message for invalid TikTok URL", () => {
    expect(getValidationError("invalid-url", "tiktok")).toBe(
      "Please enter a valid TikTok URL"
    );
  });

  it("returns error message for invalid SoundCloud URL", () => {
    expect(getValidationError("invalid-url", "soundcloud")).toBe(
      "Please enter a valid SoundCloud URL"
    );
  });

  it("returns error message for wrong platform URL", () => {
    expect(getValidationError("https://instagram.com/user", "twitter")).toBe(
      "Please enter a valid X URL"
    );
  });
});

// ============================================
// hasSocialLinks Tests
// ============================================

describe("hasSocialLinks", () => {
  it("returns false for undefined", () => {
    expect(hasSocialLinks(undefined)).toBe(false);
  });

  it("returns false for empty object", () => {
    expect(hasSocialLinks({})).toBe(false);
  });

  it("returns false for object with only empty strings", () => {
    expect(hasSocialLinks({ twitter: "", instagram: "" })).toBe(false);
  });

  it("returns false for object with whitespace-only strings", () => {
    expect(hasSocialLinks({ twitter: "   ", instagram: "  " })).toBe(false);
  });

  it("returns true when at least one link exists", () => {
    expect(hasSocialLinks({ twitter: "https://x.com/user" })).toBe(true);
  });

  it("returns true with multiple links", () => {
    expect(
      hasSocialLinks({
        twitter: "https://x.com/user",
        instagram: "https://instagram.com/user",
      })
    ).toBe(true);
  });

  it("returns true when only one link is non-empty", () => {
    expect(
      hasSocialLinks({
        twitter: "",
        instagram: "https://instagram.com/user",
        tiktok: "",
      })
    ).toBe(true);
  });

  it("handles all six platforms", () => {
    expect(
      hasSocialLinks({
        twitter: "https://x.com/user",
        instagram: "https://instagram.com/user",
        tiktok: "https://tiktok.com/@user",
        soundcloud: "https://soundcloud.com/user",
        spotify: "https://open.spotify.com/artist/123",
        youtube: "https://youtube.com/@user",
      })
    ).toBe(true);
  });
});
