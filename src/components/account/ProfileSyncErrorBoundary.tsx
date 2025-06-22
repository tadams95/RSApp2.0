import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AccountErrorBoundary } from "./AccountErrorBoundary";

interface ProfileSyncErrorFallbackProps {
  error: Error;
  resetError: () => void;
  context?: string;
}

const ProfileSyncErrorFallback: React.FC<ProfileSyncErrorFallbackProps> = ({
  error,
  resetError,
}) => {
  const isNetworkError =
    error.message.includes("network") ||
    error.message.includes("Network") ||
    error.name === "NetworkError";

  const isRealtimeDBError =
    error.message.includes("database") ||
    error.message.includes("Database") ||
    error.message.includes("realtime");

  const isPermissionError =
    error.message.includes("permission") ||
    error.message.includes("unauthorized") ||
    error.message.includes("denied");

  const isSyncConflictError =
    error.message.includes("conflict") ||
    error.message.includes("version") ||
    error.message.includes("outdated");

  const isConnectionError =
    error.message.includes("connection") ||
    error.message.includes("timeout") ||
    error.message.includes("disconnected");

  const getErrorTitle = () => {
    if (isNetworkError || isConnectionError) return "Sync Connection Error";
    if (isPermissionError) return "Sync Permission Error";
    if (isSyncConflictError) return "Profile Sync Conflict";
    if (isRealtimeDBError) return "Database Sync Error";
    return "Profile Sync Error";
  };

  const getErrorMessage = () => {
    if (isNetworkError || isConnectionError) {
      return "Unable to sync your profile due to connection issues. Your changes are saved locally and will sync when connection is restored.";
    }
    if (isPermissionError) {
      return "You don't have permission to sync profile data. Please sign in again to restore sync functionality.";
    }
    if (isSyncConflictError) {
      return "There was a conflict while syncing your profile. Some changes may have been made elsewhere.";
    }
    if (isRealtimeDBError) {
      return "There was an issue connecting to the profile sync service. Your data is safe but may not be up to date.";
    }
    return "We encountered an error while syncing your profile data. Your local changes are preserved.";
  };

  const handleRetrySync = () => {
    resetError();
  };

  const handleForceSync = () => {
    Alert.alert(
      "Force Sync",
      "This will attempt to sync your profile data and may overwrite some changes. Continue?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Force Sync",
          onPress: resetError,
          style: "destructive",
        },
      ]
    );
  };

  const handleWorkOffline = () => {
    Alert.alert(
      "Work Offline",
      "You can continue using the app. Your changes will be saved locally and synced when connection is restored.",
      [{ text: "OK", style: "default", onPress: resetError }]
    );
  };

  const handleResolveConflict = () => {
    Alert.alert(
      "Resolve Conflict",
      "Choose which version of your profile data to keep:",
      [
        { text: "Cancel", style: "cancel" },
        { text: "Keep Local Changes", onPress: resetError },
        {
          text: "Use Server Version",
          onPress: resetError,
          style: "destructive",
        },
      ]
    );
  };

  const handleContactSupport = () => {
    Alert.alert(
      "Contact Support",
      "If profile sync continues to fail, please contact support@ragestate.com with details about when the issue started.",
      [{ text: "OK", style: "default" }]
    );
  };

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>{getErrorTitle()}</Text>
      <Text style={styles.errorMessage}>{getErrorMessage()}</Text>

      {error.message && (
        <Text style={styles.errorDetails}>Sync error: {error.message}</Text>
      )}

      <View style={styles.actionButtons}>
        {isSyncConflictError ? (
          <Pressable
            style={[styles.button, styles.conflictButton]}
            onPress={handleResolveConflict}
          >
            <Text style={styles.buttonText}>Resolve Conflict</Text>
          </Pressable>
        ) : (
          <Pressable
            style={[styles.button, styles.retryButton]}
            onPress={handleRetrySync}
          >
            <Text style={styles.buttonText}>Retry Sync</Text>
          </Pressable>
        )}

        {(isNetworkError || isConnectionError) && (
          <Pressable
            style={[styles.button, styles.offlineButton]}
            onPress={handleWorkOffline}
          >
            <Text style={styles.buttonText}>Work Offline</Text>
          </Pressable>
        )}

        {!isSyncConflictError && (
          <Pressable
            style={[styles.button, styles.forceButton]}
            onPress={handleForceSync}
          >
            <Text style={styles.buttonText}>Force Sync</Text>
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
          🌐 Your changes are saved locally and will sync automatically when
          online
        </Text>
      )}

      {isSyncConflictError && (
        <Text style={styles.hint}>
          ⚠️ Profile data conflict detected - please choose which version to
          keep
        </Text>
      )}

      {isPermissionError && (
        <Text style={styles.hint}>
          🔒 Sign in again to restore profile sync functionality
        </Text>
      )}
    </View>
  );
};

interface ProfileSyncErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onSyncFailure?: (error: Error) => void;
  onAuthError?: () => void;
}

export const ProfileSyncErrorBoundary: React.FC<
  ProfileSyncErrorBoundaryProps
> = ({ children, onError, onSyncFailure, onAuthError }) => {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Check if this is an auth-related error
    const isAuthError =
      error.message.includes("auth") ||
      error.message.includes("permission") ||
      error.message.includes("unauthorized");

    // Check if this is a sync-specific error
    const isSyncError =
      error.message.includes("sync") ||
      error.message.includes("database") ||
      error.message.includes("realtime");

    if (isAuthError && onAuthError) {
      onAuthError();
    }

    if (isSyncError && onSyncFailure) {
      onSyncFailure(error);
    }

    if (onError) {
      onError(error, errorInfo);
    }
  };

  return (
    <AccountErrorBoundary
      context="profile synchronization"
      fallbackComponent={ProfileSyncErrorFallback}
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
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    minWidth: 75,
    alignItems: "center",
    marginVertical: 3,
  },
  retryButton: {
    backgroundColor: "#2196f3",
  },
  conflictButton: {
    backgroundColor: "#ff5722",
  },
  forceButton: {
    backgroundColor: "#9c27b0",
  },
  offlineButton: {
    backgroundColor: "#607d8b",
  },
  supportButton: {
    backgroundColor: "#ff9800",
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
