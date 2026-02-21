import { QueryClient } from "@tanstack/react-query";

/**
 * React Query configuration with optimal settings for the Rage State app
 *
 * Configuration considerations:
 * - Server data (products, events) should be cached longer as it changes infrequently
 * - User-specific data should have shorter cache times
 * - Retry logic should be conservative to avoid overwhelming servers
 * - Background refetch should be enabled for better UX
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Cache for 5 minutes by default (good for most server data)
      staleTime: 1000 * 60 * 5, // 5 minutes

      // Keep unused data in cache for 10 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes (formerly cacheTime)

      // Retry failed requests 2 times with exponential backoff
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),

      // Enable background refetching for better UX
      refetchOnWindowFocus: true,
      refetchOnMount: true,
      refetchOnReconnect: true,

      // Disable background refetch while user is inactive
      refetchInterval: false,

      // Network mode for better offline handling
      networkMode: "online",
    },
    mutations: {
      // Retry mutations once (more conservative for data modifications)
      retry: 1,
      retryDelay: 1000,

      // Network mode for mutations
      networkMode: "online",
    },
  },
});

type QueryFilters = Record<string, string | number | boolean | null | undefined>;

/**
 * Query keys factory for consistent key management
 * This helps with invalidation and ensures consistent caching
 */
export const queryKeys = {
  // Shopify/Products
  products: {
    all: ["products"] as const,
    lists: () => [...queryKeys.products.all, "list"] as const,
    list: (filters: QueryFilters) =>
      [...queryKeys.products.lists(), { filters }] as const,
    details: () => [...queryKeys.products.all, "detail"] as const,
    detail: (handle: string) =>
      [...queryKeys.products.details(), handle] as const,
    collections: () => [...queryKeys.products.all, "collections"] as const,
    collection: (handle: string) =>
      [...queryKeys.products.collections(), handle] as const,
  },

  // Events
  events: {
    all: ["events"] as const,
    lists: () => [...queryKeys.events.all, "list"] as const,
    list: (filters: QueryFilters) =>
      [...queryKeys.events.lists(), { filters }] as const,
    details: () => [...queryKeys.events.all, "detail"] as const,
    detail: (id: string) => [...queryKeys.events.details(), id] as const,
  },

  // User-specific data (shorter cache times)
  user: {
    all: ["user"] as const,
    profile: () => [...queryKeys.user.all, "profile"] as const,
    cart: () => [...queryKeys.user.all, "cart"] as const,
    orders: () => [...queryKeys.user.all, "orders"] as const,
    notifications: () => [...queryKeys.user.all, "notifications"] as const,
  },

  // Chat (real-time subscriptions, cache for offline access)
  chat: {
    all: ["chat"] as const,
    lists: () => [...queryKeys.chat.all, "list"] as const,
    messages: (chatId: string) =>
      [...queryKeys.chat.all, "messages", chatId] as const,
    detail: (chatId: string) =>
      [...queryKeys.chat.all, "detail", chatId] as const,
    unreadCount: () => [...queryKeys.chat.all, "unreadCount"] as const,
  },
} as const;

/**
 * Specialized query options for different data types
 */
export const queryOptions = {
  // Products and collections change infrequently
  products: {
    staleTime: 1000 * 60 * 15, // 15 minutes
    gcTime: 1000 * 60 * 30, // 30 minutes
  },

  // Events might change more frequently
  events: {
    staleTime: 1000 * 60 * 5, // 5 minutes
    gcTime: 1000 * 60 * 15, // 15 minutes
  },

  // User data should be fresh
  user: {
    staleTime: 1000 * 60 * 2, // 2 minutes
    gcTime: 1000 * 60 * 5, // 5 minutes
  },

  // Real-time or frequently changing data
  realtime: {
    staleTime: 1000 * 30, // 30 seconds
    gcTime: 1000 * 60 * 2, // 2 minutes
    refetchInterval: 1000 * 60, // Refetch every minute
  },

  // Chat uses real-time subscriptions, cache for offline access
  chat: {
    staleTime: 1000 * 60, // 1 minute (real-time handles updates)
    gcTime: 1000 * 60 * 10, // 10 minutes (keep for offline)
  },
} as const;
