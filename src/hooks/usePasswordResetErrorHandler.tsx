import { useCallback, useState } from "react";

/**
 * Custom hook for handling Firebase password reset errors
 */
export function usePasswordResetErrorHandler() {
  const [error, setError] = useState<string | null>(null);
  const [hasAttempted, setHasAttempted] = useState<boolean>(false);

  /**
   * Clears the error state
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  /**
   * Handles password reset errors with user-friendly messages
   */
  const handleResetError = useCallback((error: any) => {
    setHasAttempted(true);

    // Extract error code or fallback to generic message
    const errorCode = error?.code || "";
    let errorMessage: string;

    // Provide specific messages for different error types
    switch (errorCode) {
      case "auth/invalid-email":
        errorMessage =
          "The email address is not valid. Please check and try again.";
        break;

      case "auth/user-not-found":
        // Don't disclose if user exists or not for security reasons
        errorMessage =
          "If this email is registered, you will receive reset instructions shortly.";
        break;

      case "auth/too-many-requests":
        errorMessage =
          "Too many password reset attempts. Please try again later.";
        break;

      case "auth/network-request-failed":
        errorMessage =
          "Network connection issue. Please check your internet connection.";
        break;

      default:
        errorMessage = error?.message || "An error occurred. Please try again.";
    }

    setError(errorMessage);
    return errorMessage;
  }, []);

  /**
   * Records a successful attempt
   */
  const handleSuccess = useCallback(() => {
    setHasAttempted(true);
    clearError();
  }, [clearError]);

  return {
    error,
    hasAttempted,
    handleResetError,
    handleSuccess,
    clearError,
  };
}

export default usePasswordResetErrorHandler;
