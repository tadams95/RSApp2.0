/**
 * CartReconciliationHandler Component
 *
 * This component displays a UI for order reconciliation checks,
 * giving users visibility into the recovery process.
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

interface CartReconciliationHandlerProps {
  isReconciling: boolean;
  onRetry?: () => void;
  onDismiss?: () => void;
  error?: string | null;
}

export default function CartReconciliationHandler({
  isReconciling,
  onRetry,
  onDismiss,
  error,
}: CartReconciliationHandlerProps) {
  if (!isReconciling && !error) {
    return null;
  }

  return (
    <View style={styles.container}>
      {isReconciling ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={GlobalStyles.colors.red4} />
          <Text style={styles.message}>Checking order status...</Text>
        </View>
      ) : error ? (
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle"
            size={20}
            color={GlobalStyles.colors.red5}
          />
          <Text style={styles.errorMessage}>
            {error || "An error occurred during order reconciliation"}
          </Text>
          <View style={styles.buttonContainer}>
            {onRetry && (
              <TouchableOpacity onPress={onRetry} style={styles.button}>
                <Text style={styles.buttonText}>Retry</Text>
              </TouchableOpacity>
            )}
            {onDismiss && (
              <TouchableOpacity
                onPress={onDismiss}
                style={[styles.button, styles.dismissButton]}
              >
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#111111",
    borderRadius: 8,
    borderColor: GlobalStyles.colors.grey7,
    borderWidth: 1,
  },
  loadingContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  errorContainer: {
    alignItems: "flex-start",
  },
  message: {
    marginLeft: 8,
    color: "white",
    fontSize: 14,
  },
  errorMessage: {
    marginLeft: 8,
    marginTop: 4,
    color: GlobalStyles.colors.red4,
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: "row",
    marginTop: 12,
  },
  button: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 4,
    backgroundColor: GlobalStyles.colors.red4,
    marginRight: 8,
  },
  buttonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "500",
  },
  dismissButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: GlobalStyles.colors.grey3,
  },
  dismissButtonText: {
    color: GlobalStyles.colors.grey7,
  },
});
