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
  resolution?: string;
  conflictType?:
    | "concurrent-modification"
    | "data-changed"
    | "permission-issue"
    | "network-issue"
    | "other";
}

/**
 * Runs a Firestore transaction with retry capabilities and enhanced conflict detection
 *
 * @param db Firestore database instance
 * @param transactionFn Function that takes a transaction and performs the desired operations
 * @param options Additional options for the transaction
 * @returns Result of the transaction operation
 */
export async function runTransactionWithRetry<T>(
  db: Firestore,
  transactionFn: (transaction: Transaction) => Promise<T>,
  options: {
    maxRetries?: number;
    onConflictDetected?: (error: TransactionErrorInfo) => void;
    operationName?: string;
  } = {}
): Promise<T> {
  const {
    maxRetries = 3,
    onConflictDetected,
    operationName = "transaction",
  } = options;

  return retryWithBackoff(async () => {
    try {
      return await runTransaction(db, transactionFn);
    } catch (error: any) {
      // Translate Firestore transaction errors to more user-friendly formats
      const translatedError = translateTransactionError(error);

      // Add operation context to the error
      if (operationName) {
        translatedError.message = translatedError.message.replace(
          "transaction",
          operationName
        );

        if (translatedError.resolution) {
          translatedError.resolution = translatedError.resolution.replace(
            "transaction",
            operationName
          );
        }
      }

      // Log transaction error details for monitoring
      console.error("Transaction error:", {
        code: translatedError.code,
        message: translatedError.message,
        resolution: translatedError.resolution,
        conflictType: translatedError.conflictType,
        originalError: error,
      });

      // Notify conflict handler if provided
      if (onConflictDetected) {
        onConflictDetected(translatedError);
      }

      throw translatedError;
    }
  }, maxRetries);
}

/**
 * Translates Firestore transaction errors to more user-friendly formats
 * with enhanced guidance for recovery
 *
 * @param error The original Firestore error
 * @returns Translated error with user-friendly message and recovery guidance
 */
function translateTransactionError(error: any): TransactionErrorInfo {
  // Default error info
  const errorInfo: TransactionErrorInfo = {
    code: "transaction-failed",
    message: "The operation could not be completed. Please try again.",
    recoverable: true,
    originalError: error,
    resolution:
      "Try the operation one more time. If the problem persists, try refreshing the app.",
    conflictType: "other",
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
      message: "Network connection issue detected during transaction.",
      resolution:
        "Please check your internet connection, ensure you have a stable connection, and try again.",
      recoverable: true,
      conflictType: "network-issue",
    };
  }

  // Handle Firestore transaction specific errors
  const errorCode = error.code || "";

  if (errorCode.includes("aborted")) {
    return {
      ...errorInfo,
      code: "transaction-conflict",
      message: "Another update was in progress while processing your request.",
      resolution:
        "Someone else might be updating the same data. Wait a moment and try again.",
      recoverable: true,
      conflictType: "concurrent-modification",
    };
  }

  if (errorCode.includes("failed-precondition")) {
    return {
      ...errorInfo,
      code: "transaction-precondition-failed",
      message: "The data changed while processing your request.",
      resolution:
        "The information has been updated since you last loaded it. Please refresh the app and try again.",
      recoverable: true,
      conflictType: "data-changed",
    };
  }

  if (errorCode.includes("permission-denied")) {
    return {
      ...errorInfo,
      code: "permission-denied",
      message: "You don't have permission to perform this operation.",
      resolution:
        "Your session may have expired. Try signing out and back in, then try again.",
      recoverable: false,
      conflictType: "permission-issue",
    };
  }

  // Handle deadline exceeded errors
  if (errorCode.includes("deadline-exceeded")) {
    return {
      ...errorInfo,
      code: "transaction-timeout",
      message: "The operation took too long to complete.",
      resolution:
        "This might be due to slow internet connection. Try again when you have a stronger connection.",
      recoverable: true,
      conflictType: "network-issue",
    };
  }

  // Handle unavailable errors (often service-side issues)
  if (errorCode.includes("unavailable")) {
    return {
      ...errorInfo,
      code: "service-unavailable",
      message: "The service is temporarily unavailable.",
      resolution:
        "Our systems may be experiencing high traffic. Please wait a moment and try again.",
      recoverable: true,
      conflictType: "other",
    };
  }

  // Handle resource exhausted errors
  if (errorCode.includes("resource-exhausted")) {
    return {
      ...errorInfo,
      code: "quota-exceeded",
      message: "Service capacity limits reached.",
      resolution:
        "The system is experiencing high demand. Please try again in a few minutes.",
      recoverable: true,
      conflictType: "other",
    };
  }

  // Handle already exists errors
  if (errorCode.includes("already-exists")) {
    return {
      ...errorInfo,
      code: "duplicate-operation",
      message: "This operation has already been performed.",
      resolution:
        "The action you're trying to perform may have already completed. Refresh to see the latest changes.",
      recoverable: false,
      conflictType: "data-changed",
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
