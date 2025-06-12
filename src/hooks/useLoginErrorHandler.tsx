import { useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { extractFirebaseErrorCode } from "../utils/firebaseErrorHandler";

/**
 * Custom hook for handling Firebase authentication errors specifically for login
 * Provides consistent error handling across the login flow
 */
export function useLoginErrorHandler() {
  const [error, setError] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState<number>(0);
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
    setRecoveryAction(null);
  }, []);

  /**
   * Resets the failed attempts counter
   */
  const resetFailedAttempts = useCallback(() => {
    setFailedAttempts(0);
  }, []);

  /**
   * Handles Firebase authentication errors with consistent UI responses
   * Tracks login attempts and provides appropriate recovery actions
   */
  const handleLoginError = useCallback(
    (error: any) => {
      // Count failed attempts
      setFailedAttempts((prev) => prev + 1);

      // Extract Firebase error code
      const errorCode = extractFirebaseErrorCode(error);
      let errorMessage: string;

      if (!errorCode) {
        errorMessage =
          error?.message ||
          "An unexpected login error occurred. Please try again.";
      } else {
        // Return user-friendly error messages based on Firebase error codes
        switch (errorCode) {
          case "auth/invalid-email":
            errorMessage = "Please enter a valid email address.";
            break;

          case "auth/user-not-found":
            errorMessage =
              "No account found with this email. Check your email or create a new account.";
            setRecoveryAction({
              text: "Sign Up Instead",
              onPress: () => router.push("/(auth)/signup"),
            });
            break;

          case "auth/wrong-password":
            errorMessage =
              "Incorrect password. Please try again or reset your password.";
            setRecoveryAction({
              text: "Reset Password",
              onPress: () => router.push("/(auth)/forgot"),
            });
            break;

          case "auth/too-many-requests":
            errorMessage =
              "Access temporarily disabled due to many failed login attempts. Reset your password or try again later.";
            setRecoveryAction({
              text: "Reset Password",
              onPress: () => router.push("/(auth)/forgot"),
            });
            break;

          case "auth/user-disabled":
            errorMessage =
              "This account has been disabled. Please contact support for assistance.";
            break;

          case "auth/network-request-failed":
            errorMessage =
              "Network connection issue. Please check your internet connection and try again.";
            setRecoveryAction({
              text: "Try Again",
              onPress: clearErrors,
            });
            break;

          default:
            errorMessage = `Login failed: ${
              error.message || "Unknown error"
            }. Please try again.`;
        }
      }

      setError(errorMessage);

      // Handle multiple failed attempts
      if (
        failedAttempts >= 2 &&
        !recoveryAction &&
        errorCode === "auth/wrong-password"
      ) {
        setRecoveryAction({
          text: "Forgot Password?",
          onPress: () => router.push("/(auth)/forgot"),
        });

        // Show additional guidance after repeated failures
        if (failedAttempts >= 4) {
          Alert.alert(
            "Having Trouble Logging In?",
            "You've made several unsuccessful login attempts. Would you like to reset your password?",
            [
              {
                text: "Reset Password",
                onPress: () => router.push("/(auth)/forgot"),
              },
              {
                text: "Try Again",
                style: "cancel",
              },
            ]
          );
        }
      }

      // Log the error for debugging
      console.error("Login error:", {
        originalError: error,
        errorCode: errorCode,
        userMessage: errorMessage,
        attempts: failedAttempts + 1,
      });

      return errorMessage;
    },
    [router, failedAttempts, recoveryAction, clearErrors]
  );

  return {
    error,
    setError,
    failedAttempts,
    recoveryAction,
    handleLoginError,
    clearErrors,
    resetFailedAttempts,
  };
}

export default useLoginErrorHandler;
