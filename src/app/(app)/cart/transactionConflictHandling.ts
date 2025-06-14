/**
 * Transaction Conflict Handling Module Index
 *
 * This file exports all components and utilities for transaction conflict handling.
 */

// Components
export { default as CheckoutTransactionHandler } from "./components/CheckoutTransactionHandler";
export { default as TransactionConflictHandler } from "./components/TransactionConflictHandler";

// Hooks
export { useTransactionConflict } from "./hooks/useTransactionConflict";

// Utilities
export { runTransactionWithRetry } from "./utils/firestoreTransaction";
export {
  checkForConcurrentOperations,
  cleanupOperations,
  completeOperation,
  registerOperation,
  trackSession,
} from "./utils/sessionTracking";
export {
  createFieldConflictInfo,
  detectConcurrentModification,
  hasFieldChanged,
} from "./utils/transactionConflictDetection";
export { processOrderWithConflictHandling } from "./utils/transactionConflictExample";

// Types
export type { TransactionConflictInfo } from "./components/TransactionConflictHandler";
