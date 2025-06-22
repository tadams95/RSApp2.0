import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { Alert, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { GlobalStyles } from "../../../../constants/styles";
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
              color={GlobalStyles.colors.red3}
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
              color={GlobalStyles.colors.grey4}
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

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0, 0, 0, 0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
  },
  card: {
    backgroundColor: GlobalStyles.colors.grey9,
    width: "85%",
    borderRadius: 12,
    padding: 20,
    alignItems: "center",
    borderWidth: 1,
    borderColor: GlobalStyles.colors.grey8,
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 10,
  },
  iconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: "rgba(255, 59, 48, 0.1)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#FFFFFF",
    marginBottom: 12,
    textAlign: "center",
  },
  message: {
    fontSize: 16,
    color: GlobalStyles.colors.grey3,
    marginBottom: 16,
    textAlign: "center",
    lineHeight: 22,
  },
  detailsToggle: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  detailsText: {
    fontSize: 14,
    color: GlobalStyles.colors.grey4,
    marginRight: 4,
  },
  errorDetails: {
    width: "100%",
    backgroundColor: GlobalStyles.colors.grey9,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorCode: {
    color: GlobalStyles.colors.grey3,
    fontSize: 14,
    marginBottom: 8,
  },
  errorDescription: {
    color: GlobalStyles.colors.red3,
    fontSize: 14,
    marginBottom: 8,
  },
  errorTime: {
    color: GlobalStyles.colors.grey4,
    fontSize: 14,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
  },
  button: {
    borderRadius: 8,
    padding: 12,
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    height: 48,
  },
  cancelButton: {
    backgroundColor: "transparent",
    borderWidth: 1,
    borderColor: GlobalStyles.colors.grey7,
    marginRight: 8,
  },
  retryButton: {
    backgroundColor: GlobalStyles.colors.red4,
    marginLeft: 8,
  },
  cancelButtonText: {
    color: GlobalStyles.colors.grey3,
    fontSize: 16,
    fontWeight: "500",
  },
  retryButtonText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "500",
  },
  disabledButton: {
    opacity: 0.5,
  },
});

export default PaymentErrorHandler;
