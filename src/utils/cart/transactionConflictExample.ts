/**
 * Transaction Conflict Handling Example
 *
 * This file demonstrates how to implement the transaction conflict handling
 * in the cart checkout process.
 */

import { Firestore, Transaction, doc } from "firebase/firestore";
import { Alert } from "react-native";
import { runTransactionWithRetry } from "./firestoreTransaction";
import {
  checkForConcurrentOperations,
  completeOperation,
  registerOperation,
} from "./sessionTracking";

/**
 * Example of how to implement transaction conflict handling in the checkout process
 *
 * @param db Firestore instance
 * @param userId User ID
 * @param orderId Order ID
 * @param cartItems Cart items to process
 * @param onConflictDetected Callback for handling conflicts
 */
export async function processOrderWithConflictHandling(
  db: Firestore,
  userId: string,
  orderId: string,
  cartItems: any[],
  onConflictDetected?: (error: any) => void
): Promise<{ success: boolean; orderId?: string; error?: any }> {
  try {
    // Register this operation to detect concurrent attempts
    const operationId = await registerOperation("checkout", userId);

    // Check if there might be other concurrent operations
    const concurrentOps = await checkForConcurrentOperations(
      "checkout",
      userId
    );

    if (concurrentOps.hasConcurrentOperations && !concurrentOps.isSameDevice) {
      // Alert the user about potential conflicts
      return new Promise<{ success: boolean; orderId?: string; error?: any }>(
        (resolve, reject) => {
          Alert.alert(
            "Warning",
            "It appears you may have another checkout in progress on another device. " +
              "Continuing may cause conflicts. Do you want to proceed?",
            [
              {
                text: "Cancel",
                style: "cancel",
                onPress: async () => {
                  await completeOperation(operationId);
                  reject(
                    new Error("Checkout canceled due to potential conflict")
                  );
                },
              },
              {
                text: "Continue",
                onPress: () => {
                  // Continue with checkout by proceeding with the normal flow
                  console.log(
                    "User chose to continue despite potential conflict"
                  );
                  // Just let the code continue to the transaction part
                  resolve({ success: true });
                },
              },
            ],
            { cancelable: false }
          );
        }
      );
    }

    // Start the transaction with conflict handling
    const result = await runTransactionWithRetry(
      db,
      async (transaction: Transaction) => {
        // 1. Get the user document to check its current state
        const userRef = doc(db, "users", userId);
        const userDoc = await transaction.get(userRef);

        if (!userDoc.exists()) {
          throw new Error("User not found");
        }

        // 2. Get inventory documents for each product
        const inventoryPromises = cartItems.map(async (item) => {
          const inventoryRef = doc(db, "inventory", item.productId);
          return {
            ref: inventoryRef,
            doc: await transaction.get(inventoryRef),
            item,
          };
        });

        const inventoryResults = await Promise.all(inventoryPromises);

        // 3. Check for concurrent modifications on inventory
        // This is a more advanced check than the automatic Firestore transaction
        // conflict detection - it provides more specific information about what changed

        /*
         * NOTE: In a real implementation, you would retrieve the cached client-side inventory data
         * that was saved when the user added the items to their cart and compare it with the
         * current server-side inventory data to detect conflicts. For example:
         *
         * const clientCachedInventory = await retrieveClientInventoryCache();
         *
         * This example assumes we don't have previously cached inventory data.
         */

        for (const { doc: serverDoc, item } of inventoryResults) {
          // Check current server data against cart item data
          // In a real app with cached inventory, you would use:
          // const cachedItem = clientCachedInventory.get(item.productId);
          const productId = item.productId;

          // Skip if the product doesn't exist
          if (!serverDoc.exists()) {
            throw {
              code: "not-found",
              message: `Product "${item.productName}" is no longer available.`,
              resolution:
                "Please remove this item from your cart and try again.",
            };
          }

          const serverData = serverDoc.data();

          // Check if there's enough inventory
          if (serverData.stock < item.quantity) {
            throw {
              code: "inventory-insufficient",
              message: `Only ${serverData.stock} units of "${item.productName}" are available.`,
              detail: `You requested ${item.quantity} units.`,
              resolution: "Please update your cart quantity and try again.",
              conflictType: "data-changed",
            };
          }

          // Check if price has changed (simulated conflict)
          if (serverData.price !== item.price) {
            throw {
              code: "price-changed",
              message: `The price of "${item.productName}" has changed.`,
              detail: `Current price: $${serverData.price.toFixed(
                2
              )}, Your cart price: $${item.price.toFixed(2)}`,
              resolution:
                "Please reload the product page to see the updated price.",
              conflictType: "data-changed",
            };
          }
        }

        // 4. Process the order
        // Subtract from inventory
        for (const { ref, doc, item } of inventoryResults) {
          const data = doc.data();
          if (!data) {
            throw {
              code: "data-missing",
              message: `Could not retrieve data for product "${item.productName}".`,
              resolution:
                "Please try again or remove this item from your cart.",
            };
          }
          const currentStock = data.stock;
          transaction.update(ref, {
            stock: currentStock - item.quantity,
          });
        }

        // Create order document
        const orderRef = doc(db, "users", userId, "orders", orderId);
        transaction.set(orderRef, {
          items: cartItems,
          status: "processing",
          createdAt: new Date(),
          updatedAt: new Date(),
          userId,
        });

        return {
          success: true,
          orderId,
        };
      },
      {
        maxRetries: 1, // We'll handle retries through the UI
        onConflictDetected,
        operationName: "checkout",
      }
    );

    // Mark operation as completed
    await completeOperation(operationId);

    return result;
  } catch (error) {
    console.error("Error in processOrderWithConflictHandling:", error);

    // If the error wasn't already handled by onConflictDetected
    if (onConflictDetected && error) {
      onConflictDetected(error);
    }

    return {
      success: false,
      error,
    };
  }
}
