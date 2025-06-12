import { extractDatabaseErrorCode } from "./databaseErrorHandler";
import { extractFirebaseErrorCode } from "./firebaseErrorHandler";

/**
 * Enhanced error logging function for Firebase-related errors
 * Formats and logs errors with additional context to help debugging
 */
export function logError(
  error: any,
  context: string,
  additionalInfo?: Record<string, any>
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
    stack: error?.stack,
    ...additionalInfo,
  };

  // Log in development - in production this could be sent to a logging service
  console.error("Firebase Error:", errorDetails);

  // For certain critical errors, we might want additional logging
  if (
    errorCode === "permission-denied" ||
    errorCode === "unavailable" ||
    errorCode === "not-found"
  ) {
    console.error("CRITICAL ERROR:", JSON.stringify(errorDetails, null, 2));
  }
}

export default logError;
