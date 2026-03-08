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
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Theme } from "../../../../constants/themes";
import { useTheme } from "../../../../contexts/ThemeContext";
import { useThemedStyles } from "../../../../hooks/useThemedStyles";
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
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

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
            <ActivityIndicator size="small" color={theme.colors.danger} />
            <Text style={styles.message}>Resolving conflict...</Text>
          </View>
        ) : conflictInfo ? (
          <View style={styles.conflictContainer}>
            <View style={styles.header}>
              <Ionicons
                name="warning"
                size={20}
                color={theme.colors.warning}
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

const createStyles = (theme: Theme) =>
  ({
    container: {
      marginVertical: 12,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.lg,
      backgroundColor: theme.colors.bgElev1,
      borderRadius: theme.radius.button,
      borderColor: theme.colors.borderStrong,
      borderWidth: 1,
    },
    loadingContainer: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
    },
    conflictContainer: {
      alignItems: "flex-start" as const,
    },
    header: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: theme.spacing.sm,
    },
    title: {
      marginLeft: theme.spacing.sm,
      color: theme.colors.warning,
      fontSize: 16,
      fontWeight: theme.typography.weights.semibold,
    },
    message: {
      marginLeft: theme.spacing.sm,
      color: theme.colors.textPrimary,
      fontSize: 14,
      marginBottom: theme.spacing.sm,
    },
    detail: {
      marginLeft: theme.spacing.sm,
      color: theme.colors.textSecondary,
      fontSize: theme.typography.sizes.meta,
      marginBottom: theme.spacing.md,
    },
    resolutionContainer: {
      marginTop: theme.spacing.xs,
      marginLeft: theme.spacing.sm,
      marginBottom: theme.spacing.lg,
    },
    resolutionTitle: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: theme.typography.weights.medium,
      marginBottom: theme.spacing.xs,
    },
    resolution: {
      color: theme.colors.textSecondary,
      fontSize: 14,
    },
    buttonContainer: {
      flexDirection: "row" as const,
      marginTop: theme.spacing.xs,
    },
    button: {
      paddingVertical: theme.spacing.sm,
      paddingHorizontal: theme.spacing.xl,
      borderRadius: 6,
      marginRight: 10,
    },
    retryButton: {
      backgroundColor: theme.colors.danger,
    },
    cancelButton: {
      backgroundColor: "transparent",
      borderColor: theme.colors.textTertiary,
      borderWidth: 1,
    },
    buttonText: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: theme.typography.weights.medium,
    },
    cancelButtonText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      fontWeight: theme.typography.weights.medium,
    },
  } as const);
