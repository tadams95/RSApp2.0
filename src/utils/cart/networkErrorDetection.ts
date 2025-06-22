import NetInfo from "@react-native-community/netinfo";

/**
 * Check if the device is currently connected to the internet
 * @returns Promise that resolves to a boolean indicating connection status
 */
export const isNetworkConnected = async (): Promise<boolean> => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected !== null && state.isConnected;
  } catch (error) {
    console.error("Failed to check network connection:", error);
    // If we can't check, assume there is no connection to be safe
    return false;
  }
};

/**
 * Determines if an error is likely due to a network issue
 * @param error The error to analyze
 * @returns boolean indicating if it's a network-related error
 */
export const isNetworkError = (error: any): boolean => {
  if (!error) return false;

  // Check common error messages for network failures
  const errorMessage =
    typeof error === "string"
      ? error.toLowerCase()
      : error.message?.toLowerCase() || "";

  const networkErrorMessages = [
    "network error",
    "failed to fetch",
    "unable to connect",
    "internet connection",
    "network request failed",
    "connection failed",
    "cannot connect to server",
    "offline",
    "no connection",
    "timed out",
    "timeout",
    "econnrefused",
    "enotfound",
  ];

  return networkErrorMessages.some((msg) => errorMessage.includes(msg));
};

/**
 * Calculates an appropriate backoff delay for retries
 * @param attempt The current attempt number (starting from 0)
 * @param baseDelayMs The base delay in milliseconds
 * @param maxDelayMs The maximum delay in milliseconds
 * @returns The delay time in milliseconds
 */
export const calculateBackoffDelay = (
  attempt: number,
  baseDelayMs = 500,
  maxDelayMs = 15000
): number => {
  // Exponential backoff with jitter
  const exponentialDelay = Math.min(
    maxDelayMs,
    baseDelayMs * Math.pow(2, attempt)
  );

  // Add some randomness (jitter) to prevent synchronized retries
  const jitter = Math.random() * 0.5 + 0.75; // Between 0.75 and 1.25

  return Math.floor(exponentialDelay * jitter);
};

/**
 * Monitors a payment request with retry capabilities
 * @param requestFn The function that makes the payment request
 * @param maxAttempts Maximum number of retry attempts
 */
export const retryWithBackoff = async <T>(
  requestFn: () => Promise<T>,
  maxAttempts = 3
): Promise<T> => {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      if (attempt > 0) {
        console.log(`Retry attempt ${attempt} of ${maxAttempts - 1}...`);
      }

      // Check network before attempting
      const isConnected = await isNetworkConnected();
      if (!isConnected) {
        throw new Error("No network connection available");
      }

      return await requestFn();
    } catch (error: any) {
      lastError = error;

      // Don't retry if it's not a network error
      if (!isNetworkError(error)) {
        console.log("Error is not network-related, not retrying:", error);
        break;
      }

      // Don't retry on the last attempt
      if (attempt === maxAttempts - 1) {
        console.log("Maximum retry attempts reached");
        break;
      }

      // Calculate delay with exponential backoff
      const delay = calculateBackoffDelay(attempt);
      console.log(
        `Retrying in ${delay}ms due to network error: ${error.message || error}`
      );

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError || new Error("Request failed after multiple attempts");
};
