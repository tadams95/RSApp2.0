import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import {
  getDownloadURL,
  ref,
  uploadBytesResumable,
  UploadTaskSnapshot,
} from "firebase/storage";
import { auth, db, storage } from "../firebase/firebase";
import { getUserData } from "../utils/auth";
import { getFollowing } from "./followService";

// Types - matches actual Firestore schema
export interface RepostOf {
  postId: string;
  authorId: string;
  authorName?: string;
  authorPhoto?: string;
  authorUsername?: string;
}

export interface Post {
  id: string;
  // Author fields (actual Firestore field names)
  userId: string;
  userDisplayName: string;
  usernameLower?: string;
  userProfilePicture?: string;
  userVerified?: boolean; // Verified badge
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
  // Repost info (if this post is a repost of another)
  repostOf?: RepostOf;
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
    where("userId", "==", userId),
    orderBy("timestamp", "desc"),
    limit(limitCount)
  );

  const snapshot = await getDocs(postsQuery);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Post[];
}

// ============================================
// Post Creation
// ============================================

export interface CreatePostInput {
  content: string;
  mediaFiles: { uri: string; type: "image" | "video" }[];
  isPublic: boolean;
}

export interface UploadProgress {
  totalFiles: number;
  completedFiles: number;
  currentFileProgress: number; // 0-100
  overallProgress: number; // 0-100
}

/**
 * Upload a single file to Firebase Storage with progress tracking
 */
async function uploadMediaFile(
  fileUri: string,
  postId: string,
  index: number,
  onProgress?: (progress: number) => void
): Promise<string> {
  // Fetch the file as a blob
  const response = await fetch(fileUri);
  const blob = await response.blob();

  // Determine file extension from URI or blob type
  const extension = fileUri.split(".").pop()?.toLowerCase() || "jpg";
  const filename = `${Date.now()}_${index}.${extension}`;
  const storagePath = `posts/${postId}_${filename}`;

  const storageRef = ref(storage, storagePath);

  return new Promise((resolve, reject) => {
    const uploadTask = uploadBytesResumable(storageRef, blob);

    uploadTask.on(
      "state_changed",
      (snapshot: UploadTaskSnapshot) => {
        const progress =
          (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
        onProgress?.(progress);
      },
      (error) => {
        console.error("Upload error:", error);
        reject(error);
      },
      async () => {
        try {
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          resolve(downloadURL);
        } catch (error) {
          reject(error);
        }
      }
    );
  });
}

/**
 * Create a new post with optional media
 * Uploads media to Storage, then creates Firestore document
 */
export async function createPost(
  input: CreatePostInput,
  onProgress?: (progress: UploadProgress) => void
): Promise<string> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Must be logged in to create a post");
  }

  // Get user data from /customers collection
  const userData = await getUserData(currentUser.uid);
  if (!userData) {
    throw new Error("User data not found");
  }

  // Also fetch from /profiles collection for social fields (displayName, verification, photo)
  const profileDoc = await getDoc(doc(db, "profiles", currentUser.uid));
  const profileData = profileDoc.exists() ? profileDoc.data() : null;

  // Generate a temporary post ID for storage paths
  const tempPostId = `${currentUser.uid}_${Date.now()}`;

  // Upload media files with progress tracking
  const mediaUrls: string[] = [];
  const mediaTypes: ("image" | "video")[] = [];
  const totalFiles = input.mediaFiles.length;

  for (let i = 0; i < input.mediaFiles.length; i++) {
    const file = input.mediaFiles[i];

    const downloadUrl = await uploadMediaFile(
      file.uri,
      tempPostId,
      i,
      (fileProgress) => {
        onProgress?.({
          totalFiles,
          completedFiles: i,
          currentFileProgress: fileProgress,
          overallProgress: ((i + fileProgress / 100) / totalFiles) * 100,
        });
      }
    );

    mediaUrls.push(downloadUrl);
    mediaTypes.push(file.type);

    // Update progress for completed file
    onProgress?.({
      totalFiles,
      completedFiles: i + 1,
      currentFileProgress: 100,
      overallProgress: ((i + 1) / totalFiles) * 100,
    });
  }

  // Create the post document in Firestore
  // Use conditional spreading to omit null fields (Firestore rules reject null for typed fields)
  // Prefer /profiles data for social fields, fall back to /customers data
  const profilePicture =
    profileData?.photoURL ||
    profileData?.profilePicture ||
    userData.profilePicture;
  const displayName =
    profileData?.displayName ||
    userData.displayName ||
    userData.name ||
    userData.email ||
    "Anonymous";
  const username = profileData?.usernameLower || userData.username;
  const isVerified =
    profileData?.isVerified === true ||
    userData.verificationStatus === "verified" ||
    userData.verificationStatus === "artist";

  const postData = {
    // Author info
    userId: currentUser.uid,
    userDisplayName: displayName,
    ...(username && { usernameLower: username.toLowerCase() }),
    ...(profilePicture && { userProfilePicture: profilePicture }),
    userVerified: isVerified,
    // Content
    content: input.content.trim(),
    ...(mediaUrls.length > 0 && { mediaUrls }),
    ...(mediaTypes.length > 0 && { mediaTypes }),
    // Visibility
    isPublic: input.isPublic,
    // Engagement counts (start at 0)
    likeCount: 0,
    commentCount: 0,
    repostCount: 0,
    // Timestamps
    timestamp: serverTimestamp(),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, POSTS_COLLECTION), postData);

  return docRef.id;
}
