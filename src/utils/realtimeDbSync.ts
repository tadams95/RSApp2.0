/**
 * Utilities for handling data synchronization with Firebase Realtime Database
 * Includes conflict resolution, retry mechanisms, and error handling
 */

import {
  DataSnapshot,
  Database,
  DatabaseReference,
  get,
  onValue,
  ref,
  set,
  update,
} from "firebase/database";
import { extractDatabaseErrorCode } from "./databaseErrorHandler";

// Type for sync operation configuration
export interface SyncOperationOptions {
  maxRetries?: number;
  initialBackoffDelay?: number;
  maxBackoffDelay?: number;
  onError?: (error: SyncError) => void;
  onRetry?: (attempt: number, delay: number) => void;
  onSuccess?: () => void;
  conflictStrategy?: "server-wins" | "client-wins" | "merge";
}

// Default options for sync operations
export const DEFAULT_SYNC_OPTIONS: SyncOperationOptions = {
  maxRetries: 3,
  initialBackoffDelay: 1000, // 1 second
  maxBackoffDelay: 30000, // 30 seconds
  conflictStrategy: "merge",
};

// Type for sync errors
export interface SyncError {
  code: string;
  message: string;
  timestamp: number;
  path?: string;
  retryCount?: number;
  originalError?: any;
}

/**
 * Calculate backoff delay for retries using exponential backoff
 * @param attempt Current retry attempt number (0-based)
 * @param options Configuration options
 * @returns Delay in milliseconds before the next retry
 */
export function calculateBackoffDelay(
  attempt: number,
  options: Pick<
    SyncOperationOptions,
    "initialBackoffDelay" | "maxBackoffDelay"
  > = {}
): number {
  const initialDelay =
    options.initialBackoffDelay || DEFAULT_SYNC_OPTIONS.initialBackoffDelay!;
  const maxDelay =
    options.maxBackoffDelay || DEFAULT_SYNC_OPTIONS.maxBackoffDelay!;

  const delay = Math.min(initialDelay * Math.pow(2, attempt), maxDelay);

  // Add some randomness (jitter) to prevent synchronized retries
  return delay + Math.random() * (delay * 0.1);
}

/**
 * Handle an error during a sync operation with retry capability
 * @param error The original error
 * @param path Database path where the error occurred
 * @param retryCount Current retry count
 * @param options Configuration options
 * @returns Formatted SyncError
 */
export function handleSyncError(
  error: any,
  path: string,
  retryCount: number,
  options: SyncOperationOptions = {}
): SyncError {
  const errorCode = extractDatabaseErrorCode(error);
  const syncError: SyncError = {
    code: errorCode || "unknown-error",
    message:
      error.message || "Unknown error occurred during data synchronization",
    timestamp: Date.now(),
    path,
    retryCount,
    originalError: error,
  };

  // Call error handler if provided
  if (options.onError) {
    options.onError(syncError);
  } else {
    console.error(`Sync error at ${path}:`, syncError);
  }

  return syncError;
}

/**
 * Execute a database operation with retry capability
 * @param operation Async function that performs the database operation
 * @param path Database path (for error reporting only)
 * @param options Configuration options
 * @returns Result of the operation or throws an error after all retries fail
 */
export async function executeWithRetry<T>(
  operation: () => Promise<T>,
  path: string,
  options: SyncOperationOptions = {}
): Promise<T> {
  const {
    maxRetries = DEFAULT_SYNC_OPTIONS.maxRetries!,
    initialBackoffDelay = DEFAULT_SYNC_OPTIONS.initialBackoffDelay!,
    maxBackoffDelay = DEFAULT_SYNC_OPTIONS.maxBackoffDelay!,
    onRetry,
    onSuccess,
  } = options;

  let lastError: any;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      // Execute the operation
      const result = await operation();

      // Success - call handler and return result
      if (onSuccess) {
        onSuccess();
      }
      return result;
    } catch (error: any) {
      lastError = error;

      // Last attempt failed
      if (attempt >= maxRetries) {
        break;
      }

      // Calculate delay for next retry
      const delay = calculateBackoffDelay(attempt, {
        initialBackoffDelay,
        maxBackoffDelay,
      });

      // Notify about retry if handler provided
      if (onRetry) {
        onRetry(attempt + 1, delay);
      } else {
        console.log(
          `Retrying operation at ${path} in ${delay}ms (attempt ${
            attempt + 1
          }/${maxRetries})`
        );
      }

      // Wait before next attempt
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  // All retries failed
  const syncError = handleSyncError(lastError, path, maxRetries, options);
  throw syncError;
}

/**
 * Fetches data from a database reference with retry capability
 * @param dbRef Database reference to fetch from
 * @param options Configuration options
 * @returns Promise resolving to a DataSnapshot
 */
export async function fetchDataWithRetry(
  dbRef: DatabaseReference,
  options: SyncOperationOptions = {}
): Promise<DataSnapshot> {
  const path = dbRef.toString();

  return executeWithRetry(() => get(dbRef), path, options);
}

/**
 * Updates data at a database reference with retry capability and conflict resolution
 * @param dbRef Database reference to update
 * @param updates Object containing updates to apply
 * @param options Configuration options
 * @returns Promise resolving to true on success
 */
export async function updateDataWithRetry(
  dbRef: DatabaseReference,
  updates: Record<string, any>,
  options: SyncOperationOptions = {}
): Promise<boolean> {
  const path = dbRef.toString();
  const conflictStrategy =
    options.conflictStrategy || DEFAULT_SYNC_OPTIONS.conflictStrategy;

  if (conflictStrategy === "server-wins" || conflictStrategy === "merge") {
    // Fetch current data to check for conflicts
    try {
      const snapshot = await fetchDataWithRetry(dbRef, options);
      const currentData = snapshot.exists() ? snapshot.val() : null;

      // Data not changed on server, just apply our update
      if (!currentData) {
        return executeWithRetry(
          () => update(dbRef, updates).then(() => true),
          path,
          options
        );
      }

      // Check for modification timestamp if available
      if (
        currentData._lastUpdated &&
        updates._lastUpdated &&
        currentData._lastUpdated > updates._lastUpdated
      ) {
        // Server data is newer than our base data

        if (conflictStrategy === "merge") {
          // Merge strategy: combine server and client changes
          const merged = {
            ...currentData,
            ...updates,
            _lastUpdated: Date.now(),
          };
          return executeWithRetry(
            () => update(dbRef, merged).then(() => true),
            path,
            options
          );
        } else {
          // server-wins
          // Server wins: only apply updates that don't overwrite newer server changes
          console.warn(`Conflict detected at ${path}: Server has newer data`);

          // We could implement more complex field-by-field merging here
          // For now we just update with our changes assuming they're still relevant
          return executeWithRetry(
            () =>
              update(dbRef, {
                ...updates,
                _lastUpdated: Date.now(),
              }).then(() => true),
            path,
            options
          );
        }
      }
    } catch (error) {
      // If checking for conflicts fails, proceed with the update as a fallback
      console.warn(
        `Failed to check for conflicts at ${path}, proceeding with update`
      );
    }
  }

  // For client-wins strategy or if conflict checks failed, just apply the update
  return executeWithRetry(
    () =>
      update(dbRef, {
        ...updates,
        _lastUpdated: Date.now(),
      }).then(() => true),
    path,
    options
  );
}

/**
 * Sets data at a database reference with retry capability
 * Note: This will overwrite any existing data without conflict resolution
 * Use updateDataWithRetry for updates that need conflict resolution
 */
export async function setDataWithRetry(
  dbRef: DatabaseReference,
  data: any,
  options: SyncOperationOptions = {}
): Promise<boolean> {
  const path = dbRef.toString();

  return executeWithRetry(
    () =>
      set(dbRef, {
        ...data,
        _lastUpdated: Date.now(),
      }).then(() => true),
    path,
    options
  );
}

/**
 * Creates a subscription to a database reference with error handling and automatic reconnection
 * @param dbRef Database reference to subscribe to
 * @param onDataUpdate Callback for successful data updates
 * @param options Configuration options
 * @returns Function to unsubscribe
 */
export function createDataSubscription(
  dbRef: DatabaseReference,
  onDataUpdate: (snapshot: DataSnapshot) => void,
  options: SyncOperationOptions = {}
): () => void {
  const path = dbRef.toString();

  const handleError = (error: any) => {
    handleSyncError(error, path, 0, options);
  };

  try {
    return onValue(dbRef, onDataUpdate, handleError);
  } catch (error) {
    handleError(error);
    // Return a no-op function as fallback
    return () => {};
  }
}

/**
 * Helper to get a database reference from a path
 * @param database Firebase database instance
 * @param path Path to the data
 * @returns Database reference
 */
export function getDataRef(
  database: Database,
  path: string
): DatabaseReference {
  return ref(database, path);
}
