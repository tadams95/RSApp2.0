/**
 * CheckoutErrorBoundary - Specialized error boundary for cart checkout flow
 *
 * Handles critical checkout errors with user-friendly recovery options
 * and prevents complete app crashes during payment processing.
 */

import { MaterialCommunityIcons } from "@expo/vector-icons";
import React, { Component, ErrorInfo, ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { Button, Card, Surface, Text } from "react-native-paper";
import { logError } from "../../../../utils/logError";

interface CheckoutErrorBoundaryProps {
  children: ReactNode;
  onRetry?: () => void;
  onCancel?: () => void;
  onFallbackAction?: () => void;
  fallbackActionText?: string;
  operationContext?: string; // e.g., "payment", "checkout", "transaction"
}

interface CheckoutErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorContext: string | null;
}

/**
 * Specialized error boundary for checkout operations
 * Provides specific recovery options for checkout-related failures
 */
export default class CheckoutErrorBoundary extends Component<
  CheckoutErrorBoundaryProps,
  CheckoutErrorBoundaryState
> {
  constructor(props: CheckoutErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorContext: null,
    };
  }

  static getDerivedStateFromError(
    error: Error
  ): Partial<CheckoutErrorBoundaryState> {
    return {
      hasError: true,
      error,
      errorContext: error.message || "checkout_error",
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const context = this.props.operationContext || "checkout";

    // Log error for monitoring
    logError(error, `CheckoutErrorBoundary_${context}`, {
      componentStack: errorInfo.componentStack,
      errorBoundary: true,
      operationContext: context,
    });

    console.error(`Checkout error in ${context}:`, error, errorInfo);

    this.setState({ errorContext: context });
  }

  resetErrorBoundary = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorContext: null,
    });
  };

  handleRetry = (): void => {
    if (this.props.onRetry) {
      this.props.onRetry();
    }
    this.resetErrorBoundary();
  };

  handleCancel = (): void => {
    if (this.props.onCancel) {
      this.props.onCancel();
    }
    this.resetErrorBoundary();
  };

  handleFallbackAction = (): void => {
    if (this.props.onFallbackAction) {
      this.props.onFallbackAction();
    }
    this.resetErrorBoundary();
  };

  getErrorMessage(): string {
    const context = this.state.errorContext || "checkout";

    // Provide context-specific error messages
    switch (context) {
      case "payment":
        return "We encountered an issue processing your payment. Your card was not charged.";
      case "transaction":
        return "There was a problem completing your transaction. Please try again.";
      case "checkout":
        return "Something went wrong during checkout. Your order wasn't completed.";
      default:
        return "We encountered an unexpected error during the checkout process.";
    }
  }

  getActionText(): string {
    const context = this.state.errorContext || "checkout";

    switch (context) {
      case "payment":
        return "Retry Payment";
      case "transaction":
        return "Try Transaction Again";
      default:
        return "Try Again";
    }
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Surface style={styles.container}>
          <Card style={styles.errorCard}>
            <Card.Content style={styles.content}>
              <View style={styles.iconContainer}>
                <MaterialCommunityIcons
                  name="alert-circle-outline"
                  size={48}
                  color="#FF6B6B"
                />
              </View>

              <Text variant="headlineSmall" style={styles.title}>
                Checkout Error
              </Text>

              <Text variant="bodyMedium" style={styles.message}>
                {this.getErrorMessage()}
              </Text>

              <View style={styles.buttonContainer}>
                {this.props.onRetry && (
                  <Button
                    mode="contained"
                    onPress={this.handleRetry}
                    style={[styles.button, styles.primaryButton]}
                    labelStyle={styles.buttonText}
                  >
                    {this.getActionText()}
                  </Button>
                )}

                {this.props.onFallbackAction &&
                  this.props.fallbackActionText && (
                    <Button
                      mode="outlined"
                      onPress={this.handleFallbackAction}
                      style={styles.button}
                      labelStyle={styles.secondaryButtonText}
                    >
                      {this.props.fallbackActionText}
                    </Button>
                  )}

                {this.props.onCancel && (
                  <Button
                    mode="text"
                    onPress={this.handleCancel}
                    style={styles.button}
                    labelStyle={styles.secondaryButtonText}
                  >
                    Cancel
                  </Button>
                )}
              </View>

              {/* Development error details */}
              {__DEV__ && this.state.error && (
                <View style={styles.devErrorContainer}>
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
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
    padding: 16,
  },
  errorCard: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#1A1A1A",
    borderRadius: 12,
    elevation: 8,
  },
  content: {
    alignItems: "center",
    padding: 20,
  },
  iconContainer: {
    marginBottom: 16,
  },
  title: {
    marginBottom: 12,
    textAlign: "center",
    color: "#FFFFFF",
    fontWeight: "600",
  },
  message: {
    marginBottom: 24,
    textAlign: "center",
    color: "#CCCCCC",
    lineHeight: 20,
  },
  buttonContainer: {
    width: "100%",
    gap: 12,
  },
  button: {
    borderRadius: 8,
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
    marginTop: 16,
  },
  devErrorText: {
    color: "#FF6B6B",
    fontFamily: "monospace",
    fontSize: 12,
  },
});
