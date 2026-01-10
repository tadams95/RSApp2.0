import { ImageProps as ExpoImageProps } from "expo-image";
import React, { useCallback, useRef, useState } from "react";
import { ImageSourcePropType, View, ViewStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import ImageWithFallback from "./ImageWithFallback";

// Define the props interface locally since it's not exported from ImageWithFallback
interface ImageWithFallbackProps extends Omit<ExpoImageProps, "source"> {
  source: ImageSourcePropType;
  fallbackSource?: ImageSourcePropType;
  renderFallback?: () => React.ReactNode;
  showLoadingIndicator?: boolean;
  loadingIndicatorColor?: string;
  loadingIndicatorSize?: "small" | "large";
  onLoadSuccess?: () => void;
  onLoadError?: (error: Error) => void;
  maxRetries?: number;
  showRetryButton?: boolean;
  showErrorMessage?: boolean;
  errorContext?: string;
}

interface LazyImageProps extends Omit<ImageWithFallbackProps, "placeholder"> {
  /**
   * Threshold for when to start loading the image (in pixels before it's visible)
   * @default 100
   */
  threshold?: number;
  /**
   * Placeholder component to show before image loads
   */
  placeholder?: React.ReactNode;
  /**
   * Whether lazy loading is enabled
   * @default true
   */
  lazy?: boolean;
  /**
   * Cache type for lazy loaded images
   * @default "LAZY_LIST"
   */
  cacheType?:
    | "STATIC"
    | "PRODUCT"
    | "EVENT"
    | "PROFILE"
    | "LAZY_LIST"
    | "TEMPORARY";
}

/**
 * LazyImage component that defers image loading until the image is about to become visible
 * Built on top of ImageWithFallback to maintain all existing functionality
 */
const LazyImage: React.FC<LazyImageProps> = ({
  threshold = 100,
  placeholder,
  lazy = true,
  style,
  cacheType = "LAZY_LIST",
  ...imageProps
}) => {
  const { theme } = useTheme();
  const [shouldLoad, setShouldLoad] = useState(!lazy);
  const viewRef = useRef<View>(null);

  const handleLayout = useCallback(() => {
    if (!lazy || shouldLoad) return;

    // For FlashList, we'll defer loading until after the initial render
    // This allows FlashList to position items before starting image loads
    const timer = setTimeout(() => {
      setShouldLoad(true);
    }, 50); // Small delay to let FlashList settle

    return () => clearTimeout(timer);
  }, [lazy, shouldLoad]);

  // If lazy loading is disabled, render the image immediately
  if (!lazy || shouldLoad) {
    return (
      <ImageWithFallback style={style} cacheType={cacheType} {...imageProps} />
    );
  }

  // Show placeholder while waiting to load
  const containerStyle: ViewStyle = Array.isArray(style)
    ? Object.assign({}, ...style.filter((s) => s))
    : (style as ViewStyle) || {};

  return (
    <View
      ref={viewRef}
      style={[containerStyle, { backgroundColor: theme.colors.bgElev1 }]}
      onLayout={handleLayout}
    >
      {placeholder}
    </View>
  );
};

export default LazyImage;
