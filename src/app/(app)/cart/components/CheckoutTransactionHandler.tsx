/**
 * CheckoutTransactionHandler Component
 *
 * Provides a wrapper to handle transaction conflicts during checkout
 * with appropriate UI feedback and recovery options.
 */

import { Firestore, Transaction } from "firebase/firestore";
import React, { ReactNode, useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTransactionConflict } from "../../../../hooks/cart/useTransactionConflict";
import { runTransactionWithRetry } from "../../../../utils/cart/firestoreTransaction";
import TransactionConflictHandler from "./TransactionConflictHandler";

interface CheckoutTransactionHandlerProps {
  db: Firestore;
  children: ReactNode;
  onTransactionComplete: (result: any) => void;
  onTransactionError?: (error: any) => void;
  onCancel?: () => void;
  transactionFn?: (transaction: Transaction) => Promise<any>;
}

export default function CheckoutTransactionHandler({
  db,
  children,
  onTransactionComplete,
  onTransactionError,
  onCancel,
  transactionFn,
}: CheckoutTransactionHandlerProps) {
  const [isProcessing, setIsProcessing] = useState(false);

  const {
    conflictInfo,
    isResolving,
    handleTransactionError,
    handleRetry,
    handleCancel,
    resetConflict,
  } = useTransactionConflict({
    onResolve: async () => {
      if (transactionFn) {
        await executeTransaction(transactionFn);
      }
    },
    onCancel,
  });

  const executeTransaction = useCallback(
    async (fn: (transaction: Transaction) => Promise<any>) => {
      setIsProcessing(true);

      try {
        const result = await runTransactionWithRetry(db, fn, {
          maxRetries: 1, // We'll handle further retries through the UI
          onConflictDetected: handleTransactionError,
          operationName: "checkout",
        });

        onTransactionComplete(result);
        resetConflict();
        return result;
      } catch (error) {
        // The error is already handled by onConflictDetected
        // But we might want to do additional handling here
        if (onTransactionError) {
          onTransactionError(error);
        }
        throw error;
      } finally {
        setIsProcessing(false);
      }
    },
    [
      db,
      handleTransactionError,
      onTransactionComplete,
      onTransactionError,
      resetConflict,
    ]
  );

  return (
    <View style={styles.container}>
      {/* Main content */}
      <View
        style={[
          styles.contentContainer,
          (isProcessing || isResolving) && styles.dimmedContent,
        ]}
      >
        {children}
      </View>

      {/* Loading overlay when processing */}
      {isProcessing && !conflictInfo && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FFFFFF" />
        </View>
      )}

      {/* Transaction conflict handler */}
      <TransactionConflictHandler
        conflictInfo={conflictInfo}
        isResolving={isResolving}
        onRetry={handleRetry}
        onCancel={handleCancel}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: "relative",
  },
  contentContainer: {
    flex: 1,
  },
  dimmedContent: {
    opacity: 0.6,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
});
