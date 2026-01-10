import { ImageProps as ExpoImageProps, Image } from "expo-image";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  ImageSourcePropType,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Theme } from "../../constants/themes";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import {
  CACHE_POLICIES,
  ImageCacheOptions,
  generateCacheKey,
} from "../../utils/imageCacheConfig";
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
  /**
   * Test ID for testing purposes
   */
  testID?: string;
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
  loadingIndicatorColor,
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
  testID,
  ...props
}) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const indicatorColor = loadingIndicatorColor ?? theme.colors.accent;
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Fix Firebase Storage URLs that are missing ?alt=media
  const fixedSource = React.useMemo(() => {
    if (
      typeof source === "object" &&
      "uri" in source &&
      typeof (source as any).uri === "string"
    ) {
      const uri = (source as any).uri as string;
      // Check if it's a Firebase Storage URL missing alt=media
      if (
        uri.includes("firebasestorage.googleapis.com") &&
        !uri.includes("alt=media")
      ) {
        const separator = uri.includes("?") ? "&" : "?";
        return { ...(source as object), uri: `${uri}${separator}alt=media` };
      }
    }
    return source;
  }, [source]);
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

      // Get a user-friendly error message (this also logs the error)
      const message = getStorageErrorMessage(actualError);

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
    <View style={[styles.container, style]} testID={testID}>
      <Image
        key={`image-${retryCount}`} // Force re-mount on retry
        source={hasError ? actualFallbackSource : fixedSource}
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
          color={indicatorColor}
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

const createStyles = (theme: Theme) =>
  ({
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
      color: theme.colors.textPrimary,
      fontSize: 12,
      textAlign: "center",
    },
    retryButton: {
      position: "absolute",
      backgroundColor: theme.colors.accent,
      paddingHorizontal: 15,
      paddingVertical: 6,
      borderRadius: 4,
    },
    retryButtonText: {
      color: theme.colors.textPrimary,
      fontSize: 12,
      fontWeight: "bold",
    },
  } as const);

export default ImageWithFallback;
