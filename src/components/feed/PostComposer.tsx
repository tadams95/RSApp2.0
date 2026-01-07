import { MaterialCommunityIcons } from "@expo/vector-icons";
import { ResizeMode, Video } from "expo-av";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { GlobalStyles } from "../../constants/styles";
import {
  createPost,
  CreatePostInput,
  UploadProgress,
} from "../../services/feedService";
import {
  compressImage,
  COMPRESSION_PRESETS,
} from "../../utils/imageCompression";

// Constants
const MAX_CONTENT_LENGTH = 500;
const MIN_CONTENT_LENGTH = 1; // Must have at least 1 char if no media
const MAX_IMAGES = 4;
const MAX_VIDEO = 1;
const MAX_VIDEO_SIZE_MB = 100; // 100MB max for videos

// Helper to format error messages
const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    if (msg.includes("network") || msg.includes("fetch")) {
      return "Network error. Please check your connection and try again.";
    }
    if (msg.includes("storage") || msg.includes("upload")) {
      return "Failed to upload media. Please try again.";
    }
    if (msg.includes("permission") || msg.includes("unauthorized")) {
      return "You don't have permission to post. Please sign in again.";
    }
    if (msg.includes("quota")) {
      return "Storage limit reached. Please try with smaller files.";
    }
    return error.message;
  }
  return "Something went wrong. Please try again.";
};

// Types
export interface MediaItem {
  uri: string;
  type: "image" | "video";
  compressedUri?: string;
  isCompressing?: boolean;
}

export interface PostComposerProps {
  visible: boolean;
  onClose: () => void;
  onPostCreated: () => void;
}

/**
 * Post Composer Modal
 * Allows users to create posts with text and media (up to 4 images OR 1 video)
 */
export function PostComposer({
  visible,
  onClose,
  onPostCreated,
}: PostComposerProps) {
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState("");
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [isPublic, setIsPublic] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(
    null
  );

  // Calculate remaining characters
  const remainingChars = MAX_CONTENT_LENGTH - content.length;
  const isOverLimit = remainingChars < 0;

  // Check if we can add more media
  const hasVideo = media.some((m) => m.type === "video");
  const canAddMedia = !hasVideo && media.length < MAX_IMAGES;
  const canAddVideo = media.length === 0;

  // Check if any media is still compressing
  const isCompressing = media.some((m) => m.isCompressing);

  // Validation: content or media required, not over limit, not compressing
  const isValid =
    (content.trim().length > 0 || media.length > 0) &&
    !isOverLimit &&
    !isCompressing;

  // Reset form state
  const resetForm = useCallback(() => {
    setContent("");
    setMedia([]);
    setIsPublic(true);
    setIsSubmitting(false);
    setUploadProgress(null);
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    if (content.trim() || media.length > 0) {
      Alert.alert(
        "Discard Post?",
        "You have unsaved changes. Are you sure you want to discard this post?",
        [
          { text: "Keep Editing", style: "cancel" },
          {
            text: "Discard",
            style: "destructive",
            onPress: () => {
              resetForm();
              onClose();
            },
          },
        ]
      );
    } else {
      onClose();
    }
  }, [content, media.length, onClose, resetForm]);

  // Request permissions
  const requestPermissions = async (): Promise<boolean> => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your photo library to add media to your post.",
        [{ text: "OK" }]
      );
      return false;
    }
    return true;
  };

  // Pick images from library
  const pickImages = useCallback(async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        selectionLimit: MAX_IMAGES - media.length,
        quality: 1, // We handle compression ourselves
        exif: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        // Add images with compressing state
        const newMedia: MediaItem[] = result.assets.map((asset) => ({
          uri: asset.uri,
          type: "image" as const,
          isCompressing: true,
        }));

        setMedia((prev) => [...prev, ...newMedia].slice(0, MAX_IMAGES));

        // Compress each image
        for (const asset of result.assets) {
          try {
            const compressed = await compressImage(
              asset.uri,
              COMPRESSION_PRESETS.EVENT // Good balance for social posts
            );

            setMedia((prev) =>
              prev.map((item) =>
                item.uri === asset.uri
                  ? {
                      ...item,
                      compressedUri: compressed.uri,
                      isCompressing: false,
                    }
                  : item
              )
            );
          } catch (error) {
            console.error("Failed to compress image:", error);
            // Keep original if compression fails
            setMedia((prev) =>
              prev.map((item) =>
                item.uri === asset.uri
                  ? { ...item, compressedUri: asset.uri, isCompressing: false }
                  : item
              )
            );
          }
        }
      }
    } catch (error) {
      console.error("Error picking images:", error);
      Alert.alert("Error", "Failed to select images. Please try again.");
    }
  }, [media.length]);

  // Pick video from library
  const pickVideo = useCallback(async () => {
    const hasPermission = await requestPermissions();
    if (!hasPermission) return;

    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Videos,
        allowsMultipleSelection: false,
        quality: 1,
        videoMaxDuration: 60, // 60 seconds max
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];
        // Videos don't get compressed client-side (transcoding happens server-side)
        setMedia([
          {
            uri: asset.uri,
            type: "video",
            compressedUri: asset.uri,
            isCompressing: false,
          },
        ]);
      }
    } catch (error) {
      console.error("Error picking video:", error);
      Alert.alert("Error", "Failed to select video. Please try again.");
    }
  }, []);

  // Take photo with camera
  const takePhoto = useCallback(async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== "granted") {
      Alert.alert(
        "Permission Required",
        "Please allow access to your camera to take a photo.",
        [{ text: "OK" }]
      );
      return;
    }

    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 1,
        exif: false,
      });

      if (!result.canceled && result.assets.length > 0) {
        const asset = result.assets[0];

        // Add with compressing state
        setMedia((prev) =>
          [
            ...prev,
            { uri: asset.uri, type: "image" as const, isCompressing: true },
          ].slice(0, MAX_IMAGES)
        );

        // Compress the image
        try {
          const compressed = await compressImage(
            asset.uri,
            COMPRESSION_PRESETS.EVENT
          );

          setMedia((prev) =>
            prev.map((item) =>
              item.uri === asset.uri
                ? {
                    ...item,
                    compressedUri: compressed.uri,
                    isCompressing: false,
                  }
                : item
            )
          );
        } catch (error) {
          console.error("Failed to compress image:", error);
          setMedia((prev) =>
            prev.map((item) =>
              item.uri === asset.uri
                ? { ...item, compressedUri: asset.uri, isCompressing: false }
                : item
            )
          );
        }
      }
    } catch (error) {
      console.error("Error taking photo:", error);
      Alert.alert("Error", "Failed to take photo. Please try again.");
    }
  }, []);

  // Remove media item
  const removeMedia = useCallback((uri: string) => {
    setMedia((prev) => prev.filter((item) => item.uri !== uri));
  }, []);

  // Show media picker options
  const showMediaOptions = useCallback(() => {
    const options: { text: string; onPress: () => void }[] = [];

    if (canAddMedia) {
      options.push({ text: "Choose Photos", onPress: pickImages });
      options.push({ text: "Take Photo", onPress: takePhoto });
    }

    if (canAddVideo) {
      options.push({ text: "Choose Video", onPress: pickVideo });
    }

    options.push({ text: "Cancel", onPress: () => {} });

    Alert.alert("Add Media", undefined, options);
  }, [canAddMedia, canAddVideo, pickImages, pickVideo, takePhoto]);

  // Validate post before submission
  const validatePost = useCallback((): string | null => {
    // Check if post has content or media
    if (content.trim().length === 0 && media.length === 0) {
      return "Please add some text or media to your post.";
    }

    // Check content length
    if (content.length > MAX_CONTENT_LENGTH) {
      return `Post is too long. Maximum ${MAX_CONTENT_LENGTH} characters allowed.`;
    }

    // Check media limits
    if (media.length > MAX_IMAGES) {
      return `Too many images. Maximum ${MAX_IMAGES} images allowed.`;
    }

    // Check for mixed media types (images + video not allowed)
    const hasImages = media.some((m) => m.type === "image");
    const hasVideos = media.some((m) => m.type === "video");
    if (hasImages && hasVideos) {
      return "You can add either images or a video, not both.";
    }

    // Check video count
    if (
      hasVideos &&
      media.filter((m) => m.type === "video").length > MAX_VIDEO
    ) {
      return `Only ${MAX_VIDEO} video allowed per post.`;
    }

    // Check if any media is still compressing
    if (media.some((m) => m.isCompressing)) {
      return "Please wait for media to finish processing.";
    }

    return null; // Valid
  }, [content, media]);

  // Handle post submission
  const handleSubmit = useCallback(async () => {
    if (!isValid || isSubmitting) return;

    // Run validation
    const validationError = validatePost();
    if (validationError) {
      Alert.alert("Cannot Post", validationError);
      return;
    }

    setIsSubmitting(true);
    setUploadProgress(null);

    try {
      // Prepare media files for upload (use compressed URIs where available)
      const mediaFiles = media.map((m) => ({
        uri: m.compressedUri || m.uri,
        type: m.type,
      }));

      // Create the post with progress tracking
      const postInput: CreatePostInput = {
        content: content.trim(),
        mediaFiles,
        isPublic,
      };

      await createPost(postInput, (progress) => {
        setUploadProgress(progress);
      });

      // Success!
      resetForm();
      onPostCreated();
      onClose();
    } catch (error) {
      console.error("Error creating post:", error);
      Alert.alert("Post Failed", getErrorMessage(error));
    } finally {
      setIsSubmitting(false);
      setUploadProgress(null);
    }
  }, [
    isValid,
    isSubmitting,
    validatePost,
    content,
    media,
    isPublic,
    resetForm,
    onPostCreated,
    onClose,
  ]);

  // Render media preview
  const renderMediaPreview = () => {
    if (media.length === 0) return null;

    return (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.mediaPreviewContainer}
        contentContainerStyle={styles.mediaPreviewContent}
      >
        {media.map((item, index) => (
          <View key={item.uri} style={styles.mediaItem}>
            {item.type === "image" ? (
              <Image
                source={{ uri: item.compressedUri || item.uri }}
                style={styles.mediaPreview}
                contentFit="cover"
              />
            ) : (
              <Video
                source={{ uri: item.uri }}
                style={styles.mediaPreview}
                resizeMode={ResizeMode.COVER}
                shouldPlay={false}
                isMuted
              />
            )}

            {/* Compression indicator */}
            {item.isCompressing && (
              <View style={styles.compressionOverlay}>
                <ActivityIndicator size="small" color="#fff" />
              </View>
            )}

            {/* Video indicator */}
            {item.type === "video" && (
              <View style={styles.videoIndicator}>
                <MaterialCommunityIcons
                  name="play-circle"
                  size={24}
                  color="#fff"
                />
              </View>
            )}

            {/* Remove button */}
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => removeMedia(item.uri)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <MaterialCommunityIcons
                name="close-circle"
                size={24}
                color="#fff"
              />
            </TouchableOpacity>
          </View>
        ))}
      </ScrollView>
    );
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={handleClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={[styles.container, { paddingTop: insets.top }]}>
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={handleClose} style={styles.headerButton}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>

            <Text style={styles.headerTitle}>New Post</Text>

            <TouchableOpacity
              onPress={handleSubmit}
              style={[
                styles.postButton,
                (!isValid || isSubmitting) && styles.postButtonDisabled,
              ]}
              disabled={!isValid || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.postButtonText}>Post</Text>
              )}
            </TouchableOpacity>
          </View>

          {/* Content Area */}
          <ScrollView
            style={styles.scrollView}
            keyboardShouldPersistTaps="handled"
          >
            {/* Text Input */}
            <TextInput
              style={styles.textInput}
              placeholder="What's on your mind?"
              placeholderTextColor={GlobalStyles.colors.grey5}
              multiline
              maxLength={MAX_CONTENT_LENGTH + 50} // Allow slight overage to show warning
              value={content}
              onChangeText={setContent}
              autoFocus
              autoCapitalize="none"
            />

            {/* Media Preview */}
            {renderMediaPreview()}
          </ScrollView>

          {/* Upload Progress Indicator */}
          {isSubmitting && (
            <View style={styles.progressContainer}>
              <View style={styles.progressBarBackground}>
                <View
                  style={[
                    styles.progressBarFill,
                    { width: `${uploadProgress?.overallProgress ?? 0}%` },
                  ]}
                />
              </View>
              <Text style={styles.progressText}>
                {uploadProgress && uploadProgress.totalFiles > 0
                  ? `Uploading ${uploadProgress.completedFiles + 1} of ${
                      uploadProgress.totalFiles
                    } (${Math.round(uploadProgress.overallProgress)}%)`
                  : "Creating post..."}
              </Text>
            </View>
          )}

          {/* Bottom Toolbar */}
          <View style={[styles.toolbar, { paddingBottom: insets.bottom + 8 }]}>
            {/* Character Counter */}
            <Text
              style={[
                styles.charCounter,
                isOverLimit && styles.charCounterError,
              ]}
            >
              {remainingChars}
            </Text>

            {/* Media Buttons */}
            <View style={styles.toolbarActions}>
              {/* Add Media */}
              <TouchableOpacity
                style={[
                  styles.toolbarButton,
                  !canAddMedia && !canAddVideo && styles.toolbarButtonDisabled,
                ]}
                onPress={showMediaOptions}
                disabled={!canAddMedia && !canAddVideo}
              >
                <MaterialCommunityIcons
                  name="image-plus"
                  size={24}
                  color={
                    canAddMedia || canAddVideo
                      ? GlobalStyles.colors.redVivid5
                      : GlobalStyles.colors.grey6
                  }
                />
              </TouchableOpacity>

              {/* Privacy Toggle */}
              <TouchableOpacity
                style={styles.toolbarButton}
                onPress={() => setIsPublic(!isPublic)}
              >
                <MaterialCommunityIcons
                  name={isPublic ? "earth" : "lock"}
                  size={24}
                  color={
                    isPublic
                      ? GlobalStyles.colors.redVivid5
                      : GlobalStyles.colors.grey5
                  }
                />
                <Text
                  style={[
                    styles.privacyText,
                    !isPublic && styles.privacyTextMuted,
                  ]}
                >
                  {isPublic ? "Public" : "Followers"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: GlobalStyles.colors.grey8,
  },
  headerButton: {
    minWidth: 60,
  },
  cancelText: {
    fontSize: 16,
    color: GlobalStyles.colors.grey4,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "600",
    color: "#fff",
  },
  postButton: {
    backgroundColor: GlobalStyles.colors.redVivid5,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
    minWidth: 60,
    alignItems: "center",
  },
  postButtonDisabled: {
    backgroundColor: GlobalStyles.colors.grey7,
  },
  postButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#fff",
  },
  scrollView: {
    flex: 1,
  },
  textInput: {
    fontSize: 18,
    color: "#fff",
    padding: 16,
    minHeight: 120,
    textAlignVertical: "top",
  },
  mediaPreviewContainer: {
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  mediaPreviewContent: {
    gap: 8,
  },
  mediaItem: {
    width: 120,
    height: 120,
    borderRadius: 12,
    overflow: "hidden",
    position: "relative",
  },
  mediaPreview: {
    width: "100%",
    height: "100%",
  },
  compressionOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  videoIndicator: {
    position: "absolute",
    bottom: 8,
    left: 8,
  },
  removeButton: {
    position: "absolute",
    top: 4,
    right: 4,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    borderRadius: 12,
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GlobalStyles.colors.grey8,
  },
  charCounter: {
    fontSize: 14,
    color: GlobalStyles.colors.grey5,
  },
  charCounterError: {
    color: GlobalStyles.colors.redVivid5,
  },
  toolbarActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 16,
  },
  toolbarButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    padding: 8,
  },
  toolbarButtonDisabled: {
    opacity: 0.5,
  },
  privacyText: {
    fontSize: 14,
    color: GlobalStyles.colors.redVivid5,
  },
  privacyTextMuted: {
    color: GlobalStyles.colors.grey5,
  },
  progressContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: GlobalStyles.colors.grey8,
  },
  progressBarBackground: {
    height: 4,
    backgroundColor: GlobalStyles.colors.grey8,
    borderRadius: 2,
    overflow: "hidden",
    marginBottom: 8,
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: GlobalStyles.colors.redVivid5,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 13,
    color: GlobalStyles.colors.grey4,
    textAlign: "center",
  },
});
