/**
 * Order Processing Utilities
 *
 * This file contains utilities for idempotent order creation and order reconciliation
 * to ensure orders are properly created without duplicates.
 */

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  addDoc,
  collection,
  DocumentReference,
  Firestore,
  getDocs,
  query,
  QueryDocumentSnapshot,
  Timestamp,
  where,
} from "firebase/firestore";
import { retryWithBackoff } from "./networkErrorDetection";

// Storage keys
const ORDER_CREATION_KEY = "ragestate_order_creation_id";
const ORDER_TIMESTAMP_KEY = "ragestate_order_timestamp";

/**
 * Order data structure
 */
export interface OrderData {
  userId: string;
  items: any[];
  totalPrice: number;
  paymentIntentId?: string;
  shippingAddress?: any;
  createdAt: Timestamp | Date;
  status: string;
  [key: string]: any; // Allow additional fields
}

/**
 * Generates a unique idempotency key for an order
 *
 * @param userId User ID
 * @param cartItems Cart items
 * @param totalPrice Total price
 * @returns A unique string that can be used as an idempotency key
 */
export function generateOrderIdempotencyKey(
  userId: string,
  cartItems: any[],
  totalPrice: number
): string {
  // Create a deterministic string from the order details
  const itemIds = cartItems
    .map((item) => `${item.productId}:${item.selectedQuantity}`)
    .sort()
    .join("|");
  const base = `${userId}|${itemIds}|${totalPrice.toFixed(2)}|${Date.now()}`;

  // Create a simple hash of the base string
  let hash = 0;
  for (let i = 0; i < base.length; i++) {
    const char = base.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }

  return `order_${userId}_${Math.abs(hash).toString(16)}`;
}

/**
 * Stores the idempotency key for an in-progress order
 *
 * @param idempotencyKey The idempotency key for the order
 */
export async function saveOrderIdempotencyKey(
  idempotencyKey: string
): Promise<void> {
  try {
    await AsyncStorage.setItem(ORDER_CREATION_KEY, idempotencyKey);
    await AsyncStorage.setItem(ORDER_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.error("Failed to save order idempotency key:", error);
  }
}

/**
 * Retrieves the stored idempotency key for an in-progress order
 *
 * @returns The stored idempotency key or null if not found
 */
export async function getOrderIdempotencyKey(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(ORDER_CREATION_KEY);
  } catch (error) {
    console.error("Failed to retrieve order idempotency key:", error);
    return null;
  }
}

/**
 * Clears the stored idempotency key
 */
export async function clearOrderIdempotencyKey(): Promise<void> {
  try {
    await AsyncStorage.removeItem(ORDER_CREATION_KEY);
    await AsyncStorage.removeItem(ORDER_TIMESTAMP_KEY);
  } catch (error) {
    console.error("Failed to clear order idempotency key:", error);
  }
}

/**
 * Creates an order with idempotency to prevent duplicates
 *
 * @param db Firestore instance
 * @param userId User ID
 * @param orderData Order data to save
 * @param idempotencyKey Optional custom idempotency key
 * @returns Created order document reference
 */
export async function createOrderIdempotent(
  db: Firestore,
  userId: string,
  orderData: OrderData,
  idempotencyKey?: string
): Promise<DocumentReference> {
  // Generate or use provided idempotency key
  const orderKey =
    idempotencyKey ||
    generateOrderIdempotencyKey(userId, orderData.items, orderData.totalPrice);

  // Save the idempotency key for potential recovery
  await saveOrderIdempotencyKey(orderKey);

  // Add idempotency key to order data
  const enrichedOrderData = {
    ...orderData,
    idempotencyKey: orderKey,
    createdAt: Timestamp.now(), // Ensure consistent timestamp
    userId, // Ensure userId is included
  };

  // Check if an order with this idempotency key already exists
  // This prevents duplicate orders even if the client retries
  const existingOrderRef = await checkForExistingOrder(db, userId, orderKey);
  if (existingOrderRef) {
    // Order already exists, return the reference
    console.log(
      "Found existing order with same idempotency key, preventing duplicate"
    );
    clearOrderIdempotencyKey(); // Clear since we found the order
    return existingOrderRef;
  }

  // No existing order found, create a new one with retry capability
  return retryWithBackoff(async () => {
    const ordersRef = collection(db, "users", userId, "orders");
    const docRef = await addDoc(ordersRef, enrichedOrderData);

    // Clear idempotency key after successful creation
    await clearOrderIdempotencyKey();

    console.log("Order created successfully with ID:", docRef.id);
    return docRef;
  });
}

/**
 * Checks if an order with the specified idempotency key already exists
 *
 * @param db Firestore instance
 * @param userId User ID
 * @param idempotencyKey The idempotency key to check for
 * @returns The document reference if found, or null if not found
 */
async function checkForExistingOrder(
  db: Firestore,
  userId: string,
  idempotencyKey: string
): Promise<DocumentReference | null> {
  try {
    const ordersRef = collection(db, "users", userId, "orders");
    const q = query(ordersRef, where("idempotencyKey", "==", idempotencyKey));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      // Return the first matching document reference
      const docSnapshot = querySnapshot.docs[0];
      console.log(
        `Found existing order with idempotency key ${idempotencyKey}: ${docSnapshot.id}`
      );
      return docSnapshot.ref;
    }

    return null;
  } catch (error) {
    console.error("Error checking for existing order:", error);
    return null;
  }
}

/**
 * Performs order reconciliation to check if an order was actually created
 * when the client received an unclear result (e.g., network error)
 *
 * @param db Firestore instance
 * @param userId User ID
 * @param paymentIntentId Payment intent ID from Stripe
 * @returns Any matching order documents or empty array if none found
 */
export async function reconcileOrder(
  db: Firestore,
  userId: string,
  paymentIntentId: string
): Promise<QueryDocumentSnapshot[]> {
  try {
    const ordersRef = collection(db, "users", userId, "orders");
    const q = query(ordersRef, where("paymentIntentId", "==", paymentIntentId));
    const querySnapshot = await getDocs(q);

    if (!querySnapshot.empty) {
      console.log(
        `Found ${querySnapshot.size} orders with payment intent ID ${paymentIntentId}`
      );
      return querySnapshot.docs;
    }

    // Check if there's a stored idempotency key to try that as well
    const idempotencyKey = await getOrderIdempotencyKey();
    if (idempotencyKey) {
      console.log(
        "Checking for order with stored idempotency key:",
        idempotencyKey
      );
      const idempotencyQuery = query(
        ordersRef,
        where("idempotencyKey", "==", idempotencyKey)
      );
      const idempotencySnapshot = await getDocs(idempotencyQuery);

      if (!idempotencySnapshot.empty) {
        console.log(
          `Found ${idempotencySnapshot.size} orders with idempotency key ${idempotencyKey}`
        );
        return idempotencySnapshot.docs;
      }
    }

    return [];
  } catch (error) {
    console.error("Error reconciling order:", error);
    return [];
  }
}

/**
 * Performs a full order recovery check, trying to identify if an order was created
 * during a previous failed checkout attempt
 *
 * @param db Firestore instance
 * @param userId User ID
 * @param paymentIntentId Payment intent ID from Stripe (if available)
 * @returns Any matching order documents or empty array if none found
 */
export async function attemptOrderRecovery(
  db: Firestore,
  userId: string,
  paymentIntentId?: string
): Promise<{
  orders: QueryDocumentSnapshot[];
  recovered: boolean;
}> {
  try {
    // If we have a payment intent ID, try reconciling with that first
    if (paymentIntentId) {
      const paymentIntentOrders = await reconcileOrder(
        db,
        userId,
        paymentIntentId
      );
      if (paymentIntentOrders.length > 0) {
        return { orders: paymentIntentOrders, recovered: true };
      }
    }

    // Try with stored idempotency key
    const idempotencyKey = await getOrderIdempotencyKey();
    if (idempotencyKey) {
      console.log(
        "Attempting recovery with stored idempotency key:",
        idempotencyKey
      );
      const ordersRef = collection(db, "users", userId, "orders");
      const idempotencyQuery = query(
        ordersRef,
        where("idempotencyKey", "==", idempotencyKey)
      );
      const idempotencySnapshot = await getDocs(idempotencyQuery);

      if (!idempotencySnapshot.empty) {
        // Clear the idempotency key since we found the order
        await clearOrderIdempotencyKey();
        return { orders: idempotencySnapshot.docs, recovered: true };
      }
    }

    // Try checking orders created in the last hour (last resort)
    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const ordersRef = collection(db, "users", userId, "orders");
    const recentQuery = query(
      ordersRef,
      where("createdAt", ">=", Timestamp.fromDate(oneHourAgo))
    );

    const recentSnapshot = await getDocs(recentQuery);
    if (!recentSnapshot.empty) {
      // Note: This is less reliable as it may include other recent orders
      // We're not marking this as "recovered" since we can't be sure
      return { orders: recentSnapshot.docs, recovered: false };
    }

    return { orders: [], recovered: false };
  } catch (error) {
    console.error("Error during order recovery attempt:", error);
    return { orders: [], recovered: false };
  }
}
