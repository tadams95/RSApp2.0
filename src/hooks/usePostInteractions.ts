import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";
import { useCallback, useState } from "react";
import { auth, db } from "../firebase/firebase";
import { Post, RepostOf } from "../services/feedService";

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
        // Unlike: delete the like document (Cloud Function handles counter)
        await deleteDoc(likeRef);
      } else {
        // Like: create like document (Cloud Function handles counter)
        await setDoc(likeRef, {
          postId,
          userId: currentUser.uid,
          timestamp: serverTimestamp(),
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
    timestamp: serverTimestamp(),
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

// ===== REPOST FUNCTIONS =====

const POST_REPOSTS_COLLECTION = "postReposts";

/**
 * Repost a post - creates a new post document with repostOf field
 * and a record in postReposts collection for tracking
 */
export async function repostPost(
  postId: string,
  originalPost: Post
): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Must be logged in to repost");
  }

  const repostId = `${postId}_${currentUser.uid}`;
  const repostRef = doc(db, POST_REPOSTS_COLLECTION, repostId);

  // Check if already reposted
  const existingRepost = await getDoc(repostRef);
  if (existingRepost.exists()) {
    return false; // Already reposted
  }

  // Fetch the reposter's profile to get their display name and username
  // Firebase Auth displayName is often null, so we get it from Firestore
  let reposterDisplayName = currentUser.displayName || "User";
  let reposterPhoto = currentUser.photoURL;
  let reposterUsername: string | undefined;

  try {
    const profileDoc = await getDoc(doc(db, "profiles", currentUser.uid));
    if (profileDoc.exists()) {
      const profileData = profileDoc.data();
      reposterDisplayName = profileData.displayName || reposterDisplayName;
      reposterPhoto =
        profileData.photoURL || profileData.profilePicture || reposterPhoto;
      reposterUsername = profileData.usernameLower;
    }
  } catch (err) {
    console.warn("Could not fetch reposter profile:", err);
  }

  // Build repostOf metadata from original post
  const repostOf: RepostOf = {
    postId: originalPost.id,
    authorId: originalPost.userId,
    authorName: originalPost.userDisplayName,
    authorPhoto: originalPost.userProfilePicture,
    authorUsername: originalPost.usernameLower,
  };

  // Step 1: Create a new post document representing the repost
  // Only include fields allowed by Firestore rules (no mediaTypes, optimizedMediaUrls)
  const newRepostPost = await addDoc(collection(db, POSTS_COLLECTION), {
    userId: currentUser.uid,
    userDisplayName: reposterDisplayName,
    // Include username if available
    ...(reposterUsername ? { usernameLower: reposterUsername } : {}),
    // userProfilePicture must be a string or omitted (rules don't allow null)
    ...(reposterPhoto ? { userProfilePicture: reposterPhoto } : {}),
    content: originalPost.content || "", // Carry over original content
    mediaUrls: originalPost.mediaUrls || [],
    // Note: mediaTypes and optimizedMediaUrls are NOT included
    // - mediaTypes is not in Firestore rules
    // - optimizedMediaUrls can only be set by Cloud Function
    isPublic: true,
    likeCount: 0,
    commentCount: 0,
    repostCount: 0,
    repostOf, // This marks it as a repost
    timestamp: serverTimestamp(),
  });

  // Step 2: Create tracking record in postReposts with repostPostId
  await setDoc(repostRef, {
    postId,
    userId: currentUser.uid,
    originalAuthorId: originalPost.userId,
    repostPostId: newRepostPost.id, // Key field for Cloud Function fan-out
    timestamp: serverTimestamp(),
  });

  return true;
}

/**
 * Unrepost a post - deletes both the repost post and the tracking record
 */
export async function unrepostPost(postId: string): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Must be logged in to unrepost");
  }

  const repostId = `${postId}_${currentUser.uid}`;
  const repostRef = doc(db, POST_REPOSTS_COLLECTION, repostId);

  // Check if reposted and get the repostPostId
  const repostDoc = await getDoc(repostRef);
  if (!repostDoc.exists()) {
    return false; // Not reposted
  }

  const repostData = repostDoc.data();
  const repostPostId = repostData?.repostPostId;

  // Delete the repost post document if it exists
  if (repostPostId) {
    try {
      await deleteDoc(doc(db, POSTS_COLLECTION, repostPostId));
    } catch (err) {
      console.warn("Could not delete repost post:", err);
    }
  }

  // Delete the tracking record (triggers Cloud Function to decrement counter)
  await deleteDoc(repostRef);

  return true;
}

/**
 * Check if current user has reposted a post
 */
export async function hasUserRepostedPost(postId: string): Promise<boolean> {
  const currentUser = auth.currentUser;
  if (!currentUser) return false;

  const repostId = `${postId}_${currentUser.uid}`;
  const repostRef = doc(db, POST_REPOSTS_COLLECTION, repostId);
  const repostDoc = await getDoc(repostRef);

  return repostDoc.exists();
}
