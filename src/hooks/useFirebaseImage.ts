import {
  getDownloadURL,
  getStorage,
  ref as storageRef,
} from "firebase/storage";
import { useCallback, useEffect, useState } from "react";
import { ImageSourcePropType } from "react-native";
import { logError } from "../utils/logError";
import {
  extractStorageErrorCode,
  getStorageErrorMessage,
} from "../utils/storageErrorHandler";

interface UseFirebaseImageResult {
  imageSource: ImageSourcePropType;
  isLoading: boolean;
  error: string | null;
  reload: () => void;
}

interface UseFirebaseImageOptions {
  fallbackImage?: ImageSourcePropType;
  cacheExpiry?: number; // In milliseconds, default is 1 hour
}

/**
 * Custom hook for loading and managing Firebase Storage images
 * Handles errors, loading states, and caching of Firebase Storage URLs
 *
 * @param imagePath Path to the image in Firebase Storage, or a URL
 * @param options Configuration options
 * @returns Object containing image source, loading state, error, and reload function
 */
export function useFirebaseImage(
  imagePath: string | null,
  options: UseFirebaseImageOptions = {}
): UseFirebaseImageResult {
  const [imageSource, setImageSource] = useState<ImageSourcePropType>(
    options.fallbackImage || require("../assets/user.png")
  );
  const [isLoading, setIsLoading] = useState<boolean>(!!imagePath);
  const [error, setError] = useState<string | null>(null);
  const [lastLoaded, setLastLoaded] = useState<number>(0);

  // Default cache expiry is 1 hour
  const cacheExpiry = options.cacheExpiry || 3600000;
  const defaultFallback =
    options.fallbackImage || require("../assets/user.png");

  // Function to load the image from Firebase Storage
  const loadImage = useCallback(async () => {
    // Reset states
    setIsLoading(true);
    setError(null);

    // If no image path, use fallback
    if (!imagePath) {
      setImageSource(defaultFallback);
      setIsLoading(false);
      return;
    }

    try {
      // Check if it's already a complete URL (starts with http or https)
      if (imagePath.startsWith("http")) {
        setImageSource({ uri: imagePath });
        setLastLoaded(Date.now());
        setIsLoading(false);
        return;
      }

      // Otherwise, treat it as a Firebase Storage path
      const storage = getStorage();
      const imageRef = storageRef(storage, imagePath);
      const url = await getDownloadURL(imageRef);

      setImageSource({ uri: url });
      setLastLoaded(Date.now());
    } catch (error: any) {
      const errorCode = extractStorageErrorCode(error);
      const errorMessage = getStorageErrorMessage(error);

      // Log the error
      logError(error, "FirebaseImageLoading", {
        imagePath,
        errorCode,
      });

      // Handle specific error cases with user-friendly messages
      if (errorCode === "storage/object-not-found") {
        setError("Image not found - it may have been deleted");
      } else if (errorCode === "storage/unauthorized") {
        setError("Access denied - please log in again to view this image");
      } else {
        // Set user-friendly error message
        setError(errorMessage);
      }

      // Use fallback image
      setImageSource(defaultFallback);
    } finally {
      setIsLoading(false);
    }
  }, [imagePath, defaultFallback]);

  // Function to manually reload the image
  const reload = useCallback(() => {
    loadImage();
  }, [loadImage]);

  // Load image on mount or when imagePath changes
  useEffect(() => {
    // Skip if no path
    if (!imagePath) {
      setImageSource(defaultFallback);
      setIsLoading(false);
      return;
    }

    // If URL already cached and cache not expired, skip loading
    if (
      imageSource !== defaultFallback &&
      Date.now() - lastLoaded < cacheExpiry &&
      typeof imageSource !== "number" && // Not a require() result
      "uri" in imageSource &&
      imageSource.uri === imagePath
    ) {
      return;
    }

    loadImage();
  }, [
    imagePath,
    loadImage,
    defaultFallback,
    cacheExpiry,
    imageSource,
    lastLoaded,
  ]);

  return {
    imageSource,
    isLoading,
    error,
    reload,
  };
}
