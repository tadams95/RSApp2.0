/**
 * Specialized utility to handle Firebase database operation errors
 * This provides consistent error handling for RTDB and Firestore operations
 */

import {
  extractFirebaseErrorCode,
  FirebaseAuthErrorCode,
} from "./firebaseErrorHandler";

// Type for Firebase Database error codes
export type FirebaseDatabaseErrorCode =
  | "permission-denied"
  | "unavailable"
  | "failed-precondition"
  | "data-loss"
  | "resource-exhausted"
  | "cancelled"
  | "deadline-exceeded"
  | "internal"
  | "invalid-argument"
  | "not-found"
  | "already-exists"
  | "permission-denied"
  | "unauthenticated"
  | "aborted"
  | "out-of-range"
  | "unimplemented"
  | "unknown"
  | string; // For any other codes not explicitly listed

// Common interface for database errors
export interface FirebaseDatabaseError {
  code: FirebaseDatabaseErrorCode;
  message: string;
}

/**
 * Extracts Firebase database error code from various error formats
 * @param error Any error object that might contain a Firebase error code
 * @returns The Firebase database error code or null if not found
 */
export function extractDatabaseErrorCode(
  error: any
): FirebaseDatabaseErrorCode | FirebaseAuthErrorCode | null {
  if (!error) return null;

  // First try the standard Firebase error code extraction
  const authCode = extractFirebaseErrorCode(error);
  if (authCode) return authCode;

  // Direct code property (most common)
  if (error.code && typeof error.code === "string") {
    return error.code as FirebaseDatabaseErrorCode;
  }

  // Check for code in message
  if (error.message && typeof error.message === "string") {
    // Look for patterns like "permission_denied" in the message
    const permissionMatch = error.message.match(/permission[_-]denied/i);
    if (permissionMatch) return "permission-denied";

    const quotaMatch = error.message.match(
      /quota exceeded|resource exhausted/i
    );
    if (quotaMatch) return "resource-exhausted";

    const networkMatch = error.message.match(
      /network error|connection|offline/i
    );
    if (networkMatch) return "unavailable";

    const invalidDataMatch = error.message.match(
      /invalid data|validation failed/i
    );
    if (invalidDataMatch) return "invalid-argument";
  }

  return "unknown";
}

/**
 * Provides user-friendly error messages for common Firebase database errors
 * Specialized for profile update error handling
 */
export function getProfileUpdateErrorMessage(error: any): string {
  const errorCode = extractDatabaseErrorCode(error);

  if (!errorCode) {
    // Default fallback if we can't identify a specific error code
    return (
      error?.message ||
      "An unexpected error occurred while updating your profile. Please try again."
    );
  }

  // Return user-friendly error messages based on Firebase error codes
  switch (errorCode) {
    case "permission-denied":
      return "You don't have permission to update this profile. Please log in again and try once more.";

    case "unavailable":
      return "Network connection issue. Please check your internet connection and try again.";

    case "invalid-argument":
      return "The information you provided contains invalid data. Please review your entries and try again.";

    case "resource-exhausted":
      return "We're experiencing high demand right now. Please try again in a few moments.";

    case "unauthenticated":
      return "Your login session has expired. Please log in again to continue.";

    case "deadline-exceeded":
      return "The operation timed out. Please try again when you have a stronger connection.";

    case "already-exists":
      return "This information is already in use by another account.";

    case "not-found":
      return "We couldn't find your profile. It may have been deleted or moved.";

    case "auth/requires-recent-login":
      return "For security reasons, please log in again before making these changes.";

    default:
      // For any other Firebase database errors
      return `Profile update failed: ${
        error.message || "Unknown error"
      }. Please try again.`;
  }
}

/**
 * Get field-specific error message for database operations
 */
export function getProfileUpdateFieldError(error: any): {
  field: "firstName" | "lastName" | "email" | "phoneNumber" | "general";
  message: string;
} {
  const errorCode = extractDatabaseErrorCode(error);

  if (!errorCode) {
    return {
      field: "general",
      message: error?.message || "An unexpected error occurred",
    };
  }

  // Check if the error message contains specific field references
  const errorMessage = error.message?.toLowerCase() || "";

  if (errorMessage.includes("email")) {
    return {
      field: "email",
      message: "Invalid email format or already in use",
    };
  }

  if (errorMessage.includes("phone")) {
    return { field: "phoneNumber", message: "Invalid phone number format" };
  }

  if (errorMessage.includes("name")) {
    if (errorMessage.includes("first")) {
      return { field: "firstName", message: "Invalid first name format" };
    }
    if (errorMessage.includes("last")) {
      return { field: "lastName", message: "Invalid last name format" };
    }
  }

  // Default error handling by error code
  switch (errorCode) {
    case "invalid-argument":
      return { field: "general", message: "Invalid data provided" };

    case "permission-denied":
      return { field: "general", message: "Permission denied" };

    case "unauthenticated":
      return { field: "general", message: "Session expired" };

    default:
      return { field: "general", message: "Update failed" };
  }
}

/**
 * Provides recovery actions for specific Firebase database errors
 */
export function getProfileUpdateRecoveryAction(error: any): {
  actionText: string;
  action:
    | "retry"
    | "check-connection"
    | "reload-profile"
    | "login-again"
    | "contact-support"
    | "none";
} {
  const errorCode = extractDatabaseErrorCode(error);

  if (!errorCode) {
    return { actionText: "Try Again", action: "retry" };
  }

  switch (errorCode) {
    case "unavailable":
      return { actionText: "Check Connection", action: "check-connection" };

    case "unauthenticated":
    case "auth/requires-recent-login":
      return { actionText: "Login Again", action: "login-again" };

    case "not-found":
      return { actionText: "Reload Profile", action: "reload-profile" };

    case "permission-denied":
    case "resource-exhausted":
    case "deadline-exceeded":
    case "internal":
      return { actionText: "Contact Support", action: "contact-support" };

    default:
      return { actionText: "Try Again", action: "retry" };
  }
}
