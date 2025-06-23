/**
 * Offline Storage Utility
 *
 * Provides robust offline storage capabilities for cart items, user profile data,
 * and recently viewed products with automatic sync when connectivity is restored.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";

// Storage keys
const STORAGE_KEYS = {
  CART_OFFLINE: "ragestate_cart_offline",
  PROFILE_CACHE: "ragestate_profile_cache",
  PRODUCTS_CACHE: "ragestate_products_cache",
  OFFLINE_QUEUE: "ragestate_offline_queue",
  NETWORK_STATUS: "ragestate_network_status",
  LAST_SYNC: "ragestate_last_sync",
} as const;

// Types for offline data structures
export interface OfflineCartItem {
  productId: string;
  title: string;
  price: {
    amount: number;
    currencyCode: string;
  };
  selectedColor: string;
  selectedSize: string;
  selectedQuantity: number;
  image?: string;
  variantId?: string;
  eventDetails?: {
    dateTime: string;
    location: string;
    [key: string]: any;
  };
  addedAt: number; // Timestamp when added offline
}

export interface OfflineProfileData {
  uid: string;
  email?: string;
  firstName?: string;
  lastName?: string;
  displayName?: string;
  phoneNumber?: string;
  profilePicture?: string;
  preferences?: Record<string, any>;
  lastUpdated: number;
  cachedAt: number;
}

export interface CachedProduct {
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
  cachedAt: number;
  viewedAt: number; // When user last viewed this product
}

export interface OfflineOperation {
  id: string;
  type:
    | "cart_add"
    | "cart_remove"
    | "cart_update"
    | "profile_update"
    | "order_create";
  data: any;
  timestamp: number;
  retryCount: number;
  maxRetries: number;
  lastError?: string;
}

export interface NetworkStatus {
  isConnected: boolean;
  connectionType?: string;
  lastConnected?: number;
  lastDisconnected?: number;
}

/**
 * Core offline storage class
 */
export class OfflineStorage {
  private static instance: OfflineStorage;
  private networkStatus: NetworkStatus = { isConnected: true };
  private syncCallbacks: Array<() => Promise<void>> = [];

  private constructor() {
    this.initializeNetworkMonitoring();
  }

  static getInstance(): OfflineStorage {
    if (!OfflineStorage.instance) {
      OfflineStorage.instance = new OfflineStorage();
    }
    return OfflineStorage.instance;
  }

  /**
   * Initialize network monitoring
   */
  private initializeNetworkMonitoring() {
    NetInfo.addEventListener((state) => {
      const wasConnected = this.networkStatus.isConnected;
      this.networkStatus = {
        isConnected: state.isConnected ?? false,
        connectionType: state.type,
        lastConnected: state.isConnected
          ? Date.now()
          : this.networkStatus.lastConnected,
        lastDisconnected: !state.isConnected
          ? Date.now()
          : this.networkStatus.lastDisconnected,
      };

      // Save network status
      this.saveNetworkStatus();

      // If we just came back online, trigger sync
      if (!wasConnected && this.networkStatus.isConnected) {
        this.handleReconnection();
      }
    });
  }

  /**
   * Handle reconnection - sync offline data
   */
  private async handleReconnection() {
    // console.log("Network reconnected - starting offline sync");

    try {
      // Run all registered sync callbacks
      await Promise.all(
        this.syncCallbacks.map((callback) =>
          callback().catch((error) =>
            console.error("Sync callback failed:", error)
          )
        )
      );

      // Process offline queue
      await this.processOfflineQueue();

      // Update last sync timestamp
      await this.updateLastSyncTime();

      // console.log("Offline sync completed successfully");
    } catch (error) {
      console.error("Error during offline sync:", error);
    }
  }

  /**
   * Register a sync callback to run when network reconnects
   */
  registerSyncCallback(callback: () => Promise<void>) {
    this.syncCallbacks.push(callback);
  }

  /**
   * Get current network status
   */
  getNetworkStatus(): NetworkStatus {
    return this.networkStatus;
  }

  /**
   * Check if device is currently online
   */
  isOnline(): boolean {
    return this.networkStatus.isConnected;
  }

  // === CART OFFLINE STORAGE ===

  /**
   * Save cart items for offline access
   */
  async saveOfflineCart(items: OfflineCartItem[]): Promise<void> {
    try {
      const cartData = {
        items,
        savedAt: Date.now(),
        version: 1, // For future migration support
      };

      await AsyncStorage.setItem(
        STORAGE_KEYS.CART_OFFLINE,
        JSON.stringify(cartData)
      );
      // console.log(`Saved ${items.length} cart items offline`);
    } catch (error) {
      console.error("Failed to save offline cart:", error);
      throw error;
    }
  }

  /**
   * Get offline cart items
   */
  async getOfflineCart(): Promise<OfflineCartItem[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.CART_OFFLINE);
      if (!data) return [];

      const cartData = JSON.parse(data);
      return cartData.items || [];
    } catch (error) {
      console.error("Failed to get offline cart:", error);
      return [];
    }
  }

  /**
   * Add item to offline cart
   */
  async addToOfflineCart(
    item: Omit<OfflineCartItem, "addedAt">
  ): Promise<void> {
    try {
      const existingItems = await this.getOfflineCart();
      const newItem: OfflineCartItem = {
        ...item,
        addedAt: Date.now(),
      };

      // Check if item already exists (same product, color, size)
      const existingIndex = existingItems.findIndex(
        (existing) =>
          existing.productId === item.productId &&
          existing.selectedColor === item.selectedColor &&
          existing.selectedSize === item.selectedSize
      );

      if (existingIndex >= 0) {
        // Update quantity
        existingItems[existingIndex].selectedQuantity += item.selectedQuantity;
      } else {
        // Add new item
        existingItems.push(newItem);
      }

      await this.saveOfflineCart(existingItems);
    } catch (error) {
      console.error("Failed to add item to offline cart:", error);
      throw error;
    }
  }

  /**
   * Remove item from offline cart
   */
  async removeFromOfflineCart(
    productId: string,
    selectedColor: string,
    selectedSize: string
  ): Promise<void> {
    try {
      const existingItems = await this.getOfflineCart();
      const filteredItems = existingItems.filter(
        (item) =>
          !(
            item.productId === productId &&
            item.selectedColor === selectedColor &&
            item.selectedSize === selectedSize
          )
      );

      await this.saveOfflineCart(filteredItems);
    } catch (error) {
      console.error("Failed to remove item from offline cart:", error);
      throw error;
    }
  }

  /**
   * Clear offline cart
   */
  async clearOfflineCart(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.CART_OFFLINE);
    } catch (error) {
      console.error("Failed to clear offline cart:", error);
      throw error;
    }
  }

  // === PROFILE CACHE ===

  /**
   * Cache user profile data for offline access
   */
  async cacheProfileData(
    profile: Omit<OfflineProfileData, "cachedAt">
  ): Promise<void> {
    try {
      const cachedProfile: OfflineProfileData = {
        ...profile,
        cachedAt: Date.now(),
      };

      await AsyncStorage.setItem(
        STORAGE_KEYS.PROFILE_CACHE,
        JSON.stringify(cachedProfile)
      );
      // console.log("Profile data cached for offline access");
    } catch (error) {
      console.error("Failed to cache profile data:", error);
      throw error;
    }
  }

  /**
   * Get cached profile data
   */
  async getCachedProfile(): Promise<OfflineProfileData | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PROFILE_CACHE);
      if (!data) return null;

      const profile = JSON.parse(data);

      // Check if cache is still valid (24 hours)
      const maxAge = 24 * 60 * 60 * 1000; // 24 hours
      if (Date.now() - profile.cachedAt > maxAge) {
        await this.clearCachedProfile();
        return null;
      }

      return profile;
    } catch (error) {
      console.error("Failed to get cached profile:", error);
      return null;
    }
  }

  /**
   * Clear cached profile data
   */
  async clearCachedProfile(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PROFILE_CACHE);
    } catch (error) {
      console.error("Failed to clear cached profile:", error);
    }
  }

  // === PRODUCTS CACHE ===

  /**
   * Cache recently viewed products
   */
  async cacheProduct(
    product: Omit<CachedProduct, "cachedAt" | "viewedAt">
  ): Promise<void> {
    try {
      const cachedProduct: CachedProduct = {
        ...product,
        cachedAt: Date.now(),
        viewedAt: Date.now(),
      };

      const existingProducts = await this.getCachedProducts();

      // Remove existing product if it exists
      const filteredProducts = existingProducts.filter(
        (p) => p.id !== product.id
      );

      // Add to front of list
      filteredProducts.unshift(cachedProduct);

      // Keep only last 50 products
      const limitedProducts = filteredProducts.slice(0, 50);

      await AsyncStorage.setItem(
        STORAGE_KEYS.PRODUCTS_CACHE,
        JSON.stringify(limitedProducts)
      );
      // console.log(`Cached product: ${product.title}`);
    } catch (error) {
      console.error("Failed to cache product:", error);
      throw error;
    }
  }

  /**
   * Get all cached products
   */
  async getCachedProducts(): Promise<CachedProduct[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.PRODUCTS_CACHE);
      if (!data) return [];

      const products = JSON.parse(data);

      // Filter out products older than 7 days
      const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days
      const validProducts = products.filter(
        (product: CachedProduct) => Date.now() - product.cachedAt <= maxAge
      );

      // Update storage if we filtered out old products
      if (validProducts.length !== products.length) {
        await AsyncStorage.setItem(
          STORAGE_KEYS.PRODUCTS_CACHE,
          JSON.stringify(validProducts)
        );
      }

      return validProducts;
    } catch (error) {
      console.error("Failed to get cached products:", error);
      return [];
    }
  }

  /**
   * Get recently viewed products (sorted by view time)
   */
  async getRecentlyViewedProducts(
    limit: number = 10
  ): Promise<CachedProduct[]> {
    try {
      const products = await this.getCachedProducts();
      return products.sort((a, b) => b.viewedAt - a.viewedAt).slice(0, limit);
    } catch (error) {
      console.error("Failed to get recently viewed products:", error);
      return [];
    }
  }

  /**
   * Mark product as viewed (update viewed timestamp)
   */
  async markProductAsViewed(productId: string): Promise<void> {
    try {
      const products = await this.getCachedProducts();
      const productIndex = products.findIndex((p) => p.id === productId);

      if (productIndex >= 0) {
        products[productIndex].viewedAt = Date.now();
        await AsyncStorage.setItem(
          STORAGE_KEYS.PRODUCTS_CACHE,
          JSON.stringify(products)
        );
      }
    } catch (error) {
      console.error("Failed to mark product as viewed:", error);
    }
  }

  /**
   * Clear all cached products
   */
  async clearCachedProducts(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.PRODUCTS_CACHE);
    } catch (error) {
      console.error("Failed to clear cached products:", error);
    }
  }

  // === OFFLINE OPERATIONS QUEUE ===

  /**
   * Add operation to offline queue
   */
  async addToOfflineQueue(
    operation: Omit<OfflineOperation, "id" | "timestamp" | "retryCount">
  ): Promise<void> {
    try {
      const queue = await this.getOfflineQueue();
      const newOperation: OfflineOperation = {
        ...operation,
        id: `${operation.type}_${Date.now()}_${Math.random()
          .toString(36)
          .substr(2, 9)}`,
        timestamp: Date.now(),
        retryCount: 0,
      };

      queue.push(newOperation);
      await AsyncStorage.setItem(
        STORAGE_KEYS.OFFLINE_QUEUE,
        JSON.stringify(queue)
      );
      // console.log(`Added operation to offline queue: ${newOperation.type}`);
    } catch (error) {
      console.error("Failed to add operation to offline queue:", error);
      throw error;
    }
  }

  /**
   * Get offline operations queue
   */
  async getOfflineQueue(): Promise<OfflineOperation[]> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_QUEUE);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error("Failed to get offline queue:", error);
      return [];
    }
  }

  /**
   * Process offline operations queue when back online
   */
  async processOfflineQueue(): Promise<void> {
    if (!this.isOnline()) {
      // console.log("Cannot process offline queue - device is offline");
      return;
    }

    try {
      const queue = await this.getOfflineQueue();
      if (queue.length === 0) return;

      // console.log(`Processing ${queue.length} offline operations`);

      const processedOperations: string[] = [];

      for (const operation of queue) {
        try {
          await this.processOfflineOperation(operation);
          processedOperations.push(operation.id);
          // console.log(`Processed offline operation: ${operation.type}`);
        } catch (error) {
          console.error(`Failed to process operation ${operation.id}:`, error);

          // Increment retry count
          operation.retryCount++;
          operation.lastError =
            error instanceof Error ? error.message : String(error);

          // Remove operation if max retries exceeded
          if (operation.retryCount >= operation.maxRetries) {
            // console.log(
            //   `Max retries exceeded for operation ${operation.id}, removing from queue`
            // );
            processedOperations.push(operation.id);
          }
        }
      }

      // Remove processed operations from queue
      if (processedOperations.length > 0) {
        const remainingQueue = queue.filter(
          (op) => !processedOperations.includes(op.id)
        );
        await AsyncStorage.setItem(
          STORAGE_KEYS.OFFLINE_QUEUE,
          JSON.stringify(remainingQueue)
        );
      }
    } catch (error) {
      console.error("Failed to process offline queue:", error);
    }
  }

  /**
   * Process a single offline operation
   */
  private async processOfflineOperation(
    operation: OfflineOperation
  ): Promise<void> {
    // This method should be overridden by specific implementations
    // or use a callback system to handle different operation types
    // console.log(`Processing operation: ${operation.type}`, operation.data);

    // Placeholder - specific handlers should be implemented
    switch (operation.type) {
      case "cart_add":
        // Handle cart addition sync
        break;
      case "cart_remove":
        // Handle cart removal sync
        break;
      case "cart_update":
        // Handle cart update sync
        break;
      case "profile_update":
        // Handle profile update sync
        break;
      case "order_create":
        // Handle order creation sync
        break;
      default:
        console.warn(`Unknown operation type: ${operation.type}`);
    }
  }

  /**
   * Clear offline operations queue
   */
  async clearOfflineQueue(): Promise<void> {
    try {
      await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_QUEUE);
    } catch (error) {
      console.error("Failed to clear offline queue:", error);
    }
  }

  // === UTILITY METHODS ===

  /**
   * Save network status
   */
  private async saveNetworkStatus(): Promise<void> {
    try {
      await AsyncStorage.setItem(
        STORAGE_KEYS.NETWORK_STATUS,
        JSON.stringify(this.networkStatus)
      );
    } catch (error) {
      console.error("Failed to save network status:", error);
    }
  }

  /**
   * Update last sync timestamp
   */
  private async updateLastSyncTime(): Promise<void> {
    try {
      await AsyncStorage.setItem(STORAGE_KEYS.LAST_SYNC, Date.now().toString());
    } catch (error) {
      console.error("Failed to update last sync time:", error);
    }
  }

  /**
   * Get last sync timestamp
   */
  async getLastSyncTime(): Promise<number | null> {
    try {
      const data = await AsyncStorage.getItem(STORAGE_KEYS.LAST_SYNC);
      return data ? parseInt(data, 10) : null;
    } catch (error) {
      console.error("Failed to get last sync time:", error);
      return null;
    }
  }

  /**
   * Clear all offline data
   */
  async clearAllOfflineData(): Promise<void> {
    try {
      await Promise.all([
        this.clearOfflineCart(),
        this.clearCachedProfile(),
        this.clearCachedProducts(),
        this.clearOfflineQueue(),
        AsyncStorage.removeItem(STORAGE_KEYS.LAST_SYNC),
      ]);
      // console.log("All offline data cleared");
    } catch (error) {
      console.error("Failed to clear all offline data:", error);
    }
  }

  /**
   * Get storage usage statistics
   */
  async getStorageStats(): Promise<{
    cartItems: number;
    cachedProducts: number;
    queuedOperations: number;
    hasProfile: boolean;
    lastSync: number | null;
  }> {
    try {
      const [cart, products, queue, profile, lastSync] = await Promise.all([
        this.getOfflineCart(),
        this.getCachedProducts(),
        this.getOfflineQueue(),
        this.getCachedProfile(),
        this.getLastSyncTime(),
      ]);

      return {
        cartItems: cart.length,
        cachedProducts: products.length,
        queuedOperations: queue.length,
        hasProfile: profile !== null,
        lastSync,
      };
    } catch (error) {
      console.error("Failed to get storage stats:", error);
      return {
        cartItems: 0,
        cachedProducts: 0,
        queuedOperations: 0,
        hasProfile: false,
        lastSync: null,
      };
    }
  }
}

// Export singleton instance
export const offlineStorage = OfflineStorage.getInstance();

// Export helper functions for easier use
export const {
  saveOfflineCart,
  getOfflineCart,
  addToOfflineCart,
  removeFromOfflineCart,
  clearOfflineCart,
  cacheProfileData,
  getCachedProfile,
  clearCachedProfile,
  cacheProduct,
  getCachedProducts,
  getRecentlyViewedProducts,
  markProductAsViewed,
  clearCachedProducts,
  addToOfflineQueue,
  getOfflineQueue,
  processOfflineQueue,
  clearOfflineQueue,
  isOnline,
  getNetworkStatus,
  registerSyncCallback,
  getLastSyncTime,
  clearAllOfflineData,
  getStorageStats,
} = offlineStorage;
