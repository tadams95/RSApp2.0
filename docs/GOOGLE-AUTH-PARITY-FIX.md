# Google Authentication Parity Fix Specification

> **Priority**: 🔴 Critical  
> **Estimated Effort**: 2-3 days  
> **Dependencies**: None  
> **Last Updated**: January 16, 2026

---

## Executive Summary

Users who sign up with Google Sign-In experience permission errors and broken features due to:

1. **Incomplete user document creation** - Missing critical fields (`isAdmin`, `userId`, `stats`, etc.)
2. **Wrong collection usage** - Google auth writes to `/users`, email signup writes to `/customers`
3. **No Stripe customer creation** - Google users can't purchase tickets
4. **Firestore rules blocking count queries** - `useEventAttendingCount` fails for all non-admin users

This document specifies fixes to achieve **feature parity** between Google Sign-In and email/password signup.

---

## Table of Contents

1. [Root Cause Analysis](#root-cause-analysis)
2. [Issue 1: User Document Field Disparity](#issue-1-user-document-field-disparity)
3. [Issue 2: Collection Inconsistency](#issue-2-collection-inconsistency)
4. [Issue 3: Missing Stripe Customer Creation](#issue-3-missing-stripe-customer-creation)
5. [Issue 4: Firestore Rules Blocking Count Queries](#issue-4-firestore-rules-blocking-count-queries)
6. [Issue 5: Profile Collection Not Created](#issue-5-profile-collection-not-created)
7. [Implementation Plan](#implementation-plan)
8. [Testing Checklist](#testing-checklist)
9. [Migration Strategy](#migration-strategy)

---

## Root Cause Analysis

### Current Error

```
ERROR Firebase Error: {
  "context": "useEventAttendingCount.queryFn",
  "errorCode": "permission-denied",
  "message": "Missing or insufficient permissions."
}
```

### Why This Happens

1. **`useEventAttendingCount`** attempts to read ALL documents in `events/{eventId}/ragers`
2. **Firestore rules** only allow users to read rager documents where `resource.data.firebaseId == request.auth.uid`
3. The `isAdmin()` check fails because:
   - Google users don't have `isAdmin: false` set (it's `undefined`)
   - Rule checks `get(...).data.isAdmin == true` which fails when field is missing

### Affected User Flows

| Flow                             | Email Signup | Google Signup         | Status           |
| -------------------------------- | ------------ | --------------------- | ---------------- |
| View event attending count       | ❌ Fails     | ❌ Fails              | Both broken      |
| Purchase tickets                 | ✅ Works     | ❌ No Stripe customer | Broken           |
| View own tickets                 | ✅ Works     | ⚠️ May fail           | Partially broken |
| Social features (posts, follows) | ✅ Works     | ⚠️ Missing stats      | Degraded         |
| Profile visibility               | ✅ Works     | ⚠️ Missing fields     | Degraded         |

---

## Issue 1: User Document Field Disparity

### Problem

Google Sign-In creates a minimal user document missing critical fields.

### Comparison

| Field                | Email Signup (`auth.ts`) | Google Signup (`googleAuthService.ts`) | Required?     |
| -------------------- | ------------------------ | -------------------------------------- | ------------- |
| `email`              | ✅                       | ✅                                     | Yes           |
| `firstName`          | ✅                       | ✅                                     | Yes           |
| `lastName`           | ✅                       | ✅                                     | Yes           |
| `displayName`        | ✅                       | ❌ Missing                             | Yes           |
| `phoneNumber`        | ✅                       | ❌ Missing                             | No            |
| `userId`             | ✅                       | ❌ Missing                             | **Critical**  |
| `qrCode`             | ✅                       | ❌ Missing                             | Yes (tickets) |
| `createdAt`          | ✅ (ISO string)          | ✅ (serverTimestamp)                   | Yes           |
| `updatedAt`          | ✅                       | ✅                                     | Yes           |
| `lastLogin`          | ✅                       | ❌ Missing                             | Yes           |
| `lastUpdated`        | ✅                       | ❌ Missing                             | Yes           |
| `profilePicture`     | ✅ (empty)               | ❌ Missing                             | Yes           |
| `photoURL`           | ❌                       | ✅                                     | Social        |
| `stripeCustomerId`   | ✅ (empty, then filled)  | ❌ Missing                             | **Critical**  |
| `isAdmin`            | ✅ `false`               | ❌ **Missing**                         | **Critical**  |
| `migratedFromRTDB`   | ✅ `false`               | ❌ Missing                             | Legacy        |
| `isPublic`           | ✅ `true`                | ❌ Missing                             | Social        |
| `verificationStatus` | ✅ `"none"`              | ❌ Missing                             | Social        |
| `provider`           | ❌                       | ✅ `"google"`                          | Auth tracking |
| `stats`              | ✅ (initialized)         | ❌ Missing                             | Social        |
| `expoPushToken`      | ✅                       | ❌ Missing                             | Notifications |

### Current Google Auth Code (Lines 75-85)

```typescript
// src/services/googleAuthService.ts
await setDoc(userDocRef, {
  email: userCredential.user.email,
  firstName: googleUser?.givenName || "",
  lastName: googleUser?.familyName || "",
  photoURL: googleUser?.photo || null,
  provider: "google",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
});
```

### Required Fix

```typescript
// src/services/googleAuthService.ts
const timestamp = new Date().toISOString();
const displayName =
  `${googleUser?.givenName || ""} ${googleUser?.familyName || ""}`.trim();

await setDoc(userDocRef, {
  // Core identity
  email: userCredential.user.email,
  firstName: googleUser?.givenName || "",
  lastName: googleUser?.familyName || "",
  displayName,
  userId: userCredential.user.uid,

  // Profile
  photoURL: googleUser?.photo || null,
  profilePicture: googleUser?.photo || "",
  phoneNumber: "",
  qrCode: userCredential.user.uid,

  // Auth metadata
  provider: "google",
  createdAt: serverTimestamp(),
  updatedAt: serverTimestamp(),
  lastLogin: timestamp,
  lastUpdated: timestamp,

  // Business logic - CRITICAL
  stripeCustomerId: "", // Will be populated after Stripe customer creation
  isAdmin: false, // CRITICAL: Must be explicitly false

  // Legacy support
  migratedFromRTDB: false,
  expoPushToken: "",

  // Social profile
  isPublic: true,
  verificationStatus: "none",
  stats: {
    eventsAttended: 0,
    postsCount: 0,
    followersCount: 0,
    followingCount: 0,
  },
});
```

---

## Issue 2: Collection Inconsistency

### Problem

The app uses **two different collections** for user data:

- Email signup → `/customers/{userId}`
- Google signup → `/users/{userId}`

This causes features to fail when they look in the wrong collection.

### Evidence

```typescript
// Email signup (auth.ts line 156)
setDoc(doc(db, "customers", userId), { ... })

// Google signup (googleAuthService.ts line 75)
const userDocRef = doc(db, "users", userCredential.user.uid);
```

### Services Affected

| Service                  | Collection Used            | Google Users Affected?         |
| ------------------------ | -------------------------- | ------------------------------ |
| `followService.ts`       | `/customers`               | ❌ Can't find Google users     |
| `userSearchService.ts`   | `/customers`               | ❌ Google users not searchable |
| `UserProfileView.tsx`    | `/customers`               | ❌ Profile data missing        |
| `useUserProfile.ts`      | `/customers`               | ❌ Profile hooks fail          |
| `auth.ts` (login update) | `/customers`               | ❌ Last login not updated      |
| `commentService.ts`      | `/customers` + `/profiles` | ⚠️ Partial                     |
| `feedService.ts`         | `/customers` + `/profiles` | ⚠️ Partial                     |
| `complete-profile.tsx`   | `/users`                   | ✅ Works (Google flow only)    |

### Required Fix

**Option A (Recommended): Write to BOTH collections**

Google signup should write to both `/users` AND `/customers` for compatibility:

```typescript
// Write to both collections for compatibility
await Promise.all([
  setDoc(doc(db, "users", userCredential.user.uid), userData),
  setDoc(doc(db, "customers", userCredential.user.uid), userData),
]);
```

**Option B: Migrate all services to `/users`**

This requires updating ~15+ files and is higher risk.

---

## Issue 3: Missing Stripe Customer Creation

### Problem

Email signup creates a Stripe customer via API call. Google signup does not.

### Current Email Signup Flow (signup.tsx lines 327-370)

```typescript
// After user creation
const stripeCustomerResponse = await fetch(`${API_URL}/create-customer`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    email: email,
    name: `${firstName} ${lastName}`,
    firebaseId: createdUser.userData.userId,
  }),
});

if (stripeCustomerResponse.ok) {
  const stripeCustomerData = await stripeCustomerResponse.json();
  await updateUserStripeId(userId, stripeCustomerData.customerId);
  dispatch(setStripeCustomerId(stripeCustomerData.customerId));
}
```

### Current Google Signup Flow

❌ No Stripe customer creation at all.

### Required Fix

Add Stripe customer creation to Google auth flow:

```typescript
// In googleAuthService.ts or login.tsx after successful Google sign-in

if (isNewUser) {
  // Create user document (with fixes from Issue 1)
  await setDoc(userDocRef, userData);

  // Create Stripe customer
  try {
    const response = await fetch(`${API_URL}/create-customer`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: userCredential.user.email,
        name: displayName,
        firebaseId: userCredential.user.uid,
      }),
    });

    if (response.ok) {
      const { customerId } = await response.json();
      await updateDoc(userDocRef, { stripeCustomerId: customerId });
      // Also update /customers collection
      await updateDoc(doc(db, "customers", userCredential.user.uid), {
        stripeCustomerId: customerId,
      });
    }
  } catch (error) {
    console.error("Stripe customer creation failed:", error);
    // Don't block auth flow - Stripe customer can be created later
  }
}
```

### Alternative: Cloud Function Trigger

Create a Cloud Function that triggers on `/users/{userId}` document creation:

```javascript
// functions/index.js
exports.onUserCreated = onDocumentCreated("users/{userId}", async (event) => {
  const userData = event.data.data();
  if (!userData.stripeCustomerId) {
    // Create Stripe customer and update document
  }
});
```

---

## Issue 4: Firestore Rules Blocking Count Queries

### Problem

The `useEventAttendingCount` hook tries to read ALL documents in `events/{eventId}/ragers` to count them. Firestore rules only allow reading documents where the user is the owner.

### Current Rule (firestore.rules lines 155-160)

```javascript
match /ragers/{ragerId} {
  // Readable by owner or admin only
  allow read: if isAuthenticated() && (
    resource.data.firebaseId == request.auth.uid || isAdmin()
  );
}
```

### Current Hook (useEvents.ts lines 118-132)

```typescript
export function useEventAttendingCount(eventId: string) {
  return useQuery({
    queryFn: async () => {
      const ragersCollectionRef = collection(
        firestore,
        "events",
        eventId,
        "ragers",
      );
      const querySnapshot = await getDocs(ragersCollectionRef); // ❌ Reads ALL docs
      return querySnapshot.size;
    },
  });
}
```

### Why It Fails

Firestore evaluates rules **per document**. When `getDocs()` would return documents the user can't read, Firestore denies the **entire query**.

### Required Fix Options

#### Option A: Store Count on Event Document (Recommended)

1. Add `attendingCount` field to event documents
2. Update via Cloud Function when ragers are added/removed
3. Read count from event document (already publicly readable)

**Cloud Function:**

```javascript
// functions/index.js
exports.updateAttendingCount = onDocumentWritten(
  "events/{eventId}/ragers/{ragerId}",
  async (event) => {
    const eventRef = admin.firestore().doc(`events/${event.params.eventId}`);
    const ragersSnapshot = await eventRef.collection("ragers").count().get();
    await eventRef.update({ attendingCount: ragersSnapshot.data().count });
  },
);
```

**Updated Hook:**

```typescript
export function useEventAttendingCount(eventId: string) {
  const { data: event } = useEvent(eventId);
  return {
    data: event?.attendingCount ?? 0,
    isLoading: !event,
    error: null,
  };
}
```

#### Option B: Allow Authenticated Read (Less Secure)

```javascript
match /ragers/{ragerId} {
  // Allow any authenticated user to read (exposes attendee data)
  allow read: if isAuthenticated();
}
```

⚠️ **Security Risk**: This exposes all attendee information (emails, names, etc.)

#### Option C: Use Firebase Admin SDK Count

```typescript
// Call a Cloud Function to get the count
const response = await functions.httpsCallable("getEventAttendingCount")({
  eventId,
});
return response.data.count;
```

---

## Issue 5: Profile Collection Not Created

### Problem

Google users don't get a `/profiles/{userId}` document created, which is used for public profile display.

### Current Behavior

- Email signup: No `/profiles` document created
- Google signup: No `/profiles` document created
- Both rely on `/customers` data which isn't publicly readable

### Social Features Affected

- User search results missing Google users
- Profile views showing incomplete data
- Follow suggestions not including Google users

### Required Fix

Create `/profiles` document for new users:

```typescript
// After user document creation (both Google and email)
await setDoc(doc(db, "profiles", userId), {
  displayName,
  photoURL: googleUser?.photo || "",
  bio: "",
  usernameLower: null, // Set when user chooses username
  profilePicture: googleUser?.photo || "",
  profileSongUrl: null,
});
```

---

## Implementation Plan

### Phase 1: Critical Fixes (Day 1)

1. **Fix `googleAuthService.ts`** ✅
   - ✅ Add all missing fields to user document
   - ✅ Set `isAdmin: false` explicitly
   - ✅ Write to both `/users` AND `/customers` collections
   - ✅ Create `/profiles` document

2. **Add Stripe customer creation to Google flow** ✅
   - ✅ In `googleAuthService.ts` (non-blocking with error handling)

### Phase 2: Event Count Fix (Day 1-2)

3. **Create Cloud Function for attending count** ✅
   - ✅ Trigger on rager document changes (`functions/events.js`)
   - ✅ Update `attendingCount` on parent event

4. **Update `useEventAttendingCount` hook** ✅
   - ✅ Read from event document instead of counting ragers

### Phase 3: Testing & Migration (Day 2-3)

5. **Test all user flows**
   - Google signup → complete profile → view events → purchase
   - Google login (existing user) → all features

6. **Backfill existing Google users** ✅
   - ✅ Script to add missing fields (`migrateGoogleUsers` Cloud Function)
   - ✅ Create missing `/customers` and `/profiles` documents
   - ✅ `backfillAttendingCounts` Cloud Function for event counts

---

## Files to Modify

| File                                | Changes                                                                     | Status                   |
| ----------------------------------- | --------------------------------------------------------------------------- | ------------------------ |
| `src/services/googleAuthService.ts` | Add missing fields, dual collection write, Stripe creation                  | ✅                       |
| `src/hooks/useEvents.ts`            | Update `useEventAttendingCount` to read from event doc                      | ✅                       |
| `functions/events.js`               | Add `updateAttendingCount`, `backfillAttendingCounts`, `migrateGoogleUsers` | ✅                       |
| `functions/index.js`                | Export events module                                                        | ✅                       |
| `src/app/(auth)/login.tsx`          | Pass Stripe dispatch after Google login                                     | N/A (handled in service) |
| `src/app/(auth)/signup.tsx`         | Ensure `/profiles` document created                                         | N/A (future)             |
| `firestore.rules`                   | No changes needed if using Option A                                         | ✅                       |

---

## Testing Checklist

### New Google User Flow

- [ ] Sign up with Google → user doc created with all fields
- [ ] User doc exists in `/users` collection
- [ ] User doc exists in `/customers` collection
- [ ] Profile doc exists in `/profiles` collection
- [ ] `isAdmin` field is `false` (not undefined)
- [ ] Stripe customer created and ID saved
- [ ] View events screen loads without errors
- [ ] Event attending count displays
- [ ] Can add event to cart
- [ ] Can complete purchase
- [ ] Can view purchased tickets
- [ ] Can create posts
- [ ] Can follow other users
- [ ] Profile searchable by other users

### Existing Google User Flow

- [ ] Login succeeds
- [ ] Events screen loads (may show 0 attending until backfill)
- [ ] Core features work

### Existing Email User Flow

- [ ] No regression in any functionality
- [ ] Events attending count still works after migration

---

## Migration Strategy

### For Existing Google Users

Run a one-time script to:

1. Query all `/users` documents where `provider == "google"`
2. Add missing fields (`isAdmin: false`, `stats`, etc.)
3. Copy document to `/customers` collection if missing
4. Create `/profiles` document if missing
5. Create Stripe customer if `stripeCustomerId` is empty

```javascript
// Migration script (run once via Cloud Function or admin script)
async function migrateGoogleUsers() {
  const usersSnapshot = await admin
    .firestore()
    .collection("users")
    .where("provider", "==", "google")
    .get();

  for (const doc of usersSnapshot.docs) {
    const data = doc.data();
    const updates = {};

    // Add missing fields
    if (data.isAdmin === undefined) updates.isAdmin = false;
    if (!data.userId) updates.userId = doc.id;
    if (!data.stats)
      updates.stats = {
        eventsAttended: 0,
        postsCount: 0,
        followersCount: 0,
        followingCount: 0,
      };
    // ... add other missing fields

    if (Object.keys(updates).length > 0) {
      await doc.ref.update(updates);
    }

    // Copy to /customers if missing
    const customerDoc = await admin
      .firestore()
      .doc(`customers/${doc.id}`)
      .get();
    if (!customerDoc.exists) {
      await admin
        .firestore()
        .doc(`customers/${doc.id}`)
        .set({ ...data, ...updates });
    }

    // Create profile if missing
    const profileDoc = await admin.firestore().doc(`profiles/${doc.id}`).get();
    if (!profileDoc.exists) {
      await admin
        .firestore()
        .doc(`profiles/${doc.id}`)
        .set({
          displayName:
            data.displayName || `${data.firstName} ${data.lastName}`.trim(),
          photoURL: data.photoURL || "",
          profilePicture: data.profilePicture || data.photoURL || "",
          bio: "",
        });
    }
  }
}
```

---

## Success Metrics

After implementation:

- [ ] Zero permission-denied errors in production logs for authenticated users
- [ ] Google users can complete full purchase flow
- [ ] Event attending counts display correctly
- [ ] Google users appear in user search
- [ ] Feature parity verified via manual testing

---

## Appendix: Full Field Reference

### Complete User Document Schema

```typescript
interface UserDocument {
  // Identity
  email: string;
  firstName: string;
  lastName: string;
  displayName: string;
  userId: string;

  // Profile
  phoneNumber: string;
  photoURL: string | null;
  profilePicture: string;
  qrCode: string;
  bio?: string;
  username?: string;

  // Auth
  provider: "email" | "google";
  expoPushToken: string;

  // Timestamps
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
  lastLogin: string;
  lastUpdated: string;

  // Business
  stripeCustomerId: string;
  isAdmin: boolean;

  // Legacy
  migratedFromRTDB: boolean;
  migrationDate?: string;

  // Social
  isPublic: boolean;
  verificationStatus: "none" | "verified" | "artist";
  stats: {
    eventsAttended: number;
    postsCount: number;
    followersCount: number;
    followingCount: number;
  };

  // Optional
  socialLinks?: {
    soundcloud?: string;
    instagram?: string;
    twitter?: string;
    tiktok?: string;
    spotify?: string;
    youtube?: string;
  };
  interests?: string[];
  location?: {
    city?: string;
    state?: string;
  };
  profileSongUrl?: string;
}
```
