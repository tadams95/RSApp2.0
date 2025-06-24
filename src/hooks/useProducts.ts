import {
  useQuery,
  useQueryClient,
  UseQueryResult,
} from "@tanstack/react-query";
import { queryKeys, queryOptions } from "../config/reactQuery";
import fetchShopifyProducts, {
  fetchProductByHandle,
  ShopifyProduct,
} from "../services/shopifyService";

/**
 * React Query hook for fetching all products
 * Replaces the manual useState/useEffect pattern in shop screens
 */
export const useProducts = () => {
  return useQuery({
    queryKey: queryKeys.products.lists(),
    queryFn: fetchShopifyProducts,
    ...queryOptions.products,
    // Enable stale-while-revalidate pattern
    staleTime: queryOptions.products.staleTime,
    gcTime: queryOptions.products.gcTime,
    // Ensure data is considered fresh for longer due to infrequent changes
    refetchOnMount: "always",
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
};

/**
 * React Query hook for fetching a single product by handle
 * Replaces the manual useState/useEffect pattern in product detail screens
 */
export const useProduct = (handle: string | undefined) => {
  return useQuery({
    queryKey: queryKeys.products.detail(handle || ""),
    queryFn: () => fetchProductByHandle(handle!),
    ...queryOptions.products,
    // Only run the query if handle is provided
    enabled: !!handle,
    // Products don't change frequently, so longer stale time is appropriate
    staleTime: queryOptions.products.staleTime,
    gcTime: queryOptions.products.gcTime,
    // Retry strategy for network issues
    retry: (failureCount, error: any) => {
      // Don't retry if product is not found (404)
      if (
        error?.message?.includes("not found") ||
        error?.message?.includes("404")
      ) {
        return false;
      }
      // Retry up to 2 times for other errors
      return failureCount < 2;
    },
  });
};

/**
 * Hook to prefetch a product for better UX
 * Useful when user hovers or when navigating to product detail
 */
export const usePrefetchProduct = () => {
  const queryClient = useQueryClient();

  return (handle: string) => {
    queryClient.prefetchQuery({
      queryKey: queryKeys.products.detail(handle),
      queryFn: () => fetchProductByHandle(handle),
      ...queryOptions.products,
    });
  };
};

/**
 * Types for better TypeScript support
 */
export type UseProductsResult = UseQueryResult<ShopifyProduct[], Error>;
export type UseProductResult = UseQueryResult<ShopifyProduct | null, Error>;

/**
 * Helper function to get product loading states
 * Makes it easier to handle different loading states consistently
 */
export const getProductLoadingState = (query: UseQueryResult<any, Error>) => ({
  isLoading: query.isLoading,
  isError: query.isError,
  isFetching: query.isFetching,
  isRefreshing: query.isRefetching && !query.isLoading,
  error: query.error?.message || null,
});

/**
 * Helper function to invalidate product queries
 * Useful when products need to be refreshed (e.g., after admin updates)
 */
export const useInvalidateProducts = () => {
  const queryClient = useQueryClient();

  return {
    invalidateAll: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.all,
      }),
    invalidateList: () =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.lists(),
      }),
    invalidateProduct: (handle: string) =>
      queryClient.invalidateQueries({
        queryKey: queryKeys.products.detail(handle),
      }),
  };
};
