import React from "react";
import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { AccountErrorBoundary } from "./AccountErrorBoundary";

interface EditProfileErrorFallbackProps {
  error: Error;
  resetError: () => void;
  context?: string;
}

const EditProfileErrorFallback: React.FC<EditProfileErrorFallbackProps> = ({
  error,
  resetError,
}) => {
  const isNetworkError =
    error.message.includes("network") ||
    error.message.includes("Network") ||
    error.name === "NetworkError";

  const isValidationError =
    error.message.includes("validation") ||
    error.message.includes("invalid") ||
    error.message.includes("required");

  const getErrorTitle = () => {
    if (isNetworkError) return "Connection Error";
    if (isValidationError) return "Validation Error";
    return "Profile Update Failed";
  };

  const getErrorMessage = () => {
    if (isNetworkError) {
      return "Unable to update your profile due to connection issues. Please check your internet connection and try again.";
    }
    if (isValidationError) {
      return "There was an issue with the information you provided. Please check your entries and try again.";
    }
    return "We encountered an unexpected error while updating your profile. Your information has been preserved.";
  };

  const handleContactSupport = () => {
    Alert.alert(
      "Contact Support",
      "If this problem continues, please reach out to us at support@ragestate.com with details about what you were trying to update.",
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
        <Pressable
          style={[styles.button, styles.retryButton]}
          onPress={resetError}
        >
          <Text style={styles.buttonText}>Try Again</Text>
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
          💡 Tip: Check your internet connection and try again
        </Text>
      )}
    </View>
  );
};

interface EditProfileErrorBoundaryProps {
  children: React.ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

export const EditProfileErrorBoundary: React.FC<
  EditProfileErrorBoundaryProps
> = ({ children, onError }) => {
  return (
    <AccountErrorBoundary
      context="profile update"
      fallbackComponent={EditProfileErrorFallback}
      onError={onError}
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
