import { captureException } from "../services/errorReporting";
import { extractDatabaseErrorCode } from "./databaseErrorHandler";
import { extractFirebaseErrorCode } from "./firebaseErrorHandler";

/**
 * Enhanced error logging function for Firebase-related errors
 * Formats and logs errors with additional context to help debugging
 * Sends errors to Firebase Crashlytics for production monitoring
 */
export function logError(
  error: unknown,
  context: string,
  additionalInfo?: Record<string, unknown>,
): void {
  // Get error code if available
  const firebaseCode = extractFirebaseErrorCode(error);
  const databaseCode = extractDatabaseErrorCode(error);
  const errorCode = firebaseCode || databaseCode || "unknown";

  // Build structured error object
  const err = error as { message?: string; componentStack?: string };
  const errorDetails = {
    timestamp: new Date().toISOString(),
    context,
    errorCode,
    message: err?.message || "No error message available",
    componentStack: err?.componentStack,
    ...additionalInfo,
  };

  // Always log to console in development
  if (__DEV__) {
    console.error("Error:", errorDetails);

    // Additional logging for critical errors in dev
    if (
      errorCode === "permission-denied" ||
      errorCode === "unavailable" ||
      errorCode === "not-found"
    ) {
      console.error("CRITICAL ERROR:", JSON.stringify(errorDetails, null, 2));
    }
  }

  // Send to Crashlytics for production error tracking
  captureException(
    error instanceof Error ? error : new Error(err?.message || String(error)),
    {
      ...errorDetails,
      originalError: error instanceof Error ? error.message : JSON.stringify(error),
    },
  );
}

export default logError;
