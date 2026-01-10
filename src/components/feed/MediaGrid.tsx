import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import React, { useCallback, useRef, useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import { LazyImage } from "../ui";

interface MediaGridProps {
  mediaUrls: string[];
  mediaTypes?: ("image" | "video")[];
  /** Optimized/transcoded URLs from cloud function (preferred for videos) */
  optimizedMediaUrls?: string[];
  /** Whether the post is still processing (transcoding in progress) */
  isProcessing?: boolean;
}

const { width: SCREEN_WIDTH } = Dimensions.get("window");

// Static styles for components defined outside MediaGrid (no theme needed)
const staticStyles = StyleSheet.create({
  fullSize: {
    flex: 1,
    width: "100%",
    height: "100%",
  },
  videoPlaceholder: {
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  videoErrorText: {
    color: "#888",
    fontSize: 12,
    marginTop: 8,
  },
  videoControlOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  videoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  loadingIcon: {
    opacity: 0.8,
  },
});

// Video file extensions to detect videos when mediaTypes is not provided
const VIDEO_EXTENSIONS = [".mp4", ".mov", ".webm", ".avi", ".mkv", ".m4v"];

/**
 * Detect if a URL is a video based on its extension
 */
const isVideoUrl = (url: string): boolean => {
  if (!url) return false;
  const lowercaseUrl = url.toLowerCase();
  // Check both the path and any encoded path (%2F)
  return VIDEO_EXTENSIONS.some(
    (ext) => lowercaseUrl.includes(ext + "?") || lowercaseUrl.endsWith(ext)
  );
};

/**
 * Get the media type for a URL, using mediaTypes array if available,
 * otherwise detect from URL extension
 */
const getMediaType = (
  url: string,
  index: number,
  mediaTypes?: ("image" | "video")[]
): "image" | "video" => {
  // First check if mediaTypes array has this info
  if (mediaTypes && mediaTypes[index]) {
    return mediaTypes[index];
  }
  // Otherwise detect from URL
  return isVideoUrl(url) ? "video" : "image";
};

// Video player component with controls
const VideoPlayer: React.FC<{
  uri: string;
  style: any;
  showControls?: boolean;
  autoPlay?: boolean;
  onPress?: () => void;
}> = ({ uri, style, showControls = true, autoPlay = false, onPress }) => {
  const videoRef = useRef<Video>(null);
  const [isPlaying, setIsPlaying] = useState(autoPlay);
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  const togglePlayback = useCallback(async () => {
    if (!videoRef.current) return;

    if (isPlaying) {
      await videoRef.current.pauseAsync();
    } else {
      await videoRef.current.playAsync();
    }
    setIsPlaying(!isPlaying);
  }, [isPlaying]);

  const handlePress = useCallback(() => {
    if (onPress) {
      onPress();
    } else {
      togglePlayback();
    }
  }, [onPress, togglePlayback]);

  if (hasError) {
    return (
      <Pressable onPress={handlePress} style={style}>
        <View style={[staticStyles.fullSize, staticStyles.videoPlaceholder]}>
          <MaterialCommunityIcons
            name="video-off-outline"
            size={32}
            color="#888"
          />
          <Text style={staticStyles.videoErrorText}>Video unavailable</Text>
        </View>
      </Pressable>
    );
  }

  return (
    <Pressable onPress={handlePress} style={style}>
      <Video
        ref={videoRef}
        source={{ uri }}
        style={staticStyles.fullSize}
        resizeMode={ResizeMode.COVER}
        shouldPlay={autoPlay}
        isLooping
        isMuted={!showControls} // Muted in grid, unmuted in fullscreen
        onLoadStart={() => setIsLoading(true)}
        onLoad={() => setIsLoading(false)}
        onError={(error) => {
          console.log("[VideoPlayer] Error loading video:", error);
          setHasError(true);
          setIsLoading(false);
        }}
        onPlaybackStatusUpdate={(status) => {
          if (status.isLoaded) {
            setIsPlaying(status.isPlaying);
          }
        }}
      />
      {/* Play/Pause overlay */}
      {showControls && !isLoading && (
        <View style={staticStyles.videoControlOverlay}>
          {!isPlaying && (
            <MaterialCommunityIcons name="play-circle" size={48} color="#fff" />
          )}
        </View>
      )}
      {/* Loading indicator */}
      {isLoading && (
        <View style={staticStyles.videoLoadingOverlay}>
          <MaterialCommunityIcons
            name="loading"
            size={32}
            color="#fff"
            style={staticStyles.loadingIcon}
          />
        </View>
      )}
    </Pressable>
  );
};

// Component to render a single media item (image or video)
const MediaItem: React.FC<{
  url: string;
  type: "image" | "video";
  style: any;
  onPress: () => void;
  autoPlayVideo?: boolean;
}> = ({ url, type, style, onPress, autoPlayVideo = false }) => {
  // For videos, use the VideoPlayer component
  if (type === "video") {
    return (
      <VideoPlayer
        uri={url}
        style={style}
        showControls={true}
        autoPlay={autoPlayVideo}
        onPress={onPress}
      />
    );
  }

  // For images, use LazyImage with error handling
  return (
    <Pressable onPress={onPress} style={style}>
      <LazyImage
        source={{ uri: url }}
        style={staticStyles.fullSize}
        resizeMode="cover"
        showRetryButton={false}
        maxRetries={1}
      />
    </Pressable>
  );
};

export const MediaGrid: React.FC<MediaGridProps> = ({
  mediaUrls,
  mediaTypes,
  optimizedMediaUrls,
  isProcessing,
}) => {
  const [visible, setVisible] = useState(false);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (!mediaUrls || mediaUrls.length === 0) return null;

  /**
   * Get the best URL for a media item:
   * - For videos: prefer optimized URL if available
   * - For images: use original URL
   */
  const getBestUrl = (index: number): string => {
    const originalUrl = mediaUrls[index];
    const type = getMediaType(originalUrl, index, mediaTypes);

    // For videos, check if we have an optimized version
    if (
      type === "video" &&
      optimizedMediaUrls &&
      optimizedMediaUrls.length > 0
    ) {
      // Try to find a matching optimized URL (by filename)
      const originalFilename = originalUrl
        .split("/")
        .pop()
        ?.split("?")[0]
        ?.replace(/\.[^.]+$/, "");
      const optimizedMatch = optimizedMediaUrls.find((url) => {
        const optimizedFilename = url
          .split("/")
          .pop()
          ?.split("?")[0]
          ?.replace(/\.[^.]+$/, "");
        return optimizedFilename === originalFilename;
      });

      if (optimizedMatch) {
        return optimizedMatch;
      }

      // If only one optimized URL and one video, use it
      if (optimizedMediaUrls.length === 1) {
        const videoCount = mediaUrls.filter(
          (url, i) => getMediaType(url, i, mediaTypes) === "video"
        ).length;
        if (videoCount === 1) {
          return optimizedMediaUrls[0];
        }
      }
    }

    return originalUrl;
  };

  // Get the type for each media item
  const getType = (index: number) =>
    getMediaType(mediaUrls[index], index, mediaTypes);

  const handlePress = (index: number) => {
    setCurrentMediaIndex(index);
    setVisible(true);
  };

  const renderSingleMedia = () => (
    <View style={styles.singleContainer}>
      <MediaItem
        url={getBestUrl(0)}
        type={getType(0)}
        style={styles.fullSize}
        onPress={() => handlePress(0)}
        autoPlayVideo={true} // Auto-play single videos
      />
      {isProcessing && getType(0) === "video" && (
        <View style={styles.processingBadge}>
          <Text style={styles.processingText}>Optimizing...</Text>
        </View>
      )}
    </View>
  );

  const renderTwoMedia = () => (
    <View style={styles.row}>
      {mediaUrls.slice(0, 2).map((_, index) => (
        <MediaItem
          key={`${getBestUrl(index)}-${index}`}
          url={getBestUrl(index)}
          type={getType(index)}
          style={[styles.halfSize, index === 0 ? styles.marginRight : {}]}
          onPress={() => handlePress(index)}
        />
      ))}
    </View>
  );

  const renderThreeMedia = () => (
    <View style={styles.row}>
      <MediaItem
        url={getBestUrl(0)}
        type={getType(0)}
        style={[styles.halfSize, styles.marginRight]}
        onPress={() => handlePress(0)}
      />
      <View style={styles.halfSize}>
        <MediaItem
          url={getBestUrl(1)}
          type={getType(1)}
          style={[styles.halfHeight, styles.marginBottom]}
          onPress={() => handlePress(1)}
        />
        <MediaItem
          url={getBestUrl(2)}
          type={getType(2)}
          style={styles.halfHeight}
          onPress={() => handlePress(2)}
        />
      </View>
    </View>
  );

  const renderFourPlusMedia = () => (
    <View style={styles.column}>
      <View style={[styles.row, styles.marginBottom]}>
        <MediaItem
          url={getBestUrl(0)}
          type={getType(0)}
          style={[styles.halfSize, styles.marginRight]}
          onPress={() => handlePress(0)}
        />
        <MediaItem
          url={getBestUrl(1)}
          type={getType(1)}
          style={styles.halfSize}
          onPress={() => handlePress(1)}
        />
      </View>
      <View style={styles.row}>
        <MediaItem
          url={getBestUrl(2)}
          type={getType(2)}
          style={[styles.halfSize, styles.marginRight]}
          onPress={() => handlePress(2)}
        />
        <View style={styles.halfSize}>
          <MediaItem
            url={getBestUrl(3)}
            type={getType(3)}
            style={styles.fullSize}
            onPress={() => handlePress(3)}
          />
          {mediaUrls.length > 4 && (
            <View style={styles.overlay}>
              <Text style={styles.overlayText}>+{mediaUrls.length - 4}</Text>
            </View>
          )}
        </View>
      </View>
    </View>
  );

  // Fullscreen modal content
  const renderFullscreenContent = () => {
    const currentUrl = getBestUrl(currentMediaIndex);
    const currentType = getType(currentMediaIndex);

    if (currentType === "video") {
      return (
        <VideoPlayer
          uri={currentUrl}
          style={styles.fullScreenMedia}
          showControls={true}
          autoPlay={true}
        />
      );
    }

    return (
      <Image
        source={{ uri: currentUrl }}
        style={styles.fullScreenMedia}
        resizeMode="contain"
      />
    );
  };

  return (
    <View style={styles.container}>
      {mediaUrls.length === 1 && renderSingleMedia()}
      {mediaUrls.length === 2 && renderTwoMedia()}
      {mediaUrls.length === 3 && renderThreeMedia()}
      {mediaUrls.length >= 4 && renderFourPlusMedia()}

      {/* Fullscreen Modal */}
      <Modal
        visible={visible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setVisible(false)}
      >
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.closeButton}
            onPress={() => setVisible(false)}
          >
            <MaterialCommunityIcons name="close" size={30} color="#fff" />
          </TouchableOpacity>

          {/* Navigation arrows for multiple media */}
          {mediaUrls.length > 1 && (
            <>
              {currentMediaIndex > 0 && (
                <TouchableOpacity
                  style={[styles.navButton, styles.navButtonLeft]}
                  onPress={() => setCurrentMediaIndex((i) => i - 1)}
                >
                  <MaterialCommunityIcons
                    name="chevron-left"
                    size={40}
                    color="#fff"
                  />
                </TouchableOpacity>
              )}
              {currentMediaIndex < mediaUrls.length - 1 && (
                <TouchableOpacity
                  style={[styles.navButton, styles.navButtonRight]}
                  onPress={() => setCurrentMediaIndex((i) => i + 1)}
                >
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={40}
                    color="#fff"
                  />
                </TouchableOpacity>
              )}
            </>
          )}

          {/* Media indicator dots */}
          {mediaUrls.length > 1 && (
            <View style={styles.indicatorContainer}>
              {mediaUrls.map((_, index) => (
                <View
                  key={index}
                  style={[
                    styles.indicator,
                    index === currentMediaIndex && styles.indicatorActive,
                  ]}
                />
              ))}
            </View>
          )}

          {renderFullscreenContent()}
        </View>
      </Modal>
    </View>
  );
};

const createStyles = (theme: import("../../constants/themes").Theme) => ({
  container: {
    marginTop: 12,
    borderRadius: 12,
    overflow: "hidden" as const,
    width: "100%" as const,
    aspectRatio: 16 / 9,
    backgroundColor: theme.colors.bgElev1,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.95)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  closeButton: {
    position: "absolute" as const,
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 10,
  },
  navButton: {
    position: "absolute" as const,
    top: "50%" as const,
    marginTop: -25,
    zIndex: 10,
    padding: 10,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 25,
  },
  navButtonLeft: {
    left: 10,
  },
  navButtonRight: {
    right: 10,
  },
  indicatorContainer: {
    position: "absolute" as const,
    bottom: 80,
    flexDirection: "row" as const,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  indicator: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "rgba(255,255,255,0.4)",
    marginHorizontal: 4,
  },
  indicatorActive: {
    backgroundColor: theme.colors.textPrimary,
  },
  fullScreenMedia: {
    width: SCREEN_WIDTH,
    height: "80%" as const,
  },
  singleContainer: {
    flex: 1,
  },
  row: {
    flexDirection: "row" as const,
    flex: 1,
  },
  column: {
    flex: 1,
  },
  fullSize: {
    flex: 1,
    width: "100%" as const,
    height: "100%" as const,
  },
  halfSize: {
    flex: 1,
  },
  halfHeight: {
    flex: 1,
  },
  marginRight: {
    marginRight: 2,
  },
  marginBottom: {
    marginBottom: 2,
  },
  videoPlaceholder: {
    backgroundColor: theme.colors.borderSubtle,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  videoErrorText: {
    color: theme.colors.textSecondary,
    fontSize: 12,
    marginTop: 8,
  },
  videoControlOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: "rgba(0,0,0,0.2)",
  },
  videoLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  loadingIcon: {
    opacity: 0.8,
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  overlayText: {
    color: theme.colors.textPrimary,
    fontSize: 24,
    fontWeight: "700" as const,
  },
  processingBadge: {
    position: "absolute" as const,
    top: 8,
    right: 8,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  processingText: {
    color: theme.colors.textPrimary,
    fontSize: 10,
    fontWeight: "600" as const,
  },
});
