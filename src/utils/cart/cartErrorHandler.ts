/**
 * Cart-specific error handler for write operations
 * Uses the general database error handler with cart-specific context
 */

import {
  getUserFriendlyPermissionMessage,
  handleWriteOperationError,
  verifyAuthForCartOperation,
} from "../../../../utils/databaseErrorHandler";

/**
 * Handles errors during cart checkout and order creation
 * Provides context-specific error messages
 *
 * @param error The error that occurred during checkout/order creation
 * @returns Structured error object with user-friendly message and recovery options
 */
export function handleCartOperationError(error: any) {
  // Get base error handling
  const baseError = handleWriteOperationError(error);

  // Add cart-specific context to permission errors
  if (baseError.code === "insufficient-permissions") {
    return {
      ...baseError,
      message: getUserFriendlyPermissionMessage(error, "checkout"),
    };
  }

  // Add more specific messaging for cart operations
  if (baseError.code === "data-validation-failed") {
    return {
      ...baseError,
      message:
        "Some items in your cart couldn't be validated. They may be out of stock or no longer available.",
    };
  }

  return baseError;
}

/**
 * Validates user authentication before cart checkout
 * Throws standardized errors that can be handled by handleCartOperationError
 *
 * @param userId Current user ID from auth state
 */
export function verifyCheckoutAuth(userId: string | null | undefined) {
  try {
    return verifyAuthForCartOperation(userId);
  } catch (error) {
    // Add cart-specific context to the error
    const enhancedError = error as any;
    enhancedError.context = "checkout";
    throw enhancedError;
  }
}

/**
 * Example usage of the error handling system for a cart checkout operation
 * This demonstrates the pattern to use throughout the cart system
 *
 * @param userId Current user ID from auth context
 * @param cartItems Items in the cart to process
 * @param db Firestore database instance
 * @returns Promise resolving to the created order ID or rejecting with handled error
 */
export async function exampleCheckoutWithErrorHandling(
  userId: string | null | undefined,
  cartItems: Array<any>,
  db: any // Firestore instance
): Promise<string> {
  try {
    // 1. Verify authentication first - this will throw a standardized error if not authenticated
    const verifiedUserId = verifyCheckoutAuth(userId);

    // 2. Prepare order data
    const orderData = {
      userId: verifiedUserId,
      items: cartItems,
      createdAt: new Date(),
      status: "pending",
    };

    // 3. Send to Firestore
    const orderRef = await db.collection("orders").add(orderData);
    return orderRef.id;
  } catch (error) {
    // 4. Handle any errors with our specialized handler
    const handledError = handleCartOperationError(error);

    // 5. Log the error (could be to analytics or monitoring service)
    console.error("Checkout error:", handledError.code, handledError.message);

    // 6. Re-throw with the user-friendly details
    throw handledError;
  }
}

/**
 * HOW TO USE IN COMPONENTS:
 *
 * try {
 *   const orderId = await exampleCheckoutWithErrorHandling(currentUser?.uid, cartItems, firestore);
 *   // Success handling
 * } catch (error: any) {
 *   // Display error.message to the user
 *   if (error.recoverable) {
 *     // Show retry button
 *     if (error.action === 'check-auth') {
 *       // Prompt user to login again
 *     } else if (error.action === 'check-connection') {
 *       // Show network troubleshooting guidance
 *     }
 *   } else {
 *     // Show contact support option
 *   }
 * }
 */
