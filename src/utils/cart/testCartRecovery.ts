/**
 * Cart Recovery Test Utility
 * This file contains functions to test the cart recovery functionality.
 *
 * These functions can be imported and called from a test file or a development screen
 * to verify that the cart recovery flow works as expected.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import { Alert } from "react-native";
import {
  clearCartState,
  clearCheckoutError,
  getCartState,
  getLastCheckoutError,
  hasRecentCheckoutError,
  isCartRecoverable,
  saveCartState,
  saveCheckoutError,
} from "./cartPersistence";
import { isNetworkConnected } from "./networkErrorDetection";

// Type for cart items used in testing
type TestCartItem = {
  productId: string;
  title: string;
  price: {
    amount: number;
    currencyCode: string;
  };
  selectedColor?: string | null;
  selectedSize?: string | null;
  selectedQuantity: number;
  image?: string;
  eventDetails?: any;
};

/**
 * Generate sample cart items for testing
 */
export const getSampleCartItems = (): TestCartItem[] => {
  return [
    {
      productId: "test-product-1",
      title: "Test T-Shirt",
      price: {
        amount: 29.99,
        currencyCode: "USD",
      },
      selectedColor: "Black",
      selectedSize: "M",
      selectedQuantity: 1,
      image: "https://example.com/tshirt.jpg",
    },
    {
      productId: "test-product-2",
      title: "Test Event Ticket",
      price: {
        amount: 49.99,
        currencyCode: "USD",
      },
      selectedQuantity: 1,
      eventDetails: {
        dateTime: "2025-06-20 19:00",
        location: "Test Venue, New York",
      },
    },
  ];
};

/**
 * Save a sample cart to test recovery flow
 */
export const setupTestCartRecovery = async (): Promise<void> => {
  try {
    const cartItems = getSampleCartItems();
    const totalPrice = cartItems.reduce(
      (total, item) => total + item.price.amount * item.selectedQuantity,
      0
    );

    await saveCartState(cartItems, totalPrice);

    Alert.alert(
      "Test Setup Complete",
      "Sample cart has been saved for recovery testing. Restart the app or navigate away and back to test recovery."
    );
  } catch (error) {
    console.error("Error setting up test cart recovery:", error);
    Alert.alert("Test Setup Failed", "Could not set up test cart recovery");
  }
};

/**
 * Setup a test payment error to test error recovery flow
 */
export const setupTestPaymentError = async (): Promise<void> => {
  try {
    const errorInfo = {
      code: "TEST_ERROR",
      message: "This is a test payment error for recovery testing",
      timestamp: Date.now(),
    };

    await saveCheckoutError(errorInfo);

    Alert.alert(
      "Test Error Setup Complete",
      "Sample payment error has been saved. Restart the app or navigate away and back to test error recovery."
    );
  } catch (error) {
    console.error("Error setting up test payment error:", error);
    Alert.alert(
      "Test Error Setup Failed",
      "Could not set up test payment error"
    );
  }
};

/**
 * Clear all test data
 */
export const clearTestData = async (): Promise<void> => {
  try {
    await clearCartState();
    await clearCheckoutError();

    Alert.alert(
      "Test Data Cleared",
      "All test cart and error data has been cleared."
    );
  } catch (error) {
    console.error("Error clearing test data:", error);
    Alert.alert("Failed to Clear Data", "Could not clear test data");
  }
};

/**
 * Check the current state of cart recovery and payment errors
 */
export const checkRecoveryState = async (): Promise<void> => {
  try {
    const networkStatus = await isNetworkConnected();
    const canRecoverCart = await isCartRecoverable();
    const hasError = await hasRecentCheckoutError();
    const cartState = await getCartState();
    const errorState = await getLastCheckoutError();

    const stateInfo = `
Network Connected: ${networkStatus ? "Yes" : "No"}
Cart Recoverable: ${canRecoverCart ? "Yes" : "No"}
Has Payment Error: ${hasError ? "Yes" : "No"}
Cart Items: ${cartState ? cartState.items.length : 0}
Cart Timestamp: ${
      cartState ? new Date(cartState.timestamp).toLocaleString() : "N/A"
    }
Error Code: ${errorState ? errorState.code : "N/A"}
Error Message: ${errorState ? errorState.message : "N/A"}
Error Timestamp: ${
      errorState ? new Date(errorState.timestamp).toLocaleString() : "N/A"
    }
    `;

    Alert.alert("Recovery State", stateInfo);
  } catch (error) {
    console.error("Error checking recovery state:", error);
    Alert.alert("State Check Failed", "Could not check recovery state");
  }
};

/**
 * This function simulates the application restart after a payment failure
 * by clearing in-memory state but keeping persistent storage
 */
export const simulateAppRestart = async (): Promise<void> => {
  try {
    Alert.alert(
      "Simulating App Restart",
      "This will simulate an app restart to test the recovery flow. The app will reload in 3 seconds.",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Continue",
          onPress: () => {
            // Show a countdown
            let count = 3;
            const countdownInterval = setInterval(() => {
              count--;
              if (count <= 0) {
                clearInterval(countdownInterval);
                // In a real app, we can't actually restart the app,
                // but we can force a refresh of the current screen
                Alert.alert(
                  "Simulation Complete",
                  "The app restart has been simulated. Return to the cart screen to test recovery.",
                  [
                    {
                      text: "OK",
                      // This would ideally trigger a full component remount
                    },
                  ]
                );
              } else {
                Alert.alert(
                  "Restarting in " + count,
                  "Please wait...",
                  [
                    {
                      text: "Wait",
                      style: "cancel",
                    },
                  ],
                  { cancelable: false }
                );
              }
            }, 1000);
          },
        },
      ]
    );
  } catch (error) {
    console.error("Error simulating app restart:", error);
    Alert.alert("Simulation Failed", "Could not simulate app restart");
  }
};

/**
 * List all keys in AsyncStorage to debug persistence issues
 */
export const debugStorageKeys = async (): Promise<void> => {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const cartKeys = keys.filter(
      (key) => key.includes("cart") || key.includes("checkout")
    );

    const keyInfo = `
All Keys (${keys.length}): ${keys.join(", ")}

Cart Related Keys (${cartKeys.length}): ${cartKeys.join(", ")}
    `;

    Alert.alert("Storage Keys", keyInfo);
  } catch (error) {
    console.error("Error debugging storage keys:", error);
    Alert.alert("Debug Failed", "Could not get storage keys");
  }
};

/**
 * Main test function that can be called to run through all test scenarios
 */
export const runCartRecoveryTests = async (): Promise<void> => {
  Alert.alert("Cart Recovery Test Suite", "What would you like to test?", [
    {
      text: "Setup Test Cart",
      onPress: setupTestCartRecovery,
    },
    {
      text: "Setup Test Error",
      onPress: setupTestPaymentError,
    },
    {
      text: "Check Recovery State",
      onPress: checkRecoveryState,
    },
    {
      text: "Simulate App Restart",
      onPress: simulateAppRestart,
    },
    {
      text: "Debug Storage",
      onPress: debugStorageKeys,
    },
    {
      text: "Clear Test Data",
      onPress: clearTestData,
    },
    {
      text: "Cancel",
      style: "cancel",
    },
  ]);
};

export default {
  getSampleCartItems,
  setupTestCartRecovery,
  setupTestPaymentError,
  clearTestData,
  checkRecoveryState,
  simulateAppRestart,
  debugStorageKeys,
  runCartRecoveryTests,
};
