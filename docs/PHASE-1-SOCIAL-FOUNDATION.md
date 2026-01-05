# Phase 1: Social Foundation

> **Timeline**: 2-3 weeks | **Priority**: 🔴 Critical  
> **Dependencies**: None - can start immediately  
> **Outcome**: User profiles, social feed, posts, and interactions

---

## Overview

This phase implements the core social features that are the biggest gap between web and mobile. It establishes the foundation for community engagement.

---

## 1.1 Enhanced User Profiles (~3-4 days)

### Data Model Extension

Extend `src/utils/auth.ts` UserData interface:

```typescript
interface UserData {
  // ...existing fields...
  bio?: string; // max 160 chars
  username?: string; // unique, lowercase
  socialLinks?: {
    soundcloud?: string;
    instagram?: string;
    twitter?: string;
  };
  interests?: string[]; // music genres, event types
  location?: {
    city?: string;
    state?: string;
  };
  isPublic?: boolean; // profile visibility
  lastActive?: string; // ISO timestamp
  verificationStatus?: "none" | "verified" | "artist";
  stats?: {
    eventsAttended: number;
    postsCount: number;
    followersCount: number;
    followingCount: number;
  };
}
```

### New Routes

Create under `src/app/(app)/`:

```
profile/
├── _layout.tsx          # Stack navigator
├── [userId].tsx         # View any user's profile
├── edit.tsx             # Edit own profile (modal or screen)
└── search.tsx           # User search/discovery
```

### Components to Build

Create under `src/components/profile/`:

| Component               | Purpose                                 |
| ----------------------- | --------------------------------------- |
| `UserProfileView.tsx`   | Main profile display (self/other modes) |
| `ProfileHeader.tsx`     | Avatar, name, bio, stats                |
| `ProfileStats.tsx`      | Followers, following, events, posts     |
| `FollowButton.tsx`      | Follow/unfollow with optimistic UI      |
| `SocialLinks.tsx`       | External link buttons                   |
| `InterestTags.tsx`      | Display user interests                  |
| `UserSearchInput.tsx`   | Search with debounce                    |
| `UserSearchResults.tsx` | Search results list                     |
| `UserCard.tsx`          | Compact user display for lists          |

### Implementation Checklist

- [x] Extend UserData interface with social fields
- [x] Create `profile/[userId].tsx` dynamic route
- [x] Build `UserProfileView` with self/other mode detection
- [x] Implement follow/unfollow in Firestore (`src/services/followService.ts`)
- [x] Build user search with Firestore queries (`src/services/userSearchService.ts`)
- [x] Add profile edit modal/screen (integrated EditProfile modal)
- [x] Integrate with existing EditProfile modal
- [x] Add PostHog tracking for profile events (`FollowButton.tsx`)

---

## 1.2 Social Feed Core (~5-6 days)

### Firestore Collections

Reference existing schema from `mobile-integration-spec.md`:

```typescript
// posts/{postId}
{
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorPhotoURL?: string;
  authorVerified: boolean;
  content: string;
  mediaUrls: string[];
  mediaTypes: ('image' | 'video')[];
  isPrivate: boolean;
  likeCount: number;
  commentCount: number;
  repostCount: number;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

// follows/{id} - composite key: {followerId}_{followingId}
{
  followerId: string;
  followingId: string;
  createdAt: Timestamp;
}

// postLikes/{id} - composite key: {postId}_{userId}
// postComments/{commentId}
```

### New Routes

```
src/app/(app)/
├── social/
│   ├── _layout.tsx      # Stack for social screens
│   ├── index.tsx        # Main feed (Following)
│   ├── latest.tsx       # Global latest posts
│   └── post/
│       └── [postId].tsx # Single post with comments
```

### Components to Build

Create under `src/components/feed/`:

| Component          | Purpose                       |
| ------------------ | ----------------------------- |
| `FeedScreen.tsx`   | Feed orchestrator with tabs   |
| `PostCard.tsx`     | Individual post display       |
| `PostActions.tsx`  | Like, comment, repost buttons |
| `PostComposer.tsx` | Create new post               |
| `MediaPicker.tsx`  | Select images/video           |
| `MediaGrid.tsx`    | Display post media            |
| `CommentsList.tsx` | Comments for a post           |
| `CommentInput.tsx` | Add comment                   |
| `FeedTabs.tsx`     | Switch Following/Latest       |

### Services & Hooks

Create under `src/services/` and `src/hooks/`:

```typescript
// src/services/feedService.ts
- createPost(content, mediaUrls, isPrivate)
- deletePost(postId)
- likePost(postId) / unlikePost(postId)
- getPostById(postId)

// src/services/followService.ts
- followUser(userId) / unfollowUser(userId)
- getFollowers(userId)
- getFollowing(userId)
- isFollowing(currentUser, targetUser)

// src/hooks/useFeed.ts
- useFollowingFeed() - posts from followed users
- useLatestFeed() - all public posts
- useUserPosts(userId) - posts by specific user

// src/hooks/usePostInteractions.ts
- useLike(postId)
- useComments(postId)
```

### Implementation Checklist 1.2

- [x] Create `social/` route group with layout (`src/app/(app)/social/_layout.tsx`)
- [x] Build feed screen with Following/Latest tabs (`src/app/(app)/social/index.tsx`)
- [ ] Implement real-time Firestore listener for feed
- [ ] Build PostCard component with media support
- [ ] Implement like/unlike with optimistic updates
- [ ] Add infinite scroll pagination
- [ ] Create single post view with comments
- [ ] Add PostHog tracking for feed events

---

## 1.3 Post Composer (~2-3 days)

### Features

- Text content (max 500 chars)
- Up to 4 images OR 1 video
- Privacy toggle (public/followers only)
- Character counter
- Media preview with remove option

### Implementation

```typescript
// src/components/feed/PostComposer.tsx
interface PostComposerProps {
  onPostCreated: () => void;
  onCancel: () => void;
}

// Flow:
// 1. User enters text
// 2. User optionally picks media (reuse expo-image-picker)
// 3. Compress images (reuse existing compression utility)
// 4. Upload to Firebase Storage: posts/{postId}/{filename}
// 5. Create Firestore document with mediaUrls
// 6. Navigate to feed or new post
```

### Implementation Checklist

- [ ] Create PostComposer modal/screen
- [ ] Integrate expo-image-picker for media
- [ ] Reuse image compression from `src/utils/imageCompression.ts`
- [ ] Implement Storage upload with progress
- [ ] Create post document in Firestore
- [ ] Add validation (text length, media limits)
- [ ] Show upload progress indicator
- [ ] Handle errors gracefully

---

## 1.4 Social Interactions (~2-3 days)

### Like System

```typescript
// Optimistic update pattern
const handleLike = async (postId: string) => {
  // 1. Optimistically update UI
  setLiked(true);
  setLikeCount((prev) => prev + 1);

  try {
    // 2. Write to Firestore
    await setDoc(doc(db, "postLikes", `${postId}_${userId}`), {
      postId,
      userId,
      timestamp: serverTimestamp(),
    });
    // 3. Increment counter (could use Cloud Function)
  } catch (error) {
    // 4. Rollback on failure
    setLiked(false);
    setLikeCount((prev) => prev - 1);
  }
};
```

### Comments

- Paginated loading (20 per page)
- Real-time listener for new comments
- Reply to comments (nested, 1 level deep)
- Delete own comments

### Follow System

```typescript
// src/services/followService.ts
export async function followUser(targetUserId: string) {
  const currentUserId = auth.currentUser?.uid;
  const followId = `${currentUserId}_${targetUserId}`;

  await setDoc(doc(db, "follows", followId), {
    followerId: currentUserId,
    followingId: targetUserId,
    createdAt: serverTimestamp(),
  });

  // Update follower/following counts
  // Consider Cloud Function for atomic updates
}
```

### Implementation Checklist

- [ ] Implement like/unlike with optimistic UI
- [ ] Build comments list with pagination
- [ ] Add comment creation
- [ ] Implement follow/unfollow
- [ ] Update follower/following counts
- [ ] Add notification triggers (prep for Phase 3)

---

## Tab Bar Integration

Add Social tab to `src/app/(app)/_layout.tsx`:

```typescript
<Tabs.Screen
  name="social"
  options={{
    title: "Feed",
    tabBarIcon: ({ color }) => (
      <MaterialCommunityIcons name="newspaper" color={color} size={24} />
    ),
  }}
/>
```

---

## Analytics Events

Add to PostHog tracking:

| Event             | Properties                             |
| ----------------- | -------------------------------------- |
| `feed_viewed`     | tab (following/latest), post_count     |
| `post_created`    | has_media, media_count, content_length |
| `post_liked`      | post_id, author_id                     |
| `post_unliked`    | post_id                                |
| `comment_created` | post_id, content_length                |
| `user_followed`   | followed_user_id                       |
| `user_unfollowed` | unfollowed_user_id                     |
| `profile_viewed`  | viewed_user_id, is_own_profile         |
| `user_search`     | query, results_count                   |

---

## Firestore Indexes Required

Create in Firebase Console:

```
Collection: posts
Fields: isPublic (ASC), createdAt (DESC)

Collection: posts
Fields: authorId (ASC), createdAt (DESC)

Collection: follows
Fields: followerId (ASC), createdAt (DESC)

Collection: follows
Fields: followingId (ASC), createdAt (DESC)

Collection: postComments
Fields: postId (ASC), createdAt (ASC)
```

---

## Success Criteria

- [ ] Users can view/edit their enhanced profile
- [ ] Users can view other users' public profiles
- [ ] Users can follow/unfollow other users
- [ ] Social feed displays posts from followed users
- [ ] Users can create posts with text and images
- [ ] Users can like, comment on posts
- [ ] Feed supports infinite scroll
- [ ] Real-time updates for new posts
- [ ] All interactions tracked in PostHog

---

## Files to Create

```
src/
├── app/(app)/
│   ├── profile/
│   │   ├── _layout.tsx
│   │   ├── [userId].tsx
│   │   ├── edit.tsx
│   │   └── search.tsx
│   └── social/
│       ├── _layout.tsx
│       ├── index.tsx
│       ├── latest.tsx
│       └── post/
│           └── [postId].tsx
├── components/
│   ├── profile/
│   │   ├── UserProfileView.tsx
│   │   ├── ProfileHeader.tsx
│   │   ├── ProfileStats.tsx
│   │   ├── FollowButton.tsx
│   │   ├── SocialLinks.tsx
│   │   ├── UserCard.tsx
│   │   └── index.ts
│   └── feed/
│       ├── FeedScreen.tsx
│       ├── PostCard.tsx
│       ├── PostActions.tsx
│       ├── PostComposer.tsx
│       ├── MediaGrid.tsx
│       ├── CommentsList.tsx
│       ├── CommentInput.tsx
│       └── index.ts
├── services/
│   ├── feedService.ts
│   └── followService.ts
└── hooks/
    ├── useFeed.ts
    ├── useUserPosts.ts
    └── usePostInteractions.ts
```
