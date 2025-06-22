import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { ShopifyErrorBoundary } from "./ShopifyErrorBoundary";

interface ProductFetchErrorFallbackProps {
  error: Error;
  resetError: () => void;
  context?: string;
}

const ProductFetchErrorFallback: React.FC<ProductFetchErrorFallbackProps> = ({
  error,
  resetError,
}) => {
  const isNetworkError =
    error.message.includes("network") ||
    error.message.includes("Network") ||
    error.message.includes("timeout") ||
    error.name === "NetworkError";

  const isRateLimitError =
    error.message.includes("rate limit") ||
    error.message.includes("429") ||
    error.message.includes("Too many requests");

  const isShopifyServiceError =
    error.message.includes("Shopify") ||
    error.message.includes("storefront") ||
    error.message.includes("GraphQL");

  const isProductNotFound =
    error.message.includes("not found") || error.message.includes("404");

  const getErrorTitle = () => {
    if (isProductNotFound) return "Product Not Found";
    if (isNetworkError) return "Connection Issue";
    if (isRateLimitError) return "Service Busy";
    if (isShopifyServiceError) return "Shop Service Error";
    return "Products Unavailable";
  };

  const getErrorMessage = () => {
    if (isProductNotFound) {
      return "The product you're looking for could not be found. It may have been removed or is temporarily unavailable.";
    }
    if (isNetworkError) {
      return "Unable to load products due to connection issues. Please check your internet connection and try again.";
    }
    if (isRateLimitError) {
      return "Our shop is experiencing high traffic. Please wait a moment and try again.";
    }
    if (isShopifyServiceError) {
      return "Our shop service is temporarily unavailable. We're working to restore it quickly.";
    }
    return "We're having trouble loading our product catalog. Please try again in a few moments.";
  };

  const handleBrowseAlternatives = () => {
    Alert.alert(
      "Browse Alternatives",
      "Would you like to browse our events instead while we work on fixing the shop?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Browse Events",
          onPress: () => {
            // This would navigate to events, but we'll just reset for now
            resetError();
          },
        },
      ]
    );
  };

  const handleContactSupport = () => {
    Alert.alert(
      "Shop Support",
      "If products continue to be unavailable, please contact our shop support at shop@ragestate.com",
      [{ text: "OK", style: "default" }]
    );
  };

  const handleRefresh = () => {
    resetError();
  };

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>{getErrorTitle()}</Text>
      <Text style={styles.errorMessage}>{getErrorMessage()}</Text>

      {error.message && (
        <Text style={styles.errorDetails}>Details: {error.message}</Text>
      )}

      <View style={styles.actionButtons}>
        {isRateLimitError ? (
          <Pressable
            style={[styles.button, styles.waitButton]}
            onPress={() => {
              setTimeout(handleRefresh, 3000); // Wait 3 seconds then refresh
            }}
          >
            <Text style={styles.buttonText}>Wait & Retry</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.button, styles.retryButton]}
            onPress={handleRefresh}
          >
            <Text style={styles.buttonText}>Refresh</Text>
          </Pressable>
        )}

        {!isProductNotFound && (
          <Pressable
            style={[styles.button, styles.alternativeButton]}
            onPress={handleBrowseAlternatives}
          >
            <Text style={styles.buttonText}>Browse Events</Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.button, styles.supportButton]}
          onPress={handleContactSupport}
        >
          <Text style={styles.buttonText}>Contact Support</Text>
        </Pressable>
      </View>

      {isNetworkError && (
        <Text style={styles.hint}>
          🌐 Check your internet connection and try refreshing
        </Text>
      )}

      {isRateLimitError && (
        <Text style={styles.hint}>
          ⏱️ High traffic detected - automatic retry in a few seconds
        </Text>
      )}

      {isShopifyServiceError && (
        <Text style={styles.hint}>
          🔧 Shop service maintenance - please check back shortly
        </Text>
      )}
    </View>
  );
};

interface ProductFetchErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onProductNotFound?: () => void;
}

export const ProductFetchErrorBoundary: React.FC<
  ProductFetchErrorBoundaryProps
> = ({ children, onError, onProductNotFound }) => {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Check if this is a product not found error
    const isProductNotFound =
      error.message.includes("not found") || error.message.includes("404");

    if (isProductNotFound && onProductNotFound) {
      onProductNotFound();
    }

    if (onError) {
      onError(error, errorInfo);
    }
  };

  return (
    <ShopifyErrorBoundary
      context="product fetching"
      fallbackComponent={ProductFetchErrorFallback}
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
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
    marginVertical: 4,
  },
  retryButton: {
    backgroundColor: "#007bff",
  },
  waitButton: {
    backgroundColor: "#ffc107",
  },
  alternativeButton: {
    backgroundColor: "#17a2b8",
  },
  supportButton: {
    backgroundColor: "#6c757d",
  },
  buttonText: {
    color: "#fff",
    fontSize: 14,
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
