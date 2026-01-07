import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { usePostHog } from "../../analytics/PostHogProvider";
import { GlobalStyles } from "../../constants/styles";
import { useSoundCloudPlayer } from "../../hooks/SoundCloudPlayerContext";
import { useSoundCloudTrack } from "../../hooks/useSoundCloudTrack";
import { ImageWithFallback } from "../ui";

interface ProfileSongCardProps {
  songUrl: string | null | undefined;
}

export default function ProfileSongCard({ songUrl }: ProfileSongCardProps) {
  const { trackInfo, isLoading, error, errorType } =
    useSoundCloudTrack(songUrl);
  const player = useSoundCloudPlayer();
  const { capture } = usePostHog();

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

    if (isPlaying) {
      player.pause();
      capture("profile_song_paused", {
        song_url: songUrl,
        track_title: trackInfo?.title || null,
        track_artist: trackInfo?.artist || null,
      });
    } else if (isThisSong && player.playerState === "paused") {
      player.resume();
      capture("profile_song_resumed", {
        song_url: songUrl,
        track_title: trackInfo?.title || null,
        track_artist: trackInfo?.artist || null,
      });
    } else {
      player.play(songUrl);
      // Track song play event
      capture("profile_song_played", {
        song_url: songUrl,
        track_title: trackInfo?.title || null,
        track_artist: trackInfo?.artist || null,
      });
    }
  };

  const handleOpenSoundCloud = () => {
    if (songUrl) {
      Linking.openURL(songUrl).catch((err) =>
        console.error("Couldn't load page", err)
      );
    }
  };

  if (isLoading) {
    return (
      <View
        style={styles.container}
        accessible={true}
        accessibilityLabel="Loading profile song"
        accessibilityRole="progressbar"
      >
        <View style={[styles.artwork, styles.loadingArtwork]}>
          <ActivityIndicator size="small" color={GlobalStyles.colors.grey4} />
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
  if (error || !trackInfo) {
    let errorMessage = "Play on SoundCloud";
    let errorIcon: "soundcloud" | "lock" | "alert-circle" = "soundcloud";

    if (errorType === "private") {
      errorMessage = "Private Track";
      errorIcon = "lock";
    } else if (errorType === "deleted") {
      errorMessage = "Track Unavailable";
      errorIcon = "alert-circle";
    } else if (errorType === "invalid_url") {
      errorMessage = "Invalid SoundCloud Link";
      errorIcon = "alert-circle";
    }

    return (
      <TouchableOpacity
        style={styles.errorContainer}
        onPress={handleOpenSoundCloud}
        accessible={true}
        accessibilityLabel={`${errorMessage}. Tap to open in SoundCloud`}
        accessibilityRole="button"
        accessibilityHint="Opens the track in the SoundCloud app or website"
      >
        <MaterialCommunityIcons
          name={errorIcon}
          size={24}
          color={GlobalStyles.colors.grey4}
        />
        <Text style={styles.errorText}>{errorMessage}</Text>
      </TouchableOpacity>
    );
  }

  // Build accessibility label
  const playPauseLabel = isPlaying ? "Pause" : isBuffering ? "Loading" : "Play";
  const trackAccessibilityLabel = `${trackInfo.title} by ${trackInfo.artist}. ${playPauseLabel} button`;

  return (
    <TouchableOpacity
      style={styles.container}
      onLongPress={handleOpenSoundCloud}
      activeOpacity={0.9}
      accessible={true}
      accessibilityLabel={`Profile song: ${trackInfo.title} by ${trackInfo.artist}`}
      accessibilityHint="Long press to open in SoundCloud"
      accessibilityRole="none"
    >
      <View style={styles.topRow}>
        {/* Artwork */}
        <ImageWithFallback
          source={
            trackInfo.artworkUrl
              ? { uri: trackInfo.artworkUrl }
              : require("../../assets/icon.png")
          }
          fallbackSource={require("../../assets/icon.png")}
          style={styles.artwork}
          accessible={false}
        />

        {/* Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.title} numberOfLines={1} accessible={false}>
            {trackInfo.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1} accessible={false}>
            {trackInfo.artist}
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsRow}>
        <Animated.View style={{ transform: [{ scale: buttonScale }] }}>
          <TouchableOpacity
            style={styles.playButton}
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
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <MaterialCommunityIcons
                name={isPlaying ? "pause" : "play"}
                size={18}
                color="#fff"
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
              },
            ]}
          />
        </View>

        {/* Duration */}
        <Text style={styles.duration} accessible={false}>
          {isThisSong && player.progress.duration > 0
            ? formatDuration(player.progress.currentTime)
            : trackInfo.duration
            ? formatDuration(trackInfo.duration)
            : "--:--"}
        </Text>
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

const styles = StyleSheet.create({
  container: {
    backgroundColor: GlobalStyles.colors.grey9,
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: GlobalStyles.colors.grey8,
    width: "100%",
  },
  errorContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GlobalStyles.colors.grey9,
    padding: 10,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: GlobalStyles.colors.grey8,
  },
  errorText: {
    color: GlobalStyles.colors.grey4,
    fontSize: 12,
    marginLeft: 8,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  artwork: {
    width: 40,
    height: 40,
    borderRadius: 4,
    backgroundColor: GlobalStyles.colors.grey8,
  },
  loadingArtwork: {
    justifyContent: "center",
    alignItems: "center",
  },
  infoContainer: {
    flex: 1,
    marginLeft: 10,
    justifyContent: "center",
  },
  title: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
    marginBottom: 2,
  },
  artist: {
    color: GlobalStyles.colors.grey4,
    fontSize: 11,
  },
  loadingText: {
    height: 10,
    backgroundColor: GlobalStyles.colors.grey8,
    borderRadius: 4,
  },
  controlsRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  playButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: GlobalStyles.colors.redVivid5,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 8,
  },
  progressBarBg: {
    flex: 1,
    height: 3,
    backgroundColor: GlobalStyles.colors.grey7, // Darker track
    borderRadius: 1.5,
    marginRight: 8,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: GlobalStyles.colors.grey4, // Active progress
    borderRadius: 1.5,
  },
  duration: {
    color: GlobalStyles.colors.grey5,
    fontSize: 10,
    fontVariant: ["tabular-nums"],
  },
});
