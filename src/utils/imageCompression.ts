import { manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { logError } from "./logError";

/**
 * Image compression configuration for different use cases
 */
export interface ImageCompressionOptions {
  // Maximum width/height in pixels (maintains aspect ratio)
  maxDimension?: number;
  // Quality from 0-1 (1 = best quality, 0.1 = most compressed)
  quality?: number;
  // Output format
  format?: SaveFormat;
  // Whether to apply minor rotation correction (fixes EXIF rotation issues)
  autoCorrectOrientation?: boolean;
}

/**
 * Predefined compression presets for different image types
 */
export const COMPRESSION_PRESETS = {
  // Profile pictures - smaller size for faster uploads and storage
  PROFILE: {
    maxDimension: 512, // 512x512 max
    quality: 0.8, // Good quality, reasonable file size
    format: SaveFormat.JPEG,
    autoCorrectOrientation: true,
  } as ImageCompressionOptions,

  // Event images - higher quality for display
  EVENT: {
    maxDimension: 1024, // 1024x1024 max
    quality: 0.85, // High quality
    format: SaveFormat.JPEG,
    autoCorrectOrientation: true,
  } as ImageCompressionOptions,

  // Product images - balanced for e-commerce
  PRODUCT: {
    maxDimension: 800, // 800x800 max
    quality: 0.8, // Good quality
    format: SaveFormat.JPEG,
    autoCorrectOrientation: true,
  } as ImageCompressionOptions,

  // Thumbnails - very small for lists
  THUMBNAIL: {
    maxDimension: 200, // 200x200 max
    quality: 0.7, // Lower quality for small size
    format: SaveFormat.JPEG,
    autoCorrectOrientation: true,
  } as ImageCompressionOptions,
} as const;

/**
 * Compression result information
 */
export interface CompressionResult {
  uri: string; // Compressed image URI
  width: number; // Final width
  height: number; // Final height
  originalSize?: number; // Original file size in bytes (if available)
  compressedSize?: number; // Compressed file size in bytes (if available)
  compressionRatio?: number; // Compression ratio (0-1, where 0.5 = 50% reduction)
}

/**
 * Get file size from URI (best effort - may not work on all platforms)
 */
async function getFileSize(uri: string): Promise<number | undefined> {
  try {
    const response = await fetch(uri);
    const blob = await response.blob();
    return blob.size;
  } catch (error) {
    // File size detection not critical, just log and continue
    console.warn("Could not determine file size:", error);
    return undefined;
  }
}

/**
 * Calculate optimal dimensions while maintaining aspect ratio
 */
function calculateOptimalDimensions(
  originalWidth: number,
  originalHeight: number,
  maxDimension: number
): { width: number; height: number } {
  // If image is already smaller than max, don't upscale
  if (originalWidth <= maxDimension && originalHeight <= maxDimension) {
    return { width: originalWidth, height: originalHeight };
  }

  const aspectRatio = originalWidth / originalHeight;

  if (originalWidth > originalHeight) {
    // Landscape - limit width
    return {
      width: maxDimension,
      height: Math.round(maxDimension / aspectRatio),
    };
  } else {
    // Portrait or square - limit height
    return {
      width: Math.round(maxDimension * aspectRatio),
      height: maxDimension,
    };
  }
}

/**
 * Compress an image using expo-image-manipulator
 */
export async function compressImage(
  imageUri: string,
  options: ImageCompressionOptions = COMPRESSION_PRESETS.PROFILE
): Promise<CompressionResult> {
  const startTime = Date.now();

  try {
    // Get original file size if possible
    const originalSize = await getFileSize(imageUri);

    // Get image info first to determine current dimensions
    const imageInfo = await manipulateAsync(imageUri, [], {
      compress: 1, // No compression for info gathering
      format: SaveFormat.JPEG, // Temporary format for info
    });

    // Calculate optimal dimensions
    const {
      maxDimension = 512,
      quality = 0.8,
      format = SaveFormat.JPEG,
      autoCorrectOrientation = true,
    } = options;

    const optimalDimensions = calculateOptimalDimensions(
      imageInfo.width,
      imageInfo.height,
      maxDimension
    );

    // Build manipulation actions
    const actions = [];

    // Auto-correct orientation if enabled (fixes camera rotation issues)
    if (autoCorrectOrientation) {
      // This is a simple rotation correction - expo-image-manipulator handles EXIF automatically
      actions.push({
        rotate: 0, // This will apply EXIF rotation correction
      });
    }

    // Resize if needed
    if (
      optimalDimensions.width !== imageInfo.width ||
      optimalDimensions.height !== imageInfo.height
    ) {
      actions.push({
        resize: optimalDimensions,
      });
    }

    // Apply compression and format
    const result = await manipulateAsync(imageUri, actions, {
      compress: quality,
      format: format,
    });

    // Get compressed file size if possible
    const compressedSize = await getFileSize(result.uri);

    // Calculate compression ratio
    let compressionRatio: number | undefined;
    if (originalSize && compressedSize) {
      compressionRatio = 1 - compressedSize / originalSize;
    }

    const duration = Date.now() - startTime;

    if (__DEV__) {
      console.log(`Image compressed in ${duration}ms:`, {
        originalDimensions: `${imageInfo.width}x${imageInfo.height}`,
        finalDimensions: `${result.width}x${result.height}`,
        originalSize: originalSize
          ? `${(originalSize / 1024).toFixed(1)}KB`
          : "unknown",
        compressedSize: compressedSize
          ? `${(compressedSize / 1024).toFixed(1)}KB`
          : "unknown",
        compressionRatio: compressionRatio
          ? `${(compressionRatio * 100).toFixed(1)}%`
          : "unknown",
        quality: quality,
      });
    }

    return {
      uri: result.uri,
      width: result.width,
      height: result.height,
      originalSize,
      compressedSize,
      compressionRatio,
    };
  } catch (error) {
    const duration = Date.now() - startTime;

    logError(error, "ImageCompression", {
      duration,
      options,
      originalUri: imageUri,
    });

    // If compression fails, return original image
    // This ensures upload doesn't fail due to compression issues
    console.warn("Image compression failed, using original image:", error);

    // Try to get original dimensions for fallback result
    try {
      const originalInfo = await manipulateAsync(imageUri, [], {
        compress: 1,
        format: SaveFormat.JPEG,
      });

      return {
        uri: imageUri, // Use original URI
        width: originalInfo.width,
        height: originalInfo.height,
        originalSize: await getFileSize(imageUri),
      };
    } catch (fallbackError) {
      // Last resort - return minimal result
      return {
        uri: imageUri,
        width: 0,
        height: 0,
      };
    }
  }
}

/**
 * Batch compress multiple images
 */
export async function compressImages(
  imageUris: string[],
  options: ImageCompressionOptions = COMPRESSION_PRESETS.PROFILE
): Promise<CompressionResult[]> {
  const results: CompressionResult[] = [];

  for (const uri of imageUris) {
    try {
      const result = await compressImage(uri, options);
      results.push(result);
    } catch (error) {
      logError(error, "BatchImageCompression", { uri, options });
      // Add fallback result for failed compression
      results.push({
        uri: uri, // Use original
        width: 0,
        height: 0,
      });
    }
  }

  return results;
}

/**
 * Estimate compression savings before actually compressing
 * Useful for showing users potential savings
 */
export async function estimateCompressionSavings(
  imageUri: string,
  options: ImageCompressionOptions = COMPRESSION_PRESETS.PROFILE
): Promise<{
  estimatedSavings: number; // Percentage (0-100)
  estimatedFinalSize: string; // Human readable size
} | null> {
  try {
    const originalSize = await getFileSize(imageUri);
    if (!originalSize) return null;

    // Get original dimensions
    const imageInfo = await manipulateAsync(imageUri, [], {
      compress: 1,
      format: SaveFormat.JPEG,
    });

    // Calculate size reduction factors
    const { maxDimension = 512, quality = 0.8 } = options;
    const optimalDimensions = calculateOptimalDimensions(
      imageInfo.width,
      imageInfo.height,
      maxDimension
    );

    // Estimate pixel reduction
    const originalPixels = imageInfo.width * imageInfo.height;
    const finalPixels = optimalDimensions.width * optimalDimensions.height;
    const pixelReduction = finalPixels / originalPixels;

    // Estimate compression savings (quality + pixel reduction)
    const estimatedCompression = pixelReduction * quality;
    const estimatedSavings = Math.max(
      0,
      Math.min(95, (1 - estimatedCompression) * 100)
    );

    const estimatedFinalSize = originalSize * estimatedCompression;
    const finalSizeStr =
      estimatedFinalSize > 1024 * 1024
        ? `${(estimatedFinalSize / (1024 * 1024)).toFixed(1)}MB`
        : `${(estimatedFinalSize / 1024).toFixed(0)}KB`;

    return {
      estimatedSavings: Math.round(estimatedSavings),
      estimatedFinalSize: finalSizeStr,
    };
  } catch (error) {
    logError(error, "CompressionEstimation", { imageUri, options });
    return null;
  }
}

/**
 * Check if an image needs compression based on file size and dimensions
 */
export async function shouldCompressImage(
  imageUri: string,
  maxSizeBytes: number = 1024 * 1024, // 1MB default
  maxDimension: number = 1024
): Promise<boolean> {
  try {
    const fileSize = await getFileSize(imageUri);

    // Check file size
    if (fileSize && fileSize > maxSizeBytes) {
      return true;
    }

    // Check dimensions
    const imageInfo = await manipulateAsync(imageUri, [], {
      compress: 1,
      format: SaveFormat.JPEG,
    });

    if (imageInfo.width > maxDimension || imageInfo.height > maxDimension) {
      return true;
    }

    return false;
  } catch (error) {
    // If we can't determine, err on the side of compression
    return true;
  }
}
