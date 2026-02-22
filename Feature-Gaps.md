Feature Gaps — Full Implementation Plan

Context

Post-cleanup audit passed (5/5 fixes verified). During the audit, 4 feature
gaps were identified where backend infrastructure exists but user-facing
functionality is incomplete or broken. Additionally, a critical bug was
found causing all new-follower push notifications to silently fail. This
plan covers end-to-end implementation of all gaps with no loose ends.

---

Phase 1: Notification Routing & Deep Links (Gap 3 + Gap 4)

Why first: Highest impact-to-effort ratio. Push notifications already send
but tapping them does nothing. Deep links from ragestate:// URLs are
unhandled except for ticket transfers.

1.1 Bug Fix — followedId → followingId

File: functions/notifications.js:347

// BEFORE (broken — followedId doesn't exist in the document)
const { followerId: actorId, followedId: targetUid } = f;

// AFTER
const { followerId: actorId, followingId: targetUid } = f;

Root cause: followService.ts:50-53 stores { followerId, followingId }. The
Cloud Function destructures followedId which resolves to undefined, causing
the null guard on line 348 to exit early. All new-follower notifications
have been silently dropped.

Deploy: firebase deploy --only functions:onFollowCreateNotify

1.2 Create deepLinkRouter.ts — Shared Routing Utility

File to create: src/utils/deepLinkRouter.ts

Why a shared utility: Currently notification tap routing lives in
useNotifications.ts:177-201 and deep link routing in \_layout.tsx:196-227.
Both need the same routing logic. The in-app notification inbox
(notifications/index.tsx:115-126) already has a third copy. Centralizing
prevents drift.

Existing routing in notification inbox (notifications/index.tsx:118-126) —
the canonical reference:
if (data.postId) → router.push(`/social/post/${data.postId}`)
if (data.transferId) → router.push(`/transfer/claim/${data.transferId}`)
if (data.eventId) → router.push(`/events/${data.eventId}`)
if (data.actorId) →
router.push(`/notifications/profile/${data.actorId}`)

Implementation:
import { router } from "expo-router";

interface NotificationRouteData {
type?: string;
postId?: string;
chatId?: string;
actorId?: string;
eventId?: string;
transferId?: string;
token?: string;
[key: string]: any;
}

/\*\*

- Route from notification tap or deep link data.
- Returns true if navigation was handled.
  \*/
  export function routeFromNotificationData(data: NotificationRouteData):
  boolean {
  // Post-related (likes, comments, mentions, reposts)
  if (data.postId) {
  router.push(`/social/post/${data.postId}`);
  return true;
  }
  // Chat messages
  if (data.chatId) {
  router.push(`/messages/${data.chatId}`);
  return true;
  }
  // Ticket transfers
  if (data.transferId || data.token) {
  router.push({
  pathname: "/(app)/transfer/claim",
  params: {
  token: data.token || "",
  transferId: data.transferId || "",
  },
  });
  return true;
  }
  // Events
  if (data.eventId) {
  router.push(`/events/${data.eventId}`);
  return true;
  }
  // Profile (follower notifications)
  if (data.actorId) {
  router.push(`/home/profile/${data.actorId}`);
  return true;
  }
  // Cart
  if (data.type === "cart_abandonment") {
  router.push("/cart");
  return true;
  }
  return false;
  }

/\*\*

- Route from a parsed deep link URL path.
- Handles ragestate:// and https://ragestate.com paths.
  \*/
  export function routeFromDeepLinkPath(
  path: string,
  queryParams?: Record<string, string | undefined>
  ): boolean {
  // messages/{chatId}
  if (path.startsWith("messages/")) {
  const chatId = path.replace("messages/", "");
  if (chatId) {
  router.push(`/messages/${chatId}`);
  return true;
  }
  }
  // post/{postId}
  if (path.startsWith("post/")) {
  const postId = path.replace("post/", "");
  if (postId) {
  router.push(`/social/post/${postId}`);
  return true;
  }
  }
  // profile/{userId}
  if (path.startsWith("profile/")) {
  const userId = path.replace("profile/", "");
  if (userId) {
  router.push(`/home/profile/${userId}`);
  return true;
  }
  }
  // events/{eventId}
  if (path.startsWith("events/")) {
  const eventId = path.replace("events/", "");
  if (eventId) {
  router.push(`/events/${eventId}`);
  return true;
  }
  }
  // transfer/ and claim-ticket/ (existing logic preserved)
  if (path.includes("transfer") || path.includes("claim-ticket") ||
  path.includes("claim")) {
  const token = queryParams?.token || queryParams?.t;
  const transferId = queryParams?.id;
  if (token) {
  router.push({
  pathname: "/(app)/transfer/claim",
  params: { token, transferId: transferId || "" },
  });
  return true;
  }
  }
  return false;
  }

Trade-off considered: Could use Expo Router's built-in linking config
instead of manual parsing. However, the app already has a manual deep link
handler pattern, and Cloud Functions set deepLink fields like
ragestate://post/{postId} that need to be parsed. Keeping the manual
approach is consistent and gives full control over routing without needing
to restructure the Expo Router linking config.

1.3 Update Push Notification Tap Handler

File: src/hooks/useNotifications.ts:177-201

Current state: Three console.log stubs, no actual navigation, no access to
router.

Change: Replace handleNotificationResponse body with:
const handleNotificationResponse = (
response: Notifications.NotificationResponse
) => {
const data = response.notification.request.content.data;
if (data) {
routeFromNotificationData(data as NotificationRouteData);
}
};

Import to add: import { routeFromNotificationData, NotificationRouteData }
from "../utils/deepLinkRouter";

Why this works: router from expo-router is a module-level singleton — the
deepLinkRouter.ts utility imports it directly (same pattern as
\_layout.tsx:218). No need to pass router through props or hooks.

1.4 Update In-App Notification Inbox Routing

File: src/app/(app)/notifications/index.tsx:115-126

Change: Replace the inline routing switch in handleNotificationPress with:
import { routeFromNotificationData } from "../../../utils/deepLinkRouter";

// Inside handleNotificationPress, replace lines 118-126:
routeFromNotificationData(data as any);

This unifies all three routing call sites under one utility.

1.5 Expand Deep Link Handler

File: src/app/\_layout.tsx:196-227

Change: Replace the inline handleDeepLink body with:
const handleDeepLink = (event: { url: string }) => {
try {
const parsed = Linking.parse(event.url);
if (**DEV**) console.log("Deep link received:", parsed);

     if (parsed.path) {
       routeFromDeepLinkPath(
         parsed.path,
         parsed.queryParams as Record<string, string | undefined>
       );
     }

} catch (error) {
console.error("Error handling deep link:", error);
}
};

Import to add: import { routeFromDeepLinkPath } from
"../utils/deepLinkRouter";

1.6 Handle Initial Notification (App Killed → Tap)

File: src/app/\_layout.tsx — add new useEffect near the deep link handler
(after line 240)

Why: When the app is fully killed and the user taps a push notification,
the onNotificationResponse listener in useNotifications.ts isn't set up
yet. Need to check getInitialNotification() on mount.

import { getInitialNotification } from
"../services/pushNotificationService";

useEffect(() => {
getInitialNotification().then((remoteMessage) => {
if (remoteMessage?.data) {
routeFromNotificationData(remoteMessage.data as
NotificationRouteData);
}
});
}, []);

getInitialNotification already exists and is exported from
pushNotificationService.ts:309.

1.7 Add /messages Intent Filter for Android

File: app.json — add to intentFilters[0].data array (after existing
entries)

{
"scheme": "https",
"host": "ragestate.com",
"pathPrefix": "/messages"
},
{
"scheme": "https",
"host": "www.ragestate.com",
"pathPrefix": "/messages"
}

Note: Requires EAS build to take effect (not OTA). Can be deferred to next
build cycle without blocking other changes.

1.8 Fix Token Storage Inconsistency (Minor)

File: src/services/pushNotificationService.ts:408-416

unregisterPushNotifications writes to users/{userId}/tokens/fcm but the
Cloud Function reads from users/{userId}/devices/{tokenHash}. Fix: disable
the device document instead of writing to the wrong path.

// BEFORE
await setDoc(doc(db, "users", userId, "tokens", "fcm"), { token: null, ...
});

// AFTER — query and disable all device docs for this user
const devicesRef = collection(db, "users", userId, "devices");
const devicesSnap = await getDocs(devicesRef);
const batch = writeBatch(db);
devicesSnap.docs.forEach((d) => {
batch.update(d.ref, { enabled: false, disabledAt: serverTimestamp() });
});
await batch.commit();

UX Flow — Notification Tap

User receives push notification
↓
Taps notification in system tray
↓
App in foreground?
YES → onNotificationResponse fires → routeFromNotificationData →
router.push
NO (background/killed) → getInitialNotification on mount →
routeFromNotificationData → router.push
↓
Routes to:
post_liked/comment/mention/repost → Post detail screen
new_follower → Follower's profile
chat_message → Chat room
event_reminder → Event detail
cart_abandonment → Cart screen
ticket_transfer → Transfer claim screen

Files Summary — Phase 1

File: functions/notifications.js:347
Action: Fix followedId → followingId
────────────────────────────────────────
File: src/utils/deepLinkRouter.ts
Action: Create — shared routing utility
────────────────────────────────────────
File: src/hooks/useNotifications.ts:177-201
Action: Replace console.log stubs with routeFromNotificationData
────────────────────────────────────────
File: src/app/(app)/notifications/index.tsx:115-126
Action: Use routeFromNotificationData
────────────────────────────────────────
File: src/app/\_layout.tsx:196-227
Action: Use routeFromDeepLinkPath for all deep link paths
────────────────────────────────────────
File: src/app/\_layout.tsx
Action: Add getInitialNotification useEffect
────────────────────────────────────────
File: app.json
Action: Add /messages intent filter
────────────────────────────────────────
File: src/services/pushNotificationService.ts:398-421
Action: Fix token cleanup path

---

Phase 2: Followers/Following List (Gap 1)

Why second: Highest user-visible feature gap. Users can see counts but
can't tap to see who. All backend infrastructure exists.

2.1 Data Model

No data model changes needed. Existing Firestore structure is sufficient:

/follows/{followerId}\_{followingId}
├── followerId: string
├── followingId: string
└── createdAt: Timestamp

/customers/{userId}
└── stats
├── followersCount: number
└── followingCount: number

/profiles/{userId}
├── displayName: string
├── username: string
├── photoURL: string
├── bio: string
└── verificationStatus: "none" | "verified" | "artist"

2.2 Add Profile Resolution to Follow Service

File: src/services/followService.ts

The existing getFollowers() and getFollowing() return string[] (user IDs
only). Add functions that resolve IDs to display data.

Reuse: The UserSearchResult interface from
src/services/userSearchService.ts:16-23:
interface UserSearchResult {
userId: string;
displayName: string;
username?: string;
profilePicture?: string;
verificationStatus?: "none" | "verified" | "artist";
bio?: string;
}

New functions:

import {
QueryDocumentSnapshot, limit as firestoreLimit, orderBy, startAfter
} from "firebase/firestore";
import { UserSearchResult } from "./userSearchService";

export async function getFollowersWithProfiles(
userId: string,
pageSize: number = 20,
startAfterDoc?: QueryDocumentSnapshot
): Promise<{ users: UserSearchResult[]; lastDoc: QueryDocumentSnapshot |
null }> {
// 1. Query follows where followingId == userId, ordered by createdAt
desc
// 2. Apply cursor pagination via startAfter if provided
// 3. For each followerId, batch-fetch from customers + profiles
// 4. Map to UserSearchResult[]
// 5. Return { users, lastDoc } for cursor-based pagination
}

export async function getFollowingWithProfiles(
userId: string,
pageSize: number = 20,
startAfterDoc?: QueryDocumentSnapshot
): Promise<{ users: UserSearchResult[]; lastDoc: QueryDocumentSnapshot |
null }> {
// Same pattern, query where followerId == userId
}

Profile resolution pattern (from userSearchService.ts:82-151):
// Batch fetch: try customers/{id} first, then profiles/{id} for
photo/username
const [customerDoc, profileDoc] = await Promise.all([
getDoc(doc(db, "customers", userId)),
getDoc(doc(db, "profiles", userId)),
]);
const displayName = profileDoc?.displayName || customerDoc?.displayName;
const photoURL = profileDoc?.photoURL || customerDoc?.profilePicture;

Trade-off: Could use a Cloud Function for server-side resolution (faster,
single round trip). But the follow lists are typically small (<100) and
client-side batch fetches are fast enough. A Cloud Function adds deployment
complexity for marginal gain. If perf becomes an issue later, can move to
server-side.

2.3 Add Query Keys

File: src/config/reactQuery.ts — add to queryKeys object (after chat block
at line 96):

follows: {
all: ["follows"] as const,
followers: (userId: string) => [...queryKeys.follows.all, "followers",
userId] as const,
following: (userId: string) => [...queryKeys.follows.all, "following",
userId] as const,
},

2.4 Create useFollowList Hook

File to create: src/hooks/useFollowList.ts

import { useInfiniteQuery } from "@tanstack/react-query";
import { QueryDocumentSnapshot } from "firebase/firestore";
import { queryKeys } from "../config/reactQuery";
import {
getFollowersWithProfiles,
getFollowingWithProfiles,
} from "../services/followService";
import { UserSearchResult } from "../services/userSearchService";

const PAGE_SIZE = 20;

export function useFollowList(userId: string, type: "followers" |
"following") {
const fetchFn = type === "followers" ? getFollowersWithProfiles :
getFollowingWithProfiles;
const queryKey = type === "followers"
? queryKeys.follows.followers(userId)
: queryKeys.follows.following(userId);

const query = useInfiniteQuery({
queryKey,
queryFn: async ({ pageParam }: { pageParam: QueryDocumentSnapshot |
undefined }) => {
return fetchFn(userId, PAGE_SIZE, pageParam);
},
initialPageParam: undefined as QueryDocumentSnapshot | undefined,
getNextPageParam: (lastPage) => lastPage.lastDoc ?? undefined,
staleTime: 1000 _ 60 _ 2, // 2 min
enabled: !!userId,
});

const users: UserSearchResult[] = query.data?.pages.flatMap((p) =>
p.users) ?? [];

return {
users,
isLoading: query.isLoading,
error: query.error,
fetchNextPage: query.fetchNextPage,
hasNextPage: query.hasNextPage,
isFetchingNextPage: query.isFetchingNextPage,
refetch: query.refetch,
};
}

2.5 Create Follow List Screen

File to create: src/app/(app)/profile/follow-list.tsx

UX Flow:
User taps "X Followers" on profile
↓
Navigate to /profile/follow-list?userId=abc&type=followers
↓
Screen renders:

- Header: "Followers" or "Following" with back button
- FlashList of UserCard components
- Each row: avatar, name, @username, bio, FollowButton
- Tap row → navigate to that user's profile
- Pull to refresh
- Infinite scroll pagination
- Empty state if no followers/following
- Loading skeleton on first load

Components to reuse:

- UserCard (src/components/profile/UserCard.tsx) — renders each row with
  avatar, name, username, bio, FollowButton, and profile navigation on tap
- FlashList — performance list (pattern from notifications/index.tsx)
- useThemedStyles — styled with theme tokens

Screen structure:
import { FlashList } from "@shopify/flash-list";
import { Stack, useLocalSearchParams } from "expo-router";
// ... imports

export default function FollowListScreen() {
const { userId, type } = useLocalSearchParams<{ userId: string; type:
"followers" | "following" }>();
const { theme } = useTheme();
const styles = useThemedStyles(createStyles);
const { users, isLoading, fetchNextPage, hasNextPage, isFetchingNextPage,
refetch } =
useFollowList(userId, type);

const title = type === "followers" ? "Followers" : "Following";

return (
<View style={styles.container}>
<Stack.Screen options={{ headerTitle: title }} />
<FlashList
data={users}
renderItem={({ item }) => <UserCard user={item} />}
estimatedItemSize={74}
onEndReached={() => hasNextPage && fetchNextPage()}
onEndReachedThreshold={0.5}
ListEmptyComponent={!isLoading ? <EmptyState type={type} /> : null}
ListFooterComponent={isFetchingNextPage ? <ActivityIndicator /> :
null}
refreshControl={<RefreshControl refreshing={false} 
 onRefresh={refetch} />}
/>
</View>
);
}

2.6 Register Route

File: src/app/(app)/profile/\_layout.tsx — add after line 26:

<Stack.Screen
name="follow-list"
options={{
     headerTitle: "",
     headerShadowVisible: false,
   }}
/>

2.7 Wire Up Navigation

File: src/components/profile/UserProfileView.tsx:402-407

// BEFORE
onFollowersPress={() => {
// TODO: Navigate to followers list
}}
onFollowingPress={() => {
// TODO: Navigate to following list
}}

// AFTER
onFollowersPress={() => {
router.push({
pathname: "/profile/follow-list",
params: { userId, type: "followers" },
});
track("followers_list_viewed", { profile_user_id: userId, is_own_profile:
isOwnProfile });
}}
onFollowingPress={() => {
router.push({
pathname: "/profile/follow-list",
params: { userId, type: "following" },
});
track("following_list_viewed", { profile_user_id: userId, is_own_profile:
isOwnProfile });
}}

Integration point: router and track (PostHog) are already available in
UserProfileView scope. userId and isOwnProfile are component state.

Files Summary — Phase 2

File: src/services/followService.ts
Action: Add getFollowersWithProfiles(), getFollowingWithProfiles()
────────────────────────────────────────
File: src/config/reactQuery.ts
Action: Add follows query keys
────────────────────────────────────────
File: src/hooks/useFollowList.ts
Action: Create — useInfiniteQuery hook
────────────────────────────────────────
File: src/app/(app)/profile/follow-list.tsx
Action: Create — screen with FlashList + UserCard
────────────────────────────────────────
File: src/app/(app)/profile/\_layout.tsx
Action: Register follow-list route
────────────────────────────────────────
File: src/components/profile/UserProfileView.tsx:402-407
Action: Wire navigation callbacks

---

Phase 3: Events Attended Count (Gap 2)

Why third: Lower urgency — the stat just shows 0. Requires a Cloud Function
deploy and understanding of the ragers security model.

3.1 Data Model — No Schema Changes

Existing model is sufficient. The missing piece is a write trigger to
maintain the count:

/events/{eventId}/ragers/{ragerId}
├── firebaseId: string (the user's UID)
├── eventId: string
└── ... (ticket data)

/customers/{userId}
└── stats.eventsAttended: number (currently never incremented)

3.2 Firestore Rules Constraint

match /ragers/{ragerId} {
allow read: if isAuthenticated() && (
resource.data.firebaseId == request.auth.uid || isAdmin()
);
}

This means: a user can only read their OWN rager documents. You cannot
query collectionGroup("ragers").where("firebaseId", "==", someOtherUserId)
for someone else's profile. The count MUST be maintained server-side (Cloud
Function) and stored on the publicly readable customers document.

Trade-off: Could relax the Firestore rules to allow public reads of rager
docs. But this would expose ticket information (purchase details, transfer
status) to all users. Keeping the rules strict and maintaining a
denormalized count is the safer approach.

3.3 Create Cloud Function Trigger

File to create: functions/eventStats.js

const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { logger } = require("firebase-functions");
const { db, admin } = require("./admin");

/\*\*

- When a rager (ticket holder) document is created,
- increment the user's eventsAttended count.
  \*/
  exports.onRagerCreated = onDocumentCreated(
  "events/{eventId}/ragers/{ragerId}",
  async (event) => {
  const ragerData = event.data?.data();
  if (!ragerData) return null;

      const userId = ragerData.firebaseId;
      if (!userId) {
        logger.warn("Rager created without firebaseId", {
          eventId: event.params.eventId,
          ragerId: event.params.ragerId,
        });
        return null;
      }

      try {
        const customerRef = db.collection("customers").doc(userId);
        await customerRef.set(
          { stats: { eventsAttended: admin.firestore.FieldValue.increment(1)

  } },
  { merge: true }
  );
  logger.info("Incremented eventsAttended", { userId, eventId:
  event.params.eventId });
  } catch (err) {
  logger.error("Failed to increment eventsAttended", { userId, err });
  }
  return null;
  }
  );

Pattern: Follows existing Cloud Functions in notifications.js — v2 syntax,
admin.js imports, logger, null returns.

3.4 Export New Function

File: functions/index.js — add:

module.exports = {
...require("./feed"),
...require("./stripe"),
...require("./email"),
...require("./notifications"),
...require("./transcode"),
...require("./printifyWebhook"),
...require("./events"),
...require("./chat"),
...require("./eventStats"), // ← ADD
scheduledRateLimitCleanup:
require("./rateLimit").scheduledRateLimitCleanup,
aggregateDailyMetrics: require("./analytics").aggregateDailyMetrics,
};

3.5 Fix Client-Side Count Reading

File: src/components/profile/UserProfileView.tsx:95-100

The computeUserStats function currently runs three getCountFromServer
queries (posts, followers, following) and then hardcodes eventsAttended: 0.
The count is already stored on the customers document (once the Cloud
Function is deployed). Just read it:

// BEFORE
const stats = {
postsCount: postsSnapshot.data().count,
followersCount: followersSnapshot.data().count,
followingCount: followingSnapshot.data().count,
eventsAttended: 0, // TODO: Query events/ragers collection if needed
};

// AFTER — read from customers doc which is already fetched elsewhere
// Option A: Add a 4th parallel query
const customerDoc = await getDoc(doc(db, "customers", userId));
const eventsAttended = customerDoc.data()?.stats?.eventsAttended || 0;

const stats = {
postsCount: postsSnapshot.data().count,
followersCount: followersSnapshot.data().count,
followingCount: followingSnapshot.data().count,
eventsAttended,
};

Integration point: The UserProfileView already imports Firestore and db.
Need to add getDoc, doc imports and the customer doc fetch.

3.6 Backfill Script (Optional — Run Once)

For existing users who already have rager documents, run a one-time
backfill. This can be a callable Cloud Function or admin script:

// Run once via Firebase console or admin script
const ragersSnap = await db.collectionGroup("ragers").get();
const counts = {};
ragersSnap.docs.forEach((d) => {
const uid = d.data().firebaseId;
if (uid) counts[uid] = (counts[uid] || 0) + 1;
});
const batch = db.batch();
for (const [uid, count] of Object.entries(counts)) {
batch.set(db.collection("customers").doc(uid),
{ stats: { eventsAttended: count } },
{ merge: true }
);
}
await batch.commit();

UX Flow — Events Attended

Cloud Function trigger:
User purchases ticket → rager doc created → onRagerCreated fires →
increments customers/{uid}.stats.eventsAttended

Profile display:
User visits any profile → computeUserStats reads customers/{uid} →
eventsAttended shows real count

Files Summary — Phase 3

File: functions/eventStats.js
Action: Create — onRagerCreated trigger
────────────────────────────────────────
File: functions/index.js
Action: Add ...require("./eventStats")
────────────────────────────────────────
File: src/components/profile/UserProfileView.tsx:95-100
Action: Read eventsAttended from customers doc

---

Implementation Phases & Deploy Order

Phase 1a: Bug fix (deploy immediately)
└── functions/notifications.js — one-line fix
└── Deploy: firebase deploy --only functions:onFollowCreateNotify

Phase 1b: Notification routing + deep links (ship together)
└── src/utils/deepLinkRouter.ts (create)
└── src/hooks/useNotifications.ts (modify)
└── src/app/(app)/notifications/index.tsx (modify)
└── src/app/\_layout.tsx (modify)
└── src/services/pushNotificationService.ts (modify)
└── app.json (modify — requires next EAS build)

Phase 2: Followers/Following list
└── src/services/followService.ts (modify)
└── src/config/reactQuery.ts (modify)
└── src/hooks/useFollowList.ts (create)
└── src/app/(app)/profile/follow-list.tsx (create)
└── src/app/(app)/profile/\_layout.tsx (modify)
└── src/components/profile/UserProfileView.tsx (modify)

Phase 3: Events attended
└── functions/eventStats.js (create)
└── functions/index.js (modify)
└── Deploy: firebase deploy --only functions:onRagerCreated
└── Run backfill script (one-time)
└── src/components/profile/UserProfileView.tsx (modify)

---

Integration Points Summary

Existing Code: UserCard.tsx
Used By: Follow list screen
How: Renders each user row with avatar, name, FollowButton
────────────────────────────────────────
Existing Code: UserSearchResult interface
Used By: Follow service, Follow hook
How: Shared type for user display data
────────────────────────────────────────
Existing Code: followService.getFollowers/getFollowing
Used By: New getFollowersWithProfiles
How: Provides base query logic
────────────────────────────────────────
Existing Code: FlashList pattern from notifications/index.tsx
Used By: Follow list screen
How: Performance list rendering
────────────────────────────────────────
Existing Code: getInitialNotification() from pushNotificationService.ts:309
Used By: \_layout.tsx
How: Handle notification tap when app was killed
────────────────────────────────────────
Existing Code: routeFromNotificationData (new)
Used By: useNotifications.ts, notifications/index.tsx, \_layout.tsx
How: Single source of truth for notification → screen routing
────────────────────────────────────────
Existing Code: admin.js Firebase Admin SDK
Used By: eventStats.js
How: Firestore operations in Cloud Functions
────────────────────────────────────────
Existing Code: queryKeys from reactQuery.ts
Used By: useFollowList hook
How: Cache management

---

Verification Plan

Phase 1 Verification

1.  Bug fix: Have user A follow user B → user B receives push notification
    (was previously silent)
2.  Notification tap — foreground: While app is open, trigger a like
    notification → tap → navigates to post
3.  Notification tap — background: With app in background, trigger a chat
    message notification → tap → navigates to chat room
4.  Notification tap — killed: Force quit app → trigger a follow
    notification → tap → app opens to follower's profile
5.  Deep link: Open ragestate://messages/test-chat-id in Safari → app opens
    to that chat
6.  Deep link — post: Open ragestate://post/test-post-id → app opens to post
    detail
7.  In-app inbox: Tap any notification in the notifications tab → navigates
    correctly (same routing utility)

Phase 2 Verification

1.  Followers list: Visit any profile with followers → tap "X Followers" →
    see list of users with avatars and follow buttons
2.  Following list: Tap "X Following" → see list of users being followed
3.  Profile navigation: Tap any user in the list → navigate to their profile
    → back button returns to list
4.  Follow from list: Tap FollowButton in list → optimistic update → count
    updates on return to profile
5.  Pagination: Profile with >20 followers → scroll to bottom → more users
    load automatically
6.  Empty state: Profile with 0 followers → see empty state message
7.  Own profile vs other: Both own profile and others' profiles work the
    same way

Phase 3 Verification

1.  Cloud Function: Create a rager document in test environment → verify
    stats.eventsAttended increments on customer doc
2.  Profile display: Visit own profile → events attended shows correct
    non-zero count
3.  Other user's profile: Visit another user's profile → their events
    attended count shows correctly
4.  Backfill: After running backfill, existing users show correct historical
    counts
