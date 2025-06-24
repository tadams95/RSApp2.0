import { Image } from "expo-image";

/**
 * Global image cache configuration for expo-image
 * Optimizes caching strategy for different types of images in the app
 */

export interface ImageCacheOptions {
  cachePolicy?: "memory" | "disk" | "memory-disk" | "none";
  priority?: "low" | "normal" | "high";
  transition?: number;
  placeholder?: string | number | { uri: string };
  recyclingKey?: string;
}

/**
 * Cache policies for different image types
 */
export const CACHE_POLICIES = {
  // Static assets (logos, hero images) - aggressive caching
  STATIC: {
    cachePolicy: "memory-disk" as const,
    priority: "high" as const,
    transition: 200,
  },
  
  // Product images - balanced caching with transition
  PRODUCT: {
    cachePolicy: "memory-disk" as const,
    priority: "normal" as const,
    transition: 150,
    recyclingKey: "product-images",
  },
  
  // Event images - balanced caching
  EVENT: {
    cachePolicy: "memory-disk" as const,
    priority: "normal" as const,
    transition: 150,
    recyclingKey: "event-images",
  },
  
  // Profile images - memory priority for recent users
  PROFILE: {
    cachePolicy: "memory-disk" as const,
    priority: "normal" as const,
    transition: 100,
    recyclingKey: "profile-images",
  },
  
  // Lazy loaded images in lists - disk cache to save memory
  LAZY_LIST: {
    cachePolicy: "disk" as const,
    priority: "low" as const,
    transition: 200,
    recyclingKey: "list-images",
  },
  
  // Temporary/one-time images - memory only
  TEMPORARY: {
    cachePolicy: "memory" as const,
    priority: "low" as const,
    transition: 100,
  },
} as const;

/**
 * Default placeholder images for different contexts
 */
export const PLACEHOLDERS = {
  PRODUCT: require("../assets/BlurHero_2.png"),
  EVENT: require("../assets/BlurHero_2.png"),
  PROFILE: require("../assets/user.png"),
  LOGO: require("../assets/RSLogo2025.png"),
} as const;

/**
 * Initialize global image cache settings
 */
export const initializeImageCache = () => {
  // Configure expo-image global settings
  Image.clearMemoryCache();
  
  // Set memory cache size (in MB) - adjust based on device capabilities
  // This is platform-specific configuration
  if (__DEV__) {
    console.log("Image cache initialized with expo-image");
  }
};

/**
 * Cache management utilities
 */
export const ImageCacheManager = {
  /**
   * Clear memory cache (useful for memory pressure situations)
   */
  clearMemoryCache: () => {
    Image.clearMemoryCache();
    if (__DEV__) {
      console.log("Image memory cache cleared");
    }
  },

  /**
   * Clear disk cache (for cache size management)
   */
  clearDiskCache: () => {
    Image.clearDiskCache();
    if (__DEV__) {
      console.log("Image disk cache cleared");
    }
  },

  /**
   * Clear all caches
   */
  clearAllCaches: () => {
    Image.clearMemoryCache();
    Image.clearDiskCache();
    if (__DEV__) {
      console.log("All image caches cleared");
    }
  },

  /**
   * Preload critical images
   */
  preloadImages: async (imageUris: string[]) => {
    try {
      const preloadPromises = imageUris.map((uri) => 
        Image.prefetch(uri, {
          cachePolicy: "memory-disk",
          headers: {},
        })
      );
      
      await Promise.all(preloadPromises);
      
      if (__DEV__) {
        console.log(`Preloaded ${imageUris.length} images`);
      }
    } catch (error) {
      console.error("Failed to preload images:", error);
    }
  },

  /**
   * Get cache size info (if available in future expo-image versions)
   */
  getCacheInfo: async () => {
    try {
      // Future: expo-image may provide cache size APIs
      // For now, we'll use basic info
      return {
        memoryCache: "Active",
        diskCache: "Active",
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error("Failed to get cache info:", error);
      return null;
    }
  },
};

/**
 * Utility to generate cache key for dynamic content
 */
export const generateCacheKey = (
  type: string,
  id: string,
  version?: string | number
): string => {
  return `${type}-${id}${version ? `-v${version}` : ""}`;
};

/**
 * Memory pressure handler - clear cache when memory is low
 */
export const handleMemoryPressure = () => {
  if (__DEV__) {
    console.log("Memory pressure detected, clearing image memory cache");
  }
  ImageCacheManager.clearMemoryCache();
};
