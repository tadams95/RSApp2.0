import {
  deleteDoc,
  doc,
  getDoc,
  increment,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { useCallback, useState } from "react";
import { auth, db } from "../firebase/firebase";

interface UseLikeResult {
  isLiked: boolean;
  likeCount: number;
  isLoading: boolean;
  toggleLike: () => Promise<void>;
  checkIfLiked: (postId: string) => Promise<void>;
}

const POST_LIKES_COLLECTION = "postLikes";
const POSTS_COLLECTION = "posts";

/**
 * Hook for managing post likes with optimistic updates
 */
export function useLike(
  postId: string,
  initialLikeCount: number = 0
): UseLikeResult {
  const [isLiked, setIsLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(initialLikeCount);
  const [isLoading, setIsLoading] = useState(false);

  // Check if the current user has liked this post
  const checkIfLiked = useCallback(async (id: string) => {
    const currentUser = auth.currentUser;
    if (!currentUser) return;

    try {
      const likeId = `${id}_${currentUser.uid}`;
      const likeRef = doc(db, POST_LIKES_COLLECTION, likeId);
      const likeDoc = await getDoc(likeRef);
      setIsLiked(likeDoc.exists());
    } catch (error) {
      console.error("Error checking like status:", error);
    }
  }, []);

  // Toggle like with optimistic update
  const toggleLike = useCallback(async () => {
    const currentUser = auth.currentUser;
    if (!currentUser) {
      console.warn("Must be logged in to like posts");
      return;
    }

    const likeId = `${postId}_${currentUser.uid}`;
    const likeRef = doc(db, POST_LIKES_COLLECTION, likeId);
    const postRef = doc(db, POSTS_COLLECTION, postId);

    // Store previous state for rollback
    const wasLiked = isLiked;
    const previousCount = likeCount;

    // Optimistic update
    setIsLiked(!wasLiked);
    setLikeCount((prev) => (wasLiked ? prev - 1 : prev + 1));
    setIsLoading(true);

    try {
      if (wasLiked) {
        // Unlike: delete the like document
        await deleteDoc(likeRef);
        // Decrement counter on post
        await updateDoc(postRef, {
          likeCount: increment(-1),
        });
      } else {
        // Like: create like document
        await setDoc(likeRef, {
          postId,
          userId: currentUser.uid,
          createdAt: serverTimestamp(),
        });
        // Increment counter on post
        await updateDoc(postRef, {
          likeCount: increment(1),
        });
      }
    } catch (error) {
      // Rollback on error
      console.error("Error toggling like:", error);
      setIsLiked(wasLiked);
      setLikeCount(previousCount);
    } finally {
      setIsLoading(false);
    }
  }, [postId, isLiked, likeCount]);

  return {
    isLiked,
    likeCount,
    isLoading,
    toggleLike,
    checkIfLiked,
  };
}

/**
 * Standalone function to like a post (for use outside hooks)
 */
export async function likePost(postId: string): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Must be logged in to like posts");
  }

  const likeId = `${postId}_${currentUser.uid}`;
  const likeRef = doc(db, POST_LIKES_COLLECTION, likeId);
  const postRef = doc(db, POSTS_COLLECTION, postId);

  // Check if already liked
  const likeDoc = await getDoc(likeRef);
  if (likeDoc.exists()) {
    return false; // Already liked
  }

  await setDoc(likeRef, {
    postId,
    userId: currentUser.uid,
    createdAt: serverTimestamp(),
  });

  await updateDoc(postRef, {
    likeCount: increment(1),
  });

  return true;
}

/**
 * Standalone function to unlike a post (for use outside hooks)
 */
export async function unlikePost(postId: string): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Must be logged in to unlike posts");
  }

  const likeId = `${postId}_${currentUser.uid}`;
  const likeRef = doc(db, POST_LIKES_COLLECTION, likeId);
  const postRef = doc(db, POSTS_COLLECTION, postId);

  // Check if liked
  const likeDoc = await getDoc(likeRef);
  if (!likeDoc.exists()) {
    return false; // Not liked
  }

  await deleteDoc(likeRef);

  await updateDoc(postRef, {
    likeCount: increment(-1),
  });

  return true;
}

/**
 * Check if current user has liked a post
 */
export async function hasUserLikedPost(postId: string): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) return false;

  const likeId = `${postId}_${currentUser.uid}`;
  const likeRef = doc(db, POST_LIKES_COLLECTION, likeId);
  const likeDoc = await getDoc(likeRef);

  return likeDoc.exists();
}
