import { ImageProps as ExpoImageProps, Image } from "expo-image";
import React, { useCallback, useState } from "react";
import { ImageSourcePropType, View, ViewStyle } from "react-native";
import {
  CACHE_POLICIES,
  ImageCacheOptions,
  generateCacheKey,
} from "../../utils/imageCacheConfig";

type ImageCacheType =
  | "STATIC"
  | "PRODUCT"
  | "EVENT"
  | "PROFILE"
  | "LAZY_LIST"
  | "TEMPORARY";

interface ProgressiveImageProps extends Omit<ExpoImageProps, "source"> {
  source: ImageSourcePropType;
  /**
   * Low resolution placeholder image to show while high-res loads
   * Should be a small, blurred version or a low-quality version
   */
  lowResSource?: ImageSourcePropType;
  /**
   * Fallback source if both main and lowRes fail
   */
  fallbackSource?: ImageSourcePropType;
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
   * Callback when high-res image loads successfully
   */
  onHighResLoad?: () => void;
  /**
   * Callback when any image fails to load
   */
  onLoadError?: (error: Error) => void;
}

/**
 * Progressive image loading component that shows a low-res placeholder
 * while the high-resolution image loads in the background
 *
 * **Usage:**
 * - Product carousels: Shows blurred placeholder while main image loads
 * - Event hero images: Smooth loading experience for large images
 * - List items: Prevents layout shifts and provides instant visual feedback
 *
 * **Benefits:**
 * - Improved perceived performance
 * - Reduced layout shifts
 * - Better user experience on slow connections
 * - Maintains expo-image caching benefits
 *
 * **Implementation:**
 * 1. Low-res placeholder loads instantly from assets
 * 2. High-res image loads in background with expo-image caching
 * 3. Smooth fade transition when high-res is ready
 * 4. Fallback handling if both images fail
 */
const ProgressiveImage: React.FC<ProgressiveImageProps> = ({
  source,
  lowResSource,
  fallbackSource,
  style,
  cacheType = "PRODUCT",
  cacheId,
  cacheVersion,
  onHighResLoad,
  onLoadError,
  ...props
}) => {
  const [isHighResLoaded, setIsHighResLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);

  // Generate cache configuration
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

  const handleHighResLoad = useCallback(() => {
    setIsHighResLoaded(true);
    setHasError(false);
    onHighResLoad?.();
  }, [onHighResLoad]);

  const handleError = useCallback(
    (error: any) => {
      setHasError(true);
      const actualError =
        error?.error || error || new Error("Image load failed");
      onLoadError?.(actualError);
    },
    [onLoadError]
  );

  const cacheConfig = getCacheConfig();
  const containerStyle: ViewStyle = Array.isArray(style)
    ? Object.assign({}, ...style.filter((s) => s))
    : (style as ViewStyle) || {};

  // Default fallback source
  const defaultFallback = require("../../assets/BlurHero_2.png");
  const actualFallbackSource = fallbackSource || defaultFallback;

  return (
    <View style={[containerStyle, { position: "relative" }]}>
      {/* Low-res placeholder (shown until high-res loads or on error) */}
      {(!isHighResLoaded || hasError) && lowResSource && (
        <Image
          source={hasError ? actualFallbackSource : lowResSource}
          style={[
            style,
            {
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
            },
          ]}
          cachePolicy="memory" // Keep low-res in memory for quick access
          priority="high" // Load placeholder quickly
          {...props}
        />
      )}

      {/* High-res image (fades in when loaded) */}
      {!hasError && (
        <Image
          source={source}
          style={[
            style,
            {
              opacity: isHighResLoaded ? 1 : 0,
            },
          ]}
          onLoad={handleHighResLoad}
          onError={handleError}
          cachePolicy={cacheConfig.cachePolicy}
          priority={cacheConfig.priority}
          transition={isHighResLoaded ? cacheConfig.transition : 0}
          recyclingKey={cacheConfig.recyclingKey}
          {...props}
        />
      )}

      {/* Fallback image (shown only if both main and lowRes fail) */}
      {hasError && !lowResSource && (
        <Image
          source={actualFallbackSource}
          style={style}
          cachePolicy="memory"
          priority="high"
          {...props}
        />
      )}
    </View>
  );
};

export default ProgressiveImage;
