import { useState, useCallback } from "react";

type ErrorWithMessage = {
  message: string;
};

interface UseErrorHandlerResult {
  error: Error | null;
  setError: (err: unknown) => void;
  clearError: () => void;
  getErrorMessage: (err: unknown) => string;
  handleApiError: <T>(promise: Promise<T>) => Promise<[T | null, Error | null]>;
}

/**
 * Custom hook for centralized error handling
 *
 * @returns Methods and state for error handling
 */
export function useErrorHandler(): UseErrorHandlerResult {
  const [error, setErrorState] = useState<Error | null>(null);

  /**
   * Sets the current error state with proper error object conversion
   */
  const setError = useCallback((err: unknown) => {
    const errorObject = toErrorWithMessage(err);
    setErrorState(errorObject);

    // Log errors in development mode
    if (__DEV__) {
      console.error("Error handled:", errorObject);
    }
  }, []);

  /**
   * Clears the current error state
   */
  const clearError = useCallback(() => {
    setErrorState(null);
  }, []);

  /**
   * Converts any error type to a consistent message format
   */
  const getErrorMessage = useCallback((err: unknown): string => {
    return toErrorWithMessage(err).message;
  }, []);

  /**
   * Handles API calls with consistent error handling
   * Returns tuple of [result, error]
   */
  const handleApiError = useCallback(
    async <T,>(promise: Promise<T>): Promise<[T | null, Error | null]> => {
      try {
        const data = await promise;
        return [data, null];
      } catch (err) {
        const errorObject = toErrorWithMessage(err);
        return [null, errorObject];
      }
    },
    []
  );

  return {
    error,
    setError,
    clearError,
    getErrorMessage,
    handleApiError,
  };
}

/**
 * Helper function to ensure we always have a proper Error object with a message
 */
function toErrorWithMessage(maybeError: unknown): Error {
  if (maybeError instanceof Error) return maybeError;

  try {
    // Handle different error types
    if (typeof maybeError === "string") {
      return new Error(maybeError);
    }

    if (
      typeof maybeError === "object" &&
      maybeError !== null &&
      "message" in maybeError &&
      typeof (maybeError as ErrorWithMessage).message === "string"
    ) {
      return new Error((maybeError as ErrorWithMessage).message);
    }

    // For JSON objects, try to stringify
    if (typeof maybeError === "object" && maybeError !== null) {
      try {
        const jsonString = JSON.stringify(maybeError);
        return new Error(jsonString);
      } catch {
        return new Error("Unknown error object that could not be stringified");
      }
    }

    // Default fallback
    return new Error("Unknown error occurred");
  } catch {
    // Last resort fallback
    return new Error("An unexpected error occurred");
  }
}

/**
 * Formats API error messages in a user-friendly way
 */
export function formatApiErrorMessage(error: unknown): string {
  const err = toErrorWithMessage(error);

  // Common network error patterns
  if (
    err.message.includes("Network Error") ||
    err.message.includes("timeout")
  ) {
    return "Network connection issue. Please check your internet connection and try again.";
  }

  if (
    err.message.includes("code 500") ||
    err.message.includes("Internal Server Error")
  ) {
    return "We're having trouble with our servers. Please try again in a few minutes.";
  }

  if (err.message.includes("code 401") || err.message.includes("code 403")) {
    return "Your session may have expired. Please log in again.";
  }

  if (err.message.includes("code 404")) {
    return "The requested information could not be found. Please try again.";
  }

  // Handle Firebase specific errors
  if (err.message.includes("auth/")) {
    if (
      err.message.includes("auth/wrong-password") ||
      err.message.includes("auth/user-not-found")
    ) {
      return "Invalid email or password. Please try again.";
    }
    if (err.message.includes("auth/email-already-in-use")) {
      return "This email is already registered. Please try logging in instead.";
    }
    if (err.message.includes("auth/weak-password")) {
      return "Please choose a stronger password.";
    }
    if (err.message.includes("auth/invalid-email")) {
      return "Please enter a valid email address.";
    }
    // Generic auth error
    return "Authentication error. Please try again.";
  }

  // Fallback for general errors
  return "Something went wrong. Please try again.";
}
