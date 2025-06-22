/**
 * TransactionConflictHandler Component
 *
 * This component displays a UI for handling transaction conflicts,
 * providing clear guidance to users on how to recover from common issues.
 * Enhanced with error boundary protection for robust error handling.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { GlobalStyles } from "../../../../constants/styles";
import CheckoutErrorBoundary from "./CheckoutErrorBoundary";

export interface TransactionConflictInfo {
  code: string;
  message: string;
  detail?: string;
  resolution: string;
}

interface TransactionConflictHandlerProps {
  conflictInfo: TransactionConflictInfo | null;
  isResolving: boolean;
  onRetry: () => void;
  onCancel?: () => void;
}

export default function TransactionConflictHandler({
  conflictInfo,
  isResolving,
  onRetry,
  onCancel,
}: TransactionConflictHandlerProps) {
  if (!conflictInfo && !isResolving) {
    return null;
  }

  return (
    <CheckoutErrorBoundary
      operationContext="transaction"
      onRetry={onRetry}
      onCancel={onCancel}
      fallbackActionText="Cancel Transaction"
      onFallbackAction={onCancel}
    >
      <View style={styles.container}>
        {isResolving ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={GlobalStyles.colors.red4} />
            <Text style={styles.message}>Resolving conflict...</Text>
          </View>
        ) : conflictInfo ? (
          <View style={styles.conflictContainer}>
            <View style={styles.header}>
              <Ionicons
                name="warning"
                size={20}
                color={GlobalStyles.colors.yellow}
              />
              <Text style={styles.title}>Transaction Conflict</Text>
            </View>

            <Text style={styles.message}>{conflictInfo.message}</Text>

            {conflictInfo.detail && (
              <Text style={styles.detail}>{conflictInfo.detail}</Text>
            )}

            <View style={styles.resolutionContainer}>
              <Text style={styles.resolutionTitle}>Suggested action:</Text>
              <Text style={styles.resolution}>{conflictInfo.resolution}</Text>
            </View>

            <View style={styles.buttonContainer}>
              <TouchableOpacity
                onPress={onRetry}
                style={[styles.button, styles.retryButton]}
              >
                <Text style={styles.buttonText}>Retry</Text>
              </TouchableOpacity>

              {onCancel && (
                <TouchableOpacity
                  onPress={onCancel}
                  style={[styles.button, styles.cancelButton]}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        ) : null}
      </View>
    </CheckoutErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 12,
    paddingHorizontal: 16,
    paddingVertical: 16,
    backgroundColor: "#111111",
    borderRadius: 8,
    borderColor: GlobalStyles.colors.grey7,
    borderWidth: 1,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  conflictContainer: {
    alignItems: "flex-start",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 8,
  },
  title: {
    marginLeft: 8,
    color: GlobalStyles.colors.yellow,
    fontSize: 16,
    fontWeight: "600",
  },
  message: {
    marginLeft: 8,
    color: "white",
    fontSize: 14,
    marginBottom: 8,
  },
  detail: {
    marginLeft: 8,
    color: GlobalStyles.colors.grey4,
    fontSize: 13,
    marginBottom: 12,
  },
  resolutionContainer: {
    marginTop: 4,
    marginLeft: 8,
    marginBottom: 16,
  },
  resolutionTitle: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
    marginBottom: 4,
  },
  resolution: {
    color: GlobalStyles.colors.grey3,
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: "row",
    marginTop: 4,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 6,
    marginRight: 10,
  },
  retryButton: {
    backgroundColor: GlobalStyles.colors.red4,
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderColor: GlobalStyles.colors.grey6,
    borderWidth: 1,
  },
  buttonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  cancelButtonText: {
    color: GlobalStyles.colors.grey3,
    fontSize: 14,
    fontWeight: "500",
  },
});
