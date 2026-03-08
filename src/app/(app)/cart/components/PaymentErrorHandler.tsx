import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Alert, Text, TouchableOpacity, View } from "react-native";
import type { Theme } from "../../../../constants/themes";
import { useTheme } from "../../../../contexts/ThemeContext";
import { useThemedStyles } from "../../../../hooks/useThemedStyles";
import {
  clearCheckoutError,
  getLastCheckoutError,
} from "../../../../utils/cart/cartPersistence";
import { isNetworkConnected } from "../../../../utils/cart/networkErrorDetection";
import CheckoutErrorBoundary from "./CheckoutErrorBoundary";

type PaymentErrorProps = {
  onRetry: () => Promise<void>;
  onCancel: () => void;
};

const PaymentErrorHandler: React.FC<PaymentErrorProps> = ({
  onRetry,
  onCancel,
}) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const [errorInfo, setErrorInfo] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showErrorDetails, setShowErrorDetails] = useState(false);

  useEffect(() => {
    // Check for any previous payment errors on mount
    checkPreviousErrors();
  }, []);

  const checkPreviousErrors = async () => {
    try {
      const errorData = await getLastCheckoutError();
      if (errorData) {
        setErrorInfo(errorData);
      }
    } catch (err) {
      console.error("Failed to check for previous errors:", err);
    }
  };

  const handleRetry = async () => {
    // First check if we have network connectivity
    const isConnected = await isNetworkConnected();

    if (!isConnected) {
      Alert.alert(
        "Network Error",
        "You appear to be offline. Please check your connection and try again.",
        [{ text: "OK" }]
      );
      return;
    }

    try {
      setLoading(true);

      // Clear the error before retrying
      await clearCheckoutError();

      // Execute the retry function from parent
      await onRetry();
    } catch (error) {
      console.error("Error during payment retry:", error);
      Alert.alert(
        "Retry Failed",
        "There was a problem retrying your payment. Please try again or contact support.",
        [{ text: "OK" }]
      );
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    // Clear the stored error when user cancels
    await clearCheckoutError();
    onCancel();
  };

  if (!errorInfo) {
    return null;
  }

  const errorMessage = errorInfo.message || "An unknown error occurred";
  const errorTime = errorInfo.timestamp
    ? new Date(errorInfo.timestamp).toLocaleString()
    : "Unknown time";

  return (
    <CheckoutErrorBoundary
      operationContext="payment"
      onRetry={handleRetry}
      onCancel={handleCancel}
      fallbackActionText="Back to Cart"
      onFallbackAction={handleCancel}
    >
      <View style={styles.container}>
        <View style={styles.card}>
          <View style={styles.iconContainer}>
            <Ionicons
              name="warning-outline"
              size={32}
              color={theme.colors.danger}
            />
          </View>

          <Text style={styles.title}>Payment Problem Detected</Text>

          <Text style={styles.message}>
            We found an issue with your previous payment attempt.
          </Text>

          <TouchableOpacity
            style={styles.detailsToggle}
            onPress={() => setShowErrorDetails(!showErrorDetails)}
          >
            <Text style={styles.detailsText}>
              {showErrorDetails ? "Hide error details" : "Show error details"}
            </Text>
            <Ionicons
              name={showErrorDetails ? "chevron-up" : "chevron-down"}
              size={16}
              color={theme.colors.textSecondary}
            />
          </TouchableOpacity>

          {showErrorDetails && (
            <View style={styles.errorDetails}>
              <Text style={styles.errorCode}>
                Error code: {errorInfo.code || "Unknown"}
              </Text>
              <Text style={styles.errorDescription}>{errorMessage}</Text>
              <Text style={styles.errorTime}>Occurred at: {errorTime}</Text>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.button,
                styles.retryButton,
                loading && styles.disabledButton,
              ]}
              onPress={handleRetry}
              disabled={loading}
            >
              <Text style={styles.retryButtonText}>
                {loading ? "Retrying..." : "Retry Payment"}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </CheckoutErrorBoundary>
  );
};

const createStyles = (theme: Theme) =>
  ({
    container: {
      position: "absolute" as const,
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: theme.colors.overlay,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      zIndex: 1000,
    },
    card: {
      backgroundColor: theme.colors.bgElev1,
      width: "85%" as const,
      borderRadius: theme.radius.card,
      padding: theme.spacing.xl,
      alignItems: "center" as const,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
      ...theme.shadows.modal,
    },
    iconContainer: {
      width: 60,
      height: 60,
      borderRadius: 30,
      backgroundColor: theme.colors.dangerMuted,
      justifyContent: "center" as const,
      alignItems: "center" as const,
      marginBottom: theme.spacing.lg,
    },
    title: {
      fontSize: 18,
      fontWeight: theme.typography.weights.bold,
      color: theme.colors.textPrimary,
      marginBottom: theme.spacing.md,
      textAlign: "center" as const,
    },
    message: {
      fontSize: 16,
      color: theme.colors.textSecondary,
      marginBottom: theme.spacing.lg,
      textAlign: "center" as const,
      lineHeight: 22,
    },
    detailsToggle: {
      flexDirection: "row" as const,
      alignItems: "center" as const,
      marginBottom: theme.spacing.lg,
    },
    detailsText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      marginRight: theme.spacing.xs,
    },
    errorDetails: {
      width: "100%" as const,
      backgroundColor: theme.colors.bgElev2,
      borderRadius: theme.radius.button,
      padding: theme.spacing.md,
      marginBottom: theme.spacing.lg,
    },
    errorCode: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      marginBottom: theme.spacing.sm,
    },
    errorDescription: {
      color: theme.colors.danger,
      fontSize: 14,
      marginBottom: theme.spacing.sm,
    },
    errorTime: {
      color: theme.colors.textSecondary,
      fontSize: 14,
    },
    buttonContainer: {
      flexDirection: "row" as const,
      justifyContent: "space-between" as const,
      width: "100%" as const,
    },
    button: {
      borderRadius: theme.radius.button,
      padding: theme.spacing.md,
      flex: 1,
      alignItems: "center" as const,
      justifyContent: "center" as const,
      height: 48,
    },
    cancelButton: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
      marginRight: theme.spacing.sm,
    },
    retryButton: {
      backgroundColor: theme.colors.danger,
      marginLeft: theme.spacing.sm,
    },
    cancelButtonText: {
      color: theme.colors.textSecondary,
      fontSize: 16,
      fontWeight: theme.typography.weights.medium,
    },
    retryButtonText: {
      color: theme.colors.textPrimary,
      fontSize: 16,
      fontWeight: theme.typography.weights.medium,
    },
    disabledButton: {
      opacity: 0.5,
    },
  } as const);

export default PaymentErrorHandler;
