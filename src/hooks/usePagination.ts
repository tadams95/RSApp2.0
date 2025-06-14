/**
 * Custom Hook for Firebase Firestore Pagination
 *
 * This hook provides a complete pagination solution with error handling,
 * recovery mechanisms, and state management for Firestore queries.
 */

import NetInfo from "@react-native-community/netinfo";
import { DocumentData, Firestore, getFirestore } from "firebase/firestore";
import { useCallback, useEffect, useState } from "react";
import {
  fetchNextPage,
  fetchPaginatedData,
  fetchPrevPage,
  loadPaginationState,
  PaginationOptions,
  PaginationState,
  retryPagination,
  savePaginationState,
} from "../utils/paginationHandler";

interface UsePaginationOptions extends PaginationOptions {
  firestore?: Firestore;
  persistKey?: string;
  autoLoad?: boolean;
  maxAge?: number; // Max age for persisted pagination state in milliseconds
  retryOnReconnect?: boolean;
}

interface UsePaginationReturn<T> {
  data: T[];
  loading: boolean;
  error: string | null;
  paginationState: PaginationState;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  currentPage: number;
  fetchInitialPage: () => Promise<void>;
  fetchNextPage: () => Promise<void>;
  fetchPrevPage: () => Promise<void>;
  refreshData: () => Promise<void>;
}

/**
 * Custom hook for paginated Firestore data with error handling and recovery
 *
 * @param collectionPath The path to the Firestore collection
 * @param options Pagination and configuration options
 * @returns Pagination state and functions to manage pagination
 */
export function usePagination<T extends DocumentData = DocumentData>(
  collectionPath: string,
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  // Extract options with defaults
  const {
    firestore = getFirestore(),
    persistKey,
    autoLoad = true,
    pageSize = 10,
    maxAge = 60 * 60 * 1000, // 1 hour default
    retryOnReconnect = true,
    ...paginationOptions
  } = options;

  // Set up state
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [paginationState, setPaginationState] = useState<PaginationState>({
    currentPage: 1,
    hasNextPage: false,
    hasPrevPage: false,
    pageSize,
    timestamp: Date.now(),
  });
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [needsRefresh, setNeedsRefresh] = useState<boolean>(false);

  // Load saved pagination state if persistKey is provided
  useEffect(() => {
    if (persistKey) {
      const savedState = loadPaginationState(persistKey, maxAge);
      if (savedState) {
        setPaginationState(savedState);
      }
    }
  }, [persistKey, maxAge]);

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const wasOffline = isOffline;
      setIsOffline(!state.isConnected);

      // If coming back online and we need a refresh, do it
      if (wasOffline && state.isConnected && needsRefresh && retryOnReconnect) {
        fetchInitialPage();
        setNeedsRefresh(false);
      }
    });

    return () => unsubscribe();
  }, [isOffline, needsRefresh, retryOnReconnect]);

  // Fetch initial page of data
  const fetchInitialPage = useCallback(async () => {
    if (isOffline) {
      setError(
        "You are currently offline. Please check your network connection."
      );
      setNeedsRefresh(true);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Use retryPagination for automatic retry with backoff
      const result = await retryPagination(() =>
        fetchPaginatedData<T>(collectionPath, {
          pageSize,
          ...paginationOptions,
        })
      );

      setData(result.data);
      setPaginationState(result.paginationState);

      if (result.error) {
        setError(result.error);
      }

      // Save pagination state if persistKey is provided
      if (persistKey) {
        savePaginationState(persistKey, result.paginationState);
      }
    } catch (err: any) {
      setError(err?.message || "An error occurred while fetching data");
    } finally {
      setLoading(false);
    }
  }, [collectionPath, pageSize, isOffline, persistKey, paginationOptions]);

  // Fetch next page of data
  const fetchNextPageData = useCallback(async () => {
    if (!paginationState.hasNextPage || isOffline) {
      if (isOffline) {
        setError(
          "You are currently offline. Please check your network connection."
        );
        setNeedsRefresh(true);
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await retryPagination(() =>
        fetchNextPage<T>(collectionPath, paginationState, {
          pageSize,
          ...paginationOptions,
        })
      );

      setData(result.data);
      setPaginationState(result.paginationState);

      if (result.error) {
        setError(result.error);
      }

      // Save pagination state if persistKey is provided
      if (persistKey) {
        savePaginationState(persistKey, result.paginationState);
      }
    } catch (err: any) {
      setError(
        err?.message || "An error occurred while fetching the next page"
      );
    } finally {
      setLoading(false);
    }
  }, [
    collectionPath,
    paginationState,
    isOffline,
    pageSize,
    persistKey,
    paginationOptions,
  ]);

  // Fetch previous page of data
  const fetchPrevPageData = useCallback(async () => {
    if (!paginationState.hasPrevPage || isOffline) {
      if (isOffline) {
        setError(
          "You are currently offline. Please check your network connection."
        );
        setNeedsRefresh(true);
      }
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await retryPagination(() =>
        fetchPrevPage<T>(collectionPath, paginationState, {
          pageSize,
          ...paginationOptions,
        })
      );

      setData(result.data);
      setPaginationState(result.paginationState);

      if (result.error) {
        setError(result.error);
      }

      // Save pagination state if persistKey is provided
      if (persistKey) {
        savePaginationState(persistKey, result.paginationState);
      }
    } catch (err: any) {
      setError(
        err?.message || "An error occurred while fetching the previous page"
      );
    } finally {
      setLoading(false);
    }
  }, [
    collectionPath,
    paginationState,
    isOffline,
    pageSize,
    persistKey,
    paginationOptions,
  ]);

  // Refresh data (reset to first page)
  const refreshData = useCallback(async () => {
    // Reset pagination state to initial values
    setPaginationState({
      currentPage: 1,
      hasNextPage: false,
      hasPrevPage: false,
      pageSize,
      timestamp: Date.now(),
    });

    // Fetch first page
    await fetchInitialPage();
  }, [fetchInitialPage, pageSize]);

  // Auto-load data on initial render if autoLoad is true
  useEffect(() => {
    if (autoLoad) {
      fetchInitialPage();
    }
  }, [autoLoad, fetchInitialPage]);

  return {
    data,
    loading,
    error,
    paginationState,
    hasNextPage: paginationState.hasNextPage,
    hasPrevPage: paginationState.hasPrevPage,
    currentPage: paginationState.currentPage,
    fetchInitialPage,
    fetchNextPage: fetchNextPageData,
    fetchPrevPage: fetchPrevPageData,
    refreshData,
  };
}
