import React, { useCallback, useMemo } from "react";
import { Linking, StyleProp, Text, TextStyle } from "react-native";
import type { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { parseText, TextSegment, truncateUrl } from "../../utils/textParser";

export interface LinkedTextProps {
  /** The text content to parse and render */
  text: string;
  /** Style applied to the entire text block */
  style?: StyleProp<TextStyle>;
  /** Style applied to all link types (URL, mention, hashtag) */
  linkStyle?: StyleProp<TextStyle>;
  /** Callback when a @mention is tapped */
  onMentionPress?: (username: string) => void;
  /** Callback when a #hashtag is tapped */
  onHashtagPress?: (tag: string) => void;
  /** Callback when a URL is tapped. If not provided, opens in browser */
  onUrlPress?: (url: string) => void;
  /** Maximum number of lines before truncation */
  numberOfLines?: number;
  /** Whether the text is selectable */
  selectable?: boolean;
  /** Max length for URL display (truncates long URLs). Set to 0 to disable. Default: 50 */
  maxUrlLength?: number;
}

/**
 * LinkedText - Renders text with interactive links for URLs, @mentions, and #hashtags
 *
 * Usage:
 * ```tsx
 * <LinkedText
 *   text="Check out https://ragestate.com with @djshadow!"
 *   onMentionPress={(username) => router.push(`/profile/${username}`)}
 * />
 * ```
 */
export function LinkedText({
  text,
  style,
  linkStyle,
  onMentionPress,
  onHashtagPress,
  onUrlPress,
  numberOfLines,
  selectable = false,
  maxUrlLength = 50,
}: LinkedTextProps): JSX.Element {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Parse text into segments
  const segments = useMemo(() => parseText(text), [text]);

  // Handle URL tap - open in browser by default
  const handleUrlPress = useCallback(
    async (url: string) => {
      if (onUrlPress) {
        onUrlPress(url);
        return;
      }

      try {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        }
      } catch (error) {
        console.warn("Failed to open URL:", url, error);
      }
    },
    [onUrlPress]
  );

  // Handle mention tap
  const handleMentionPress = useCallback(
    (username: string) => {
      onMentionPress?.(username);
    },
    [onMentionPress]
  );

  // Handle hashtag tap
  const handleHashtagPress = useCallback(
    (tag: string) => {
      onHashtagPress?.(tag);
    },
    [onHashtagPress]
  );

  // Render a single segment
  const renderSegment = (segment: TextSegment, index: number) => {
    switch (segment.type) {
      case "url": {
        // Truncate URL for display if needed, but keep full URL for navigation
        const displayUrl =
          maxUrlLength > 0
            ? truncateUrl(segment.content, maxUrlLength)
            : segment.content;

        return (
          <Text
            key={`url-${index}`}
            style={[styles.link, styles.urlLink, linkStyle]}
            onPress={() => handleUrlPress(segment.url)}
            accessibilityRole="link"
            accessibilityLabel={`Link: ${segment.url}`}
            accessibilityHint="Opens in browser"
          >
            {displayUrl}
          </Text>
        );
      }

      case "mention":
        return (
          <Text
            key={`mention-${index}`}
            style={[styles.link, styles.mentionLink, linkStyle]}
            onPress={
              onMentionPress
                ? () => handleMentionPress(segment.username)
                : undefined
            }
            accessibilityRole={onMentionPress ? "button" : "text"}
            accessibilityLabel={`Mention: @${segment.username}`}
            accessibilityHint={
              onMentionPress ? "Tap to view profile" : undefined
            }
          >
            {segment.content}
          </Text>
        );

      case "hashtag":
        return (
          <Text
            key={`hashtag-${index}`}
            style={[styles.link, styles.hashtagLink, linkStyle]}
            onPress={
              onHashtagPress ? () => handleHashtagPress(segment.tag) : undefined
            }
            accessibilityRole={onHashtagPress ? "button" : "text"}
            accessibilityLabel={`Hashtag: #${segment.tag}`}
            accessibilityHint={
              onHashtagPress ? "Tap to view hashtag" : undefined
            }
          >
            {segment.content}
          </Text>
        );

      case "text":
      default:
        return (
          <Text key={`text-${index}`} style={styles.plainText}>
            {segment.content}
          </Text>
        );
    }
  };

  // If no segments, render empty
  if (segments.length === 0) {
    return <Text style={style} />;
  }

  return (
    <Text
      style={style}
      numberOfLines={numberOfLines}
      selectable={selectable}
      accessibilityRole="text"
    >
      {segments.map(renderSegment)}
    </Text>
  );
}

const createStyles = (theme: Theme) =>
  ({
    plainText: {
      // Inherits from parent Text style
    },
    link: {
      color: theme.colors.accent,
    },
    urlLink: {
      textDecorationLine: "underline",
    },
    mentionLink: {
      fontWeight: "600",
    },
    hashtagLink: {
      // Same as base link style
    },
  } as const);

export default LinkedText;
