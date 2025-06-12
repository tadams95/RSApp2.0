import { Timestamp } from "firebase/firestore";
import { extractDatabaseErrorCode } from "./databaseErrorHandler";
import logError from "./logError";

// Define types for event data
export interface EventData {
  id?: string;
  name: string;
  dateTime: Timestamp;
  location: string;
  price: number;
  imgURL: string;
  quantity: number;
  description?: string;
  attendingCount?: number;
  [key: string]: any; // For any additional fields
}

// Default values for missing event properties
export const DEFAULT_EVENT_VALUES = {
  name: "Untitled Event",
  location: "Location TBA",
  price: 0,
  quantity: 0,
  imgURL: require("../assets/BlurHero_2.png"),
  description: "No description available",
};

/**
 * Ensures an event object has all required properties by providing fallbacks for missing data
 * @param event Potentially incomplete event data from Firestore
 * @returns Complete event object with fallbacks applied where needed
 */
export function sanitizeEventData(eventData: any): EventData {
  // If data is completely missing, return a placeholder object
  if (!eventData) {
    return {
      id: "missing-data",
      name: DEFAULT_EVENT_VALUES.name,
      dateTime: Timestamp.now(), // Current time as fallback
      location: DEFAULT_EVENT_VALUES.location,
      price: DEFAULT_EVENT_VALUES.price,
      imgURL: DEFAULT_EVENT_VALUES.imgURL,
      quantity: DEFAULT_EVENT_VALUES.quantity,
      description: DEFAULT_EVENT_VALUES.description,
    };
  }

  // For each expected field, use the value from eventData or fall back to default
  return {
    id: eventData.id || "missing-id",
    name: eventData.name || DEFAULT_EVENT_VALUES.name,
    dateTime:
      eventData.dateTime instanceof Timestamp
        ? eventData.dateTime
        : Timestamp.now(),
    location: eventData.location || DEFAULT_EVENT_VALUES.location,
    price:
      typeof eventData.price === "number"
        ? eventData.price
        : DEFAULT_EVENT_VALUES.price,
    imgURL: eventData.imgURL || DEFAULT_EVENT_VALUES.imgURL,
    quantity:
      typeof eventData.quantity === "number"
        ? eventData.quantity
        : DEFAULT_EVENT_VALUES.quantity,
    description: eventData.description || DEFAULT_EVENT_VALUES.description,
    // Pass through any other fields
    ...eventData,
  };
}

/**
 * Handles errors during event data fetching with appropriate logging and classification
 * @param error Error object caught during fetch
 * @param context Context for logging (component name, operation)
 * @param additionalInfo Additional context info for logging
 * @returns Error message suitable for users
 */
export function handleEventFetchError(
  error: any,
  context: string,
  additionalInfo?: Record<string, any>
): string {
  // Log the error with our enhanced error logging
  logError(error, context, additionalInfo);

  // Get specific error code
  const errorCode = extractDatabaseErrorCode(error);

  // Return user-friendly error message based on error type
  switch (errorCode) {
    case "permission-denied":
      return "You don't have permission to view these events.";
    case "unavailable":
    case "network-request-failed":
      return "Network error. Please check your connection and try again.";
    case "resource-exhausted":
      return "Service is currently busy. Please try again in a moment.";
    case "not-found":
      return "The events you're looking for couldn't be found.";
    default:
      return "An error occurred while loading events. Please try again.";
  }
}

/**
 * Determines if a retry should be attempted based on error type and previous attempts
 * @param errorCode Firestore error code
 * @param attempts Number of previous retry attempts
 * @returns Boolean indicating whether to retry
 */
export function shouldRetryEventFetch(
  errorCode: string | null,
  attempts: number
): boolean {
  // Don't retry beyond a reasonable limit
  if (attempts >= 3) return false;

  // Retry for these specific error types which might be transient
  if (
    errorCode === "unavailable" ||
    errorCode === "resource-exhausted" ||
    errorCode === "deadline-exceeded"
  ) {
    return true;
  }

  // Don't retry for these errors that are unlikely to resolve on retry
  if (errorCode === "permission-denied" || errorCode === "not-found") {
    return false;
  }

  // For unknown errors, attempt one retry
  return attempts < 1;
}

/**
 * Calculates the backoff time for retries using exponential backoff strategy
 * @param attempt The current attempt number (0-based)
 * @returns Delay in milliseconds before next retry
 */
export function getRetryBackoffTime(attempt: number): number {
  // Base backoff is 1000ms (1 second)
  const baseBackoff = 1000;

  // Calculate exponential backoff with random jitter
  // 2^attempt * base time + random jitter
  const exponentialBackoff = Math.pow(2, attempt) * baseBackoff;
  const jitter = Math.random() * 1000; // Up to 1 second of random jitter

  return exponentialBackoff + jitter;
}
