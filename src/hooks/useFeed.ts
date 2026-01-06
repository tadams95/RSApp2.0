import {
  collection,
  DocumentData,
  getDocs,
  limit,
  orderBy,
  query,
  QueryDocumentSnapshot,
  startAfter,
  where,
} from "firebase/firestore";
import { useCallback, useEffect, useRef, useState } from "react";
import { db } from "../firebase/firebase";
import {
  Post,
  subscribeToFollowingFeed,
  subscribeToForYouFeed,
} from "../services/feedService";
import { useAuth } from "./AuthContext";

export type FeedType = "forYou" | "following";

const PAGE_SIZE = 10;

interface UseFeedResult {
  posts: Post[];
  isLoading: boolean;
  error: Error | null;
  refetch: () => void;
  loadMore: () => void;
  hasMore: boolean;
  isLoadingMore: boolean;
}

/**
 * Hook for subscribing to real-time feed updates with pagination
 * Automatically switches between Following and For You feeds based on feedType
 */
export function useFeed(feedType: FeedType): UseFeedResult {
  const { authenticated } = useAuth();
  const [posts, setPosts] = useState<Post[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const lastDocRef = useRef<QueryDocumentSnapshot<DocumentData> | null>(null);

  // Refetch by incrementing the key to trigger useEffect
  const refetch = useCallback(() => {
    setIsLoading(true);
    setError(null);
    setHasMore(true);
    lastDocRef.current = null;
    setRefreshKey((prev) => prev + 1);
  }, []);

  // Load more posts for pagination
  const loadMore = useCallback(async () => {
    if (isLoadingMore || !hasMore || !lastDocRef.current) return;

    setIsLoadingMore(true);

    try {
      // Query uses actual Firestore field names: isPublic, timestamp
      const nextQuery = query(
        collection(db, "posts"),
        where("isPublic", "==", true),
        orderBy("timestamp", "desc"),
        startAfter(lastDocRef.current),
        limit(PAGE_SIZE)
      );

      const snapshot = await getDocs(nextQuery);

      if (snapshot.empty) {
        setHasMore(false);
      } else {
        const newPosts: Post[] = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as Post[];

        lastDocRef.current = snapshot.docs[snapshot.docs.length - 1];
        setPosts((prev) => [...prev, ...newPosts]);

        if (snapshot.docs.length < PAGE_SIZE) {
          setHasMore(false);
        }
      }
    } catch (err) {
      console.error("Error loading more posts:", err);
    } finally {
      setIsLoadingMore(false);
    }
  }, [feedType, isLoadingMore, hasMore]);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setHasMore(true);
    lastDocRef.current = null;

    let unsubscribe: (() => void) | null = null;

    const handleUpdate = (newPosts: Post[]) => {
      setPosts(newPosts);
      setIsLoading(false);
      // Store reference to last doc for pagination
      // Note: Real-time listener doesn't give us direct access to docs
      // So we'll fetch the last doc separately if needed
      if (newPosts.length < PAGE_SIZE) {
        setHasMore(false);
      }
    };

    const handleError = (err: Error) => {
      setError(err);
      setIsLoading(false);
    };

    if (feedType === "forYou") {
      unsubscribe = subscribeToForYouFeed(handleUpdate, handleError, {
        limitCount: PAGE_SIZE,
      });
    } else if (feedType === "following" && authenticated) {
      unsubscribe = subscribeToFollowingFeed(handleUpdate, handleError, {
        limitCount: PAGE_SIZE,
      });
    } else {
      // Not logged in for following feed
      setPosts([]);
      setIsLoading(false);
      setHasMore(false);
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [feedType, authenticated, refreshKey]);

  return { posts, isLoading, error, refetch, loadMore, hasMore, isLoadingMore };
}

/**
 * Hook specifically for the Following feed
 */
export function useFollowingFeed(): UseFeedResult {
  return useFeed("following");
}

/**
 * Hook specifically for the For You feed
 */
export function useForYouFeed(): UseFeedResult {
  return useFeed("forYou");
}
