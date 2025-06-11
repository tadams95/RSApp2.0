import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import {
  extractDatabaseErrorCode,
  getProfileUpdateErrorMessage,
  getProfileUpdateFieldError,
  getProfileUpdateRecoveryAction,
} from "../utils/databaseErrorHandler";

/**
 * Custom hook for handling Firebase database errors specifically for profile updates
 * Provides consistent error handling across the profile update flow
 */
export function useProfileUpdateErrorHandler() {
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [recoveryAction, setRecoveryAction] = useState<{
    text: string;
    onPress: () => void;
  } | null>(null);

  const router = useRouter();

  /**
   * Clears all error states
   */
  const clearErrors = useCallback(() => {
    setError(null);
    setFieldErrors({});
    setRecoveryAction(null);
  }, []);

  /**
   * Handles Firebase database errors with consistent UI responses
   */
  const handleUpdateError = useCallback(
    (error: any, onReload?: () => void) => {
      // Get user-friendly error message
      const errorMessage = getProfileUpdateErrorMessage(error);
      setError(errorMessage);

      // Update specific field errors if applicable
      const fieldError = getProfileUpdateFieldError(error);
      if (fieldError.field !== "general") {
        setFieldErrors((prev) => ({
          ...prev,
          [fieldError.field]: fieldError.message,
        }));
      }

      // Extract error code
      const errorCode = extractDatabaseErrorCode(error);

      // Get recommended recovery action
      const recoveryActionInfo = getProfileUpdateRecoveryAction(error);

      // Set appropriate recovery action based on error
      switch (recoveryActionInfo.action) {
        case "check-connection":
          setRecoveryAction({
            text: recoveryActionInfo.actionText,
            onPress: () =>
              setError("Please check your internet connection and try again"),
          });
          break;

        case "login-again":
          setRecoveryAction({
            text: recoveryActionInfo.actionText,
            onPress: () => {
              Alert.alert(
                "Session Expired",
                "For security reasons, please log in again to update your profile.",
                [
                  {
                    text: "Log Out",
                    onPress: () => router.push("/(auth)/"),
                  },
                  {
                    text: "Cancel",
                    style: "cancel",
                  },
                ]
              );
            },
          });
          break;

        case "reload-profile":
          if (onReload) {
            setRecoveryAction({
              text: recoveryActionInfo.actionText,
              onPress: () => {
                clearErrors();
                onReload();
              },
            });
          }
          break;

        case "contact-support":
          setRecoveryAction({
            text: recoveryActionInfo.actionText,
            onPress: () => {
              Alert.alert(
                "Contact Support",
                "Please contact support if this issue persists.",
                [{ text: "OK", style: "default" }]
              );
            },
          });
          break;

        default:
          // Default to retry
          setRecoveryAction({
            text: "Try Again",
            onPress: clearErrors,
          });
          break;
      }

      // Log the error for debugging
      console.error("Profile update error:", {
        originalError: error,
        errorCode: errorCode,
        userMessage: errorMessage,
      });

      // For critical errors, show an alert
      if (errorCode === "not-found" || errorCode === "permission-denied") {
        Alert.alert(
          "Profile Error",
          "There was an issue accessing your profile. Please try logging in again.",
          [
            {
              text: "Log Out",
              onPress: () => router.push("/(auth)/"),
            },
            {
              text: "OK",
              style: "cancel",
            },
          ]
        );
      }

      return errorCode;
    },
    [router, clearErrors]
  );

  return {
    error,
    fieldErrors,
    recoveryAction,
    handleUpdateError,
    clearErrors,
    setFieldError: (field: string, message: string) => {
      setFieldErrors((prev) => ({ ...prev, [field]: message }));
    },
  };
}

export default useProfileUpdateErrorHandler;
