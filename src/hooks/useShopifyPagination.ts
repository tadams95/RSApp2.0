/**
 * Custom hook for Shopify product pagination
 *
 * This hook provides pagination functionality for Shopify products,
 * adapting our Shopify API to work with our pagination system
 */

import NetInfo from "@react-native-community/netinfo";
import { useCallback, useEffect, useState } from "react";
import {
  fetchPaginatedProducts,
  PaginationInfo,
  ShopifyPaginationParams,
  ShopifyProduct,
} from "../services/shopifyService";

interface UseShopifyPaginationOptions {
  pageSize?: number;
  autoLoad?: boolean;
}

interface UseShopifyPaginationReturn {
  products: ShopifyProduct[];
  loading: boolean;
  error: string | null;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  currentPage: number;
  loadNextPage: () => Promise<void>;
  loadPrevPage: () => Promise<void>;
  refreshProducts: () => Promise<void>;
}

/**
 * Custom hook for paginated Shopify product data
 *
 * @param options Pagination options including page size
 * @returns Pagination state and functions to navigate between pages
 */
export function useShopifyPagination(
  options: UseShopifyPaginationOptions = {}
): UseShopifyPaginationReturn {
  const { pageSize = 10, autoLoad = true } = options;

  // State variables
  const [products, setProducts] = useState<ShopifyProduct[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [cursors, setCursors] = useState<{ [page: number]: string }>({});
  const [pageInfo, setPageInfo] = useState<PaginationInfo>({
    hasNextPage: false,
    hasPreviousPage: false,
  });
  const [isOffline, setIsOffline] = useState<boolean>(false);
  const [needsRefresh, setNeedsRefresh] = useState<boolean>(false);

  // Monitor network status
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const wasOffline = isOffline;
      setIsOffline(!state.isConnected);

      // If coming back online and we need a refresh, do it
      if (wasOffline && state.isConnected && needsRefresh) {
        refreshProducts();
        setNeedsRefresh(false);
      }
    });

    return () => unsubscribe();
  }, [isOffline, needsRefresh]);

  // Load initial page
  const loadProducts = useCallback(
    async (params: ShopifyPaginationParams = {}) => {
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
        const paginationParams: ShopifyPaginationParams = {
          first: pageSize,
          ...params,
        };

        const result = await fetchPaginatedProducts(paginationParams);

        setProducts(result.products);
        setPageInfo(result.pageInfo);

        // Store cursor for the current page for potential backward navigation
        if (result.pageInfo.endCursor) {
          setCursors((prev) => ({
            ...prev,
            [currentPage]: result.pageInfo.endCursor as string,
          }));
        }
      } catch (err: any) {
        setError(err?.message || "An error occurred while fetching products");
        console.error("Error in useShopifyPagination:", err);
      } finally {
        setLoading(false);
      }
    },
    [pageSize, isOffline, currentPage]
  );

  // Load next page
  const loadNextPage = useCallback(async () => {
    if (!pageInfo.hasNextPage || isOffline) {
      if (isOffline) {
        setError(
          "You are currently offline. Please check your network connection."
        );
        setNeedsRefresh(true);
      }
      return;
    }

    setLoading(true);

    try {
      const paginationParams: ShopifyPaginationParams = {
        first: pageSize,
        after: pageInfo.endCursor,
      };

      const result = await fetchPaginatedProducts(paginationParams);

      setProducts(result.products);
      setPageInfo(result.pageInfo);
      setCurrentPage((prev) => prev + 1);

      // Store cursor for the new page
      if (result.pageInfo.endCursor) {
        setCursors((prev) => ({
          ...prev,
          [currentPage + 1]: result.pageInfo.endCursor as string,
        }));
      }
    } catch (err: any) {
      setError(
        err?.message || "An error occurred while fetching the next page"
      );
    } finally {
      setLoading(false);
    }
  }, [pageInfo, pageSize, isOffline, currentPage]);

  // Load previous page
  const loadPrevPage = useCallback(async () => {
    if (currentPage <= 1 || isOffline) {
      if (isOffline) {
        setError(
          "You are currently offline. Please check your network connection."
        );
        setNeedsRefresh(true);
      }
      return;
    }

    setLoading(true);

    try {
      // Get the cursor for the previous page
      const targetPage = currentPage - 1;
      const prevCursor = cursors[targetPage - 1]; // Page before the one we want

      const paginationParams: ShopifyPaginationParams = {
        first: pageSize,
        ...(prevCursor ? { after: prevCursor } : {}),
      };

      const result = await fetchPaginatedProducts(paginationParams);

      setProducts(result.products);
      setPageInfo(result.pageInfo);
      setCurrentPage(targetPage);
    } catch (err: any) {
      setError(
        err?.message || "An error occurred while fetching the previous page"
      );
    } finally {
      setLoading(false);
    }
  }, [currentPage, cursors, pageSize, isOffline]);

  // Refresh data (reset to first page)
  const refreshProducts = useCallback(async () => {
    setCurrentPage(1);
    setCursors({});
    await loadProducts();
  }, [loadProducts]);

  // Auto-load data on initial render if autoLoad is true
  useEffect(() => {
    if (autoLoad) {
      loadProducts();
    }
  }, [autoLoad, loadProducts]);

  return {
    products,
    loading,
    error,
    hasNextPage: pageInfo.hasNextPage,
    hasPrevPage: currentPage > 1,
    currentPage,
    loadNextPage,
    loadPrevPage,
    refreshProducts,
  };
}
