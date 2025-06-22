import React, { Component, ReactNode } from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { logError } from "../../utils/logError";

interface AccountErrorBoundaryProps {
  children: ReactNode;
  fallbackComponent?: React.ComponentType<AccountErrorFallbackProps>;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  context?: string;
}

interface AccountErrorFallbackProps {
  error: Error;
  resetError: () => void;
  context?: string;
}

interface AccountErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

const DefaultAccountErrorFallback: React.FC<AccountErrorFallbackProps> = ({
  error,
  resetError,
  context = "account operation",
}) => (
  <View style={styles.errorContainer}>
    <Text style={styles.errorTitle}>Account Error</Text>
    <Text style={styles.errorMessage}>
      Something went wrong with your {context}. Please try again.
    </Text>
    <Text style={styles.errorDetails}>
      {error.message || "An unexpected error occurred"}
    </Text>
    <View style={styles.actionButtons}>
      <Pressable
        style={[styles.button, styles.retryButton]}
        onPress={resetError}
      >
        <Text style={styles.buttonText}>Try Again</Text>
      </Pressable>
      <Pressable
        style={[styles.button, styles.helpButton]}
        onPress={() => {
          Alert.alert(
            "Need Help?",
            "If this problem persists, please contact support at support@ragestate.com",
            [{ text: "OK", style: "default" }]
          );
        }}
      >
        <Text style={styles.buttonText}>Get Help</Text>
      </Pressable>
    </View>
  </View>
);

export class AccountErrorBoundary extends Component<
  AccountErrorBoundaryProps,
  AccountErrorBoundaryState
> {
  constructor(props: AccountErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(
    error: Error
  ): Partial<AccountErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log the error for debugging and monitoring
    logError(error, "AccountErrorBoundary", {
      context: this.props.context || "account_management",
      componentStack: errorInfo.componentStack,
      errorBoundary: "AccountErrorBoundary",
    });

    this.setState({
      errorInfo,
    });

    // Call the custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const FallbackComponent =
        this.props.fallbackComponent || DefaultAccountErrorFallback;

      return (
        <FallbackComponent
          error={this.state.error}
          resetError={this.resetError}
          context={this.props.context}
        />
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
    backgroundColor: "#f5f5f5",
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: "bold",
    color: "#d32f2f",
    marginBottom: 12,
    textAlign: "center",
  },
  errorMessage: {
    fontSize: 16,
    color: "#333",
    textAlign: "center",
    marginBottom: 8,
    lineHeight: 24,
  },
  errorDetails: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
    marginBottom: 24,
    fontStyle: "italic",
  },
  actionButtons: {
    flexDirection: "row",
    gap: 12,
  },
  button: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: "center",
  },
  retryButton: {
    backgroundColor: "#2196f3",
  },
  helpButton: {
    backgroundColor: "#ff9800",
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
});
