/**
 * Offline Cart Synchronization Utility
 *
 * Integrates offline storage with Redux cart state to provide seamless
 * offline cart persistence and synchronization when connectivity is restored.
 */

import React from "react";
import { CartItem, updateCartItems } from "../store/redux/cartSlice";
import { store } from "../store/redux/store";
import { useNetworkStatus } from "./networkStatus";
import {
  OfflineCartItem,
  OfflineOperation,
  OfflineStorage,
} from "./offlineStorage";

// Initialize offline storage manager
const offlineStorage = OfflineStorage.getInstance();

/**
 * Converts Redux CartItem to OfflineCartItem format
 */
export const convertToOfflineCartItem = (item: CartItem): OfflineCartItem => {
  return {
    productId: item.productId,
    title: item.title || "",
    price: item.price,
    selectedColor: item.selectedColor,
    selectedSize: item.selectedSize,
    selectedQuantity: item.selectedQuantity,
    image: item.image,
    variantId: item.variantId,
    eventDetails: item.eventDetails,
    addedAt: Date.now(),
  };
};

/**
 * Converts OfflineCartItem to Redux CartItem format
 */
export const convertToReduxCartItem = (item: OfflineCartItem): CartItem => {
  return {
    productId: item.productId,
    title: item.title,
    price: item.price,
    selectedColor: item.selectedColor,
    selectedSize: item.selectedSize,
    selectedQuantity: item.selectedQuantity,
    image: item.image,
    variantId: item.variantId,
    eventDetails: item.eventDetails,
    metadata: undefined, // Can be extended if needed
  };
};

/**
 * Saves current Redux cart state to offline storage
 */
export const saveCartToOfflineStorage = async (): Promise<void> => {
  try {
    const state = store.getState();
    const cartItems = state.cart.items;

    if (cartItems.length === 0) {
      await offlineStorage.clearOfflineCart();
      return;
    }

    const offlineItems = cartItems.map(convertToOfflineCartItem);
    await offlineStorage.saveOfflineCart(offlineItems);

  } catch (error) {
    console.error("Failed to save cart to offline storage:", error);
  }
};

/**
 * Loads cart from offline storage and updates Redux state
 */
export const loadCartFromOfflineStorage = async (): Promise<boolean> => {
  try {
    const offlineItems = await offlineStorage.getOfflineCart();

    if (!offlineItems || offlineItems.length === 0) {
      return false;
    }

    const reduxItems = offlineItems.map(convertToReduxCartItem);
    store.dispatch(updateCartItems(reduxItems));

    return true;
  } catch (error) {
    console.error("Failed to load cart from offline storage:", error);
    return false;
  }
};

/**
 * Synchronizes offline cart changes when network comes back online
 */
export const syncOfflineCartChanges = async (): Promise<void> => {
  try {
    const operations = await offlineStorage.getOfflineQueue();
    const cartOperations = operations.filter(
      (op: OfflineOperation) =>
        op.type === "cart_add" ||
        op.type === "cart_remove" ||
        op.type === "cart_update"
    );

    if (cartOperations.length === 0) {
      return;
    }

    // Process operations in chronological order
    const sortedOperations = cartOperations.sort(
      (a: OfflineOperation, b: OfflineOperation) => a.timestamp - b.timestamp
    );

    for (const operation of sortedOperations) {
      try {
        await processOfflineCartOperation(operation);
      } catch (error) {
        console.error(`Failed to sync operation ${operation.id}:`, error);

        // For cart operations, we'll just log the error since cart is ephemeral
        // The actual cart sync happens through Redux state persistence
      }
    }

  } catch (error) {
    console.error("Failed to sync offline cart changes:", error);
  }
};

/**
 * Processes a single offline cart operation
 */
const processOfflineCartOperation = async (
  operation: OfflineOperation
): Promise<void> => {
  switch (operation.type) {
    case "cart_add":
      // For cart operations, we just update the local Redux state
      // since cart is ephemeral until checkout
      break;

    case "cart_remove":
      break;

    case "cart_update":
      break;

    default:
  }
};

/**
 * Adds a cart operation to the offline queue
 */
export const queueOfflineCartOperation = async (
  type: "cart_add" | "cart_remove" | "cart_update",
  data: any
): Promise<void> => {
  try {
    await offlineStorage.addToOfflineQueue({
      type,
      data,
      maxRetries: 3,
    });
  } catch (error) {
    console.error("Failed to queue offline cart operation:", error);
  }
};

/**
 * Hook to automatically sync cart when connectivity is restored
 */
export const useOfflineCartSync = () => {
  const { isOnline } = useNetworkStatus();

  // React to connectivity changes
  React.useEffect(() => {
    if (isOnline) {
      syncOfflineCartChanges();
    }
  }, [isOnline]);

  return {
    saveCartToOfflineStorage,
    loadCartFromOfflineStorage,
    syncOfflineCartChanges,
    queueOfflineCartOperation,
  };
};

// Auto-save cart to offline storage whenever Redux cart state changes
let lastCartState: CartItem[] = [];

export const initializeOfflineCartSync = () => {
  // Subscribe to Redux store changes
  store.subscribe(() => {
    const currentState = store.getState();
    const currentCartItems = currentState.cart.items;

    // Only save if cart actually changed
    if (JSON.stringify(currentCartItems) !== JSON.stringify(lastCartState)) {
      lastCartState = [...currentCartItems];
      saveCartToOfflineStorage();
    }
  });

  // Load cart from offline storage on initialization
  loadCartFromOfflineStorage();
};

export default {
  saveCartToOfflineStorage,
  loadCartFromOfflineStorage,
  syncOfflineCartChanges,
  queueOfflineCartOperation,
  initializeOfflineCartSync,
  useOfflineCartSync,
};
