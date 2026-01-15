# Firebase & Firestore Skill

> **Purpose:** Standardize Firebase/Firestore patterns for data access, security, and Cloud Functions  
> **Applies to:** All Firebase interactions - client services, security rules, Cloud Functions  
> **Last Updated:** January 14, 2026

---

## Core Principles

1. **Security first** - All Firestore operations must respect security rules
2. **Type safety** - Use TypeScript interfaces matching Firestore schema
3. **Real-time subscriptions** - Properly manage listeners and cleanup
4. **Consistent patterns** - Follow established service structure
5. **Admin separation** - Admin operations only in Cloud Functions

---

## Architecture Overview

```
Client Side:
├── src/firebase/firebase.ts        # Firebase initialization
├── src/services/                   # Data access services
│   ├── feedService.ts             # Posts, reposts
│   ├── followService.ts           # Following/followers
│   ├── commentService.ts          # Comments
│   └── userSearchService.ts       # User search
└── src/utils/auth.ts              # Auth helpers

Server Side:
├── functions/
│   ├── index.js                   # Function exports
│   ├── feed.js                    # Feed operations
│   ├── notifications.js           # Notification triggers
│   └── admin.js                   # Admin SDK setup

Security:
├── firestore.rules                # Security rules
├── storage.rules                  # Storage rules
└── rules/                         # Rule backups
```

---

## Client-Side Patterns

### 1. Service File Structure

All service files follow this pattern:

```typescript
// Example: feedService.ts
import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  addDoc,
  updateDoc,
  serverTimestamp,
  Timestamp,
  type Unsubscribe,
} from "firebase/firestore";
import { db, auth } from "@/firebase/firebase";

// 1. TYPE DEFINITIONS (matching Firestore schema exactly)
export interface Post {
  id: string;
  userId: string;
  userDisplayName: string;
  usernameLower?: string;
  userProfilePicture?: string;
  userVerified?: boolean;
  content: string;
  mediaUrls?: string[];
  isPublic: boolean;
  likeCount: number;
  commentCount: number;
  timestamp: Timestamp;
}

// 2. CONSTANTS
const POSTS_COLLECTION = "posts";
const DEFAULT_LIMIT = 20;

// 3. REAL-TIME SUBSCRIPTIONS
export function subscribeToForYouFeed(
  onUpdate: (posts: Post[]) => void,
  onError: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, POSTS_COLLECTION),
    where("isPublic", "==", true),
    orderBy("timestamp", "desc"),
    limit(DEFAULT_LIMIT)
  );

  return onSnapshot(
    q,
    (snapshot) => {
      const posts = snapshot.docs.map((doc) => ({
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

// 4. ONE-TIME READS
export async function getPostById(postId: string): Promise<Post | null> {
  try {
    const postRef = doc(db, POSTS_COLLECTION, postId);
    const postSnap = await getDoc(postRef);

    if (!postSnap.exists()) {
      return null;
    }

    return {
      id: postSnap.id,
      ...postSnap.data(),
    } as Post;
  } catch (error) {
    console.error("Error fetching post:", error);
    throw error;
  }
}

// 5. WRITE OPERATIONS
export async function createPost(
  content: string,
  mediaUrls?: string[]
): Promise<string> {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const userData = await getUserData(user.uid);

  const postData = {
    userId: user.uid,
    userDisplayName: userData.displayName || "Unknown",
    usernameLower: userData.usernameLower,
    userProfilePicture: userData.profilePicture,
    content,
    mediaUrls: mediaUrls || [],
    isPublic: true,
    likeCount: 0,
    commentCount: 0,
    timestamp: serverTimestamp(),
  };

  const docRef = await addDoc(collection(db, POSTS_COLLECTION), postData);
  return docRef.id;
}
```

---

### 2. Timestamp Handling

✅ **CORRECT:**

```typescript
import { Timestamp, serverTimestamp } from "firebase/firestore";

// For writes - use serverTimestamp()
const data = {
  content: "Hello",
  timestamp: serverTimestamp(), // Server sets the time
};

// For reads - Timestamp type
interface Post {
  timestamp: Timestamp; // Not Date or number
}

// Convert to Date for display
const date = post.timestamp.toDate();
const formatted = formatDistanceToNowStrict(date);
```

❌ **WRONG:**

```typescript
// Don't use client-side timestamps
timestamp: new Date(),
timestamp: Date.now(),

// Don't use Date type in interfaces
interface Post {
  timestamp: Date; // Wrong - use Timestamp
}
```

---

### 3. Real-Time Subscription Pattern

✅ **CORRECT:**

```typescript
import { useEffect, useState } from "react";
import { subscribeToForYouFeed } from "@/services/feedService";

const FeedScreen = () => {
  const [posts, setPosts] = useState<Post[]>([]);

  useEffect(() => {
    // Subscribe on mount
    const unsubscribe = subscribeToForYouFeed(
      (newPosts) => setPosts(newPosts),
      (error) => console.error(error)
    );

    // Cleanup on unmount
    return () => unsubscribe();
  }, []);

  return <PostList posts={posts} />;
};
```

**Key points:**

- Return `Unsubscribe` function from service
- Call unsubscribe in cleanup (return from useEffect)
- Handle both success and error callbacks

---

### 4. Query Patterns

#### Simple Query

```typescript
const q = query(
  collection(db, "posts"),
  where("userId", "==", currentUserId),
  orderBy("timestamp", "desc"),
  limit(20)
);
```

#### Compound Query (requires index)

```typescript
// Requires index in Firebase Console or firestore.indexes.json
const q = query(
  collection(db, "posts"),
  where("isPublic", "==", true),
  where("userId", "in", followingIds),
  orderBy("timestamp", "desc")
);
```

#### Array Contains Query

```typescript
const q = query(
  collection(db, "posts"),
  where("tags", "array-contains", "music"),
  limit(10)
);
```

---

### 5. Batch Operations

```typescript
import { writeBatch, doc } from "firebase/firestore";

async function updateMultiplePosts(updates: Array<{ id: string; data: any }>) {
  const batch = writeBatch(db);

  updates.forEach(({ id, data }) => {
    const ref = doc(db, "posts", id);
    batch.update(ref, data);
  });

  await batch.commit();
}
```

---

## Firestore Security Rules

Your rules are in `firestore.rules`. Follow these patterns:

### 1. Helper Functions (at top of rules)

```javascript
// Basic authentication
function isAuthenticated() {
  return request.auth != null;
}

function isCurrentUser(userId) {
  return isAuthenticated() && request.auth.uid == userId;
}

// Type guards
function isString(v) { return v is string; }
function isBool(v) { return v is bool; }
function isTimestamp(v) { return v is timestamp; }

// Validation helpers
function isMaxLen500(v) {
  return v is string && v.matches('^[\\s\\S]{0,500}$');
}

function hasOnlyKeys(data, keys) {
  return data.keys().hasOnly(keys);
}

// Admin check (custom claim + fallback)
function isAdmin() {
  return request.auth != null && (
    request.auth.token.admin == true ||
    exists(/databases/$(database)/documents/adminUsers/$(request.auth.uid))
  );
}
```

### 2. Collection Rules Pattern

```javascript
// Public profiles - readable by all, writable by owner
match /profiles/{userId} {
  allow read: if true;

  allow create, update: if (isCurrentUser(userId) || isAdmin())
    && (isAdmin() || hasOnlyKeys(request.resource.data, [
      'displayName', 'photoURL', 'bio', 'usernameLower', 'profilePicture'
    ]))
    && (!request.resource.data.keys().hasAny(['displayName'])
        || isString(request.resource.data.displayName))
    && (!request.resource.data.keys().hasAny(['bio'])
        || isMaxLen500(request.resource.data.bio));

  allow delete: if isCurrentUser(userId) || isAdmin();
}

// Private user data - only owner
match /users/{userId} {
  allow read, write: if isCurrentUser(userId) || isAdmin();
}

// Posts - public read, owner write
match /posts/{postId} {
  allow read: if resource.data.isPublic == true || isCurrentUser(resource.data.userId) || isAdmin();

  allow create: if isAuthenticated()
    && request.resource.data.userId == request.auth.uid
    && isString(request.resource.data.content)
    && request.resource.data.content.size() <= 500;

  allow update: if isCurrentUser(resource.data.userId) || isAdmin();
  allow delete: if isCurrentUser(resource.data.userId) || isAdmin();
}
```

### 3. Field Validation Pattern

```javascript
// Validate specific fields exist and are correct type
allow create: if request.resource.data.keys().hasAll(['userId', 'content', 'timestamp'])
  && isString(request.resource.data.content)
  && request.resource.data.content.size() >= 1
  && request.resource.data.content.size() <= 500
  && request.resource.data.userId == request.auth.uid
  && request.resource.data.timestamp == request.time;
```

---

## Cloud Functions Patterns

### 1. Function Structure (v2)

```javascript
// functions/index.js
module.exports = {
  ...require("./feed"),
  ...require("./notifications"),
};

// functions/feed.js
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { onCall } = require("firebase-functions/v2/https");
const { admin, db } = require("./admin");

// Firestore Trigger
exports.onPostCreated = onDocumentCreated("posts/{postId}", async (event) => {
  const postId = event.params.postId;
  const postData = event.data.data();

  // Process new post
  console.log("New post created:", postId);
});

// Callable Function
exports.likePost = onCall(async (request) => {
  // Verify authentication
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Must be logged in");
  }

  const { postId } = request.data;
  const userId = request.auth.uid;

  // Use admin SDK
  const postRef = db.collection("posts").doc(postId);
  await postRef.update({
    likeCount: admin.firestore.FieldValue.increment(1),
  });

  return { success: true };
});
```

### 2. Admin SDK Setup

```javascript
// functions/admin.js
const admin = require("firebase-admin");

// Initialize only once
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
```

### 3. Notification Trigger Pattern

```javascript
// functions/notifications.js
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { db } = require("./admin");

exports.onCommentAdded = onDocumentCreated(
  "comments/{commentId}",
  async (event) => {
    const commentData = event.data.data();
    const { postId, userId: actorId, content } = commentData;

    // Get post to find author
    const postSnap = await db.collection("posts").doc(postId).get();
    if (!postSnap.exists) return;

    const postAuthorId = postSnap.data().userId;

    // Don't notify if commenting on own post
    if (actorId === postAuthorId) return;

    // Create notification
    await db.collection("notifications").add({
      recipientId: postAuthorId,
      actorId,
      type: "comment_added",
      postId,
      commentId: event.params.commentId,
      read: false,
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);
```

### 4. Scheduled Function Pattern

```javascript
const { onSchedule } = require("firebase-functions/v2/scheduler");

exports.dailyCleanup = onSchedule("every day 02:00", async (event) => {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 30);

  const oldDocs = await db
    .collection("notifications")
    .where("timestamp", "<", cutoffDate)
    .where("read", "==", true)
    .get();

  const batch = db.batch();
  oldDocs.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();

  console.log(`Deleted ${oldDocs.size} old notifications`);
});
```

### 5. Rate Limiting Pattern

```javascript
// functions/rateLimit.js
const { db } = require("./admin");

async function checkRateLimit(userId, action, maxAttempts, windowMinutes) {
  const windowMs = windowMinutes * 60 * 1000;
  const now = Date.now();
  const windowStart = now - windowMs;

  const attemptsRef = db.collection("rateLimits").doc(`${userId}_${action}`);
  const doc = await attemptsRef.get();

  if (!doc.exists) {
    await attemptsRef.set({
      attempts: [now],
      lastAttempt: now,
    });
    return { allowed: true, remaining: maxAttempts - 1 };
  }

  const data = doc.data();
  const recentAttempts = data.attempts.filter((t) => t > windowStart);

  if (recentAttempts.length >= maxAttempts) {
    return {
      allowed: false,
      remaining: 0,
      retryAfter: Math.ceil((recentAttempts[0] + windowMs - now) / 1000),
    };
  }

  await attemptsRef.update({
    attempts: [...recentAttempts, now],
    lastAttempt: now,
  });

  return {
    allowed: true,
    remaining: maxAttempts - recentAttempts.length - 1,
  };
}

module.exports = { checkRateLimit };
```

---

## Collection Schema Reference

### collections/posts

```typescript
{
  userId: string;              // Author ID
  userDisplayName: string;     // Denormalized for display
  usernameLower?: string;      // Username handle
  userProfilePicture?: string; // Profile pic URL
  userVerified?: boolean;      // Verified badge
  content: string;             // Post text (max 500 chars)
  mediaUrls?: string[];        // Original media URLs
  optimizedMediaUrls?: string[]; // Transcoded media (set by function)
  isProcessing?: boolean;      // Media processing state
  isPublic: boolean;           // Public visibility
  likeCount: number;           // Engagement count
  commentCount: number;        // Engagement count
  repostCount?: number;        // Engagement count
  repostOf?: {                 // If this is a repost
    postId: string;
    authorId: string;
    originalContent?: string;  // For quote reposts
  };
  timestamp: Timestamp;        // Created at
  updatedAt?: Timestamp;       // Last edited
  edited?: boolean;            // Edit flag
}
```

### collections/profiles (public)

```typescript
{
  displayName: string;         // Display name
  usernameLower: string;       // Unique username (lowercase)
  bio?: string;                // Bio (max 500 chars)
  photoURL?: string;           // Profile picture
  profilePicture?: string;     // Alt profile pic field
  profileSongUrl?: string;     // Profile song URL
  isVerified?: boolean;        // Admin-only field
}
```

### collections/users (private)

```typescript
{
  email: string;
  displayName: string;
  usernameLower?: string;
  profilePicture?: string;
  bio?: string;
  isAdmin?: boolean;
  fcmTokens?: string[];        // Push notification tokens
  notificationSettings?: {
    likes: boolean;
    comments: boolean;
    follows: boolean;
    mentions: boolean;
    quietHours?: {
      enabled: boolean;
      start: string;  // "22:00"
      end: string;    // "08:00"
      timezone: string;
    };
  };
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

### collections/notifications

```typescript
{
  recipientId: string;         // Who receives this
  actorId: string;             // Who did the action
  type: string;                // "post_liked", "comment_added", "follow", etc.
  postId?: string;             // Related post
  commentId?: string;          // Related comment
  read: boolean;               // Read state
  timestamp: Timestamp;        // When created
  data?: {                     // Additional context
    actorName?: string;
    postContent?: string;
  };
}
```

---

## Common Patterns from Codebase

### Pattern 1: User Data Denormalization

```typescript
// When creating a post, include user info for fast display
import { getUserData } from "@/utils/auth";

const user = auth.currentUser;
const userData = await getUserData(user.uid);

const postData = {
  userId: user.uid,
  userDisplayName: userData.displayName || "Unknown",
  usernameLower: userData.usernameLower,
  userProfilePicture: userData.profilePicture,
  content: content,
  // ... rest
};
```

### Pattern 2: Following Feed Query

```typescript
// Get posts from followed users
const following = await getFollowing(userId);
const followingIds = following.map((f) => f.uid);

if (followingIds.length === 0) {
  return []; // No following, empty feed
}

const q = query(
  collection(db, "posts"),
  where("userId", "in", followingIds.slice(0, 10)), // Firestore limit
  orderBy("timestamp", "desc"),
  limit(20)
);
```

### Pattern 3: Engagement Counters

```typescript
// Increment like count atomically
import { increment } from "firebase/firestore";

await updateDoc(doc(db, "posts", postId), {
  likeCount: increment(1),
});
```

---

## DO's and DON'Ts

### ✅ DO

- Use `serverTimestamp()` for all timestamps
- Return `Unsubscribe` from subscription functions
- Clean up listeners in useEffect cleanup
- Use TypeScript interfaces matching Firestore schema
- Validate all user inputs in security rules
- Use admin SDK only in Cloud Functions
- Denormalize data for display performance
- Use batch writes for multiple updates
- Check authentication before operations
- Handle errors gracefully
- Use constants for collection names

### ❌ DON'T

- Use client-side timestamps (`new Date()`)
- Forget to unsubscribe from listeners
- Use `any` types for Firestore data
- Skip security rule validation
- Use admin SDK in client code
- Over-normalize data (balance with reads)
- Perform single writes in loops (use batches)
- Assume user is authenticated
- Ignore Firestore errors
- Hardcode collection names
- Query without indexes for compound queries

---

## Testing Firestore Rules

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Run emulator with rules
firebase emulators:start --only firestore

# In another terminal, run tests
npm test
```

Test file example:

```javascript
// functions/__tests__/rules.test.js
const { assertSucceeds, assertFails } = require("@firebase/rules-unit-testing");

test("can read own profile", async () => {
  const db = getFirestore(myAuth);
  await assertSucceeds(db.collection("profiles").doc(myUid).get());
});

test("cannot write others profile", async () => {
  const db = getFirestore(myAuth);
  await assertFails(
    db.collection("profiles").doc(otherUid).set({ bio: "hack" })
  );
});
```

---

## Additional Resources

- `src/services/feedService.ts` - Feed operations reference
- `src/services/followService.ts` - Follow relationships
- `firestore.rules` - Complete security rules
- `functions/notifications.js` - Trigger examples
- `functions/rateLimit.js` - Rate limiting utility
- Firebase Docs: https://firebase.google.com/docs/firestore
