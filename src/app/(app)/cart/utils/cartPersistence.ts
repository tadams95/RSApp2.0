import AsyncStorage from "@react-native-async-storage/async-storage";

const CART_STORAGE_KEY = "ragestate_cart_data";
const CHECKOUT_ERROR_KEY = "ragestate_last_checkout_error";
const CHECKOUT_TIMESTAMP_KEY = "ragestate_last_checkout_attempt";

/**
 * Saves the current cart state to AsyncStorage
 * @param cartItems The cart items to save
 * @param totalPrice The total price of the cart
 */
export const saveCartState = async (
  cartItems: any[],
  totalPrice: number
): Promise<void> => {
  try {
    const cartData = {
      items: cartItems,
      totalPrice,
      timestamp: Date.now(),
    };
    await AsyncStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartData));
    console.log("Cart state saved successfully");
  } catch (error) {
    console.error("Failed to save cart state:", error);
  }
};

/**
 * Retrieves the saved cart state from AsyncStorage
 * @returns The saved cart data or null if not found
 */
export const getCartState = async (): Promise<{
  items: any[];
  totalPrice: number;
  timestamp: number;
} | null> => {
  try {
    const savedCart = await AsyncStorage.getItem(CART_STORAGE_KEY);
    if (savedCart) {
      return JSON.parse(savedCart);
    }
    return null;
  } catch (error) {
    console.error("Failed to retrieve cart state:", error);
    return null;
  }
};

/**
 * Clears the saved cart state from AsyncStorage
 */
export const clearCartState = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CART_STORAGE_KEY);
    console.log("Cart state cleared successfully");
  } catch (error) {
    console.error("Failed to clear cart state:", error);
  }
};

/**
 * Saves information about a checkout error
 * @param errorInfo Object containing details about the error
 */
export const saveCheckoutError = async (errorInfo: {
  code: string;
  message: string;
  paymentIntentId?: string;
}): Promise<void> => {
  try {
    await AsyncStorage.setItem(CHECKOUT_ERROR_KEY, JSON.stringify(errorInfo));
    await AsyncStorage.setItem(CHECKOUT_TIMESTAMP_KEY, Date.now().toString());
    console.log("Checkout error saved");
  } catch (error) {
    console.error("Failed to save checkout error:", error);
  }
};

/**
 * Gets the last checkout error if one exists
 * @returns The error information or null if not found
 */
export const getLastCheckoutError = async (): Promise<{
  code: string;
  message: string;
  paymentIntentId?: string;
  timestamp: number;
} | null> => {
  try {
    const errorInfo = await AsyncStorage.getItem(CHECKOUT_ERROR_KEY);
    const timestamp = await AsyncStorage.getItem(CHECKOUT_TIMESTAMP_KEY);

    if (errorInfo && timestamp) {
      return {
        ...JSON.parse(errorInfo),
        timestamp: parseInt(timestamp, 10),
      };
    }
    return null;
  } catch (error) {
    console.error("Failed to retrieve checkout error:", error);
    return null;
  }
};

/**
 * Clears the saved checkout error
 */
export const clearCheckoutError = async (): Promise<void> => {
  try {
    await AsyncStorage.removeItem(CHECKOUT_ERROR_KEY);
    await AsyncStorage.removeItem(CHECKOUT_TIMESTAMP_KEY);
    console.log("Checkout error cleared");
  } catch (error) {
    console.error("Failed to clear checkout error:", error);
  }
};

/**
 * Determines if a saved cart is recent enough to be restored
 * Uses a 24-hour window by default
 */
export const isCartRecoverable = async (
  maxAgeMs = 24 * 60 * 60 * 1000
): Promise<boolean> => {
  const savedCart = await getCartState();
  if (!savedCart) return false;

  const currentTime = Date.now();
  const cartAge = currentTime - savedCart.timestamp;

  return cartAge <= maxAgeMs;
};

/**
 * Determines if there was a recent failed checkout
 * Uses a 1-hour window by default for considering an error as recent
 */
export const hasRecentCheckoutError = async (
  maxAgeMs = 60 * 60 * 1000
): Promise<boolean> => {
  const errorInfo = await getLastCheckoutError();
  if (!errorInfo) return false;

  const currentTime = Date.now();
  const errorAge = currentTime - errorInfo.timestamp;

  return errorAge <= maxAgeMs;
};
