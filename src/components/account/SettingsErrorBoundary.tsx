import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AccountErrorBoundary } from "./AccountErrorBoundary";

interface SettingsErrorFallbackProps {
  error: Error;
  resetError: () => void;
  context?: string;
}

const SettingsErrorFallback: React.FC<SettingsErrorFallbackProps> = ({
  error,
  resetError,
}) => {
  const isPermissionError =
    error.message.includes("permission") ||
    error.message.includes("unauthorized") ||
    error.message.includes("Permission");

  const isNetworkError =
    error.message.includes("network") ||
    error.message.includes("Network") ||
    error.name === "NetworkError";

  const isAuthError =
    error.message.includes("auth") ||
    error.message.includes("authentication") ||
    error.message.includes("user-not-found");

  const getErrorTitle = () => {
    if (isPermissionError) return "Access Denied";
    if (isNetworkError) return "Connection Error";
    if (isAuthError) return "Authentication Error";
    return "Settings Error";
  };

  const getErrorMessage = () => {
    if (isPermissionError) {
      return "You don't have permission to perform this action. Please verify your account status.";
    }
    if (isNetworkError) {
      return "Unable to load settings due to connection issues. Please check your internet connection.";
    }
    if (isAuthError) {
      return "Your session may have expired. Please log in again to access settings.";
    }
    return "We encountered an error while loading your settings. Please try again.";
  };

  const handleReauth = () => {
    Alert.alert(
      "Session Expired",
      "You will be redirected to the login screen to sign in again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign In Again",
          onPress: () => {
            // This will be handled by the parent component
            resetError();
          },
        },
      ]
    );
  };

  const handleContactSupport = () => {
    Alert.alert(
      "Need Help?",
      "If you continue to experience issues, please contact our support team at support@ragestate.com",
      [{ text: "OK", style: "default" }]
    );
  };

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>{getErrorTitle()}</Text>
      <Text style={styles.errorMessage}>{getErrorMessage()}</Text>

      {error.message && (
        <Text style={styles.errorDetails}>Error: {error.message}</Text>
      )}

      <View style={styles.actionButtons}>
        {isAuthError ? (
          <Pressable
            style={[styles.button, styles.authButton]}
            onPress={handleReauth}
          >
            <Text style={styles.buttonText}>Sign In Again</Text>
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
          style={[styles.button, styles.supportButton]}
          onPress={handleContactSupport}
        >
          <Text style={styles.buttonText}>Get Help</Text>
        </Pressable>
      </View>

      {isPermissionError && (
        <Text style={styles.hint}>
          💡 Some features may require admin privileges
        </Text>
      )}

      {isNetworkError && (
        <Text style={styles.hint}>
          🌐 Check your internet connection and try again
        </Text>
      )}
    </View>
  );
};

interface SettingsErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onAuthError?: () => void;
}

export const SettingsErrorBoundary: React.FC<SettingsErrorBoundaryProps> = ({
  children,
  onError,
  onAuthError,
}) => {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Check if this is an auth-related error that requires re-authentication
    const isAuthError =
      error.message.includes("auth") ||
      error.message.includes("authentication") ||
      error.message.includes("user-not-found") ||
      error.message.includes("token-expired");

    if (isAuthError && onAuthError) {
      onAuthError();
    }

    if (onError) {
      onError(error, errorInfo);
    }
  };

  return (
    <AccountErrorBoundary
      context="settings management"
      fallbackComponent={SettingsErrorFallback}
      onError={handleError}
    >
      {children}
    </AccountErrorBoundary>
  );
};

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 24,
    backgroundColor: "#fff",
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
    color: "#d32f2f",
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
    gap: 12,
    marginBottom: 16,
  },
  button: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 90,
    alignItems: "center",
  },
  retryButton: {
    backgroundColor: "#2196f3",
  },
  authButton: {
    backgroundColor: "#4caf50",
  },
  supportButton: {
    backgroundColor: "#ff9800",
  },
  buttonText: {
    color: "#fff",
    fontSize: 15,
    fontWeight: "600",
  },
  hint: {
    fontSize: 12,
    color: "#666",
    fontStyle: "italic",
    textAlign: "center",
  },
});
