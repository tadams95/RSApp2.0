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
  // Write operation specific error codes
  | "write-operation-failed"
  | "data-validation-failed"
  | "insufficient-permissions"
  | "concurrent-modification"
  | "write-conflict"
  | "quota-exceeded"
  | "network-error"
  // Validation specific error codes
  | "validation-email-format"
  | "validation-name-format"
  | "validation-phone-format"
  | "validation-required-field"
  | "validation-field-length"
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

    // Added validation-specific patterns
    const invalidDataMatch = error.message.match(
      /invalid data|validation failed|validate/i
    );
    if (invalidDataMatch) return "data-validation-failed";

    const emailFormatMatch = error.message.match(/email format|invalid email/i);
    if (emailFormatMatch) return "validation-email-format";

    const nameFormatMatch = error.message.match(/name format|invalid name/i);
    if (nameFormatMatch) return "validation-name-format";

    const phoneFormatMatch = error.message.match(
      /phone format|invalid phone|phone number/i
    );
    if (phoneFormatMatch) return "validation-phone-format";
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
 * Enhanced to better handle validation-specific errors
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

  // First try to match based on specific validation error codes
  switch (errorCode) {
    case "validation-email-format":
      return {
        field: "email",
        message: "Please enter a valid email address (e.g., name@example.com)",
      };

    case "validation-name-format":
      if (errorMessage.includes("first")) {
        return {
          field: "firstName",
          message: "First name contains invalid characters",
        };
      }
      if (errorMessage.includes("last")) {
        return {
          field: "lastName",
          message: "Last name contains invalid characters",
        };
      }
      // If we can't determine which name field, make a guess based on error message
      return {
        field: errorMessage.includes("first") ? "firstName" : "lastName",
        message: "Name contains invalid characters",
      };

    case "validation-phone-format":
      return {
        field: "phoneNumber",
        message: "Please enter a valid phone number format",
      };

    case "validation-required-field":
      if (errorMessage.includes("email")) {
        return { field: "email", message: "Email is required" };
      }
      if (errorMessage.includes("phone")) {
        return { field: "phoneNumber", message: "Phone number is required" };
      }
      if (errorMessage.includes("first name")) {
        return { field: "firstName", message: "First name is required" };
      }
      if (errorMessage.includes("last name")) {
        return { field: "lastName", message: "Last name is required" };
      }
      break;

    case "data-validation-failed":
      // Try to determine which field failed validation from the error message
      if (errorMessage.includes("email")) {
        return { field: "email", message: "Invalid email format" };
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
      break;
  }

  // If no specific validation error code, try to determine from the message
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

/**
 * Handles errors that occur during Firebase write operations
 * Enhanced to handle validation failures more robustly
 *
 * @param error Any error that might have occurred during a write operation
 * @returns An object with user-friendly message, recovery options, and error code
 */
export function handleWriteOperationError(error: any): {
  message: string;
  recoverable: boolean;
  code: FirebaseDatabaseErrorCode;
  action?:
    | "retry"
    | "check-auth"
    | "check-connection"
    | "contact-support"
    | "review-input";
  fieldErrors?: Record<string, string>; // Added for field-specific validation errors
} {
  const errorCode = extractDatabaseErrorCode(error) || "unknown";
  const errorMessage = error?.message?.toLowerCase() || "";

  // Enhanced validation error handling
  if (
    errorCode === "data-validation-failed" ||
    errorCode === "invalid-argument" ||
    errorCode.startsWith("validation-") ||
    errorMessage.includes("validation") ||
    errorMessage.includes("schema") ||
    errorMessage.includes("invalid") ||
    errorMessage.includes("required field")
  ) {
    // Extract field-specific errors with enhanced precision
    const fieldErrors = extractFieldValidationErrors(error);
    const hasSpecificErrors = Object.keys(fieldErrors).length > 0;

    // Construct appropriate message based on field errors
    let validationMessage =
      "The information you entered doesn't meet our requirements.";

    if (hasSpecificErrors) {
      // Mention affected fields in the message
      const affectedFields = Object.keys(fieldErrors)
        .map((field) => {
          // Format field name for display (e.g., firstName -> First Name)
          return field
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (str) => str.toUpperCase());
        })
        .join(", ");

      validationMessage = `Validation failed for: ${affectedFields}. Please review your input and try again.`;
    }

    return {
      message: validationMessage,
      recoverable: true,
      code: "data-validation-failed",
      action: "review-input",
      fieldErrors: hasSpecificErrors ? fieldErrors : undefined,
    };
  }

  // Rest of error handling for non-validation errors
  switch (errorCode) {
    case "permission-denied":
    case "insufficient-permissions":
    case "unauthenticated":
      return {
        message:
          "You don't have permission to perform this action. Please log in again and retry.",
        recoverable: true,
        code: "insufficient-permissions",
        action: "check-auth",
      };

    case "unavailable":
    case "deadline-exceeded":
    case "network-error":
      return {
        message:
          "Network issue detected. Please check your connection and try again.",
        recoverable: true,
        code: "network-error",
        action: "check-connection",
      };

    case "write-conflict":
    case "concurrent-modification":
      return {
        message:
          "This data was modified elsewhere. Please refresh and try again.",
        recoverable: true,
        code: "write-conflict",
      };

    case "resource-exhausted":
    case "quota-exceeded":
      return {
        message:
          "Service is currently busy. Please try again in a few moments.",
        recoverable: true,
        code: "quota-exceeded",
      };

    case "internal":
    case "data-loss":
      return {
        message: "A server error occurred. Our team has been notified.",
        recoverable: false,
        code: "write-operation-failed",
        action: "contact-support",
      };

    default:
      return {
        message: "An error occurred while saving data. Please try again.",
        recoverable: true,
        code: "write-operation-failed",
      };
  }
}

/**
 * Verifies authentication state before performing cart operations
 * Returns current user ID if authenticated or throws a standardized error
 *
 * @param currentUserId The current user ID from auth state
 * @returns The verified user ID
 * @throws Standardized error with appropriate code if not authenticated
 */
export function verifyAuthForCartOperation(
  currentUserId: string | null | undefined
): string {
  // Check if user ID exists
  if (!currentUserId) {
    const error = new Error("User authentication required for this operation");
    // Set properties to match Firebase error format for consistent handling
    (error as any).code = "insufficient-permissions";
    throw error;
  }

  return currentUserId;
}

/**
 * Generates user-friendly messages for permission-related errors
 * Contextualizes the error message based on the operation being performed
 *
 * @param error The original error object
 * @param operation The specific operation being performed (e.g., 'checkout', 'order', 'profile-update')
 * @returns User-friendly error message with guidance
 */
export function getUserFriendlyPermissionMessage(
  error: any,
  operation:
    | "checkout"
    | "order-creation"
    | "profile-update"
    | "cart-update"
    | string
): string {
  const errorCode = extractDatabaseErrorCode(error);

  // Base message by operation type
  const baseMessages = {
    checkout: "We couldn't complete your checkout",
    "order-creation": "We couldn't create your order",
    "profile-update": "We couldn't update your profile",
    "cart-update": "We couldn't update your cart",
  };

  const baseMessage =
    baseMessages[operation as keyof typeof baseMessages] ||
    "We couldn't complete your request";

  // Add specific guidance based on error code
  switch (errorCode) {
    case "permission-denied":
    case "insufficient-permissions":
      return `${baseMessage} because you don't have permission. Please sign in again to continue.`;

    case "unauthenticated":
      return `${baseMessage} because your session has expired. Please sign in again.`;

    default:
      return `${baseMessage} due to an authentication issue. Please try signing out and back in.`;
  }
}

/**
 * Extract field-specific validation errors from general error message and code
 * Provides structured field errors for form validation
 *
 * @param error Any error object that might contain validation error information
 * @returns Record of field name to error message or empty object if no field errors detected
 */
export function extractFieldValidationErrors(
  error: any
): Record<string, string> {
  const fieldErrors: Record<string, string> = {};

  // First check if the error already has field errors attached
  if (error?.validationErrors && typeof error.validationErrors === "object") {
    return { ...error.validationErrors };
  }

  if (error?.fieldErrors && typeof error.fieldErrors === "object") {
    return { ...error.fieldErrors };
  }

  const errorMessage = error?.message?.toLowerCase() || "";
  const errorCode = extractDatabaseErrorCode(error) || "unknown";

  // Extract from email-related errors
  if (
    errorCode === "validation-email-format" ||
    (errorMessage.includes("email") &&
      (errorMessage.includes("format") ||
        errorMessage.includes("invalid") ||
        errorMessage.includes("pattern") ||
        errorMessage.includes("match")))
  ) {
    fieldErrors.email =
      "Please enter a valid email address (e.g., name@example.com)";
  }

  // Extract from name-related errors
  if (
    errorMessage.includes("first name") ||
    errorMessage.includes("firstname")
  ) {
    if (errorMessage.includes("string")) {
      fieldErrors.firstName = "First name must be text";
    } else if (errorMessage.includes("invalid")) {
      fieldErrors.firstName = "First name contains invalid characters";
    } else {
      fieldErrors.firstName = "Invalid first name";
    }
  }

  if (errorMessage.includes("last name") || errorMessage.includes("lastname")) {
    if (errorMessage.includes("string")) {
      fieldErrors.lastName = "Last name must be text";
    } else if (errorMessage.includes("invalid")) {
      fieldErrors.lastName = "Last name contains invalid characters";
    } else {
      fieldErrors.lastName = "Invalid last name";
    }
  }

  // Just "name" without specifying first/last is trickier
  if (
    errorMessage.includes("name") &&
    !errorMessage.includes("first") &&
    !errorMessage.includes("last")
  ) {
    // Make a best guess based on context
    if (errorMessage.includes("string")) {
      fieldErrors.firstName = "Name must be text";
    } else if (errorMessage.includes("invalid")) {
      fieldErrors.firstName = "Name contains invalid characters";
    }
  }

  // Extract from phone-related errors
  if (
    errorCode === "validation-phone-format" ||
    (errorMessage.includes("phone") &&
      (errorMessage.includes("format") ||
        errorMessage.includes("invalid") ||
        errorMessage.includes("string")))
  ) {
    if (errorMessage.includes("string")) {
      fieldErrors.phoneNumber = "Phone number must be text";
    } else {
      fieldErrors.phoneNumber = "Please enter a valid phone number";
    }
  }

  return fieldErrors;
}
