import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Linking,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { usePostHog } from "../../analytics/PostHogProvider";
import { useTheme } from "../../contexts/ThemeContext";
import { useMusicPlayer } from "../../hooks/MusicPlayerContext";
import useMusicTrack from "../../hooks/useMusicTrack";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import {
  getDeepLink,
  getMusicPlatformConfig,
  MusicPlatform,
  MusicTrackInfo,
} from "../../utils/musicPlatforms";
import { ImageWithFallback } from "../ui";
import PlatformBadge from "./PlatformBadge";

// Cached track info from Firestore profileMusic field
interface CachedTrackInfo {
  platform: MusicPlatform;
  title?: string;
  artist?: string;
  artworkUrl?: string | null;
}

interface ProfileSongCardProps {
  songUrl: string | null | undefined;
  /** Optional cached track data from Firestore to avoid refetching */
  cachedTrackInfo?: CachedTrackInfo;
}

export default function ProfileSongCard({
  songUrl,
  cachedTrackInfo,
}: ProfileSongCardProps) {
  const { trackInfo, isLoading, error, errorType, platform } =
    useMusicTrack(songUrl);
  const player = useMusicPlayer();
  const { capture } = usePostHog();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  // Use cached data as fallback while loading or if oEmbed fails
  // This provides instant display using Firestore-cached metadata
  const displayInfo: MusicTrackInfo | null =
    trackInfo ||
    (cachedTrackInfo
      ? {
          title: cachedTrackInfo.title || "Unknown Track",
          artist: cachedTrackInfo.artist || "Unknown Artist",
          artworkUrl: cachedTrackInfo.artworkUrl || null,
          platform: cachedTrackInfo.platform,
          embedUrl: null,
          originalUrl: songUrl || "",
        }
      : null);

  // Use detected platform or cached platform
  const displayPlatform =
    platform !== "unknown" ? platform : cachedTrackInfo?.platform || "unknown";

  // Get platform configuration for colors and names
  const platformConfig = getMusicPlatformConfig(displayPlatform);

  // Animation values
  const buttonScale = useRef(new Animated.Value(1)).current;
  const progressBarWidth = useRef(new Animated.Value(0)).current;

  if (!songUrl) return null;

  // Determine if this card's song is the one currently playing
  const isThisSong = player.isCurrentSong(songUrl);
  const isPlaying = isThisSong && player.playerState === "playing";
  const isBuffering = isThisSong && player.playerState === "loading";
  const hasError = isThisSong && player.playerState === "error";
  const progressPercentage = isThisSong ? player.progress.percentage : 0;

  // Animate progress bar smoothly
  useEffect(() => {
    Animated.timing(progressBarWidth, {
      toValue: progressPercentage,
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [progressPercentage]);

  // Animate play button on press
  const animateButton = () => {
    Animated.sequence([
      Animated.timing(buttonScale, {
        toValue: 0.9,
        duration: 50,
        useNativeDriver: true,
      }),
      Animated.timing(buttonScale, {
        toValue: 1,
        duration: 100,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const handlePlayToggle = () => {
    animateButton();

    // Check if platform can play in-app using MusicPlayer
    const canPlay = player.canPlayInApp(displayPlatform);
    if (!canPlay) {
      handleOpenInPlatform();
      return;
    }

    if (isPlaying) {
      player.pause();
      // Analytics tracked in MusicPlayerContext
    } else if (isThisSong && player.playerState === "paused") {
      player.resume();
      // Analytics tracked in MusicPlayerContext
    } else {
      player.play(songUrl, displayInfo || undefined);
      // Analytics tracked in MusicPlayerContext
    }
  };

  // Handle opening the track in the platform's app/website
  const handleOpenInPlatform = async () => {
    if (!songUrl) return;

    // Track analytics
    capture("profile_music_opened", {
      platform: displayPlatform,
      track_title: displayInfo?.title || null,
      track_artist: displayInfo?.artist || null,
      destination: "app",
    });

    // Try deep link first
    const deepLink = getDeepLink(songUrl, displayPlatform);
    if (deepLink) {
      try {
        const canOpen = await Linking.canOpenURL(deepLink);
        if (canOpen) {
          await Linking.openURL(deepLink);
          return;
        }
      } catch (err) {
        console.log(
          `Deep link failed for ${displayPlatform}, falling back to web URL`
        );
      }
    }

    // Fall back to original URL
    try {
      await Linking.openURL(songUrl);
    } catch (err) {
      console.error("Couldn't open URL", err);
    }
  };

  // Show loading state only if we don't have cached data to show
  if (isLoading && !displayInfo) {
    return (
      <View
        style={styles.container}
        accessible={true}
        accessibilityLabel="Loading profile song"
        accessibilityRole="progressbar"
      >
        <View style={[styles.artwork, styles.loadingArtwork]}>
          <ActivityIndicator size="small" color={theme.colors.textSecondary} />
        </View>
        <View style={styles.infoContainer}>
          <View
            style={[styles.loadingText, { width: "80%", marginBottom: 8 }]}
          />
          <View style={[styles.loadingText, { width: "50%" }]} />
        </View>
      </View>
    );
  }

  // Handle different error types with appropriate messaging
  // Only show error if we have no display info (cached or fetched)
  if ((error || !trackInfo) && !displayInfo) {
    // Use platform-specific messaging
    let errorMessage = `Open in ${platformConfig.name}`;
    let errorIcon: string = platformConfig.icon;

    if (errorType === "private") {
      errorMessage = "Private Track";
      errorIcon = "lock";
    } else if (errorType === "not_found") {
      errorMessage = "Track Unavailable";
      errorIcon = "alert-circle";
    } else if (errorType === "invalid_url") {
      errorMessage = "Invalid Music Link";
      errorIcon = "alert-circle";
    } else if (errorType === "network") {
      errorMessage = "Network Error - Tap to Open";
      errorIcon = "wifi-off";
    }

    return (
      <TouchableOpacity
        style={styles.errorContainer}
        onPress={handleOpenInPlatform}
        accessible={true}
        accessibilityLabel={`${errorMessage}. Tap to open in ${platformConfig.name}`}
        accessibilityRole="button"
        accessibilityHint={`Opens the track in the ${platformConfig.name} app or website`}
      >
        <MaterialCommunityIcons
          name={errorIcon as any}
          size={24}
          color={
            displayPlatform !== "unknown"
              ? platformConfig.color
              : theme.colors.textSecondary
          }
        />
        <Text style={styles.errorText}>{errorMessage}</Text>
      </TouchableOpacity>
    );
  }

  // If we still don't have display info, return null
  if (!displayInfo) return null;

  // Build accessibility label
  const playPauseLabel = isPlaying ? "Pause" : isBuffering ? "Loading" : "Play";
  const trackAccessibilityLabel = `${displayInfo.title} by ${displayInfo.artist}. ${playPauseLabel} button`;

  // Determine if we can play in-app (SoundCloud and YouTube)
  const canPlayInApp = player.canPlayInApp(displayPlatform);

  return (
    <TouchableOpacity
      style={styles.container}
      onLongPress={handleOpenInPlatform}
      activeOpacity={0.9}
      accessible={true}
      accessibilityLabel={`Profile song from ${platformConfig.name}: ${displayInfo.title} by ${displayInfo.artist}`}
      accessibilityHint={`Long press to open in ${platformConfig.name}`}
      accessibilityRole="none"
    >
      <View style={styles.topRow}>
        {/* Artwork */}
        <ImageWithFallback
          source={
            displayInfo.artworkUrl
              ? { uri: displayInfo.artworkUrl }
              : require("../../assets/icon.png")
          }
          fallbackSource={require("../../assets/icon.png")}
          style={styles.artwork}
          accessible={false}
        />

        {/* Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.title} numberOfLines={1} accessible={false}>
            {displayInfo.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1} accessible={false}>
            {displayInfo.artist}
          </Text>
        </View>

        {/* Platform Badge - positioned at right corner */}
        <View style={styles.platformBadgeContainer}>
          <PlatformBadge platform={displayPlatform} size="medium" />
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsRow}>
        {canPlayInApp ? (
          // SoundCloud: Show play/pause with progress bar
          <>
            <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
              <TouchableOpacity
                style={[
                  styles.playButton,
                  { backgroundColor: platformConfig.color },
                ]}
                onPress={handlePlayToggle}
                disabled={isBuffering}
                accessible={true}
                accessibilityLabel={trackAccessibilityLabel}
                accessibilityRole="button"
                accessibilityState={{
                  disabled: isBuffering,
                  busy: isBuffering,
                }}
              >
                {isBuffering ? (
                  <ActivityIndicator
                    size="small"
                    color={theme.colors.textPrimary}
                  />
                ) : (
                  <MaterialCommunityIcons
                    name={isPlaying ? "pause" : "play"}
                    size={18}
                    color={theme.colors.textPrimary}
                  />
                )}
              </TouchableOpacity>
            </Animated.View>

            {/* Animated Progress Bar */}
            <View style={styles.progressBarBg} accessible={false}>
              <Animated.View
                style={[
                  styles.progressBarFill,
                  {
                    width: progressBarWidth.interpolate({
                      inputRange: [0, 100],
                      outputRange: ["0%", "100%"],
                    }),
                    backgroundColor: platformConfig.color,
                  },
                ]}
              />
            </View>

            {/* Duration */}
            <Text style={styles.duration} accessible={false}>
              {isThisSong && player.progress.duration > 0
                ? formatDuration(player.progress.currentTime)
                : displayInfo.duration
                ? formatDuration(displayInfo.duration)
                : "--:--"}
            </Text>
          </>
        ) : (
          // Spotify/YouTube: Show "Open in {Platform}" button
          <TouchableOpacity
            style={[
              styles.openInPlatformButton,
              { borderColor: platformConfig.color },
            ]}
            onPress={handleOpenInPlatform}
            accessible={true}
            accessibilityLabel={`Open in ${platformConfig.name}`}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons
              name={platformConfig.icon as any}
              size={14}
              color={platformConfig.color}
            />
            <Text
              style={[
                styles.openInPlatformText,
                { color: platformConfig.color },
              ]}
            >
              Open in {platformConfig.name}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );
}

function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
}

const createStyles = (theme: import("../../constants/themes").Theme) => ({
  container: {
    backgroundColor: theme.colors.bgElev1,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
    width: "100%" as const,
  },
  errorContainer: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    backgroundColor: theme.colors.bgElev1,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.colors.borderSubtle,
  },
  errorText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginLeft: 8,
  },
  topRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: 8,
  },
  artwork: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: theme.colors.bgElev2,
  },
  platformBadgeContainer: {
    marginLeft: "auto" as const,
  },
  loadingArtwork: {
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  infoContainer: {
    flex: 1,
    marginLeft: 10,
    justifyContent: "center" as const,
  },
  title: {
    color: theme.colors.textPrimary,
    fontSize: 13,
    fontWeight: "600" as const,
    marginBottom: 2,
  },
  artist: {
    color: theme.colors.textSecondary,
    fontSize: 11,
  },
  loadingText: {
    height: 10,
    backgroundColor: theme.colors.bgElev2,
    borderRadius: 4,
  },
  controlsRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
  },
  playButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: theme.colors.accent,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    marginRight: 8,
  },
  openInPlatformButton: {
    flex: 1,
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "center" as const,
    paddingVertical: 8,
    borderRadius: 6,
    borderWidth: 1,
    gap: 6,
  },
  openInPlatformText: {
    fontSize: 12,
    fontWeight: "600" as const,
  },
  progressBarBg: {
    flex: 1,
    height: 3,
    backgroundColor: theme.colors.bgElev2,
    borderRadius: 1.5,
    marginRight: 8,
    overflow: "hidden" as const,
  },
  progressBarFill: {
    height: "100%" as const,
    backgroundColor: theme.colors.textSecondary,
    borderRadius: 1.5,
  },
  duration: {
    color: theme.colors.textTertiary,
    fontSize: 10,
    fontVariant: ["tabular-nums"] as "tabular-nums"[],
  },
});
