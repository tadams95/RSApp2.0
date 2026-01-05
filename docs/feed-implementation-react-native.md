RAGESTATE FEED IMPLEMENTATION (React Native / Expo)
===================================================

This plan adapts the web Feed guide to our React Native app (Expo Router, Firebase v9 modular, Firestore + Storage, React Query, PostHog). It outlines data shape, rules, routes, components, functions, and a phased rollout aligned with our codebase.

1) Firestore data model
-----------------------

Collections (same core model as web, with mobile-friendly denormalization):

- posts/{postId}
  - userId: string
  - userDisplayName: string
  - userProfilePicture: string | null
  - content: string
  - mediaUrls: string[] (Storage URLs)
  - mediaType: 'image' | 'video' | null
  - mediaVariants?: { thumb?: string; medium?: string; poster?: string }
  - timestamp: Timestamp
  - likeCount: number
  - commentCount: number
  - tags?: string[]
  - isPublic: boolean

- postLikes/{likeId}
  - postId: string
  - userId: string
  - timestamp: Timestamp

- postComments/{commentId}
  - postId: string
  - userId: string
  - userDisplayName: string
  - userProfilePicture: string | null
  - content: string
  - timestamp: Timestamp
  - likeCount?: number

- follows/{id}
  - followerId: string
  - followedId: string
  - createdAt: Timestamp

- userFeeds/{userId}/feedItems/{postId}
  - createdAt: Timestamp (fan-out time)
  - rank?: number

Indexes
- posts: timestamp DESC; userId ASC + timestamp DESC (author timeline)
- postComments: postId ASC + timestamp ASC
- follows: followerId ASC; followedId ASC
- userFeeds.feedItems: createdAt DESC

2) Security rules (mobile)
-------------------------

Use Firestore rules equivalent to the web plan, with hardened feed writes restricted to Cloud Functions:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /posts/{postId} {
      allow read: if resource.data.isPublic == true || resource.data.userId == request.auth.uid;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    match /postLikes/{likeId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    match /postComments/{commentId} {
      allow read: if true;
      allow create: if request.auth != null;
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    match /follows/{id} {
      allow read: if true;
      allow create: if request.auth != null &&
        request.resource.data.followerId == request.auth.uid &&
        request.resource.data.followedId is string &&
        request.resource.data.followerId != request.resource.data.followedId;
      allow delete: if request.auth != null && resource.data.followerId == request.auth.uid;
    }
    match /userFeeds/{userId} {
      allow read: if request.auth != null && request.auth.uid == userId;
      allow write: if false; // only Cloud Functions fan-out writes
      match /feedItems/{postId} { allow read: if request.auth != null && request.auth.uid == userId; }
    }
  }
}
```

3) Screens and routes (Expo Router)
-----------------------------------

Create these routes under `src/app/(app)/`:
- `feed/index.tsx` – personalized feed (userFeeds)
- `feed/latest.tsx` – global latest (query posts where isPublic==true orderBy timestamp DESC)
- `post/[postId].tsx` – post permalink with comments
Note: Profile routes already exist; ensure profile shows user’s timeline via `where('userId','==', targetId) orderBy timestamp DESC`.

4) Components (RN/TSX)
----------------------

Place under `src/components/feed/`:
- FeedContainer.tsx – orchestrates queries, pagination, pull-to-refresh
- PostComposer.tsx – text input, media picker, submit
- PostCard.tsx – render content/media, like/comment actions
- CommentsSheet.tsx – bottom sheet or modal to lazy-load comments
- FeedFilter.tsx – switch between Latest/Following, sort options

Libraries
- Lists: `@shopify/flash-list`
- Media display: `expo-image` (images), `expo-av` (video)
- Media pick/upload: `expo-image-picker`, `expo-file-system`; upload to Storage
- State/server data: React Query (existing), Firebase modular SDK (existing in `src/firebase/firebase.ts`)

5) Services and hooks
---------------------

Create under `src/services/` and `src/hooks/`:
- `feedService.ts` – Firestore read/write helpers (createPost, like/unlike, listFeedItems, listLatest)
- `useFeed.ts` – useInfiniteQuery for personalized feed (hydrate `feedItems` → batch fetch posts by IDs)
- `useLatestPosts.ts` – useInfiniteQuery for Latest tab
- `usePostInteractions.ts` – like/unlike, optimistic updates, PostHog events
- `useComments.ts` – paginated comments load/create

Pagination
- Personalized: page through `userFeeds/{uid}/feedItems` orderBy createdAt DESC limit 10–15; hydrate posts with batched `where(documentId(),'in', batchIds)` in chunks of ≤10.
- Latest: query `posts` where isPublic==true orderBy timestamp DESC limit 10–15 with `startAfter`.

6) Cloud Functions (Node in `functions/`)
----------------------------------------

Extend `functions/index.js` with:
- onCreate(post): fan-out to followers → write `feedItems` for each follower; trim to N (e.g., 500)
- onWrite(like/comment): transactionally update counters on the post
- storage.onFinalize: generate thumbnails/posters, update `mediaVariants`
- scheduled: trim stale feedItems; compute lightweight trending metrics

7) Post creation flow (mobile UX)
---------------------------------

- Compose: multiline text + image/video picker (limit: up to 4 images, 1 video)
- Compression: reuse `src/hooks/useImageCompression.tsx` where applicable
- Upload: show progress; upload media to `posts/{postId}/{filename}`
- Create doc: write `posts/{postId}` with mediaUrls/mediaType; CF will attach variants

8) Interactions
---------------

- Like/unlike: create/delete docs in `postLikes`; update `likeCount` via CF; optimistic UI
- Comments: create `postComments` docs; lazy-load and paginate; optionally like comments later
- Share: OS share sheet with post permalink or deep link (Phase 2)

9) Performance and offline
--------------------------

- Use FlashList with estimatedItemSize; keyExtractor=postId
- Detach listeners when screens blur; prefer paginated queries over live listeners for feed
- Firestore local cache handles offline reads; queue writes with retry UI
- Lazy-load videos; use poster images; pause when offscreen

10) Analytics (PostHog)
-----------------------

Track events:
- feed_view, feed_scroll_depth, feed_tab_switch
- post_create_start/success/fail, post_like, post_unlike, comment_create
- media_upload_start/success/fail
Include props: postId, authorId, hasMedia, mediaType, latencyMs

11) Testing
-----------

- Unit: component tests with mock data (PostCard, PostComposer)
- Integration: feed hooks with Firebase emulator or mocked Firestore
- Performance: large lists with FlashList profiler; ensure <16ms render frames

12) Rollout
-----------

MVP (1–2 sprints)
- Public posts (text + images), Likes, Comments (basic), Personalized feed fan-out, Latest tab
- Follow/unfollow in profiles (follows collection)

V2
- Video upload with server-side poster/thumbs
- Notifications on likes/comments/follows (reuse `src/services/notificationService.ts`)
- Hashtags + simple search, content reporting (`reports` collection)

V3
- Ranking improvements, saved posts, advanced moderation tools

13) Implementation checklist (RN)
---------------------------------

- [ ] Firestore collections + indexes
- [ ] Rules deployed
- [ ] Expo Router screens: feed/, feed/latest, post/[postId]
- [ ] Components under src/components/feed
- [ ] Services/hooks
- [ ] CF fan-out + counters + media finalize
- [ ] Analytics wiring
- [ ] Tests and emulator runs
