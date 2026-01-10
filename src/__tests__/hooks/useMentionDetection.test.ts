/**
 * Tests for useMentionDetection Hook
 * @file src/__tests__/hooks/useMentionDetection.test.ts
 *
 * Tests the pure utility functions exported from the hook.
 * For React hook testing, use @testing-library/react-hooks.
 */

import {
  detectMentionAt,
  insertMentionAt,
} from "../../hooks/useMentionDetection";

// ============================================
// detectMentionAt Tests
// ============================================

describe("detectMentionAt", () => {
  describe("basic detection", () => {
    it("detects @ at the start of text", () => {
      const result = detectMentionAt("@user", 5);
      expect(result.isActive).toBe(true);
      expect(result.query).toBe("user");
      expect(result.startIndex).toBe(0);
    });

    it("detects @ after space", () => {
      const result = detectMentionAt("Hey @user", 9);
      expect(result.isActive).toBe(true);
      expect(result.query).toBe("user");
      expect(result.startIndex).toBe(4);
    });

    it("detects @ after newline", () => {
      const result = detectMentionAt("Hello\n@user", 11);
      expect(result.isActive).toBe(true);
      expect(result.query).toBe("user");
      expect(result.startIndex).toBe(6);
    });

    it("detects @ after tab", () => {
      const result = detectMentionAt("Hello\t@user", 11);
      expect(result.isActive).toBe(true);
      expect(result.query).toBe("user");
      expect(result.startIndex).toBe(6);
    });

    it("returns empty query when just @ typed", () => {
      const result = detectMentionAt("Hello @", 7);
      expect(result.isActive).toBe(true);
      expect(result.query).toBe("");
      expect(result.startIndex).toBe(6);
    });
  });

  describe("partial typing", () => {
    it("detects partial mention as user types", () => {
      // User typing "@r"
      expect(detectMentionAt("@r", 2)).toEqual({
        isActive: true,
        query: "r",
        startIndex: 0,
      });

      // User typing "@ra"
      expect(detectMentionAt("@ra", 3)).toEqual({
        isActive: true,
        query: "ra",
        startIndex: 0,
      });

      // User typing "@rage"
      expect(detectMentionAt("@rage", 5)).toEqual({
        isActive: true,
        query: "rage",
        startIndex: 0,
      });
    });

    it("detects mention with cursor in middle", () => {
      // Cursor after 'ra' in '@ragestate'
      const result = detectMentionAt("@ragestate", 3);
      expect(result.isActive).toBe(true);
      expect(result.query).toBe("ra");
      expect(result.startIndex).toBe(0);
    });
  });

  describe("invalid positions (mid-word @)", () => {
    it("ignores @ in email addresses", () => {
      const result = detectMentionAt("email@example.com", 17);
      expect(result.isActive).toBe(false);
      expect(result.query).toBe("");
    });

    it("ignores @ attached to word", () => {
      const result = detectMentionAt("test@user", 9);
      expect(result.isActive).toBe(false);
    });

    it("ignores @ after number without space", () => {
      const result = detectMentionAt("123@user", 8);
      expect(result.isActive).toBe(false);
    });

    it("ignores @ after punctuation without space", () => {
      const result = detectMentionAt("hello!@user", 11);
      expect(result.isActive).toBe(false);
    });
  });

  describe("invalid query characters", () => {
    it("stops detection when space is typed", () => {
      const result = detectMentionAt("@user name", 10);
      expect(result.isActive).toBe(false);
    });

    it("stops detection when special character is typed", () => {
      const result = detectMentionAt("@user!", 6);
      expect(result.isActive).toBe(false);
    });

    it("stops detection when hyphen is typed", () => {
      const result = detectMentionAt("@user-name", 10);
      expect(result.isActive).toBe(false);
    });

    it("stops detection when period is typed", () => {
      const result = detectMentionAt("@user.name", 10);
      expect(result.isActive).toBe(false);
    });
  });

  describe("valid username characters", () => {
    it("accepts alphanumeric usernames", () => {
      const result = detectMentionAt("@user123", 8);
      expect(result.isActive).toBe(true);
      expect(result.query).toBe("user123");
    });

    it("accepts underscores in usernames", () => {
      const result = detectMentionAt("@user_name", 10);
      expect(result.isActive).toBe(true);
      expect(result.query).toBe("user_name");
    });

    it("accepts mixed case usernames", () => {
      const result = detectMentionAt("@RageState", 10);
      expect(result.isActive).toBe(true);
      expect(result.query).toBe("RageState");
    });

    it("accepts usernames starting with numbers", () => {
      const result = detectMentionAt("@123user", 8);
      expect(result.isActive).toBe(true);
      expect(result.query).toBe("123user");
    });
  });

  describe("multiple mentions", () => {
    it("detects the most recent @ before cursor", () => {
      // Cursor at end, should detect @second
      const result = detectMentionAt("@first @second", 14);
      expect(result.isActive).toBe(true);
      expect(result.query).toBe("second");
      expect(result.startIndex).toBe(7);
    });

    it("detects first mention when cursor is there", () => {
      // Cursor after @first
      const result = detectMentionAt("@first @second", 6);
      expect(result.isActive).toBe(true);
      expect(result.query).toBe("first");
      expect(result.startIndex).toBe(0);
    });

    it("handles cursor between mentions", () => {
      // Cursor after space before @second
      const result = detectMentionAt("@first @second", 7);
      // The @ at index 7 has cursor right at it, query would be empty
      expect(result.isActive).toBe(true);
      expect(result.query).toBe("");
      expect(result.startIndex).toBe(7);
    });
  });

  describe("edge cases", () => {
    it("returns inactive for empty string", () => {
      const result = detectMentionAt("", 0);
      expect(result.isActive).toBe(false);
    });

    it("returns inactive for cursor at position 0", () => {
      const result = detectMentionAt("@user", 0);
      expect(result.isActive).toBe(false);
    });

    it("returns inactive when no @ present", () => {
      const result = detectMentionAt("hello world", 11);
      expect(result.isActive).toBe(false);
    });

    it("handles @ at very end with cursor after", () => {
      const result = detectMentionAt("hello @", 7);
      expect(result.isActive).toBe(true);
      expect(result.query).toBe("");
    });

    it("respects 30 character limit", () => {
      const longUsername = "a".repeat(30);
      const result = detectMentionAt(`@${longUsername}`, 31);
      expect(result.isActive).toBe(true);
      expect(result.query).toBe(longUsername);
    });

    it("returns inactive for username > 30 chars", () => {
      const tooLongUsername = "a".repeat(31);
      const result = detectMentionAt(`@${tooLongUsername}`, 32);
      expect(result.isActive).toBe(false);
    });
  });
});

// ============================================
// insertMentionAt Tests
// ============================================

describe("insertMentionAt", () => {
  describe("basic insertion", () => {
    it("inserts username at @ position", () => {
      const result = insertMentionAt("@", 0, "ragestate");
      expect(result).toBe("@ragestate ");
    });

    it("replaces partial query with full username", () => {
      const result = insertMentionAt("@rage", 0, "ragestate");
      expect(result).toBe("@ragestate ");
    });

    it("preserves text before mention", () => {
      const result = insertMentionAt("Hey @rage", 4, "ragestate");
      expect(result).toBe("Hey @ragestate ");
    });

    it("preserves text after mention", () => {
      const result = insertMentionAt("@rage check this", 0, "ragestate");
      expect(result).toBe("@ragestate check this");
    });
  });

  describe("spacing", () => {
    it("adds space after username when at end", () => {
      const result = insertMentionAt("@user", 0, "ragestate");
      expect(result).toBe("@ragestate ");
    });

    it("does not double space if text after has space", () => {
      const result = insertMentionAt("@user more text", 0, "ragestate");
      expect(result).toBe("@ragestate more text");
    });

    it("adds space when followed by text without space", () => {
      const result = insertMentionAt("@usertext", 0, "ragestate");
      // Note: "text" starts right after the detected mention chars
      // The function finds where username chars end
      expect(result).toBe("@ragestate ");
    });
  });

  describe("preserving context", () => {
    it("handles mention in middle of sentence", () => {
      const result = insertMentionAt(
        "Check out @rage for events!",
        10,
        "ragestate"
      );
      expect(result).toBe("Check out @ragestate for events!");
    });

    it("handles multiple words after mention", () => {
      const result = insertMentionAt(
        "@rage is hosting the show tonight",
        0,
        "ragestate"
      );
      expect(result).toBe("@ragestate is hosting the show tonight");
    });
  });

  describe("edge cases", () => {
    it("returns original text if startIndex is -1", () => {
      const result = insertMentionAt("hello world", -1, "ragestate");
      expect(result).toBe("hello world");
    });

    it("handles empty text with valid index", () => {
      // Edge case: shouldn't happen in practice
      const result = insertMentionAt("", 0, "ragestate");
      expect(result).toBe("@ragestate ");
    });

    it("handles username with underscores", () => {
      const result = insertMentionAt("@dj", 0, "dj_shadow_official");
      expect(result).toBe("@dj_shadow_official ");
    });

    it("handles username with numbers", () => {
      const result = insertMentionAt("@test", 0, "user123");
      expect(result).toBe("@user123 ");
    });
  });

  describe("complex scenarios", () => {
    it("works with second mention in text", () => {
      const text = "@first hey @sec";
      const result = insertMentionAt(text, 11, "second_user");
      expect(result).toBe("@first hey @second_user ");
    });

    it("preserves first mention when inserting second", () => {
      const text = "@ragestate and @ty";
      const result = insertMentionAt(text, 15, "tyrelle");
      expect(result).toBe("@ragestate and @tyrelle ");
    });
  });
});

// ============================================
// Integration-style tests
// ============================================

describe("mention detection flow", () => {
  it("simulates typing @ragestate", () => {
    const steps = [
      { text: "@", cursor: 1 },
      { text: "@r", cursor: 2 },
      { text: "@ra", cursor: 3 },
      { text: "@rag", cursor: 4 },
      { text: "@rage", cursor: 5 },
      { text: "@rages", cursor: 6 },
      { text: "@ragest", cursor: 7 },
      { text: "@ragesta", cursor: 8 },
      { text: "@ragestat", cursor: 9 },
      { text: "@ragestate", cursor: 10 },
    ];

    steps.forEach(({ text, cursor }) => {
      const result = detectMentionAt(text, cursor);
      expect(result.isActive).toBe(true);
      expect(result.query).toBe(text.slice(1)); // Everything after @
    });
  });

  it("simulates typing, selecting, and continuing", () => {
    // 1. User types "Hey @rage"
    let detection = detectMentionAt("Hey @rage", 9);
    expect(detection.isActive).toBe(true);
    expect(detection.query).toBe("rage");

    // 2. User selects "ragestate" from dropdown
    const newText = insertMentionAt(
      "Hey @rage",
      detection.startIndex,
      "ragestate"
    );
    expect(newText).toBe("Hey @ragestate ");

    // 3. User continues typing
    const finalText = newText + "check this out!";
    detection = detectMentionAt(finalText, finalText.length);
    expect(detection.isActive).toBe(false); // No active mention
  });
});
