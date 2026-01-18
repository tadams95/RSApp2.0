import { MaterialCommunityIcons } from "@expo/vector-icons";
import { router } from "expo-router";
import React, { Component, ErrorInfo, ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { Button, Card, Surface, Text } from "react-native-paper";
import type { Theme } from "../constants/themes";
import { ThemeContext } from "../contexts/ThemeContext";
import { captureException } from "../services/errorReporting";

interface ErrorBoundaryProps {
  children: ReactNode;
  fallbackComponent?: ReactNode;
  onError?: (error: Error, stackTrace: ErrorInfo) => void;
  resetKeys?: any[];
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * Error Boundary component that catches JavaScript errors anywhere in its child component tree
 * and displays a fallback UI instead of crashing the entire app.
 */
class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    // Update state so the next render will show the fallback UI
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Send to Sentry for production error tracking
    captureException(error, {
      componentStack: errorInfo.componentStack,
      errorBoundary: "GlobalErrorBoundary",
    });

    // Log the error to console for development
    console.error("Error caught by boundary:", error, errorInfo);

    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Store error info for potential display
    this.setState({ errorInfo });
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps): void {
    // If any of the resetKeys change, reset the error boundary
    if (
      this.props.resetKeys &&
      prevProps.resetKeys &&
      this.state.hasError &&
      areKeysChanged(prevProps.resetKeys, this.props.resetKeys)
    ) {
      this.resetErrorBoundary();
    }
  }

  resetErrorBoundary = (): void => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  navigateToHome = (): void => {
    router.replace("/");
    this.resetErrorBoundary();
  };

  render(): ReactNode {
    if (this.state.hasError) {
      // If a custom fallback component is provided, use it
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent;
      }

      // Default error UI - use ThemeContext.Consumer for class component
      return (
        <ThemeContext.Consumer>
          {({ theme }) => {
            const styles = createStyles(theme);
            return (
              <Surface style={styles.container}>
                <Card style={styles.errorCard}>
                  <Card.Content style={styles.content}>
                    <View style={styles.iconContainer}>
                      <MaterialCommunityIcons
                        name="alert-circle"
                        size={64}
                        color={theme.colors.danger}
                      />
                    </View>

                    <Text variant="headlineMedium" style={styles.title}>
                      Something went wrong
                    </Text>

                    <Text variant="bodyLarge" style={styles.message}>
                      We encountered an error while trying to display this
                      content.
                    </Text>

                    {__DEV__ && this.state.error && (
                      <View style={styles.devErrorContainer}>
                        <Text variant="bodySmall" style={styles.errorName}>
                          {this.state.error.toString()}
                        </Text>

                        <ScrollView style={styles.stackTraceContainer}>
                          <Text variant="bodySmall" style={styles.stackTrace}>
                            {this.state.errorInfo?.componentStack || ""}
                          </Text>
                        </ScrollView>
                      </View>
                    )}

                    <View style={styles.buttonContainer}>
                      <Button
                        mode="contained"
                        onPress={this.resetErrorBoundary}
                        style={styles.button}
                      >
                        Try Again
                      </Button>

                      <Button
                        mode="outlined"
                        onPress={this.navigateToHome}
                        style={styles.button}
                      >
                        Go Home
                      </Button>
                    </View>
                  </Card.Content>
                </Card>
              </Surface>
            );
          }}
        </ThemeContext.Consumer>
      );
    }

    return this.props.children;
  }
}

// Helper function to check if reset keys have changed
const areKeysChanged = (prevKeys: any[], nextKeys: any[]): boolean => {
  if (prevKeys.length !== nextKeys.length) return true;

  for (let i = 0; i < prevKeys.length; i++) {
    if (prevKeys[i] !== nextKeys[i]) return true;
  }

  return false;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bgRoot,
      justifyContent: "center",
      alignItems: "center",
      padding: 16,
    },
    errorCard: {
      width: "100%",
      maxWidth: 500,
      backgroundColor: theme.colors.bgElev1,
      borderRadius: 12,
    },
    content: {
      alignItems: "center",
    },
    iconContainer: {
      marginBottom: 16,
    },
    title: {
      marginBottom: 8,
      textAlign: "center",
      color: theme.colors.textPrimary,
    },
    message: {
      marginBottom: 24,
      textAlign: "center",
      color: theme.colors.textSecondary,
    },
    buttonContainer: {
      flexDirection: "row",
      justifyContent: "center",
      width: "100%",
      marginTop: 16,
    },
    button: {
      marginHorizontal: 8,
      minWidth: 120,
    },
    devErrorContainer: {
      width: "100%",
      padding: 12,
      backgroundColor: theme.colors.bgElev2,
      borderRadius: 8,
      marginVertical: 16,
    },
    errorName: {
      color: theme.colors.danger,
      marginBottom: 8,
      fontWeight: "bold",
    },
    stackTraceContainer: {
      maxHeight: 200,
    },
    stackTrace: {
      color: theme.colors.textSecondary,
      fontFamily: "monospace",
      fontSize: 10,
    },
  });

export default ErrorBoundary;
