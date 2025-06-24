import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useImageCompression } from "../../hooks/useImageCompression";
import {
  COMPRESSION_PRESETS,
  ImageCompressionOptions,
} from "../../utils/imageCompression";

interface CompressedImageUploaderProps {
  // Image source and fallback
  source?: { uri: string } | number;
  fallbackSource?: { uri: string } | number;

  // Styling
  style?: any; // View style for container
  imageStyle?: any; // Image style
  overlayStyle?: any; // Upload overlay style

  // Compression settings
  compressionPreset?: keyof typeof COMPRESSION_PRESETS;
  compressionOptions?: ImageCompressionOptions;

  // Upload handling
  onImageSelected?: (
    compressedUri: string,
    compressionInfo: any
  ) => Promise<void>;
  onUploadProgress?: (progress: number) => void;
  onUploadSuccess?: () => void;
  onUploadError?: (error: string) => void;

  // Image picker options
  allowsEditing?: boolean;
  aspect?: [number, number];
  quality?: number;

  // UI options
  showCompressionInfo?: boolean;
  disabled?: boolean;
  uploadButtonText?: string;

  // Accessibility
  accessibilityLabel?: string;
  accessibilityHint?: string;
}

/**
 * A reusable image uploader component with built-in compression
 * Handles image selection, compression, and upload flow
 */
export const CompressedImageUploader: React.FC<
  CompressedImageUploaderProps
> = ({
  source,
  fallbackSource = require("../../assets/user.png"),
  style,
  imageStyle,
  overlayStyle,
  compressionPreset = "PROFILE",
  compressionOptions,
  onImageSelected,
  onUploadProgress,
  onUploadSuccess,
  onUploadError,
  allowsEditing = true,
  aspect = [4, 3],
  quality = 1, // We handle compression ourselves
  showCompressionInfo = true,
  disabled = false,
  uploadButtonText = "Select Image",
  accessibilityLabel = "Select image",
  accessibilityHint = "Tap to select and upload an image",
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const {
    isCompressing,
    compressionProgress,
    error: compressionError,
    result: compressionResult,
    compressWithPreset,
    reset: resetCompression,
  } = useImageCompression();

  // Handle image selection and upload flow
  const handleSelectImage = useCallback(async () => {
    if (disabled || isUploading || isCompressing) {
      return;
    }

    try {
      // Reset previous states
      setUploadError(null);
      resetCompression();

      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing,
        aspect,
        quality,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const imageUri = result.assets[0].uri;

      // Compress the image
      const options =
        compressionOptions || COMPRESSION_PRESETS[compressionPreset];
      const compressed = await compressWithPreset(imageUri, compressionPreset);

      // Call upload handler if provided
      if (onImageSelected) {
        setIsUploading(true);
        setUploadProgress(0);

        try {
          await onImageSelected(compressed.uri, compressed);
          setUploadProgress(100);
          onUploadSuccess?.();
        } catch (error: any) {
          const errorMessage = error.message || "Upload failed";
          setUploadError(errorMessage);
          onUploadError?.(errorMessage);
        } finally {
          setIsUploading(false);
        }
      }
    } catch (error: any) {
      const errorMessage = error.message || "Failed to process image";
      setUploadError(errorMessage);
      onUploadError?.(errorMessage);

      Alert.alert("Image Processing Failed", errorMessage, [
        { text: "OK", style: "default" },
        { text: "Try Again", onPress: handleSelectImage },
      ]);
    }
  }, [
    disabled,
    isUploading,
    isCompressing,
    allowsEditing,
    aspect,
    quality,
    compressionOptions,
    compressionPreset,
    onImageSelected,
    onUploadSuccess,
    onUploadError,
    compressWithPreset,
    resetCompression,
  ]);

  // Render upload overlay
  const renderOverlay = () => {
    const isProcessing = isCompressing || isUploading;

    if (!isProcessing && !uploadError) {
      return null;
    }

    return (
      <View style={[styles.overlay, overlayStyle]}>
        {isCompressing && (
          <>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.overlayText}>
              Compressing... {compressionProgress.toFixed(0)}%
            </Text>
          </>
        )}

        {isUploading && (
          <>
            <ActivityIndicator size="large" color="#ffffff" />
            <Text style={styles.overlayText}>
              Uploading... {uploadProgress.toFixed(0)}%
            </Text>
            {showCompressionInfo && compressionResult?.compressionRatio && (
              <Text style={styles.subText}>
                {(compressionResult.compressionRatio * 100).toFixed(0)}% smaller
              </Text>
            )}
          </>
        )}

        {uploadError && (
          <>
            <View style={styles.errorIcon}>
              <Text style={styles.errorIconText}>!</Text>
            </View>
            <Text style={styles.overlayText}>{uploadError}</Text>
            <TouchableOpacity
              style={styles.retryButton}
              onPress={handleSelectImage}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    );
  };

  const isInteractionDisabled = disabled || isCompressing || isUploading;

  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={handleSelectImage}
      disabled={isInteractionDisabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: isInteractionDisabled }}
    >
      <Image
        source={source || fallbackSource}
        style={[styles.image, imageStyle]}
        contentFit="cover"
      />
      {renderOverlay()}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
    overflow: "hidden",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  overlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  overlayText: {
    color: "#ffffff",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    marginTop: 8,
  },
  subText: {
    color: "rgba(255, 255, 255, 0.8)",
    fontSize: 12,
    textAlign: "center",
    marginTop: 4,
    fontStyle: "italic",
  },
  errorIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#ff4444",
    justifyContent: "center",
    alignItems: "center",
  },
  errorIconText: {
    color: "#ffffff",
    fontSize: 20,
    fontWeight: "bold",
  },
  retryButton: {
    marginTop: 12,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: "#333",
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#555",
  },
  retryButtonText: {
    color: "#ffffff",
    fontSize: 12,
    fontWeight: "600",
  },
});

export default CompressedImageUploader;
