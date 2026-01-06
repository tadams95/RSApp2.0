import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  DocumentData,
  getDocs,
  limit,
  onSnapshot,
  orderBy,
  query,
  QueryDocumentSnapshot,
  serverTimestamp,
  startAfter,
  Timestamp,
  where,
  type Unsubscribe,
} from "firebase/firestore";
import { auth, db } from "../firebase/firebase";

const COMMENTS_COLLECTION = "postComments";
const PAGE_SIZE = 20;

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  userDisplayName: string;
  userProfilePicture?: string;
  content: string;
  likeCount: number;
  createdAt: Timestamp;
  // Optional: for nested replies (1 level deep)
  parentCommentId?: string;
}

export interface CommentInput {
  content: string;
  parentCommentId?: string;
}

/**
 * Subscribe to real-time comments for a post
 */
export function subscribeToComments(
  postId: string,
  onUpdate: (comments: Comment[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const commentsQuery = query(
    collection(db, COMMENTS_COLLECTION),
    where("postId", "==", postId),
    orderBy("createdAt", "asc"),
    limit(PAGE_SIZE)
  );

  return onSnapshot(
    commentsQuery,
    (snapshot) => {
      const comments: Comment[] = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Comment[];
      onUpdate(comments);
    },
    (error) => {
      console.error("Error subscribing to comments:", error);
      onError(error);
    }
  );
}

/**
 * Get paginated comments for a post
 */
export async function getComments(
  postId: string,
  lastDoc?: QueryDocumentSnapshot<DocumentData>
): Promise<{
  comments: Comment[];
  lastDoc: QueryDocumentSnapshot<DocumentData> | null;
}> {
  let commentsQuery = query(
    collection(db, COMMENTS_COLLECTION),
    where("postId", "==", postId),
    orderBy("createdAt", "asc"),
    limit(PAGE_SIZE)
  );

  if (lastDoc) {
    commentsQuery = query(
      collection(db, COMMENTS_COLLECTION),
      where("postId", "==", postId),
      orderBy("createdAt", "asc"),
      startAfter(lastDoc),
      limit(PAGE_SIZE)
    );
  }

  const snapshot = await getDocs(commentsQuery);
  const comments: Comment[] = snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Comment[];

  const newLastDoc =
    snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null;

  return { comments, lastDoc: newLastDoc };
}

/**
 * Add a comment to a post
 */
export async function addComment(
  postId: string,
  input: CommentInput
): Promise<Comment> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Must be logged in to comment");
  }

  if (!input.content.trim()) {
    throw new Error("Comment cannot be empty");
  }

  const commentData = {
    postId,
    userId: currentUser.uid,
    userDisplayName: currentUser.displayName || "Anonymous",
    userProfilePicture: currentUser.photoURL || null,
    content: input.content.trim(),
    likeCount: 0,
    createdAt: serverTimestamp(),
    ...(input.parentCommentId && { parentCommentId: input.parentCommentId }),
  };

  const docRef = await addDoc(collection(db, COMMENTS_COLLECTION), commentData);

  return {
    id: docRef.id,
    ...commentData,
    createdAt: Timestamp.now(), // Use client timestamp for immediate display
  } as Comment;
}

/**
 * Delete a comment (only the author can delete)
 */
export async function deleteComment(commentId: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser) {
    throw new Error("Must be logged in to delete comments");
  }

  await deleteDoc(doc(db, COMMENTS_COLLECTION, commentId));
}
