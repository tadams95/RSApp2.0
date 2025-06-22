/**
 * Transaction Conflict Handling Module Index
 *
 * This file exports all components and utilities for transaction conflict handling.
 */

// Components
export { default as CheckoutTransactionHandler } from "./components/CheckoutTransactionHandler";
export { default as TransactionConflictHandler } from "./components/TransactionConflictHandler";

// Hooks
export { useTransactionConflict } from "../../hooks/cart/useTransactionConflict";

// Utilities
export { runTransactionWithRetry } from "./firestoreTransaction";
export {
  checkForConcurrentOperations,
  cleanupOperations,
  completeOperation,
  registerOperation,
  trackSession,
} from "./sessionTracking";
export {
  createFieldConflictInfo,
  detectConcurrentModification,
  hasFieldChanged,
} from "./transactionConflictDetection";
export { processOrderWithConflictHandling } from "./transactionConflictExample";

// Types
export type { TransactionConflictInfo } from "../../app/(app)/cart/components/TransactionConflictHandler";
