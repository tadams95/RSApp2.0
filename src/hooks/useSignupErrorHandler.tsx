import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import {
  extractFirebaseErrorCode,
  getSignupErrorMessage,
  getSignupFieldError,
} from "../utils/firebaseErrorHandler";

/**
 * Custom hook for handling Firebase authentication errors specifically for signup
 * Provides consistent error handling across the signup flow
 */
export function useSignupErrorHandler() {
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
   * Handles Firebase authentication errors with consistent UI responses
   */
  const handleAuthError = useCallback(
    (error: any) => {
      // Get user-friendly error message
      const errorMessage = getSignupErrorMessage(error);
      setError(errorMessage);

      // Update specific field errors if applicable
      const fieldError = getSignupFieldError(error);
      if (fieldError.field !== "general") {
        setFieldErrors((prev) => ({
          ...prev,
          [fieldError.field]: fieldError.message,
        }));
      }

      // Extract Firebase error code
      const errorCode = extractFirebaseErrorCode(error);

      // Set appropriate recovery action based on error
      if (errorCode === "auth/email-already-in-use") {
        setRecoveryAction({
          text: "Go to Login",
          onPress: () => router.push("/(auth)/login"),
        });
      } else if (errorCode === "auth/network-request-failed") {
        setRecoveryAction({
          text: "Check Connection",
          onPress: () =>
            setError("Please check your internet connection and try again"),
        });
      } else if (errorCode === "auth/too-many-requests") {
        setRecoveryAction({
          text: "Reset Password",
          onPress: () => router.push("/(auth)/forgotPassword"),
        });
      } else if (errorCode === "auth/weak-password") {
        setRecoveryAction({
          text: "Password Tips",
          onPress: () =>
            Alert.alert(
              "Creating a Strong Password",
              "• Use at least 8 characters\n• Include uppercase and lowercase letters\n• Add numbers and special characters\n• Avoid using common words or personal info",
              [{ text: "OK", style: "default" }]
            ),
        });
      }

      // Log the error for debugging
      console.error("Signup error:", {
        originalError: error,
        errorCode: errorCode,
        userMessage: errorMessage,
      });

      // For specific critical errors, show an alert
      if (errorCode === "auth/account-exists-with-different-credential") {
        Alert.alert(
          "Account Already Exists",
          "An account with this email exists using a different sign-in method. Please try signing in with another method.",
          [
            {
              text: "Go to Login",
              onPress: () => router.push("/(auth)/login"),
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
    [router]
  );

  return {
    error,
    fieldErrors,
    recoveryAction,
    handleAuthError,
    clearErrors,
    setFieldError: (field: string, message: string) => {
      setFieldErrors((prev) => ({ ...prev, [field]: message }));
    },
  };
}

export default useSignupErrorHandler;
