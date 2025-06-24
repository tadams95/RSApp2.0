import { Image } from "expo-image";
import { ImageCacheManager, CACHE_POLICIES } from "./imageCacheConfig";

/**
 * Critical images that should be preloaded for better UX
 */
export const CRITICAL_IMAGES = {
  // App logos and branding
  LOGOS: [
    require("../assets/RSLogo2025.png"),
    require("../assets/RSLogoNew.png"),
    require("../assets/RSLogoRounded.png"),
  ],
  
  // Fallback/placeholder images
  PLACEHOLDERS: [
    require("../assets/user.png"),
    require("../assets/BlurHero_2.png"),
    require("../assets/BlurHero_1.3.png"),
  ],
  
  // Hero images
  HEROES: [
    require("../assets/ShopHero_1.png"),
    require("../assets/ShopHero_2.png"),
  ],
} as const;

/**
 * Image preloader for critical app images
 */
export class ImagePreloader {
  private static instance: ImagePreloader;
  private preloadedImages = new Set<string>();
  private preloadPromises = new Map<string, Promise<void>>();

  static getInstance(): ImagePreloader {
    if (!ImagePreloader.instance) {
      ImagePreloader.instance = new ImagePreloader();
    }
    return ImagePreloader.instance;
  }

  /**
   * Preload critical images on app startup
   */
  async preloadCriticalImages(): Promise<void> {
    const startTime = Date.now();
    
    try {
      // Combine all critical image sources
      const allCriticalImages = [
        ...CRITICAL_IMAGES.LOGOS,
        ...CRITICAL_IMAGES.PLACEHOLDERS,
        ...CRITICAL_IMAGES.HEROES,
      ];

      // Extract only remote URLs that need prefetching
      // Static assets (require() results) are already optimized by the bundler
      const remoteImageUris = allCriticalImages
        .map(source => {
          // Only process objects with uri property (remote images)
          return typeof source === 'object' && 'uri' in source ? source.uri : null;
        })
        .filter((uri): uri is string => uri !== null);

      // Preload only remote images - static assets don't need prefetching
      if (remoteImageUris.length > 0) {
        await ImageCacheManager.preloadImages(remoteImageUris);
      }

      const duration = Date.now() - startTime;
      if (__DEV__) {
        const staticCount = allCriticalImages.length - remoteImageUris.length;
        console.log(`Critical images processed in ${duration}ms (${staticCount} static assets, ${remoteImageUris.length} remote images preloaded)`);
      }
    } catch (error) {
      console.error("Failed to preload critical images:", error);
    }
  }

  /**
   * Preload images from URLs with caching strategy
   */
  async preloadImageUrls(
    urls: string[],
    cacheType: keyof typeof CACHE_POLICIES = "PRODUCT"
  ): Promise<void> {
    const newUrls = urls.filter(url => !this.preloadedImages.has(url));
    
    if (newUrls.length === 0) {
      return; // All images already preloaded
    }

    const cacheConfig = CACHE_POLICIES[cacheType];
    
    try {
      const preloadPromises = newUrls.map(async (url) => {
        // Check if already preloading
        if (this.preloadPromises.has(url)) {
          return this.preloadPromises.get(url);
        }

        // Create preload promise
        const promise = Image.prefetch(url, {
          cachePolicy: cacheConfig.cachePolicy,
          headers: {},
        }).then(() => {
          this.preloadedImages.add(url);
          this.preloadPromises.delete(url);
        }).catch((error) => {
          console.warn(`Failed to preload image: ${url}`, error);
          this.preloadPromises.delete(url);
        });

        this.preloadPromises.set(url, promise);
        return promise;
      });

      await Promise.allSettled(preloadPromises);
      
      if (__DEV__) {
        console.log(`Preloaded ${newUrls.length} images with ${cacheType} policy`);
      }
    } catch (error) {
      console.error("Failed to preload image URLs:", error);
    }
  }

  /**
   * Preload product images from Shopify products
   */
  async preloadProductImages(products: Array<{ images?: Array<{ src: string }> }>): Promise<void> {
    const imageUrls: string[] = [];
    
    products.forEach(product => {
      if (product.images) {
        product.images.forEach(image => {
          if (image.src) {
            imageUrls.push(image.src);
          }
        });
      }
    });

    if (imageUrls.length > 0) {
      await this.preloadImageUrls(imageUrls, "PRODUCT");
    }
  }

  /**
   * Preload event images
   */
  async preloadEventImages(events: Array<{ imgURL?: string }>): Promise<void> {
    const imageUrls = events
      .map(event => event.imgURL)
      .filter((url): url is string => !!url);

    if (imageUrls.length > 0) {
      await this.preloadImageUrls(imageUrls, "EVENT");
    }
  }

  /**
   * Get preload status
   */
  getPreloadStatus(): { total: number; loaded: number } {
    return {
      total: this.preloadedImages.size + this.preloadPromises.size,
      loaded: this.preloadedImages.size,
    };
  }

  /**
   * Clear preload cache
   */
  clearPreloadCache(): void {
    this.preloadedImages.clear();
    this.preloadPromises.clear();
  }
}

/**
 * Global instance for easy access
 */
export const imagePreloader = ImagePreloader.getInstance();
