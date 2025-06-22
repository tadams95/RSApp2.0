/**
 * CheckoutFlowErrorBoundary - Comprehensive error boundary for the entire checkout flow
 *
 * This error boundary wraps the entire checkout process and provides fallback UI
 * for any unhandled errors that occur during the checkout flow.
 * It serves as the final safety net to prevent app crashes during critical operations.
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { Component, ErrorInfo, ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, Surface, Text } from "react-native-paper";
import { logError } from "../../../../utils/logError";

interface CheckoutFlowErrorBoundaryProps {
  children: ReactNode;
  onRetryCheckout?: () => void;
  onBackToCart?: () => void;
  onNavigateHome?: () => void;
}

interface CheckoutFlowErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorId: string | null;
}

/**
 * Comprehensive error boundary for the entire checkout flow
 * Provides robust error handling and recovery options for checkout operations
 */
export default class CheckoutFlowErrorBoundary extends Component<
  CheckoutFlowErrorBoundaryProps,
  CheckoutFlowErrorBoundaryState
> {
  constructor(props: CheckoutFlowErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorId: null,
    };
  }

  static getDerivedStateFromError(
    error: Error
  ): Partial<CheckoutFlowErrorBoundaryState> {
    const errorId = `checkout_${Date.now()}_${Math.random()
      .toString(36)
      .substr(2, 9)}`;
    return {
      hasError: true,
      error,
      errorId,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Generate unique error ID for tracking
    const errorId = this.state.errorId || `checkout_${Date.now()}`;

    // Log error for monitoring and debugging
    logError(error, "CheckoutFlowErrorBoundary", {
      errorId,
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
      flowType: "checkout",
      timestamp: new Date().toISOString(),
    });

    console.error("Critical checkout flow error:", {
      error,
      errorInfo,
      errorId,
    });
  }

  resetErrorBoundary = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorId: null,
    });
  };

  handleRetryCheckout = (): void => {
    if (this.props.onRetryCheckout) {
      this.props.onRetryCheckout();
    }
    this.resetErrorBoundary();
  };

  handleBackToCart = (): void => {
    if (this.props.onBackToCart) {
      this.props.onBackToCart();
    }
    this.resetErrorBoundary();
  };

  handleNavigateHome = (): void => {
    if (this.props.onNavigateHome) {
      this.props.onNavigateHome();
    }
    this.resetErrorBoundary();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Surface style={styles.container}>
          <Card style={styles.errorCard}>
            <Card.Content style={styles.content}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons
                  name="alert-octagon"
                  size={64}
                  color="#FF6B6B"
                />
              </View>

              <Text variant="headlineSmall" style={styles.title}>
                Checkout Error
              </Text>

              <Text variant="bodyMedium" style={styles.message}>
                We encountered an unexpected error during checkout. Your payment
                was not processed.
              </Text>

              <Text variant="bodySmall" style={styles.assurance}>
                Don't worry - your cart items are safe and no charges were made.
              </Text>

              <View style={styles.buttonContainer}>
                {this.props.onRetryCheckout && (
                  <Button
                    mode="contained"
                    onPress={this.handleRetryCheckout}
                    style={[styles.button, styles.primaryButton]}
                    labelStyle={styles.buttonText}
                  >
                    Try Again
                  </Button>
                )}

                {this.props.onBackToCart && (
                  <Button
                    mode="outlined"
                    onPress={this.handleBackToCart}
                    style={styles.button}
                    labelStyle={styles.secondaryButtonText}
                  >
                    Back to Cart
                  </Button>
                )}

                {this.props.onNavigateHome && (
                  <Button
                    mode="text"
                    onPress={this.handleNavigateHome}
                    style={styles.button}
                    labelStyle={styles.secondaryButtonText}
                  >
                    Go Home
                  </Button>
                )}
              </View>

              {/* Development error details */}
              {__DEV__ && this.state.error && (
                <View style={styles.devErrorContainer}>
                  <Text variant="labelSmall" style={styles.devErrorLabel}>
                    Error ID: {this.state.errorId}
                  </Text>
                  <Text variant="bodySmall" style={styles.devErrorText}>
                    {this.state.error.toString()}
                  </Text>
                </View>
              )}
            </Card.Content>
          </Card>
        </Surface>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#1A1A1A",
    borderRadius: 16,
    elevation: 12,
    shadowColor: "#FF6B6B",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
  },
  content: {
    alignItems: "center",
    padding: 24,
  },
  iconContainer: {
    marginBottom: 20,
  },
  title: {
    marginBottom: 12,
    textAlign: "center",
    color: "#FFFFFF",
    fontWeight: "700",
  },
  message: {
    marginBottom: 16,
    textAlign: "center",
    color: "#CCCCCC",
    lineHeight: 22,
  },
  assurance: {
    marginBottom: 28,
    textAlign: "center",
    color: "#90EE90",
    fontStyle: "italic",
  },
  buttonContainer: {
    width: "100%",
    gap: 12,
  },
  button: {
    borderRadius: 8,
    paddingVertical: 4,
  },
  primaryButton: {
    backgroundColor: "#FF6B6B",
  },
  buttonText: {
    color: "#FFFFFF",
    fontWeight: "600",
    fontSize: 16,
  },
  secondaryButtonText: {
    color: "#CCCCCC",
    fontSize: 14,
  },
  devErrorContainer: {
    width: "100%",
    padding: 12,
    backgroundColor: "#2A2A2A",
    borderRadius: 8,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: "#FF6B6B",
  },
  devErrorLabel: {
    color: "#FFAA00",
    marginBottom: 4,
    fontWeight: "600",
  },
  devErrorText: {
    color: "#FF6B6B",
    fontFamily: "monospace",
    fontSize: 11,
  },
});
