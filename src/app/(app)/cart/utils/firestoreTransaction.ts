/**
 * Firestore Transaction Utilities
 *
 * This file contains utilities for handling Firestore transactions
 * with retry capabilities and error handling.
 */

import { Firestore, Transaction, runTransaction } from "firebase/firestore";
import { isNetworkError, retryWithBackoff } from "./networkErrorDetection";

interface TransactionErrorInfo {
  code: string;
  message: string;
  recoverable: boolean;
  originalError?: any;
}

/**
 * Runs a Firestore transaction with retry capabilities
 *
 * @param db Firestore database instance
 * @param transactionFn Function that takes a transaction and performs the desired operations
 * @param maxRetries Maximum number of retries for the transaction
 * @returns Result of the transaction operation
 */
export async function runTransactionWithRetry<T>(
  db: Firestore,
  transactionFn: (transaction: Transaction) => Promise<T>,
  maxRetries = 3
): Promise<T> {
  return retryWithBackoff(async () => {
    try {
      return await runTransaction(db, transactionFn);
    } catch (error: any) {
      // Translate Firestore transaction errors to more user-friendly formats
      const translatedError = translateTransactionError(error);

      // Log transaction error details for monitoring
      console.error("Transaction error:", {
        code: translatedError.code,
        message: translatedError.message,
        originalError: error,
      });

      throw translatedError;
    }
  }, maxRetries);
}

/**
 * Translates Firestore transaction errors to more user-friendly formats
 *
 * @param error The original Firestore error
 * @returns Translated error with user-friendly message
 */
function translateTransactionError(error: any): TransactionErrorInfo {
  // Default error info
  const errorInfo: TransactionErrorInfo = {
    code: "transaction-failed",
    message: "The operation could not be completed. Please try again.",
    recoverable: true,
    originalError: error,
  };

  // No error passed
  if (!error) {
    return errorInfo;
  }

  // Handle network errors
  if (isNetworkError(error)) {
    return {
      ...errorInfo,
      code: "network-error",
      message:
        "Network connection issue. Please check your connection and try again.",
      recoverable: true,
    };
  }

  // Handle Firestore transaction specific errors
  const errorCode = error.code || "";

  if (errorCode.includes("aborted")) {
    return {
      ...errorInfo,
      code: "transaction-conflict",
      message: "Another update was in progress. Please try again.",
      recoverable: true,
    };
  }

  if (errorCode.includes("failed-precondition")) {
    return {
      ...errorInfo,
      code: "transaction-precondition-failed",
      message:
        "The data changed while processing your request. Please refresh and try again.",
      recoverable: true,
    };
  }

  if (errorCode.includes("permission-denied")) {
    return {
      ...errorInfo,
      code: "permission-denied",
      message: "You don't have permission to perform this operation.",
      recoverable: false,
    };
  }

  return errorInfo;
}

/**
 * Example usage:
 *
 * await runTransactionWithRetry(db, async (transaction) => {
 *   // Get document references
 *   const orderRef = doc(db, 'orders', orderId);
 *   const inventoryRef = doc(db, 'inventory', productId);
 *
 *   // Read data in transaction
 *   const inventoryDoc = await transaction.get(inventoryRef);
 *
 *   if (!inventoryDoc.exists()) {
 *     throw new Error('Product not found');
 *   }
 *
 *   const inventory = inventoryDoc.data();
 *   if (inventory.stock < quantity) {
 *     throw new Error('Not enough stock');
 *   }
 *
 *   // Write data in transaction
 *   transaction.update(inventoryRef, { stock: inventory.stock - quantity });
 *   transaction.set(orderRef, orderData);
 *
 *   return { orderId };
 * });
 */
