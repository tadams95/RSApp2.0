// Comment types - canonical definitions
// Re-exported from @/services/commentService for backward compatibility

import { Timestamp } from "firebase/firestore";

export interface Comment {
  id: string;
  postId: string;
  userId: string;
  userDisplayName: string;
  userProfilePicture?: string;
  userVerified?: boolean; // Verified badge
  content: string;
  likeCount: number;
  timestamp: Timestamp;
  createdAt?: Timestamp; // Alias for display (mapped from timestamp)
  // Optional: for nested replies (1 level deep)
  parentId?: string;
}

export interface CommentInput {
  content: string;
  parentCommentId?: string;
}
