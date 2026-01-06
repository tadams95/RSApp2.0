import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebase";
import { getFollowing } from "./followService";

// Types - matches actual Firestore schema
export interface Post {
  id: string;
  // Author fields (actual Firestore field names)
  userId: string;
  userDisplayName: string;
  usernameLower?: string;
  userProfilePicture?: string;
  // Content
  content: string;
  mediaUrls?: string[];
  mediaTypes?: ("image" | "video")[];
  // Optimized media (from transcoding cloud function)
  optimizedMediaUrls?: string[];
  isProcessing?: boolean;
  // Visibility
  isPublic: boolean;
  // Engagement counts
  likeCount: number;
  commentCount: number;
  repostCount?: number;
  // Timestamps
  timestamp: Timestamp;
  updatedAt?: Timestamp;
  edited?: boolean;
}

export interface FeedOptions {
  limitCount?: number;
}

const POSTS_COLLECTION = "posts";
const DEFAULT_LIMIT = 20;

/**
 * Subscribe to public feed - all public posts, newest first
 * Real-time listener that updates when new posts are added
 */
export function subscribeToForYouFeed(
  onUpdate: (posts: Post[]) => void,
  onError: (error: Error) => void,
  options: FeedOptions = {}
): Unsubscribe {
  const postsQuery = query(
    collection(db, POSTS_COLLECTION),
    where("isPublic", "==", true),
    orderBy("timestamp", "desc"),
    limit(options.limitCount || DEFAULT_LIMIT)
  );

  return onSnapshot(
    postsQuery,
    (snapshot) => {
      const posts: Post[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Post[];
      onUpdate(posts);
    },
    (error) => {
      console.error("Error subscribing to feed:", error);
      onError(error);
    }
  );
}

/**
 * Subscribe to "Following" feed - posts from users the current user follows
 * Real-time listener that updates when new posts are added
 */
export function subscribeToFollowingFeed(
  onUpdate: (posts: Post[]) => void,
  onError: (error: Error) => void,
  options: FeedOptions = {}
): Unsubscribe | null {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    onError(new Error("Must be logged in to view following feed"));
    return null;
  }

  // First get the list of users we're following
  // Then subscribe to their posts
  let unsubscribe: Unsubscribe | null = null;

  getFollowing(currentUser.uid)
    .then((followingIds) => {
      if (followingIds.length === 0) {
        // No one followed, return empty array
        onUpdate([]);
        return;
      }

      // Firestore 'in' queries are limited to 30 items
      // For larger following lists, we'd need to batch queries
      const queryIds = followingIds.slice(0, 30);

      const postsQuery = query(
        collection(db, POSTS_COLLECTION),
        where("authorId", "in", queryIds),
        orderBy("createdAt", "desc"),
        limit(options.limitCount || DEFAULT_LIMIT)
      );

      unsubscribe = onSnapshot(
        postsQuery,
        (snapshot) => {
          const posts: Post[] = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })) as Post[];
          onUpdate(posts);
        },
        (error) => {
          console.error("Error subscribing to Following feed:", error);
          onError(error);
        }
      );
    })
    .catch((error) => {
      console.error("Error getting following list:", error);
      onError(error);
    });

  // Return cleanup function
  return () => {
    if (unsubscribe) {
      unsubscribe();
    }
  };
}

/**
 * Get a single post by ID
 */
export async function getPostById(postId: string): Promise<Post | null> {
  const postRef = doc(db, POSTS_COLLECTION, postId);
  const postDoc = await getDoc(postRef);

  if (!postDoc.exists()) {
    return null;
  }

  return {
    id: postDoc.id,
    ...postDoc.data(),
  } as Post;
}

/**
 * Get posts by a specific user
 */
export async function getUserPosts(
  userId: string,
  limitCount: number = DEFAULT_LIMIT
): Promise<Post[]> {
  const postsQuery = query(
    collection(db, POSTS_COLLECTION),
    where("authorId", "==", userId),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );

  const snapshot = await getDocs(postsQuery);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Post[];
}
