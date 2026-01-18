import { captureException } from "../services/errorReporting";
import { extractDatabaseErrorCode } from "./databaseErrorHandler";
import { extractFirebaseErrorCode } from "./firebaseErrorHandler";

/**
 * Enhanced error logging function for Firebase-related errors
 * Formats and logs errors with additional context to help debugging
 * Now sends errors to Sentry for production monitoring
 */
export function logError(
  error: any,
  context: string,
  additionalInfo?: Record<string, any>,
): void {
  // Get error code if available
  const firebaseCode = extractFirebaseErrorCode(error);
  const databaseCode = extractDatabaseErrorCode(error);
  const errorCode = firebaseCode || databaseCode || "unknown";

  // Build structured error object
  const errorDetails = {
    timestamp: new Date().toISOString(),
    context,
    errorCode,
    message: error?.message || "No error message available",
    componentStack: error?.componentStack,
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

  // Send to Sentry for production error tracking
  captureException(
    error instanceof Error ? error : new Error(error?.message || String(error)),
    {
      ...errorDetails,
      originalError: error,
    },
  );
}

export default logError;
