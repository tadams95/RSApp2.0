import { useCallback, useEffect, useRef, useState } from "react";
import { MentionUser } from "../components/feed/MentionUserRow";
import {
  searchUsersByUsername,
  UserSearchResult,
} from "../services/userSearchService";

interface UseUserSearchResult {
  /** Search results matching the query */
  results: MentionUser[];
  /** Whether a search is in progress */
  isLoading: boolean;
  /** Error from the last search, if any */
  error: Error | null;
  /** Trigger a search with the given query */
  search: (query: string) => void;
  /** Clear search results */
  clear: () => void;
}

/**
 * Hook for searching users by username with debouncing
 *
 * @param debounceMs - Debounce delay in milliseconds (default: 300)
 * @returns Search results, loading state, and search function
 *
 * @example
 * ```tsx
 * const { results, isLoading, search, clear } = useUserSearch();
 *
 * // In your component
 * useEffect(() => {
 *   if (mentionQuery) {
 *     search(mentionQuery);
 *   } else {
 *     clear();
 *   }
 * }, [mentionQuery]);
 * ```
 */
export function useUserSearch(debounceMs: number = 300): UseUserSearchResult {
  const [results, setResults] = useState<MentionUser[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Track the debounce timeout
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  // Track the last search query to avoid stale results
  const lastQueryRef = useRef<string>("");
  // Cache recent results to avoid redundant queries
  const cacheRef = useRef<Map<string, MentionUser[]>>(new Map());

  /**
   * Convert UserSearchResult to MentionUser format
   */
  const toMentionUser = (user: UserSearchResult): MentionUser => ({
    uid: user.userId,
    username: user.username || "",
    displayName: user.displayName,
    profilePicture: user.profilePicture,
    verified: user.verificationStatus === "verified",
  });

  /**
   * Execute the actual search
   */
  const executeSearch = useCallback(async (query: string) => {
    // Check cache first
    const cached = cacheRef.current.get(query);
    if (cached) {
      setResults(cached);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const searchResults = await searchUsersByUsername(query, 10);

      // Only update if this is still the most recent query
      if (query === lastQueryRef.current) {
        const mentionUsers = searchResults.map(toMentionUser);

        // Cache the results
        cacheRef.current.set(query, mentionUsers);

        // Keep cache size manageable (max 50 entries)
        if (cacheRef.current.size > 50) {
          const firstKey = cacheRef.current.keys().next().value;
          if (firstKey) {
            cacheRef.current.delete(firstKey);
          }
        }

        setResults(mentionUsers);
      }
    } catch (err) {
      if (query === lastQueryRef.current) {
        setError(err instanceof Error ? err : new Error("Search failed"));
        setResults([]);
      }
    } finally {
      if (query === lastQueryRef.current) {
        setIsLoading(false);
      }
    }
  }, []);

  /**
   * Trigger a debounced search
   */
  const search = useCallback(
    (query: string) => {
      lastQueryRef.current = query;

      // Clear any pending debounce
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }

      // For empty or very short queries, clear results immediately
      if (!query || query.length < 1) {
        setResults([]);
        setIsLoading(false);
        setError(null);
        return;
      }

      // Show loading immediately for better UX
      setIsLoading(true);

      // Debounce the actual search
      debounceRef.current = setTimeout(() => {
        executeSearch(query);
      }, debounceMs);
    },
    [debounceMs, executeSearch]
  );

  /**
   * Clear search results and state
   */
  const clear = useCallback(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    lastQueryRef.current = "";
    setResults([]);
    setIsLoading(false);
    setError(null);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  return {
    results,
    isLoading,
    error,
    search,
    clear,
  };
}

export default useUserSearch;
