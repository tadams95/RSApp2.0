import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AccountErrorBoundary } from "./AccountErrorBoundary";

interface ProfilePictureErrorFallbackProps {
  error: Error;
  resetError: () => void;
  context?: string;
}

const ProfilePictureErrorFallback: React.FC<
  ProfilePictureErrorFallbackProps
> = ({ error, resetError }) => {
  const isStorageError =
    error.message.includes("storage") ||
    error.message.includes("Storage") ||
    error.message.includes("unauthorized");

  const isNetworkError =
    error.message.includes("network") ||
    error.message.includes("Network") ||
    error.name === "NetworkError";

  const isFileSizeError =
    error.message.includes("size") ||
    error.message.includes("limit") ||
    error.message.includes("large");

  const isPermissionError =
    error.message.includes("permission") ||
    error.message.includes("unauthorized") ||
    error.message.includes("denied");

  const getErrorTitle = () => {
    if (isStorageError || isPermissionError) return "Upload Permission Error";
    if (isNetworkError) return "Connection Error";
    if (isFileSizeError) return "File Size Error";
    return "Profile Picture Error";
  };

  const getErrorMessage = () => {
    if (isPermissionError) {
      return "You don't have permission to upload or delete profile pictures. Please sign in again.";
    }
    if (isNetworkError) {
      return "Unable to upload your profile picture due to connection issues. Please check your internet connection.";
    }
    if (isFileSizeError) {
      return "The selected image is too large. Please choose an image smaller than 5MB.";
    }
    if (isStorageError) {
      return "There was an issue with the image storage service. Please try again in a few moments.";
    }
    return "We encountered an error while processing your profile picture. Please try again.";
  };

  const handleRetryWithPermission = () => {
    Alert.alert(
      "Permission Required",
      "You'll be redirected to sign in again to refresh your permissions.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign In Again",
          onPress: () => {
            // This will trigger a re-authentication flow
            resetError();
          },
        },
      ]
    );
  };

  const handleSelectNewImage = () => {
    Alert.alert(
      "Select New Image",
      "Would you like to choose a different image? Make sure it's smaller than 5MB.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Choose Image",
          onPress: resetError,
        },
      ]
    );
  };

  const handleContactSupport = () => {
    Alert.alert(
      "Contact Support",
      "If you continue to have trouble uploading your profile picture, please contact support@ragestate.com",
      [{ text: "OK", style: "default" }]
    );
  };

  return (
    <View style={styles.errorContainer}>
      <Text style={styles.errorTitle}>{getErrorTitle()}</Text>
      <Text style={styles.errorMessage}>{getErrorMessage()}</Text>

      {error.message && (
        <Text style={styles.errorDetails}>
          Technical details: {error.message}
        </Text>
      )}

      <View style={styles.actionButtons}>
        {isPermissionError ? (
          <Pressable
            style={[styles.button, styles.authButton]}
            onPress={handleRetryWithPermission}
          >
            <Text style={styles.buttonText}>Sign In Again</Text>
          </Pressable>
        ) : isFileSizeError ? (
          <Pressable
            style={[styles.button, styles.selectButton]}
            onPress={handleSelectNewImage}
          >
            <Text style={styles.buttonText}>Choose New Image</Text>
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

      {isFileSizeError && (
        <Text style={styles.hint}>
          📏 Tip: Images should be smaller than 5MB for best results
        </Text>
      )}

      {isNetworkError && (
        <Text style={styles.hint}>
          🌐 Check your internet connection and try again
        </Text>
      )}

      {isPermissionError && (
        <Text style={styles.hint}>
          🔒 Signing in again will refresh your upload permissions
        </Text>
      )}
    </View>
  );
};

interface ProfilePictureErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  onAuthError?: () => void;
}

export const ProfilePictureErrorBoundary: React.FC<
  ProfilePictureErrorBoundaryProps
> = ({ children, onError, onAuthError }) => {
  const handleError = (error: Error, errorInfo: React.ErrorInfo) => {
    // Check if this is a permission error that requires re-authentication
    const isPermissionError =
      error.message.includes("permission") ||
      error.message.includes("unauthorized") ||
      error.message.includes("denied");

    if (isPermissionError && onAuthError) {
      onAuthError();
    }

    if (onError) {
      onError(error, errorInfo);
    }
  };

  return (
    <AccountErrorBoundary
      context="profile picture upload"
      fallbackComponent={ProfilePictureErrorFallback}
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
  selectButton: {
    backgroundColor: "#9c27b0",
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
