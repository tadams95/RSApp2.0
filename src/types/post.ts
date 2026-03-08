// Post types - canonical definitions
// Re-exported from @/services/feedService for backward compatibility

import { Timestamp } from "firebase/firestore";

export interface RepostOf {
  postId: string;
  authorId: string;
  authorName?: string;
  authorPhoto?: string;
  authorUsername?: string;
  // Quote repost fields (for embedded preview)
  originalContent?: string;
  originalMediaUrls?: string[];
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
