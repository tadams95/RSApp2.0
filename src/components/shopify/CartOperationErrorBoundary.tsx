import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { ShopifyErrorBoundary } from "./ShopifyErrorBoundary";

interface CartOperationErrorFallbackProps {
  error: Error;
  resetError: () => void;
  context?: string;
}

const CartOperationErrorFallback: React.FC<CartOperationErrorFallbackProps> = ({
  error,
  resetError,
}) => {
  const isNetworkError =
    error.message.includes("network") ||
    error.message.includes("Network") ||
    error.message.includes("timeout") ||
    error.name === "NetworkError";

  const isInventoryError =
    error.message.includes("inventory") ||
    error.message.includes("stock") ||
    error.message.includes("available") ||
    error.message.includes("sold out");

  const isValidationError =
    error.message.includes("validation") ||
    error.message.includes("invalid") ||
    error.message.includes("required");

  const isConflictError =
    error.message.includes("conflict") ||
    error.message.includes("concurrent") ||
    error.message.includes("version");

  const getErrorTitle = () => {
    if (isInventoryError) return "Item Unavailable";
    if (isNetworkError) return "Connection Issue";
    if (isValidationError) return "Cart Validation Error";
    if (isConflictError) return "Cart Sync Issue";
    return "Cart Operation Failed";
  };

  const getErrorMessage = () => {
    if (isInventoryError) {
      return "The item you're trying to add is no longer available or out of stock. Please check for alternative sizes or colors.";
    }
    if (isNetworkError) {
      return "Unable to update your cart due to connection issues. Your cart is saved locally and will sync when connection is restored.";
    }
    if (isValidationError) {
      return "There was an issue with your cart selection. Please check your size, color, and quantity choices.";
    }
    if (isConflictError) {
      return "Your cart was updated from another device. We've synced the latest version.";
    }
    return "We encountered an issue updating your cart. Your previous cart state has been preserved.";
  };

  const handleContinueShopping = () => {
    Alert.alert(
      "Continue Shopping",
      "Would you like to continue browsing while we resolve the cart issue?",
      [
        { text: "Stay Here", style: "cancel" },
        {
          text: "Continue Shopping",
          onPress: resetError,
        },
      ]
    );
  };

  const handleViewCart = () => {
    Alert.alert(
      "View Cart",
      "Your cart has been preserved. Would you like to review your items?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "View Cart",
          onPress: resetError,
        },
      ]
    );
  };

  const handleRefreshCart = () => {
    resetError();
  };

  const handleContactSupport = () => {
    Alert.alert(
      "Cart Support",
      "If you continue having trouble with cart operations, please contact support at cart@ragestate.com",
      [{ text: "OK", style: "default" }]
    );
  };

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>{getErrorTitle()}</Text>
      <Text style={styles.errorMessage}>{getErrorMessage()}</Text>

      {error.message && (
        <Text style={styles.errorDetails}>Error details: {error.message}</Text>
      )}

      <View style={styles.actionButtons}>
        {isConflictError ? (
          <Pressable
            style={[styles.button, styles.syncButton]}
            onPress={handleRefreshCart}
          >
            <Text style={styles.buttonText}>Sync Cart</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.button, styles.retryButton]}
            onPress={handleRefreshCart}
          >
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.button, styles.viewCartButton]}
          onPress={handleViewCart}
        >
          <Text style={styles.buttonText}>View Cart</Text>
        </Pressable>

        <Pressable
          style={[styles.button, styles.continueButton]}
          onPress={handleContinueShopping}
        >
          <Text style={styles.buttonText}>Keep Shopping</Text>
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
          💾 Your cart changes are saved locally and will sync when online
        </Text>
      )}

      {isInventoryError && (
        <Text style={styles.hint}>
          📦 Check product availability and try alternative options
        </Text>
      )}

      {isConflictError && (
        <Text style={styles.hint}>
          🔄 Cart was updated from another device - syncing latest version
        </Text>
      )}
    </View>
  );
};

interface CartOperationErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onInventoryError?: (error: Error) => void;
  onSyncConflict?: () => void;
}

export const CartOperationErrorBoundary: React.FC<
  CartOperationErrorBoundaryProps
> = ({ children, onError, onInventoryError, onSyncConflict }) => {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Check for specific error types
    const isInventoryError =
      error.message.includes("inventory") ||
      error.message.includes("stock") ||
      error.message.includes("available");

    const isConflictError =
      error.message.includes("conflict") ||
      error.message.includes("concurrent") ||
      error.message.includes("version");

    if (isInventoryError && onInventoryError) {
      onInventoryError(error);
    }

    if (isConflictError && onSyncConflict) {
      onSyncConflict();
    }

    if (onError) {
      onError(error, errorInfo);
    }
  };

  return (
    <ShopifyErrorBoundary
      context="cart operations"
      fallbackComponent={CartOperationErrorFallback}
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
    marginBottom: 12,
    lineHeight: 24,
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
  syncButton: {
    backgroundColor: "#17a2b8",
  },
  viewCartButton: {
    backgroundColor: "#28a745",
  },
  continueButton: {
    backgroundColor: "#ffc107",
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
