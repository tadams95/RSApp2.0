import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AccountErrorBoundary } from "./AccountErrorBoundary";

interface UserDataErrorFallbackProps {
  error: Error;
  resetError: () => void;
  context?: string;
}

const UserDataErrorFallback: React.FC<UserDataErrorFallbackProps> = ({
  error,
  resetError,
}) => {
  const isNetworkError =
    error.message.includes("network") ||
    error.message.includes("Network") ||
    error.name === "NetworkError";

  const isPermissionError =
    error.message.includes("permission") ||
    error.message.includes("unauthorized") ||
    error.message.includes("denied");

  const isFirestoreError =
    error.message.includes("firestore") ||
    error.message.includes("Firestore") ||
    error.message.includes("document");

  const isAuthError =
    error.message.includes("auth") ||
    error.message.includes("authentication") ||
    error.message.includes("user-not-found");

  const getErrorTitle = () => {
    if (isNetworkError) return "Connection Error";
    if (isPermissionError) return "Access Denied";
    if (isAuthError) return "Authentication Error";
    if (isFirestoreError) return "Data Access Error";
    return "Profile Data Error";
  };

  const getErrorMessage = () => {
    if (isNetworkError) {
      return "Unable to load your profile data due to connection issues. Please check your internet connection.";
    }
    if (isPermissionError) {
      return "You don't have permission to access your profile data. Please sign in again.";
    }
    if (isAuthError) {
      return "Your session has expired. Please sign in again to view your profile.";
    }
    if (isFirestoreError) {
      return "There was an issue accessing your profile data from our servers. Please try again.";
    }
    return "We encountered an error while loading your profile information. Please try again.";
  };

  const handleRefresh = () => {
    resetError();
  };

  const handleSignInAgain = () => {
    Alert.alert(
      "Session Expired",
      "You will be redirected to sign in again to access your profile data.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign In",
          onPress: resetError,
        },
      ]
    );
  };

  const handleOfflineMode = () => {
    Alert.alert(
      "Limited Access",
      "You can continue using the app with limited functionality while offline. Some features may not be available.",
      [{ text: "OK", style: "default", onPress: resetError }]
    );
  };

  const handleContactSupport = () => {
    Alert.alert(
      "Contact Support",
      "If you continue to have trouble accessing your profile data, please contact support@ragestate.com",
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
        {isAuthError || isPermissionError ? (
          <Pressable
            style={[styles.button, styles.authButton]}
            onPress={handleSignInAgain}
          >
            <Text style={styles.buttonText}>Sign In Again</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.button, styles.retryButton]}
            onPress={handleRefresh}
          >
            <Text style={styles.buttonText}>Refresh</Text>
          </Pressable>
        )}

        {isNetworkError && (
          <Pressable
            style={[styles.button, styles.offlineButton]}
            onPress={handleOfflineMode}
          >
            <Text style={styles.buttonText}>Continue Offline</Text>
          </Pressable>
        )}

        <Pressable
          style={[styles.button, styles.supportButton]}
          onPress={handleContactSupport}
        >
          <Text style={styles.buttonText}>Get Help</Text>
        </Pressable>
      </View>

      {isNetworkError && (
        <Text style={styles.hint}>
          🌐 Check your internet connection or continue with limited
          functionality
        </Text>
      )}

      {isAuthError && (
        <Text style={styles.hint}>
          🔒 Signing in again will restore access to your profile data
        </Text>
      )}

      {isFirestoreError && (
        <Text style={styles.hint}>
          📊 Our servers may be experiencing issues - please try again shortly
        </Text>
      )}
    </View>
  );
};

interface UserDataErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onAuthError?: () => void;
  allowOfflineMode?: boolean;
}

export const UserDataErrorBoundary: React.FC<UserDataErrorBoundaryProps> = ({
  children,
  onError,
  onAuthError,
  allowOfflineMode = true,
}) => {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Check if this is an auth-related error that requires re-authentication
    const isAuthError =
      error.message.includes("auth") ||
      error.message.includes("authentication") ||
      error.message.includes("user-not-found") ||
      error.message.includes("permission");

    if (isAuthError && onAuthError) {
      onAuthError();
    }

    if (onError) {
      onError(error, errorInfo);
    }
  };

  return (
    <AccountErrorBoundary
      context="user data loading"
      fallbackComponent={UserDataErrorFallback}
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
    backgroundColor: "#2196f3",
  },
  authButton: {
    backgroundColor: "#4caf50",
  },
  offlineButton: {
    backgroundColor: "#607d8b",
  },
  supportButton: {
    backgroundColor: "#ff9800",
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
