/**
 * Hook for managing transaction conflicts in the application
 * Provides state and handlers for transaction conflict UI components
 */

import { useCallback, useState } from "react";
import { TransactionConflictInfo } from "../components/TransactionConflictHandler";

interface UseTransactionConflictOptions {
  onResolve?: () => void;
  onCancel?: () => void;
  maxRetries?: number;
}

export function useTransactionConflict({
  onResolve,
  onCancel,
  maxRetries = 3,
}: UseTransactionConflictOptions = {}) {
  // State for tracking conflict information
  const [conflictInfo, setConflictInfo] =
    useState<TransactionConflictInfo | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [operationCompleted, setOperationCompleted] = useState(false);

  /**
   * Handle a transaction error by showing conflict information
   */
  const handleTransactionError = useCallback((error: any) => {
    // If we have specific transaction error info
    if (error?.code && error?.message) {
      setConflictInfo({
        code: error.code,
        message: error.message,
        detail: error.detail,
        resolution: error.resolution || "Please try the operation again.",
      });
    } else {
      // Generic error handling
      setConflictInfo({
        code: "unknown-error",
        message: "An unexpected error occurred during the transaction.",
        resolution:
          "Please try again. If the problem persists, try refreshing the app.",
      });
    }

    setIsResolving(false);
  }, []);

  /**
   * Retry the transaction operation
   */
  const handleRetry = useCallback(async () => {
    if (retryCount >= maxRetries) {
      setConflictInfo({
        code: "max-retries",
        message: "Maximum retry attempts reached.",
        resolution: "Please refresh the app and try again later.",
      });
      return;
    }

    setIsResolving(true);
    setRetryCount((prev) => prev + 1);

    try {
      // Execute the resolve callback if provided
      if (onResolve) {
        await onResolve();
      }

      // If we get here, the operation was successful
      setConflictInfo(null);
      setIsResolving(false);
      setOperationCompleted(true);
    } catch (error) {
      // If the retry fails, show the error again
      handleTransactionError(error);
    }
  }, [retryCount, maxRetries, onResolve, handleTransactionError]);

  /**
   * Cancel the transaction operation
   */
  const handleCancel = useCallback(() => {
    setConflictInfo(null);
    if (onCancel) {
      onCancel();
    }
  }, [onCancel]);

  /**
   * Reset the conflict state
   */
  const resetConflict = useCallback(() => {
    setConflictInfo(null);
    setIsResolving(false);
    setRetryCount(0);
    setOperationCompleted(false);
  }, []);

  return {
    conflictInfo,
    isResolving,
    retryCount,
    operationCompleted,
    handleTransactionError,
    handleRetry,
    handleCancel,
    resetConflict,
    setConflictInfo,
  };
}
