/**
 * Pagination Handler for Firebase Firestore
 *
 * This utility provides robust pagination functionality with error handling for Firestore queries.
 * It handles cursor errors, out-of-bounds requests, and provides recovery mechanisms for interrupted operations.
 */

import {
  collection,
  DocumentData,
  DocumentSnapshot,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  Query,
  startAfter,
  where,
  WhereFilterOp,
} from "firebase/firestore";
import { extractDatabaseErrorCode } from "./databaseErrorHandler";
import { getRetryBackoffTime } from "./eventDataHandler";
import logError from "./logError";

// Interface for pagination state that can be persisted
export interface PaginationState {
  lastVisibleId?: string;
  lastVisibleData?: Record<string, any>;
  currentPage: number;
  totalItems?: number;
  totalPages?: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  pageSize: number;
  timestamp: number;
}

// Interface for pagination options
export interface PaginationOptions {
  pageSize?: number;
  orderByField?: string;
  orderDirection?: "asc" | "desc";
  whereConditions?: [string, WhereFilterOp, any][];
}

// Interface for pagination results
export interface PaginatedResult<T> {
  data: T[];
  paginationState: PaginationState;
  error: string | null;
}

// Error messages
export const PAGINATION_ERRORS = {
  INVALID_CURSOR:
    "The pagination cursor is no longer valid. Results have been reset to the first page.",
  OUT_OF_BOUNDS:
    "The requested page is out of bounds. Results have been adjusted to an available page.",
  CURSOR_CHANGED:
    "The data has changed since your last query, which affected pagination. Results may have shifted.",
  GENERAL_ERROR: "An error occurred during pagination. Please try again.",
};

/**
 * Fetches paginated data from Firestore with comprehensive error handling
 *
 * @param collectionPath The Firestore collection path
 * @param options Pagination options including page size, ordering, etc.
 * @param savedState Optional previously saved pagination state for continuing pagination
 * @returns Paginated data with updated pagination state
 */
export async function fetchPaginatedData<T extends DocumentData>(
  collectionPath: string,
  options: PaginationOptions = {},
  savedState?: PaginationState
): Promise<PaginatedResult<T>> {
  const {
    pageSize = 10,
    orderByField = "createdAt",
    orderDirection = "desc",
    whereConditions = [],
  } = options;

  const initialPaginationState: PaginationState = {
    currentPage: 1,
    hasNextPage: false,
    hasPrevPage: false,
    pageSize,
    timestamp: Date.now(),
  };

  // Initialize state from saved state or defaults
  let paginationState = savedState || initialPaginationState;

  try {
    // Get Firestore instance
    const db = getFirestore();

    // Start with base query on the collection
    let baseQuery = query(
      collection(db, collectionPath),
      orderBy(orderByField, orderDirection)
    );

    // Add where conditions if provided
    whereConditions.forEach(([field, operator, value]) => {
      baseQuery = query(baseQuery, where(field, operator, value));
    });

    // Handle pagination
    let paginatedQuery: Query<DocumentData>;
    let lastVisible: DocumentSnapshot | null = null;

    // Try to get the last document if we have a saved state with a lastVisibleId
    if (savedState?.lastVisibleId) {
      try {
        // Start after the last visible document if continuing pagination
        if (savedState.lastVisibleData) {
          // Try to reconstruct the document snapshot from saved data
          const fakeSnapshot = {
            id: savedState.lastVisibleId,
            data: () => savedState.lastVisibleData,
            exists: () => true,
          } as unknown as DocumentSnapshot;

          paginatedQuery = query(
            baseQuery,
            startAfter(fakeSnapshot),
            limit(pageSize)
          );
        } else {
          // Reset pagination if we can't reconstruct the cursor
          paginatedQuery = query(baseQuery, limit(pageSize));
          paginationState = {
            ...paginationState,
            currentPage: 1,
            hasPrevPage: false,
          };
        }
      } catch (error) {
        // Handle cursor errors
        logError(error, "paginationHandler.cursorReconstruction", {
          collectionPath,
        });
        // Reset pagination
        paginatedQuery = query(baseQuery, limit(pageSize));
        paginationState = {
          ...initialPaginationState,
        };

        return {
          data: [],
          paginationState,
          error: PAGINATION_ERRORS.INVALID_CURSOR,
        };
      }
    } else {
      // First page
      paginatedQuery = query(baseQuery, limit(pageSize));
    }

    // Execute query
    const querySnapshot = await getDocs(paginatedQuery);

    // Check for empty result
    if (querySnapshot.empty) {
      // If we requested a page other than the first and got empty results,
      // we might be out of bounds, so reset to first page
      if (paginationState.currentPage > 1) {
        const firstPageQuery = query(baseQuery, limit(pageSize));
        const firstPageSnapshot = await getDocs(firstPageQuery);

        const data = firstPageSnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as unknown as T[];

        const updatedPaginationState: PaginationState = {
          currentPage: 1,
          hasNextPage: firstPageSnapshot.docs.length === pageSize,
          hasPrevPage: false,
          pageSize,
          timestamp: Date.now(),
          lastVisibleId: firstPageSnapshot.docs.length
            ? firstPageSnapshot.docs[firstPageSnapshot.docs.length - 1].id
            : undefined,
          lastVisibleData: firstPageSnapshot.docs.length
            ? firstPageSnapshot.docs[firstPageSnapshot.docs.length - 1].data()
            : undefined,
        };

        return {
          data,
          paginationState: updatedPaginationState,
          error: PAGINATION_ERRORS.OUT_OF_BOUNDS,
        };
      }

      // Empty result for first page
      return {
        data: [],
        paginationState: {
          ...paginationState,
          hasNextPage: false,
          hasPrevPage: false,
        },
        error: null,
      };
    }

    // Process results and prepare the next pagination state
    const data = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as unknown as T[];

    // Get the last visible document for next page
    lastVisible = querySnapshot.docs[querySnapshot.docs.length - 1];

    // Check if more items exist for next page
    const nextQuery = query(baseQuery, startAfter(lastVisible), limit(1));
    const nextSnapshot = await getDocs(nextQuery);
    const hasNextPage = !nextSnapshot.empty;

    // Update pagination state
    const updatedPaginationState: PaginationState = {
      ...paginationState,
      hasNextPage,
      hasPrevPage: paginationState.currentPage > 1,
      lastVisibleId: lastVisible.id,
      lastVisibleData: lastVisible.data(),
      timestamp: Date.now(),
    };

    return {
      data,
      paginationState: updatedPaginationState,
      error: null,
    };
  } catch (error) {
    // Enhanced error handling
    const errorCode = extractDatabaseErrorCode(error);

    logError(error, "paginationHandler.fetchPaginatedData", {
      collectionPath,
      currentPage: paginationState.currentPage,
      pageSize,
      errorCode,
    });

    // Return sensible defaults with helpful error message
    return {
      data: [],
      paginationState: {
        ...initialPaginationState,
      },
      error: PAGINATION_ERRORS.GENERAL_ERROR,
    };
  }
}

/**
 * Fetches the next page of data based on current pagination state
 *
 * @param collectionPath The Firestore collection path
 * @param currentState The current pagination state
 * @param options Pagination options
 * @returns The next page of data with updated pagination state
 */
export async function fetchNextPage<T extends DocumentData>(
  collectionPath: string,
  currentState: PaginationState,
  options: PaginationOptions = {}
): Promise<PaginatedResult<T>> {
  // If there's no next page, return current state with no error
  if (!currentState.hasNextPage) {
    return {
      data: [],
      paginationState: currentState,
      error: null,
    };
  }

  const nextState: PaginationState = {
    ...currentState,
    currentPage: currentState.currentPage + 1,
  };

  return fetchPaginatedData<T>(collectionPath, options, nextState);
}

/**
 * Fetches the previous page of data based on current pagination state
 * This requires implementation of previous page tracking which is more complex
 * with Firestore's forward-only pagination. This implementation resets to first page.
 *
 * @param collectionPath The Firestore collection path
 * @param currentState The current pagination state
 * @param options Pagination options
 * @returns The previous page of data with updated pagination state
 */
export async function fetchPrevPage<T extends DocumentData>(
  collectionPath: string,
  currentState: PaginationState,
  options: PaginationOptions = {}
): Promise<PaginatedResult<T>> {
  // If we're already on the first page, return current state
  if (currentState.currentPage <= 1) {
    return {
      data: [],
      paginationState: {
        ...currentState,
        currentPage: 1,
        hasPrevPage: false,
      },
      error: null,
    };
  }

  // Since Firestore doesn't support backwards pagination easily,
  // we'll reset to the first page
  const newState: PaginationState = {
    ...currentState,
    currentPage: 1,
    lastVisibleId: undefined,
    lastVisibleData: undefined,
    hasPrevPage: false,
  };

  return fetchPaginatedData<T>(collectionPath, options, newState);
}

/**
 * Safely stores the pagination state to recover later
 * This can be used to implement recovery of pagination after app restarts
 *
 * @param key Unique identifier for this pagination state
 * @param state The pagination state to store
 */
export function savePaginationState(key: string, state: PaginationState): void {
  try {
    // Add timestamp for expiration checks
    const stateWithTimestamp = {
      ...state,
      timestamp: Date.now(),
    };
    localStorage.setItem(
      `pagination_${key}`,
      JSON.stringify(stateWithTimestamp)
    );
  } catch (error) {
    console.error("Failed to save pagination state:", error);
  }
}

/**
 * Loads a previously saved pagination state
 *
 * @param key Unique identifier for the pagination state
 * @param maxAgeMs Maximum age of the stored state in milliseconds (default: 1 hour)
 * @returns The stored pagination state or null if not found or expired
 */
export function loadPaginationState(
  key: string,
  maxAgeMs: number = 60 * 60 * 1000
): PaginationState | null {
  try {
    const saved = localStorage.getItem(`pagination_${key}`);
    if (!saved) return null;

    const state = JSON.parse(saved) as PaginationState;
    const currentTime = Date.now();

    // Check if state is too old
    if (state.timestamp && currentTime - state.timestamp > maxAgeMs) {
      localStorage.removeItem(`pagination_${key}`);
      return null;
    }

    return state;
  } catch (error) {
    console.error("Failed to load pagination state:", error);
    return null;
  }
}

/**
 * Retry a pagination request with exponential backoff
 *
 * @param fetchFn The pagination function to retry
 * @param maxAttempts Maximum number of retry attempts
 * @returns The result of the pagination function
 */
export async function retryPagination<T>(
  fetchFn: () => Promise<PaginatedResult<T>>,
  maxAttempts: number = 3
): Promise<PaginatedResult<T>> {
  let lastError: Error | null = null;
  let attempts = 0;

  while (attempts < maxAttempts) {
    try {
      return await fetchFn();
    } catch (error: any) {
      lastError = error;
      const errorCode = extractDatabaseErrorCode(error);

      // Only retry specific errors that might be transient
      if (
        errorCode === "unavailable" ||
        errorCode === "resource-exhausted" ||
        errorCode === "deadline-exceeded"
      ) {
        attempts++;
        if (attempts < maxAttempts) {
          const backoffTime = getRetryBackoffTime(attempts);
          console.log(
            `Retrying pagination in ${backoffTime}ms (attempt ${attempts})`
          );
          await new Promise((resolve) => setTimeout(resolve, backoffTime));
          continue;
        }
      } else {
        // Don't retry errors that aren't likely to resolve
        break;
      }
    }
  }

  // If we get here, all retries failed or error wasn't retriable
  return {
    data: [],
    paginationState: {
      currentPage: 1,
      hasNextPage: false,
      hasPrevPage: false,
      pageSize: 10,
      timestamp: Date.now(),
    },
    error: PAGINATION_ERRORS.GENERAL_ERROR,
  };
}
