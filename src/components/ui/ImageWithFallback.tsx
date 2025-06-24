import { ImageProps as ExpoImageProps, Image } from "expo-image";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ImageSourcePropType,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GlobalStyles } from "../../constants/styles";
import {
  CACHE_POLICIES,
  ImageCacheOptions,
  generateCacheKey,
} from "../../utils/imageCacheConfig";
import { logError } from "../../utils/logError";
import { getStorageErrorMessage } from "../../utils/storageErrorHandler";

type ImageCacheType =
  | "STATIC"
  | "PRODUCT"
  | "EVENT"
  | "PROFILE"
  | "LAZY_LIST"
  | "TEMPORARY";

interface ImageWithFallbackProps extends Omit<ExpoImageProps, "source"> {
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
  /**
   * Cache type for optimized caching strategy
   * @default "PRODUCT"
   */
  cacheType?: ImageCacheType;
  /**
   * Unique identifier for cache key generation
   */
  cacheId?: string;
  /**
   * Version for cache invalidation
   */
  cacheVersion?: string | number;
}

/**
 * A component that renders an image with fallback and loading states
 * Enhanced with Firebase Storage support, retry capabilities, and optimized caching
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
  cacheType = "PRODUCT",
  cacheId,
  cacheVersion,
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
    (errorEvent: any) => {
      // expo-image error event structure may vary, handle both possible formats
      const actualError =
        errorEvent?.error || errorEvent || new Error("Image load failed");

      // Get a user-friendly error message
      const message = getStorageErrorMessage(actualError);

      // Log the error for debugging
      logError(actualError, `ImageWithFallback.${errorContext}`, {
        retryCount,
        errorMessage: message,
        sourceType: typeof source === "number" ? "local" : "uri",
      });

      setErrorMessage(message);
      setHasError(true);
      setIsLoading(false);

      if (onLoadError) {
        onLoadError(actualError);
      }

      // Auto-retry if under the max retry limit
      if (retryCount < maxRetries) {
        setRetryCount((count) => count + 1);
        // Force re-mount of Image component by changing the key
      }
    },
    [retryCount, maxRetries, onLoadError, source, errorContext]
  );

  const handleLoad = useCallback(
    (event?: any) => {
      setHasError(false);
      setErrorMessage(null);
      setRetryCount(0); // Reset retry count on successful load

      if (onLoadSuccess) {
        onLoadSuccess();
      }
    },
    [onLoadSuccess]
  );

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

  // Generate cache configuration based on type
  const getCacheConfig = useCallback((): ImageCacheOptions => {
    const baseConfig = CACHE_POLICIES[cacheType];

    // Generate recycling key for dynamic content
    let recyclingKey: string | undefined;
    if ("recyclingKey" in baseConfig) {
      recyclingKey = baseConfig.recyclingKey;
      if (cacheId) {
        recyclingKey = generateCacheKey(
          cacheType.toLowerCase(),
          cacheId,
          cacheVersion
        );
      }
    }

    return {
      ...baseConfig,
      recyclingKey,
    };
  }, [cacheType, cacheId, cacheVersion]);

  // Handle custom fallback rendering
  if (hasError && renderFallback) {
    return <>{renderFallback()}</>;
  }

  const cacheConfig = getCacheConfig();

  return (
    <View style={[styles.container, style]}>
      <Image
        key={`image-${retryCount}`} // Force re-mount on retry
        source={hasError ? actualFallbackSource : source}
        onLoadStart={handleLoadStart}
        onLoadEnd={handleLoadEnd}
        onError={handleError} // expo-image passes error directly
        onLoad={handleLoad}
        style={[styles.image, style]}
        cachePolicy={cacheConfig.cachePolicy}
        priority={cacheConfig.priority}
        transition={cacheConfig.transition}
        recyclingKey={cacheConfig.recyclingKey}
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
