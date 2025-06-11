/**
 * Specialized utility to handle Firebase authentication errors
 * This provides consistent error messages for Firebase error codes
 */

// Type for Firebase Auth error codes
export type FirebaseAuthErrorCode =
  | "auth/email-already-in-use"
  | "auth/invalid-email"
  | "auth/user-disabled"
  | "auth/user-not-found"
  | "auth/wrong-password"
  | "auth/invalid-credential"
  | "auth/operation-not-allowed"
  | "auth/weak-password"
  | "auth/network-request-failed"
  | "auth/too-many-requests"
  | "auth/requires-recent-login"
  | "auth/account-exists-with-different-credential"
  | "auth/invalid-verification-code"
  | "auth/invalid-verification-id"
  | "auth/missing-verification-code"
  | "auth/missing-verification-id"
  | "auth/provider-already-linked"
  | "auth/credential-already-in-use"
  | string; // For any other codes not explicitly listed

// Common interface for auth errors
export interface FirebaseAuthError {
  code: FirebaseAuthErrorCode;
  message: string;
}

// Error response structure from Firebase to help with parsing
export interface FirebaseErrorResponse {
  code?: string;
  message?: string;
  response?: {
    data?: {
      error?: {
        message?: string;
      };
    };
  };
}

/**
 * Extracts Firebase error code from various error formats
 * @param error Any error object that might contain a Firebase error code
 * @returns The Firebase error code or null if not found
 */
export function extractFirebaseErrorCode(
  error: any
): FirebaseAuthErrorCode | null {
  if (!error) return null;

  // Direct code property (most common)
  if (error.code && typeof error.code === "string") {
    return error.code as FirebaseAuthErrorCode;
  }

  // Check for code in message
  if (error.message && typeof error.message === "string") {
    const codeMatch = error.message.match(/auth\/[\w-]+/);
    if (codeMatch) {
      return codeMatch[0] as FirebaseAuthErrorCode;
    }
  }

  // Check for REST API error format
  if (error.response?.data?.error?.message) {
    const message = error.response.data.error.message;

    // Map common REST error messages to Firebase auth codes
    if (message === "EMAIL_EXISTS") return "auth/email-already-in-use";
    if (message === "EMAIL_NOT_FOUND") return "auth/user-not-found";
    if (message === "INVALID_PASSWORD") return "auth/wrong-password";
    if (message === "USER_DISABLED") return "auth/user-disabled";
    if (message === "WEAK_PASSWORD") return "auth/weak-password";
    if (message === "TOO_MANY_ATTEMPTS_TRY_LATER")
      return "auth/too-many-requests";
  }

  return null;
}

/**
 * Provides user-friendly error messages for common Firebase authentication errors
 * Specialized for signup error handling
 */
export function getSignupErrorMessage(error: any): string {
  const errorCode = extractFirebaseErrorCode(error);

  if (!errorCode) {
    // Default fallback if we can't identify a specific error code
    return (
      error?.message ||
      "An unexpected error occurred during signup. Please try again."
    );
  }

  // Return user-friendly error messages based on Firebase error codes
  switch (errorCode) {
    case "auth/email-already-in-use":
      return "This email address is already in use. Please try logging in instead or use a different email.";

    case "auth/invalid-email":
      return "Please enter a valid email address.";

    case "auth/operation-not-allowed":
      return "Account creation is currently disabled. Please contact support for assistance.";

    case "auth/weak-password":
      return "Your password is too weak. Please choose a stronger password with at least 8 characters, including uppercase, lowercase, numbers, and special characters.";

    case "auth/network-request-failed":
      return "Network connection issue. Please check your internet connection and try again.";

    case "auth/too-many-requests":
      return "Too many attempts. Please try again later or reset your password.";

    case "auth/user-disabled":
      return "This account has been disabled. Please contact support for assistance.";

    case "auth/account-exists-with-different-credential":
      return "An account already exists with the same email but different sign-in credentials. Try signing in with a different method.";

    case "auth/credential-already-in-use":
      return "This credential is already associated with a different user account.";

    default:
      // For any other Firebase auth errors
      return `Account creation failed: ${
        error.message || "Unknown error"
      }. Please try again.`;
  }
}

/**
 * Get field-specific error message for form validation based on Firebase error
 */
export function getSignupFieldError(error: any): {
  field: "email" | "password" | "general";
  message: string;
} {
  const errorCode = extractFirebaseErrorCode(error);

  if (!errorCode) {
    return {
      field: "general",
      message: error?.message || "An unexpected error occurred",
    };
  }

  switch (errorCode) {
    case "auth/email-already-in-use":
      return { field: "email", message: "Email already in use" };

    case "auth/invalid-email":
      return { field: "email", message: "Invalid email format" };

    case "auth/weak-password":
      return { field: "password", message: "Password is too weak" };

    default:
      return { field: "general", message: "Signup error" };
  }
}

/**
 * Categorize the severity of Firebase errors for UI treatment
 */
export function getErrorSeverity(error: any): "high" | "medium" | "low" {
  const errorCode = extractFirebaseErrorCode(error);

  if (!errorCode) return "medium";

  const highSeverityErrors = [
    "auth/account-exists-with-different-credential",
    "auth/credential-already-in-use",
    "auth/user-disabled",
  ];

  const lowSeverityErrors = ["auth/invalid-email", "auth/weak-password"];

  if (highSeverityErrors.includes(errorCode)) return "high";
  if (lowSeverityErrors.includes(errorCode)) return "low";

  return "medium";
}

/**
 * Provides recovery actions for specific Firebase errors
 */
export function getErrorRecoveryAction(error: any): {
  actionText: string;
  action: "retry" | "login" | "password-reset" | "contact-support" | "none";
} {
  const errorCode = extractFirebaseErrorCode(error);

  if (!errorCode) {
    return { actionText: "Try Again", action: "retry" };
  }

  switch (errorCode) {
    case "auth/email-already-in-use":
      return { actionText: "Log In Instead", action: "login" };

    case "auth/too-many-requests":
      return { actionText: "Reset Password", action: "password-reset" };

    case "auth/user-disabled":
      return { actionText: "Contact Support", action: "contact-support" };

    default:
      return { actionText: "Try Again", action: "retry" };
  }
}
