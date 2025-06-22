import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { ShopifyErrorBoundary } from "./ShopifyErrorBoundary";

interface CheckoutPaymentErrorFallbackProps {
  error: Error;
  resetError: () => void;
  context?: string;
}

const CheckoutPaymentErrorFallback: React.FC<
  CheckoutPaymentErrorFallbackProps
> = ({ error, resetError }) => {
  const isPaymentError =
    error.message.includes("payment") ||
    error.message.includes("stripe") ||
    error.message.includes("card") ||
    error.message.includes("declined");

  const isNetworkError =
    error.message.includes("network") ||
    error.message.includes("Network") ||
    error.message.includes("timeout") ||
    error.name === "NetworkError";

  const isCheckoutError =
    error.message.includes("checkout") ||
    error.message.includes("order") ||
    error.message.includes("processing");

  const isValidationError =
    error.message.includes("validation") ||
    error.message.includes("invalid") ||
    error.message.includes("required") ||
    error.message.includes("address");

  const isInventoryError =
    error.message.includes("inventory") ||
    error.message.includes("stock") ||
    error.message.includes("available") ||
    error.message.includes("sold out");

  const getErrorTitle = () => {
    if (isPaymentError) return "Payment Issue";
    if (isNetworkError) return "Connection Error";
    if (isCheckoutError) return "Checkout Failed";
    if (isValidationError) return "Information Required";
    if (isInventoryError) return "Items Unavailable";
    return "Order Processing Error";
  };

  const getErrorMessage = () => {
    if (isPaymentError) {
      return "There was an issue processing your payment. Please check your payment method and try again.";
    }
    if (isNetworkError) {
      return "Unable to complete checkout due to connection issues. Your cart is saved and payment was not charged.";
    }
    if (isCheckoutError) {
      return "We encountered an issue processing your order. No payment has been charged and your cart is preserved.";
    }
    if (isValidationError) {
      return "Please check your shipping and billing information. Some required fields may be missing or invalid.";
    }
    if (isInventoryError) {
      return "Some items in your cart are no longer available. Please review your cart and update quantities.";
    }
    return "We're having trouble completing your order. Your cart is safe and no payment has been processed.";
  };

  const handleRetryPayment = () => {
    Alert.alert(
      "Retry Payment",
      "Would you like to try processing your payment again?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Retry Payment",
          onPress: resetError,
        },
      ]
    );
  };

  const handleUpdatePayment = () => {
    Alert.alert(
      "Update Payment Method",
      "Would you like to update your payment information and try again?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Update Payment",
          onPress: resetError,
        },
      ]
    );
  };

  const handleReviewCart = () => {
    Alert.alert(
      "Review Cart",
      "Would you like to review and update your cart before trying again?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Review Cart",
          onPress: resetError,
        },
      ]
    );
  };

  const handleContactSupport = () => {
    Alert.alert(
      "Checkout Support",
      "If you continue having trouble with checkout, please contact our order support at orders@ragestate.com",
      [{ text: "OK", style: "default" }]
    );
  };

  const handleSaveForLater = () => {
    Alert.alert(
      "Save Cart",
      "Your cart has been saved. You can complete your order later when the issue is resolved.",
      [{ text: "OK", style: "default", onPress: resetError }]
    );
  };

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>{getErrorTitle()}</Text>
      <Text style={styles.errorMessage}>{getErrorMessage()}</Text>

      <View style={styles.safetyNotice}>
        <Text style={styles.safetyText}>
          🛡️ Your payment was not charged and your cart is preserved
        </Text>
      </View>

      {error.message && (
        <Text style={styles.errorDetails}>
          Technical details: {error.message}
        </Text>
      )}

      <View style={styles.actionButtons}>
        {isPaymentError ? (
          <>
            <Pressable
              style={[styles.button, styles.updatePaymentButton]}
              onPress={handleUpdatePayment}
            >
              <Text style={styles.buttonText}>Update Payment</Text>
            </Pressable>
            <Pressable
              style={[styles.button, styles.retryButton]}
              onPress={handleRetryPayment}
            >
              <Text style={styles.buttonText}>Retry Payment</Text>
            </Pressable>
          </>
        ) : isInventoryError ? (
          <Pressable
            style={[styles.button, styles.reviewCartButton]}
            onPress={handleReviewCart}
          >
            <Text style={styles.buttonText}>Review Cart</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.button, styles.retryButton]}
            onPress={resetError}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.button, styles.saveButton]}
          onPress={handleSaveForLater}
        >
          <Text style={styles.buttonText}>Save for Later</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.supportButton]}
          onPress={handleContactSupport}
        >
          <Text style={styles.buttonText}>Get Help</Text>
        </Pressable>
      </View>

      {isNetworkError && (
        <Text style={styles.hint}>
          🌐 Check your connection and try again - no charges were made
        </Text>
      )}

      {isPaymentError && (
        <Text style={styles.hint}>
          💳 Try a different payment method or contact your bank
        </Text>
      )}

      {isInventoryError && (
        <Text style={styles.hint}>
          📦 Review cart items and update quantities before retrying
        </Text>
      )}
    </View>
  );
};

interface CheckoutPaymentErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onPaymentFailure?: (error: Error) => void;
  onInventoryIssue?: () => void;
  onRetryNeeded?: () => void;
}

export const CheckoutPaymentErrorBoundary: React.FC<
  CheckoutPaymentErrorBoundaryProps
> = ({
  children,
  onError,
  onPaymentFailure,
  onInventoryIssue,
  onRetryNeeded,
}) => {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Check for specific error types
    const isPaymentError =
      error.message.includes("payment") ||
      error.message.includes("stripe") ||
      error.message.includes("card") ||
      error.message.includes("declined");

    const isInventoryError =
      error.message.includes("inventory") ||
      error.message.includes("stock") ||
      error.message.includes("available");

    const needsRetry =
      error.message.includes("network") ||
      error.message.includes("timeout") ||
      error.message.includes("temporary");

    if (isPaymentError && onPaymentFailure) {
      onPaymentFailure(error);
    }

    if (isInventoryError && onInventoryIssue) {
      onInventoryIssue();
    }

    if (needsRetry && onRetryNeeded) {
      onRetryNeeded();
    }

    if (onError) {
      onError(error, errorInfo);
    }
  };

  return (
    <ShopifyErrorBoundary
      context="checkout and payment"
      fallbackComponent={CheckoutPaymentErrorFallback}
      onError={handleError}
    >
      {children}
    </ShopifyErrorBoundary>
  );
};

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#ffffff",
    margin: 16,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  errorTitle: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#dc3545",
    marginBottom: 12,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
    marginBottom: 16,
    lineHeight: 24,
  },
  safetyNotice: {
    backgroundColor: "#d4edda",
    borderColor: "#c3e6cb",
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: "100%",
  },
  safetyText: {
    fontSize: 14,
    color: "#155724",
    textAlign: "center",
    fontWeight: "500",
  },
  errorDetails: {
    fontSize: 13,
    color: "#666",
    textAlign: "center",
    marginBottom: 20,
    fontStyle: "italic",
    paddingHorizontal: 16,
  },
  actionButtons: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginBottom: 16,
  },
  button: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    minWidth: 75,
    alignItems: "center",
    marginVertical: 3,
  },
  retryButton: {
    backgroundColor: "#007bff",
  },
  updatePaymentButton: {
    backgroundColor: "#17a2b8",
  },
  reviewCartButton: {
    backgroundColor: "#ffc107",
  },
  saveButton: {
    backgroundColor: "#28a745",
  },
  supportButton: {
    backgroundColor: "#6c757d",
  },
  buttonText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  hint: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    textAlign: "center",
    paddingHorizontal: 20,
  },
});
