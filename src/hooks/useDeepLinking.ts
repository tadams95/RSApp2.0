/**
 * useDeepLinking Hook
 * Comprehensive deep link handler for RAGESTATE app
 *
 * Handles:
 * - Custom scheme links (ragestate://)
 * - Universal Links (iOS - ragestate.com/*)
 * - App Links (Android - ragestate.com/*)
 *
 * Supported Routes:
 * - /events/{id} -> Event details
 * - /user/{username} -> User profile
 * - /post/{id} -> Post details
 * - /transfer/claim?id=X&token=Y -> Ticket transfer claim
 * - /shop/product/{id} -> Product details
 * - /shop/collection/{handle} -> Collection page
 */

import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef } from "react";

/**
 * Route mapping from web URLs to mobile app routes
 * Keys are regex patterns, values are functions that return the mobile route
 */
const ROUTE_MAPPING: Record<
  string,
  (
    params: RegExpMatchArray,
    queryParams: Record<string, string>,
  ) => {
    pathname: string;
    params?: Record<string, string>;
  }
> = {
  // Event details
  "^/events?/([^/]+)$": (match) => ({
    pathname: "/(app)/events/[id]",
    params: { id: match[1] },
  }),

  // User profile (by username or userId) - supports /user/, /users/, /profile/, /profiles/
  "^/(?:users?|profiles?)/([^/]+)$": (match) => ({
    pathname: "/(app)/profile/[userId]",
    params: { userId: match[1] },
  }),

  // Post details
  "^/posts?/([^/]+)$": (match) => ({
    pathname: "/(app)/home/post/[postId]",
    params: { postId: match[1] },
  }),

  // Feed post (alternate route)
  "^/feed/posts?/([^/]+)$": (match) => ({
    pathname: "/(app)/home/post/[postId]",
    params: { postId: match[1] },
  }),

  // Ticket transfer claim
  "^/transfers?/claim$": (_match, queryParams) => ({
    pathname: "/(app)/transfer/claim",
    params: {
      token: queryParams.token || queryParams.t || "",
      transferId: queryParams.id || queryParams.transferId || "",
    },
  }),

  // Legacy claim-ticket URL (web)
  "^/claim-ticket$": (_match, queryParams) => ({
    pathname: "/(app)/transfer/claim",
    params: {
      token: queryParams.token || queryParams.t || "",
      transferId: queryParams.id || queryParams.transferId || "",
    },
  }),

  // Transfer route (with ID in path)
  "^/transfers?/([^/]+)$": (match, queryParams) => ({
    pathname: "/(app)/transfer/claim",
    params: {
      transferId: match[1],
      token: queryParams.token || queryParams.t || "",
    },
  }),

  // Shop product details
  "^/shop/products?/([^/]+)$": (match) => ({
    pathname: "/(app)/shop/[handle]",
    params: { handle: match[1] },
  }),

  // Shop collection
  "^/shop/collections?/([^/]+)$": (match) => ({
    pathname: "/(app)/shop/[handle]",
    params: { handle: match[1] },
  }),

  // Notifications
  "^/notifications$": () => ({
    pathname: "/(app)/notifications",
  }),

  // Account/Settings
  "^/account$": () => ({
    pathname: "/(app)/account",
  }),

  // My tickets/events
  "^/my-events$": () => ({
    pathname: "/(app)/events/my-events",
  }),

  // Pending transfers
  "^/transfers?/pending$": () => ({
    pathname: "/(app)/transfer/pending",
  }),
};

interface DeepLinkResult {
  handled: boolean;
  route?: string;
  params?: Record<string, string>;
}

/**
 * Parse and handle a deep link URL
 *
 * @param url - The URL to parse and handle
 * @returns DeepLinkResult indicating if the URL was handled and where it was routed
 */
export function parseDeepLink(url: string): DeepLinkResult {
  try {
    const parsed = Linking.parse(url);

    // For custom scheme links (ragestate://profile/tyrelle), hostname contains the first segment
    // and path contains the rest. We need to combine them.
    // For universal links (https://ragestate.com/profile/tyrelle), path contains everything.
    let fullPath = parsed.path || "";

    // If we have a hostname that's not a domain (e.g., "profile" from ragestate://profile/tyrelle),
    // prepend it to the path
    if (parsed.hostname && !parsed.hostname.includes(".")) {
      fullPath = parsed.hostname + (fullPath ? "/" + fullPath : "");
    }

    // Normalize the path (remove leading/trailing slashes, then add leading slash)
    const normalizedPath = "/" + fullPath.replace(/^\/+|\/+$/g, "");

    // Convert query params to a simple Record
    const queryParams: Record<string, string> = {};
    if (parsed.queryParams) {
      Object.entries(parsed.queryParams).forEach(([key, value]) => {
        if (typeof value === "string") {
          queryParams[key] = value;
        } else if (Array.isArray(value) && value.length > 0) {
          queryParams[key] = value[0];
        }
      });
    }

    // Try to match the path against our route patterns
    for (const [pattern, getRoute] of Object.entries(ROUTE_MAPPING)) {
      const regex = new RegExp(pattern, "i");
      const match = normalizedPath.match(regex);

      if (match) {
        const routeConfig = getRoute(match, queryParams);
        return {
          handled: true,
          route: routeConfig.pathname,
          params: routeConfig.params,
        };
      }
    }

    // If no match found, return unhandled
    console.log("Unhandled deep link path:", normalizedPath);
    return { handled: false };
  } catch (error) {
    console.error("Error parsing deep link:", error);
    return { handled: false };
  }
}

interface UseDeepLinkingOptions {
  /** Whether deep linking is enabled (default: true) */
  enabled?: boolean;
  /** Callback when a deep link is handled */
  onDeepLinkHandled?: (url: string, route: string) => void;
  /** Callback when a deep link is not handled */
  onDeepLinkUnhandled?: (url: string) => void;
}

/**
 * useDeepLinking Hook
 * Automatically handles deep links when the app opens or receives a URL
 *
 * @example
 * ```tsx
 * function App() {
 *   useDeepLinking({
 *     onDeepLinkHandled: (url, route) => {
 *       analytics.track('Deep Link Handled', { url, route });
 *     },
 *   });
 *
 *   return <YourApp />;
 * }
 * ```
 */
export function useDeepLinking(options: UseDeepLinkingOptions = {}): void {
  const { enabled = true, onDeepLinkHandled, onDeepLinkUnhandled } = options;

  const router = useRouter();
  const handledInitialUrl = useRef(false);

  const handleURL = useCallback(
    (url: string) => {
      if (!enabled) return;

      console.log("Deep link received:", url);

      const result = parseDeepLink(url);

      if (result.handled && result.route) {
        try {
          router.push({
            pathname: result.route as any,
            params: result.params,
          });

          onDeepLinkHandled?.(url, result.route);

          if (__DEV__) {
            console.log("✅ Deep link handled:", result.route, result.params);
          }
        } catch (error) {
          console.error("Error navigating to deep link route:", error);
        }
      } else {
        onDeepLinkUnhandled?.(url);

        if (__DEV__) {
          console.log("⚠️ Deep link not handled:", url);
        }
      }
    },
    [enabled, router, onDeepLinkHandled, onDeepLinkUnhandled],
  );

  useEffect(() => {
    if (!enabled) return;

    // Handle URL that opened the app
    const checkInitialURL = async () => {
      if (handledInitialUrl.current) return;

      try {
        const initialUrl = await Linking.getInitialURL();
        if (initialUrl) {
          handledInitialUrl.current = true;
          handleURL(initialUrl);
        }
      } catch (error) {
        console.error("Error getting initial URL:", error);
      }
    };

    checkInitialURL();

    // Handle URLs received while app is open
    const subscription = Linking.addEventListener("url", ({ url }) => {
      handleURL(url);
    });

    return () => {
      subscription.remove();
    };
  }, [enabled, handleURL]);
}

/**
 * Create a deep link URL for the app
 *
 * @param path - The path to link to (e.g., '/events/123')
 * @param params - Optional query parameters
 * @returns The full deep link URL
 */
export function createDeepLink(
  path: string,
  params?: Record<string, string>,
): string {
  const normalizedPath = path.startsWith("/") ? path.slice(1) : path;
  let url = Linking.createURL(normalizedPath);

  if (params && Object.keys(params).length > 0) {
    const queryString = Object.entries(params)
      .map(
        ([key, value]) =>
          `${encodeURIComponent(key)}=${encodeURIComponent(value)}`,
      )
      .join("&");
    url += `?${queryString}`;
  }

  return url;
}

/**
 * Get the app's URL prefix for deep links
 * Useful for sharing links that open in the app
 */
export function getDeepLinkPrefix(): string {
  return Linking.createURL("");
}

export default useDeepLinking;
