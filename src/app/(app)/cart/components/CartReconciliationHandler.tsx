/**
 * CartReconciliationHandler Component
 *
 * This component displays a UI for order reconciliation checks,
 * giving users visibility into the recovery process.
 * Enhanced with error boundary protection for robust error handling.
 */

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  ActivityIndicator,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Theme } from "../../../../constants/themes";
import { useTheme } from "../../../../contexts/ThemeContext";
import { useThemedStyles } from "../../../../hooks/useThemedStyles";
import CheckoutErrorBoundary from "./CheckoutErrorBoundary";

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
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  if (!isReconciling && !error) {
    return null;
  }

  return (
    <CheckoutErrorBoundary
      operationContext="checkout"
      onRetry={onRetry}
      onCancel={onDismiss}
      fallbackActionText="Dismiss"
      onFallbackAction={onDismiss}
    >
      <View style={styles.container}>
        {isReconciling ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="small" color={theme.colors.danger} />
            <Text style={styles.message}>Checking order status...</Text>
          </View>
        ) : error ? (
          <View style={styles.errorContainer}>
            <Ionicons
              name="alert-circle"
              size={20}
              color={theme.colors.danger}
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
    </CheckoutErrorBoundary>
  );
}

const createStyles = (theme: Theme) =>
  ({
    container: {
      marginVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.md,
      backgroundColor: theme.colors.bgElev1,
      borderRadius: theme.radius.button,
      borderColor: theme.colors.borderStrong,
      borderWidth: 1,
    },
    loadingContainer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
    },
    errorContainer: {
      alignItems: "flex-start" as const,
    },
    message: {
      marginLeft: theme.spacing.sm,
      color: theme.colors.textPrimary,
      fontSize: 14,
    },
    errorMessage: {
      marginLeft: theme.spacing.sm,
      marginTop: theme.spacing.xs,
      color: theme.colors.danger,
      fontSize: 14,
    },
    buttonContainer: {
      flexDirection: "row" as const,
      marginTop: theme.spacing.md,
    },
    button: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      borderRadius: theme.radius.button,
      backgroundColor: theme.colors.danger,
      marginRight: theme.spacing.sm,
    },
    buttonText: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: theme.typography.weights.medium,
    },
    dismissButton: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: theme.colors.textSecondary,
    },
    dismissButtonText: {
      color: theme.colors.textTertiary,
    },
  } as const);
