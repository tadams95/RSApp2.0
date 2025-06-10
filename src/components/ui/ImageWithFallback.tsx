import React, { useState } from "react";
import {
  ActivityIndicator,
  Image,
  ImageProps,
  ImageSourcePropType,
  StyleSheet,
  View,
} from "react-native";
import { GlobalStyles } from "../../constants/styles";

interface ImageWithFallbackProps extends Omit<ImageProps, "source"> {
  source: ImageSourcePropType;
  fallbackSource?: ImageSourcePropType;
  renderFallback?: () => React.ReactNode;
  showLoadingIndicator?: boolean;
  loadingIndicatorColor?: string;
  loadingIndicatorSize?: "small" | "large";
  onLoadSuccess?: () => void;
  onLoadError?: (error: Error) => void;
}

/**
 * A component that renders an image with fallback and loading states
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
  ...props
}) => {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);

  // Default fallback is a placeholder image from assets
  const defaultFallbackSource = require("../../assets/user.png");
  const actualFallbackSource = fallbackSource || defaultFallbackSource;

  const handleLoadStart = () => {
    setIsLoading(true);
  };

  const handleLoadEnd = () => {
    setIsLoading(false);
  };

  const handleError = (error: Error) => {
    console.warn("Image loading failed:", error);
    setHasError(true);
    setIsLoading(false);
    if (onLoadError) {
      onLoadError(error);
    }
  };

  const handleLoad = () => {
    setHasError(false);
    if (onLoadSuccess) {
      onLoadSuccess();
    }
  };

  if (hasError && renderFallback) {
    return <>{renderFallback()}</>;
  }

  return (
    <View style={[styles.container, style]}>
      <Image
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
});

export default ImageWithFallback;
