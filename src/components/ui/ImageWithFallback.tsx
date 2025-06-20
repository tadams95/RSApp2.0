import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageProps,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GlobalStyles } from "../../constants/styles";
import { logError } from "../../utils/logError";
import { getStorageErrorMessage } from "../../utils/storageErrorHandler";

interface ImageWithFallbackProps extends Omit<ImageProps, "source"> {
  source: ImageSourcePropType;
  fallbackSource?: ImageSourcePropType;
  renderFallback?: () => React.ReactNode;
  showLoadingIndicator?: boolean;
  loadingIndicatorColor?: string;
  loadingIndicatorSize?: "small" | "large";
  onLoadSuccess?: () => void;
  onLoadError?: (error: Error) => void;
  /**
   * Maximum number of automatic retries on failure
   * @default 2
   */
  maxRetries?: number;
  /**
   * Whether to show a retry button when loading fails
   * @default false
   */
  showRetryButton?: boolean;
  /**
   * Whether to show error message when loading fails
   * @default false
   */
  showErrorMessage?: boolean;
  /**
   * Context information for error logging
   */
  errorContext?: string;
}

/**
 * A component that renders an image with fallback and loading states
 * Enhanced with Firebase Storage support, retry capabilities, and error handling
 */
const ImageWithFallback: React.FC<ImageWithFallbackProps> = ({
  source,
  fallbackSource,
  style,
  renderFallback,
  showLoadingIndicator = true,
  loadingIndicatorColor = GlobalStyles.colors.red4,
  loadingIndicatorSize = "small",
  onLoadSuccess,
  onLoadError,
  maxRetries = 2,
  showRetryButton = false,
  showErrorMessage = false,
  errorContext = "ImageComponent",
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Default fallback is a placeholder image from assets
  const defaultFallbackSource = require("../../assets/user.png");
  const actualFallbackSource = fallbackSource || defaultFallbackSource;

  const handleLoadStart = useCallback(() => {
    setIsLoading(true);
  }, []);

  const handleLoadEnd = useCallback(() => {
    setIsLoading(false);
  }, []);

  const handleError = useCallback(
    (error: Error) => {
      // Get a user-friendly error message
      const message = getStorageErrorMessage(error);

      // Log the error for debugging
      logError(error, `ImageWithFallback.${errorContext}`, {
        retryCount,
        errorMessage: message,
        sourceType: typeof source === "number" ? "local" : "uri",
      });

      setErrorMessage(message);
      setHasError(true);
      setIsLoading(false);

      if (onLoadError) {
        onLoadError(error);
      }

      // Auto-retry if under the max retry limit
      if (retryCount < maxRetries) {
        setRetryCount((count) => count + 1);
        // Force re-mount of Image component by changing the key
      }
    },
    [retryCount, maxRetries, onLoadError, source, errorContext]
  );

  const handleLoad = useCallback(() => {
    setHasError(false);
    setErrorMessage(null);
    setRetryCount(0); // Reset retry count on successful load

    if (onLoadSuccess) {
      onLoadSuccess();
    }
  }, [onLoadSuccess]);

  const handleRetry = useCallback(() => {
    setHasError(false);
    setIsLoading(true);
    setErrorMessage(null);
    // Increment retry count and force a re-render
    setRetryCount((count) => count + 1);
  }, []);

  // Reset retry count when source changes
  useEffect(() => {
    setRetryCount(0);
    setHasError(false);
    setErrorMessage(null);
  }, [source]);

  // Handle custom fallback rendering
  if (hasError && renderFallback) {
    return <>{renderFallback()}</>;
  }

  return (
    <View style={[styles.container, style]}>
      <Image
        key={`image-${retryCount}`} // Force re-mount on retry
        source={hasError ? actualFallbackSource : source}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={(e) => handleError(e.nativeEvent.error)}
        onLoad={handleLoad}
        style={[styles.image, style]}
        {...props}
      />

      {isLoading && showLoadingIndicator && (
        <ActivityIndicator
          style={styles.loadingIndicator}
          size={loadingIndicatorSize}
          color={loadingIndicatorColor}
        />
      )}

      {hasError && showErrorMessage && errorMessage && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      )}

      {hasError && showRetryButton && (
        <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
          <Text style={styles.retryButtonText}>Retry</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "relative",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
    resizeMode: "cover",
  },
  loadingIndicator: {
    position: "absolute",
  },
  errorContainer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    padding: 8,
    alignItems: "center",
  },
  errorText: {
    color: "white",
    fontSize: 12,
    textAlign: "center",
  },
  retryButton: {
    position: "absolute",
    backgroundColor: GlobalStyles.colors.red4,
    paddingHorizontal: 15,
    paddingVertical: 6,
    borderRadius: 4,
  },
  retryButtonText: {
    color: "white",
    fontSize: 12,
    fontWeight: "bold",
  },
});

export default ImageWithFallback;
