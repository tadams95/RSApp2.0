/**
 * Offline Product Data Management
 *
 * Provides caching and offline access to recently viewed products for shop browsing.
 */

import React from "react";
import { useNetworkStatus } from "./networkStatus";
import { CachedProduct, OfflineStorage } from "./offlineStorage";

// Initialize offline storage manager
const offlineStorage = OfflineStorage.getInstance();

/**
 * Interface for product data that matches the app's Shopify product structure
 */
export interface ShopifyProduct {
  id: string;
  title: string;
  handle: string;
  descriptionHtml?: string;
  images: Array<{
    url: string;
    altText?: string;
  }>;
  variants: Array<{
    id: string;
    title?: string;
    price: {
      amount: string;
      currencyCode: string;
    };
    availableForSale: boolean;
    selectedOptions?: Array<{
      name: string;
      value: string;
    }>;
  }>;
  [key: string]: any; // Allow for additional Shopify fields
}

/**
 * Converts ShopifyProduct to CachedProduct format
 */
export const convertToCachedProduct = (
  product: ShopifyProduct
): CachedProduct => {
  return {
    id: product.id,
    title: product.title,
    handle: product.handle,
    descriptionHtml: product.descriptionHtml,
    images: product.images,
    variants: product.variants,
    cachedAt: Date.now(),
    viewedAt: Date.now(),
  };
};

/**
 * Converts CachedProduct to ShopifyProduct format
 */
export const convertFromCachedProduct = (
  cachedProduct: CachedProduct
): ShopifyProduct => {
  return {
    id: cachedProduct.id,
    title: cachedProduct.title,
    handle: cachedProduct.handle,
    descriptionHtml: cachedProduct.descriptionHtml,
    images: cachedProduct.images,
    variants: cachedProduct.variants,
  };
};

/**
 * Caches a recently viewed product
 */
export const cacheViewedProduct = async (
  product: ShopifyProduct
): Promise<void> => {
  try {
    const cachedProduct = convertToCachedProduct(product);
    await offlineStorage.cacheProduct(cachedProduct);
    // console.log(`Product ${product.title} cached for offline viewing`);
  } catch (error) {
    console.error("Failed to cache product:", error);
  }
};

/**
 * Gets cached recently viewed products
 */
export const getCachedProducts = async (
  limit: number = 20
): Promise<ShopifyProduct[]> => {
  try {
    const cachedProducts = await offlineStorage.getRecentlyViewedProducts(
      limit
    );
    return cachedProducts.map(convertFromCachedProduct);
  } catch (error) {
    console.error("Failed to get cached products:", error);
    return [];
  }
};

/**
 * Gets a specific cached product by ID or handle
 */
export const getCachedProduct = async (
  productId: string
): Promise<ShopifyProduct | null> => {
  try {
    const cachedProducts = await offlineStorage.getCachedProducts();
    const found = cachedProducts.find(
      (p) => p.id === productId || p.handle === productId
    );

    if (found) {
      // Update viewed timestamp
      found.viewedAt = Date.now();
      await offlineStorage.cacheProduct(found);
      return convertFromCachedProduct(found);
    }

    return null;
  } catch (error) {
    console.error("Failed to get cached product:", error);
    return null;
  }
};

/**
 * Clears old cached products (keeping only recent ones)
 */
export const clearOldCachedProducts = async (): Promise<void> => {
  try {
    // The getCachedProducts method automatically filters out old products
    await offlineStorage.getCachedProducts();
    // console.log("Old cached products cleared automatically");
  } catch (error) {
    console.error("Failed to clear old cached products:", error);
  }
};

/**
 * Updates a cached product's view timestamp
 */
export const updateProductViewTimestamp = async (
  productId: string
): Promise<void> => {
  try {
    await offlineStorage.markProductAsViewed(productId);
  } catch (error) {
    console.error("Failed to update product view timestamp:", error);
  }
};

/**
 * React hook for managing offline product data in shop screens
 */
export const useOfflineProducts = (
  onlineProducts?: ShopifyProduct[] | null
) => {
  const [cachedProducts, setCachedProducts] = React.useState<ShopifyProduct[]>(
    []
  );
  const [isLoading, setIsLoading] = React.useState(true);
  const { isOnline } = useNetworkStatus();

  // Load cached products on mount
  React.useEffect(() => {
    const loadCachedProducts = async () => {
      try {
        const cached = await getCachedProducts();
        setCachedProducts(cached);
      } catch (error) {
        console.error("Failed to load cached products:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCachedProducts();
  }, []);

  // Cache online products when available
  React.useEffect(() => {
    if (onlineProducts && isOnline && onlineProducts.length > 0) {
      // Cache each product asynchronously
      onlineProducts.forEach((product) => {
        cacheViewedProduct(product).catch((error) =>
          console.error(`Failed to cache product ${product.title}:`, error)
        );
      });

      setCachedProducts(onlineProducts);
    }
  }, [onlineProducts, isOnline]);

  // Clean up old cached products periodically
  React.useEffect(() => {
    if (isOnline) {
      clearOldCachedProducts().catch((error) =>
        console.error("Failed to clear old cached products:", error)
      );
    }
  }, [isOnline]);

  return {
    // Use online products if available and online, otherwise use cached
    products: isOnline && onlineProducts ? onlineProducts : cachedProducts,
    cachedProducts,
    isLoading,
    isOffline: !isOnline,
    hasOfflineData: cachedProducts.length > 0,
    cacheProduct: cacheViewedProduct,
    updateViewTimestamp: updateProductViewTimestamp,
  };
};

/**
 * React hook for managing a single product's offline data
 */
export const useOfflineProduct = (
  productId?: string,
  onlineProduct?: ShopifyProduct | null
) => {
  const [cachedProduct, setCachedProduct] =
    React.useState<ShopifyProduct | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const { isOnline } = useNetworkStatus();

  // Load cached product on mount or when productId changes
  React.useEffect(() => {
    if (!productId) {
      setIsLoading(false);
      return;
    }

    const loadCachedProduct = async () => {
      try {
        const cached = await getCachedProduct(productId);
        setCachedProduct(cached);
      } catch (error) {
        console.error("Failed to load cached product:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCachedProduct();
  }, [productId]);

  // Cache online product when available
  React.useEffect(() => {
    if (onlineProduct && isOnline) {
      cacheViewedProduct(onlineProduct).catch((error) =>
        console.error(`Failed to cache product ${onlineProduct.title}:`, error)
      );
      setCachedProduct(onlineProduct);
    }
  }, [onlineProduct, isOnline]);

  return {
    // Use online product if available and online, otherwise use cached
    product: isOnline && onlineProduct ? onlineProduct : cachedProduct,
    cachedProduct,
    isLoading,
    isOffline: !isOnline,
    hasOfflineData: cachedProduct !== null,
  };
};

export default {
  cacheViewedProduct,
  getCachedProducts,
  getCachedProduct,
  clearOldCachedProducts,
  updateProductViewTimestamp,
  useOfflineProducts,
  useOfflineProduct,
};
