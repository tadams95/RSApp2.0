import { MaterialCommunityIcons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GlobalStyles } from "../../constants/styles";
import { useSoundCloudPlayer } from "../../hooks/SoundCloudPlayerContext";
import { useSoundCloudTrack } from "../../hooks/useSoundCloudTrack";
import { ImageWithFallback } from "../ui";

interface ProfileSongCardProps {
  songUrl: string | null | undefined;
}

export default function ProfileSongCard({ songUrl }: ProfileSongCardProps) {
  const { trackInfo, isLoading, error } = useSoundCloudTrack(songUrl);
  const player = useSoundCloudPlayer();

  if (!songUrl) return null;

  // Determine if this card's song is the one currently playing
  const isThisSong = player.isCurrentSong(songUrl);
  const isPlaying = isThisSong && player.playerState === "playing";
  const isBuffering = isThisSong && player.playerState === "loading";
  const progressPercentage = isThisSong ? player.progress.percentage : 0;

  const handlePlayToggle = () => {
    if (isPlaying) {
      player.pause();
    } else if (isThisSong && player.playerState === "paused") {
      player.resume();
    } else {
      player.play(songUrl);
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
      <View style={styles.container}>
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

  if (error || !trackInfo) {
    // If error, show a minimal link fallback or nothing?
    // Doc says: "Graceful fallback (link to SoundCloud)"
    return (
      <TouchableOpacity
        style={styles.errorContainer}
        onPress={handleOpenSoundCloud}
      >
        <MaterialCommunityIcons
          name="soundcloud"
          size={24}
          color={GlobalStyles.colors.grey4}
        />
        <Text style={styles.errorText}>Play on SoundCloud</Text>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onLongPress={handleOpenSoundCloud}
      activeOpacity={0.9}
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
        />

        {/* Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.title} numberOfLines={1}>
            {trackInfo.title}
          </Text>
          <Text style={styles.artist} numberOfLines={1}>
            {trackInfo.artist}
          </Text>
        </View>
      </View>

      {/* Controls */}
      <View style={styles.controlsRow}>
        <TouchableOpacity
          style={styles.playButton}
          onPress={handlePlayToggle}
          disabled={isBuffering}
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

        {/* Progress Bar */}
        <View style={styles.progressBarBg}>
          <View
            style={[
              styles.progressBarFill,
              { width: `${progressPercentage}%` },
            ]}
          />
        </View>

        {/* Duration */}
        <Text style={styles.duration}>
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
