import { useCallback, useState } from "react";
import { Alert } from "react-native";
import {
  compressImage,
  COMPRESSION_PRESETS,
  CompressionResult,
  estimateCompressionSavings,
  ImageCompressionOptions,
} from "../utils/imageCompression";
import { logError } from "../utils/logError";

/**
 * Hook state for image compression
 */
interface UseImageCompressionState {
  isCompressing: boolean;
  compressionProgress: number;
  error: string | null;
  result: CompressionResult | null;
}

/**
 * Hook return type
 */
interface UseImageCompressionReturn {
  // State
  isCompressing: boolean;
  compressionProgress: number;
  error: string | null;
  result: CompressionResult | null;

  // Actions
  compress: (
    imageUri: string,
    options?: ImageCompressionOptions
  ) => Promise<CompressionResult>;
  compressWithPreset: (
    imageUri: string,
    preset: keyof typeof COMPRESSION_PRESETS
  ) => Promise<CompressionResult>;
  estimateSavings: (
    imageUri: string,
    options?: ImageCompressionOptions
  ) => Promise<{ estimatedSavings: number; estimatedFinalSize: string } | null>;
  showCompressionDialog: (
    imageUri: string,
    options?: ImageCompressionOptions
  ) => Promise<boolean>;
  reset: () => void;
}

/**
 * Custom hook for image compression with progress tracking and error handling
 */
export function useImageCompression(): UseImageCompressionReturn {
  const [state, setState] = useState<UseImageCompressionState>({
    isCompressing: false,
    compressionProgress: 0,
    error: null,
    result: null,
  });

  // Reset state
  const reset = useCallback(() => {
    setState({
      isCompressing: false,
      compressionProgress: 0,
      error: null,
      result: null,
    });
  }, []);

  // Main compression function
  const compress = useCallback(
    async (
      imageUri: string,
      options: ImageCompressionOptions = COMPRESSION_PRESETS.PROFILE
    ): Promise<CompressionResult> => {
      setState((prev) => ({
        ...prev,
        isCompressing: true,
        compressionProgress: 0,
        error: null,
        result: null,
      }));

      try {
        // Simulate progress updates
        setState((prev) => ({ ...prev, compressionProgress: 25 }));

        const result = await compressImage(imageUri, options);

        setState((prev) => ({
          ...prev,
          compressionProgress: 100,
          result,
          isCompressing: false,
        }));

        return result;
      } catch (error: any) {
        const errorMessage = error.message || "Image compression failed";

        setState((prev) => ({
          ...prev,
          isCompressing: false,
          compressionProgress: 0,
          error: errorMessage,
        }));

        logError(error, "UseImageCompression", {
          imageUri,
          options,
        });

        throw error;
      }
    },
    []
  );

  // Compress with predefined preset
  const compressWithPreset = useCallback(
    async (
      imageUri: string,
      preset: keyof typeof COMPRESSION_PRESETS
    ): Promise<CompressionResult> => {
      return compress(imageUri, COMPRESSION_PRESETS[preset]);
    },
    [compress]
  );

  // Estimate compression savings
  const estimateSavings = useCallback(
    async (
      imageUri: string,
      options: ImageCompressionOptions = COMPRESSION_PRESETS.PROFILE
    ) => {
      try {
        return await estimateCompressionSavings(imageUri, options);
      } catch (error: any) {
        logError(error, "UseImageCompression.EstimateSavings", {
          imageUri,
          options,
        });
        return null;
      }
    },
    []
  );

  // Show compression confirmation dialog
  const showCompressionDialog = useCallback(
    async (
      imageUri: string,
      options: ImageCompressionOptions = COMPRESSION_PRESETS.PROFILE
    ): Promise<boolean> => {
      try {
        const estimation = await estimateSavings(imageUri, options);

        if (!estimation) {
          // If we can't estimate, ask user if they want to compress anyway
          return new Promise((resolve) => {
            Alert.alert(
              "Compress Image?",
              "Would you like to compress this image for faster upload and better performance?",
              [
                {
                  text: "Skip",
                  style: "cancel",
                  onPress: () => resolve(false),
                },
                { text: "Compress", onPress: () => resolve(true) },
              ]
            );
          });
        }

        // Show estimation-based dialog
        return new Promise((resolve) => {
          Alert.alert(
            "Compress Image",
            `This will reduce the file size by approximately ${estimation.estimatedSavings}% (to about ${estimation.estimatedFinalSize}). This helps with faster uploads and better performance.`,
            [
              { text: "Skip", style: "cancel", onPress: () => resolve(false) },
              { text: "Compress", onPress: () => resolve(true) },
            ]
          );
        });
      } catch (error) {
        // If estimation fails, default to asking for compression
        return new Promise((resolve) => {
          Alert.alert(
            "Compress Image?",
            "Would you like to compress this image for faster upload?",
            [
              { text: "Skip", style: "cancel", onPress: () => resolve(false) },
              { text: "Compress", onPress: () => resolve(true) },
            ]
          );
        });
      }
    },
    [estimateSavings]
  );

  return {
    // State
    isCompressing: state.isCompressing,
    compressionProgress: state.compressionProgress,
    error: state.error,
    result: state.result,

    // Actions
    compress,
    compressWithPreset,
    estimateSavings,
    showCompressionDialog,
    reset,
  };
}

/**
 * Simpler hook for basic compression without progress tracking
 */
export function useSimpleImageCompression() {
  const [isCompressing, setIsCompressing] = useState(false);

  const compress = useCallback(
    async (
      imageUri: string,
      preset: keyof typeof COMPRESSION_PRESETS = "PROFILE"
    ): Promise<CompressionResult> => {
      setIsCompressing(true);
      try {
        const result = await compressImage(
          imageUri,
          COMPRESSION_PRESETS[preset]
        );
        return result;
      } finally {
        setIsCompressing(false);
      }
    },
    []
  );

  return {
    isCompressing,
    compress,
  };
}
