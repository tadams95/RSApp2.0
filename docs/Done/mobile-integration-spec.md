# RAGESTATE Mobile Integration Spec

> **Purpose**: Context bridge for AI agents working on the React Native mobile app.  
> **Generated**: January 4, 2026 | **Source**: Web codebase analysis + Mobile codebase audit  
> **Last Updated**: January 4, 2026 | **Mobile App Version**: 2.47.0  
> **Usage**: Copy this file to the mobile repo OR paste contents into mobile AI session.

---

## Quick Start for Mobile Agent

You're continuing development on RAGESTATE mobile — a React Native app for an event ticketing + social platform. The web app (Next.js 14) is production-ready. Your job is to achieve feature parity and leverage the existing Firebase backend.

**Key Points**:

- Firebase backend is **shared** — same project, same collections, same rules
- Auth is Firebase Auth (email/password + Google Sign-In pending)
- All payments proxy through Cloud Functions (never direct Stripe from client)
- Social features (feed, follows, notifications) use Firestore real-time listeners — **NOT YET IMPLEMENTED**
- Ticket transfers support @username lookups — **NOT YET IMPLEMENTED (QR scan only)**
- **Current Mobile Status**: Core e-commerce complete, social features are the primary gap

---

## Current Mobile App Structure

### Project Configuration

```
App Name: ragestate-app
Version: 2.47.0
Bundle ID (iOS): com.tyrelle.ragestateapp
Package (Android): com.tyrelle.ragestate
Scheme: ragestate://
EAS Project ID: 0b623ccd-8529-45cb-bc54-dd7265c22a26
```

### Route Structure (Expo Router)

```
src/app/
├── _layout.tsx          # Root layout (providers, splash screen)
├── index.tsx            # Entry redirect
├── (auth)/              # Unauthenticated routes
│   ├── _layout.tsx
│   ├── index.tsx        # Auth landing
│   ├── login.tsx        # ✅ Complete
│   ├── signup.tsx       # ✅ Complete
│   └── forgotPassword.tsx # ✅ Complete
├── (guest)/             # Guest browsing (no auth required)
│   ├── _layout.tsx
│   ├── index.tsx
│   ├── events/          # Event browsing
│   └── shop/            # Shop browsing
└── (app)/               # Authenticated routes (Tab Navigator)
    ├── _layout.tsx      # Tab bar configuration
    ├── home/            # Home tab
    │   └── index.tsx
    ├── shop/            # Shop tab
    │   ├── index.tsx    # Product list
    │   ├── [handle].tsx # Product detail
    │   └── paginated-shop.tsx
    ├── events/          # Events tab
    │   ├── index.tsx    # Event list
    │   ├── [id].tsx     # Event detail
    │   ├── my-events.tsx # User's tickets
    │   └── paginated-events.tsx
    ├── cart/            # Cart tab
    │   ├── index.tsx    # Cart & checkout
    │   └── components/  # Cart-specific components
    └── account/         # Account tab
        └── index.tsx    # Profile & settings
```

### Key Dependencies (from package.json)

```json
{
  "expo": "^53.0.17",
  "expo-router": "^5.1.3",
  "firebase": "^10.10.0",
  "@stripe/stripe-react-native": "0.45.0",
  "@reduxjs/toolkit": "^2.2.3",
  "@tanstack/react-query": "^5.81.2",
  "posthog-react-native": "^4.1.4",
  "@shopify/storefront-api-client": "^1.0.7",
  "expo-camera": "^16.1.10",
  "expo-notifications": "~0.31.4",
  "expo-image": "^2.3.2",
  "react-native-qrcode-svg": "^6.3.0"
}
```

### State Management Pattern

```typescript
// Redux (client state) - src/store/redux/
-cartSlice.tsx - // Cart items, checkout state
  userSlice.tsx - // User info, auth state, preferences
  store.tsx - // Store configuration
  // React Query (server state) - src/config/reactQuery.ts
  queryKeys.products - // Shopify products
  queryKeys.events - // Firebase events
  queryKeys.user - // User profile data
  // Context Providers
  AuthContext.tsx - // Authentication state
  PostHogProvider.tsx; // Analytics with privacy controls
```

### Firebase Configuration (Current)

```typescript
// src/firebase/firebase.tsx - Using web SDK
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Note: Using AsyncStorage for auth persistence
// NOT using @react-native-firebase/* packages
```

---

## Firebase Configuration

### Project Details

```
Project ID: ragestate-app
Region: us-central1 (Functions)
Auth Providers: Email/Password, Google
```

### Web Config (adapt for React Native Firebase)

```javascript
// From firebase/firebase.js — use same values
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
};
```

### React Native Setup

**Current Implementation** (Firebase Web SDK with Expo):

```bash
# Currently installed
firebase                    # v10.10.0 - Web SDK
@react-native-async-storage/async-storage  # For auth persistence
```

**Recommended Future Migration** (for FCM & better performance):

```bash
# Native Firebase packages (not currently used)
@react-native-firebase/app
@react-native-firebase/auth
@react-native-firebase/firestore
@react-native-firebase/storage
@react-native-firebase/messaging  # FCM push - NEEDED for real push
@react-native-firebase/app-check  # Required for production
```

**Why Migrate?**

- Current: Using `firebase` web SDK with `getReactNativePersistence(AsyncStorage)`
- Issue: No FCM support, using Expo Push Tokens instead
- Benefit: Native performance, FCM, App Check, better offline

---

## Firestore Collections (Data Model)

### Core Collections

#### `events/{eventId}`

```typescript
{
  title: string;
  description: string;
  date: Timestamp;
  endDate?: Timestamp;
  location: string;
  address?: string;
  imageUrl: string;
  price: number;           // In cents
  quantity: number;        // Available inventory (decremented on purchase)
  status: 'active' | 'inactive' | 'soldout';
  slug: string;            // URL-friendly identifier
  createdAt: Timestamp;
}
```

#### `events/{eventId}/ragers/{ragerId}`

Ticket records for attendees.

```typescript
{
  oderId: string; // Note: typo in schema, kept for compat
  oderId: string;
  email: string;
  usedCount: number; // Tickets scanned
  ticketQuantity: number; // Total tickets purchased
  active: boolean; // false when fully used
  eventId: string;
  eventTitle: string;
  eventDate: Timestamp;
  eventImageUrl: string;
  firebaseId: string; // Owner's UID
  ticketToken: string; // Unique token for scanning
  createdAt: Timestamp;
}
```

#### `ticketTokens/{token}`

O(1) lookup map for ticket scanning.

```typescript
{
  eventId: string;
  ragerId: string;
}
```

#### `ticketTransfers/{transferId}`

Pending ticket transfers (72-hour expiration).

```typescript
{
  senderId: string;
  senderUsername: string;
  senderEmail: string;
  recipientId?: string;        // Set if @username transfer
  recipientUsername?: string;
  recipientEmail: string;
  eventId: string;
  eventTitle: string;
  eventDate: Timestamp;
  ragerId: string;
  ticketQuantity: number;
  claimToken: string;          // Hashed secure token
  status: 'pending' | 'claimed' | 'cancelled' | 'expired';
  createdAt: Timestamp;
  expiresAt: Timestamp;
  claimedAt?: Timestamp;
}
```

#### `posts/{postId}`

Social feed posts.

```typescript
{
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorPhotoURL?: string;
  authorVerified: boolean;
  content: string;
  mediaUrls: string[];         // Images/videos
  mediaTypes: ('image' | 'video')[];
  isPrivate: boolean;
  likeCount: number;           // Server-managed counter
  commentCount: number;        // Server-managed counter
  repostCount: number;         // Server-managed counter
  isRepost: boolean;
  originalPostId?: string;
  originalAuthorId?: string;
  originalAuthorUsername?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

#### `postLikes/{oderId}` (composite key: `{oderId}_{oderId}`)

#### `postComments/{commentId}`

#### `follows/{oderId}` (composite key: `{followerId}_{followingId}`)

#### `notifications/{oderId}`

```typescript
{
  recipientId: string;
  type: 'like' | 'comment' | 'follow' | 'repost' | 'mention' | 'transfer_received' | 'transfer_claimed';
  actorId: string;
  actorUsername: string;
  actorPhotoURL?: string;
  postId?: string;
  transferId?: string;
  message: string;
  read: boolean;
  createdAt: Timestamp;
}
```

#### `customers/{uid}`

```typescript
{
  oderId: string; // Stripe customer ID
  email: string;
  name: string;
}
```

#### `fulfillments/{paymentIntentId}`

Order records (idempotency key = PI ID).

```typescript
{
  oderId: string;
  oderId: string;
  oderId: string;
  status: 'pending' | 'completed' | 'failed';
  items: Array<{
    productId: string;
    quantity: number;
    title: string;
    price: number;
  }>;
  createdAt: Timestamp;
  completedAt?: Timestamp;
}
```

#### `usernames/{usernameLower}`

Username reservation (write-once).

```typescript
{
  oderId: string; // Owner's UID
}
```

#### `users/{uid}` (RTDB)

```typescript
{
  email: string;
  displayName: string;
  username: string;
  photoURL?: string;
  bio?: string;
  isAdmin?: boolean;
  stripeCustomerId?: string;  // Mirrored from Firestore
  fcmTokens?: { [token: string]: true };
  notificationPreferences?: {
    likes: boolean;
    comments: boolean;
    follows: boolean;
    transfers: boolean;
    quietHoursStart?: number;  // 0-23
    quietHoursEnd?: number;
  };
}
```

---

## API Endpoints (Cloud Functions)

Base URL: `https://us-central1-ragestate-app.cloudfunctions.net/stripePayment`

### Payments

| Endpoint                 | Method | Auth     | Body                                                              | Notes                                       |
| ------------------------ | ------ | -------- | ----------------------------------------------------------------- | ------------------------------------------- |
| `/create-payment-intent` | POST   | Optional | `{ amount, currency, firebaseId?, cartItems }`                    | Returns `{ clientSecret, paymentIntentId }` |
| `/create-customer`       | POST   | Optional | `{ email, name, uid? }`                                           | Creates/returns Stripe customer             |
| `/finalize-order`        | POST   | Required | `{ paymentIntentId, firebaseId, userEmail, userName, cartItems }` | Atomic fulfillment, creates tickets         |
| `/health`                | GET    | None     | —                                                                 | Health check                                |

### Ticket Scanning (Admin)

| Endpoint                  | Method | Auth  | Body                                 | Notes                                    |
| ------------------------- | ------ | ----- | ------------------------------------ | ---------------------------------------- |
| `/scan-ticket`            | POST   | Admin | `{ token }` OR `{ userId, eventId }` | Returns `{ success, remaining, ticket }` |
| `/backfill-ticket-tokens` | POST   | Admin | `{ eventId, dryRun? }`               | Backfill tokens for legacy tickets       |

### Transfers

| Endpoint             | Method | Auth     | Body                                               | Notes                         |
| -------------------- | ------ | -------- | -------------------------------------------------- | ----------------------------- |
| `/initiate-transfer` | POST   | Required | `{ ragerId, recipientEmail?, recipientUsername? }` | Creates transfer, sends email |
| `/claim-transfer`    | POST   | Required | `{ transferId, claimToken }`                       | Claims ticket to new owner    |
| `/cancel-transfer`   | POST   | Required | `{ transferId }`                                   | Cancels pending transfer      |

### Headers Required

```
Content-Type: application/json
Authorization: Bearer <Firebase ID Token>  // For authenticated endpoints
x-proxy-key: <PROXY_KEY>                   // Only if calling directly (not via Next API)
```

---

## Authentication Flow

### Current Firebase Auth Setup (Web SDK)

```typescript
// src/firebase/firebase.tsx - Current implementation
import { initializeApp } from "firebase/app";
import { initializeAuth, getReactNativePersistence } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";

const app = initializeApp(firebaseConfig);
const firebaseAuth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});
```

### Email/Password (Currently Working)

```typescript
// src/utils/auth.ts
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
} from "firebase/auth";

// Sign up - creates user in Auth, Firestore, and RTDB
await createUserWithEmailAndPassword(firebaseAuth, email, password);

// Sign in
await signInWithEmailAndPassword(firebaseAuth, email, password);

// Password reset
await sendPasswordResetEmail(firebaseAuth, email);
```

### Google Sign-In (NOT IMPLEMENTED - TODO)

```typescript
// FUTURE: Requires native module setup
import { GoogleSignin } from "@react-native-google-signin/google-signin";

GoogleSignin.configure({
  webClientId: "<WEB_CLIENT_ID>", // From Firebase Console
});

const { idToken } = await GoogleSignin.signIn();
const credential = auth.GoogleAuthProvider.credential(idToken);
await auth().signInWithCredential(credential);
```

### Getting ID Token for API Calls

```typescript
// Current implementation - src/utils/auth.ts
import { getIdToken } from "firebase/auth";
import { auth as firebaseAuth } from "../firebase/firebase";

const idToken = await getIdToken(firebaseAuth.currentUser);

fetch(endpoint, {
  headers: {
    Authorization: `Bearer ${idToken}`,
    "Content-Type": "application/json",
  },
});
```

### Admin Check

```typescript
// Current implementation - src/utils/auth.ts
import { get, getDatabase, ref } from "firebase/database";

// Check RTDB for admin status
const rtdb = getDatabase();
const snapshot = await get(ref(rtdb, `users/${uid}/isAdmin`));
const isAdmin = snapshot.val() === true;

// Note: Custom claims check could also be done via:
// const tokenResult = await firebaseAuth.currentUser?.getIdTokenResult();
// const isAdmin = tokenResult?.claims?.admin === true;
```

---

## Push Notifications (Expo + FCM)

### Current Implementation (Expo Push Tokens)

```typescript
// src/services/notificationService.ts
import * as Notifications from "expo-notifications";
import * as Device from "expo-device";

// Request permission (works on iOS and Android)
const { status } = await Notifications.requestPermissionsAsync();

// Get Expo push token (NOT FCM token)
const token = await Notifications.getExpoPushTokenAsync({
  projectId: "0b623ccd-8529-45cb-bc54-dd7265c22a26",
});

// Register token with backend (stored in RTDB user profile)
await set(ref(rtdb, `users/${uid}/expoPushToken`), token.data);
```

### Local Notifications (Working)

```typescript
// src/services/notificationManager.ts
await Notifications.scheduleNotificationAsync({
  content: {
    title: "Ticket Transferred",
    body: "Your ticket has been sent successfully",
    data: { type: "transfer_confirmation" },
  },
  trigger: null, // Immediate
});
```

### FCM Migration (TODO for Full Feature Parity)

```typescript
// FUTURE: Using @react-native-firebase/messaging
import messaging from "@react-native-firebase/messaging";

// Request permission (iOS)
await messaging().requestPermission();

// Get FCM token
const fcmToken = await messaging().getToken();

// Register with backend
await database().ref(`users/${uid}/fcmTokens/${fcmToken}`).set(true);

// Listen for token refresh
messaging().onTokenRefresh(async (newToken) => {
  await database().ref(`users/${uid}/fcmTokens/${newToken}`).set(true);
});
```

### Handling Notifications (Current)

```typescript
// Foreground - src/app/_layout.tsx
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Background handling would need FCM integration
```

---

## Feature Parity Matrix

### Priority 1: Core Features (Must Have)

| Feature                   | Web Status | Mobile Status | Notes                                             |
| ------------------------- | ---------- | ------------- | ------------------------------------------------- |
| **Auth (Email/Password)** | ✅ Done    | ✅ Done       | Firebase Auth with AsyncStorage persistence       |
| **Auth (Google Sign-In)** | ✅ Done    | ⬜ TODO       | Needs `@react-native-google-signin` native module |
| **Event List**            | ✅ Done    | ✅ Done       | React Query + Firestore with pagination           |
| **Event Detail**          | ✅ Done    | ✅ Done       | Full info, add to cart, image caching             |
| **Ticket Purchase**       | ✅ Done    | ✅ Done       | Stripe via Cloud Functions, full flow             |
| **My Tickets**            | ✅ Done    | ✅ Done       | QR code display, ticket count                     |
| **Ticket QR Scanner**     | ✅ Done    | ✅ Done       | Admin only, expo-camera                           |
| **Social Feed**           | ✅ Done    | ⬜ TODO       | Not implemented - Priority 1 gap                  |
| **Post Composer**         | ✅ Done    | ⬜ TODO       | Not implemented - Priority 1 gap                  |
| **User Profile**          | ✅ Done    | ⚠️ Partial    | Own profile only, no public view                  |
| **Follow/Unfollow**       | ✅ Done    | ⬜ TODO       | Not implemented                                   |
| **Notifications Feed**    | ✅ Done    | ⬜ TODO       | Not implemented                                   |
| **Push Notifications**    | ✅ Done    | ⚠️ Partial    | Expo tokens, not FCM                              |

### Priority 2: Differentiators

| Feature                        | Web Status | Mobile Status | Notes                            |
| ------------------------------ | ---------- | ------------- | -------------------------------- |
| **@Username Transfer**         | ✅ Done    | ⬜ TODO       | Critical gap - QR only currently |
| **Email Transfer**             | ✅ Done    | ⬜ TODO       | Not implemented                  |
| **Profile Preview (Transfer)** | ✅ Done    | ⬜ TODO       | Shows recipient before sending   |
| **Transfer Notifications**     | ✅ Done    | ⚠️ Partial    | Local only, no push              |

### Priority 3: Nice to Have

| Feature             | Web Status | Mobile Status | Notes                             |
| ------------------- | ---------- | ------------- | --------------------------------- |
| **Light/Dark Mode** | ✅ Done    | ⬜ TODO       | System preference not implemented |
| **Video Playback**  | ✅ Done    | ⬜ TODO       | Not implemented                   |
| **Add to Calendar** | ✅ Done    | ⬜ TODO       | Native calendar API not used      |
| **Get Directions**  | ✅ Done    | ⬜ TODO       | Open maps app not implemented     |
| **Merch Shop**      | ⚠️ Partial | ✅ Done       | Shopify integration complete      |

---

## Existing Mobile Progress

> **Last Updated**: January 4, 2026 | **App Version**: 2.47.0

### Architecture Overview

| Component            | Implementation                         | Notes                                                             |
| -------------------- | -------------------------------------- | ----------------------------------------------------------------- |
| **Navigation**       | Expo Router v5.1.3                     | File-based routing with `(app)`, `(auth)`, `(guest)` route groups |
| **State Management** | Redux Toolkit + React Query            | Redux for client state (cart, user), React Query for server state |
| **UI Library**       | React Native Paper + Native Components | MaterialCommunityIcons, react-native-gesture-handler              |
| **Firebase Setup**   | Firebase JS SDK v10                    | Web SDK with AsyncStorage persistence (not React Native Firebase) |
| **Analytics**        | PostHog React Native                   | Full implementation with privacy controls and GDPR compliance     |
| **Payments**         | @stripe/stripe-react-native            | Integrated with Cloud Functions                                   |

### Completed Features ✅

#### Authentication

- [x] **Email/Password Auth** - Full implementation with Firebase Auth
- [x] **Sign Up Flow** - Complete with form validation, password requirements, Stripe customer creation
- [x] **Login Flow** - With "Stay Logged In" option, error handling, analytics tracking
- [x] **Forgot Password** - Password reset via email
- [x] **Auth State Persistence** - AsyncStorage-based session management
- [ ] **Google Sign-In** - NOT IMPLEMENTED (requires native module)

#### Events

- [x] **Event List** - Firestore query with date filtering, paginated support
- [x] **Event Detail** - Full event info, image loading, add to cart
- [x] **My Events/Tickets** - View purchased tickets, ticket count, event details
- [x] **QR Code Display** - Ticket QR codes for scanning (react-native-qrcode-svg)
- [x] **Ticket QR Scanner** - Admin camera scanning with expo-camera
- [x] **Ticket Transfer** - QR scan-based transfer to other users
- [ ] **@Username Transfer** - NOT IMPLEMENTED (transfers via QR scan only)
- [ ] **Email Transfer** - NOT IMPLEMENTED

#### E-commerce

- [x] **Ticket Purchase** - Full Stripe integration via Cloud Functions
- [x] **Cart Management** - Redux-based with offline sync
- [x] **Payment Processing** - StripeProvider, PaymentSheet, address collection
- [x] **Order Fulfillment** - Via `finalize-order` Cloud Function
- [x] **Cart Recovery** - Persistence, error handling, reconciliation

#### Shop (Shopify Integration)

- [x] **Product List** - Shopify Storefront API with FlashList
- [x] **Product Detail** - Full product info, variants, images
- [x] **Add to Cart** - Size/color selection, variant handling
- [x] **Paginated Shop** - Cursor-based pagination
- [x] **Offline Products** - Cached products for offline viewing

#### User Profile & Account

- [x] **Account Screen** - Profile picture, user info, settings
- [x] **Edit Profile** - Name, email updates via modal
- [x] **Profile Picture Upload** - Image picker with compression
- [x] **Settings Modal** - Account management, sign out
- [x] **QR Modal** - User QR code display
- [x] **Order History** - View past orders
- [ ] **Bio/Social Links** - NOT IMPLEMENTED
- [ ] **Public Profile View** - NOT IMPLEMENTED (no `/profile/[userId]` route)

#### Notifications

- [x] **Push Notification Setup** - expo-notifications configured
- [x] **Permission Handling** - Request and track permission status
- [x] **Local Notifications** - Order confirmations, transfer alerts
- [ ] **FCM Integration** - NOT IMPLEMENTED (using Expo Push Tokens)
- [ ] **Real-time Push** - NOT IMPLEMENTED (no Firebase Messaging)

#### Social Features

- [ ] **Social Feed** - NOT IMPLEMENTED
- [ ] **Post Composer** - NOT IMPLEMENTED
- [ ] **Follow/Unfollow** - NOT IMPLEMENTED
- [ ] **Likes/Comments** - NOT IMPLEMENTED
- [ ] **Notifications Feed** - NOT IMPLEMENTED

#### Infrastructure

- [x] **Error Boundaries** - Comprehensive coverage (cart, account, shopify, profile)
- [x] **Offline Support** - Cart sync, profile cache, product cache
- [x] **Image Caching** - expo-image with progressive loading, placeholders
- [x] **Image Compression** - Pre-upload compression for profile pictures
- [x] **Analytics Privacy** - GDPR-compliant opt-out with PostHog
- [x] **Network Status** - NetInfo integration with status banner
- [x] **Deep Linking** - `ragestate://` scheme configured

### Partially Complete 🚧

| Feature                    | Status | Notes                                           |
| -------------------------- | ------ | ----------------------------------------------- |
| **User Search/Discovery**  | 10%    | Data model planned, UI not built                |
| **Enhanced User Profiles** | 30%    | Basic profile exists, social fields not added   |
| **Ticket Transfers**       | 60%    | QR scan works, @username lookup not implemented |
| **Push Notifications**     | 50%    | Local works, FCM not integrated                 |
| **Deep Linking**           | 40%    | Scheme configured, not all routes handled       |

### Known Issues / Tech Debt

1. **Firebase SDK vs React Native Firebase**: Currently using web SDK (`firebase` package) instead of native modules (`@react-native-firebase/*`). This works but:

   - No FCM push notifications (using Expo tokens instead)
   - No native performance optimization
   - No App Check integration

2. **PostHog Navigation Error**: Suppressed `getCurrentRoute` errors in console due to Expo Router incompatibility (harmless but logged)

3. **Transfer System Limited**: Only supports QR scan transfers, not the @username or email transfers from web

4. **Social Features Missing**: The entire social feed, posts, follows, and notifications feed are not implemented

5. **Google Sign-In Not Implemented**: Requires `@react-native-google-signin/google-signin` native module setup

---

## Critical Implementation Notes

### 1. Stripe Payments (NEVER direct from client)

```typescript
// WRONG ❌
import Stripe from 'stripe';
const stripe = new Stripe(secretKey); // Never expose secret key

// RIGHT ✅
// 1. Create PaymentIntent via Cloud Function
const response = await fetch(`${FUNCTIONS_URL}/create-payment-intent`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ amount: 1500, currency: 'usd', cartItems }),
});
const { clientSecret } = await response.json();

// 2. Use Stripe SDK to confirm
import { useStripe } from '@stripe/stripe-react-native';
const { confirmPayment } = useStripe();
await confirmPayment(clientSecret, { paymentMethodType: 'Card' });

// 3. Finalize order via Cloud Function
await fetch(`${FUNCTIONS_URL}/finalize-order`, { ... });
```

### 2. Real-time Listeners (Memory Management)

```typescript
// Current pattern used in events hooks - src/hooks/useEvents.ts
import {
  collection,
  getDocs,
  query,
  where,
  onSnapshot,
} from "firebase/firestore";
import { db } from "../firebase/firebase";

// Query-based fetching (currently used)
const eventCollectionRef = collection(db, "events");
const q = query(eventCollectionRef, where("dateTime", ">=", currentDate));
const eventSnapshot = await getDocs(q);

// Real-time listener pattern (for social features - TODO)
useEffect(() => {
  const unsubscribe = onSnapshot(
    query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(20)),
    (snapshot) => {
      const posts = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPosts(posts);
    }
  );

  return () => unsubscribe();
}, []);
```

### 3. Image/Video Uploads

```typescript
// Current implementation - src/app/(app)/account/index.tsx
import {
  getStorage,
  ref as storageRef,
  uploadBytes,
  getDownloadURL,
} from "firebase/storage";
import * as ImagePicker from "expo-image-picker";
import { compressImage } from "../utils/imageCompression";

// Pick image
const result = await ImagePicker.launchImageLibraryAsync({
  mediaTypes: ImagePicker.MediaTypeOptions.Images,
  allowsEditing: true,
  aspect: [1, 1],
  quality: 0.8,
});

// Compress before upload
const compressed = await compressImage(result.assets[0].uri, {
  maxWidth: 500,
  maxHeight: 500,
  quality: 0.7,
});

// Upload to Firebase Storage
const storage = getStorage();
const reference = storageRef(storage, `profiles/${userId}/avatar.jpg`);
const response = await fetch(compressed.uri);
const blob = await response.blob();
await uploadBytes(reference, blob);
const downloadUrl = await getDownloadURL(reference);
```

### 4. Deep Linking

```typescript
// Configured in app.json - scheme: "ragestate"
// URL schemes to support (PARTIALLY IMPLEMENTED)

// Custom scheme (configured)
ragestate://event/{eventId}      // TODO: Handle in app
ragestate://post/{postId}        // TODO: Implement social first
ragestate://user/{username}      // TODO: Implement profiles first
ragestate://transfer/{transferId}?token={claimToken}  // TODO

// Web URLs (universal links - NOT YET CONFIGURED)
https://ragestate.com/events/{slug}
https://ragestate.com/social/{postId}
https://ragestate.com/u/{username}
https://ragestate.com/transfer/claim?id={transferId}&token={claimToken}

// Current deep link handling would be in src/app/_layout.tsx
// using Expo Router's built-in linking configuration
```

### 5. App Check (NOT IMPLEMENTED - Production Requirement)

```typescript
// FUTURE: Using @react-native-firebase/app-check
import { firebase } from "@react-native-firebase/app-check";

// Initialize before any Firebase calls
await firebase.appCheck().activate("your-recaptcha-site-key", true);

// Note: Current implementation does NOT have App Check
// This should be added before production release
```

---

## Environment Variables

```bash
# .env or app.config.js
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=ragestate-app
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
FIREBASE_MEASUREMENT_ID=

STRIPE_PUBLISHABLE_KEY=pk_live_...  # or pk_test_...
FUNCTIONS_BASE_URL=https://us-central1-ragestate-app.cloudfunctions.net/stripePayment

# For direct Function calls (usually not needed from mobile)
# PROXY_KEY=  # Don't include in mobile — use Firebase Auth instead
```

---

## Testing Checklist

Before submitting to app stores:

### Authentication

- [x] Sign up (email/password)
- [x] Sign in (email/password)
- [x] Sign out
- [x] Password reset
- [ ] Google Sign-In - NOT IMPLEMENTED

### Events & Tickets

- [x] Event browsing and filtering
- [x] Complete purchase flow (Stripe integration)
- [x] View purchased tickets with QR
- [ ] Transfer ticket via @username - NOT IMPLEMENTED
- [ ] Transfer ticket via email - NOT IMPLEMENTED
- [x] Transfer ticket via QR scan
- [ ] Claim incoming transfer - PARTIAL

### Social Features (NOT IMPLEMENTED)

- [ ] Social feed loads and scrolls
- [ ] Create post with image
- [ ] Create post with video
- [ ] Like, comment, repost
- [ ] Follow/unfollow users
- [ ] View notifications feed

### Notifications

- [x] Local notifications work
- [ ] Receive push notification (FCM) - NOT IMPLEMENTED

### Other Features

- [x] Deep links scheme configured
- [ ] Deep links open correct screens - PARTIAL
- [x] Offline behavior (cart, products cached)
- [ ] Light/dark mode - NOT IMPLEMENTED
- [ ] Accessibility (VoiceOver/TalkBack) - NOT TESTED

---

## Questions for Mobile Session

When continuing mobile development, the current state is:

1. **Navigation**: Expo Router v5.1.3 with file-based routing - CONFIGURED ✅
2. **Firebase**: Web SDK (`firebase` v10) with AsyncStorage persistence - CONFIGURED ✅
3. **Existing Screens**: Auth (login, signup, forgot password), Events (list, detail, my-events), Shop (list, detail, paginated), Cart, Account
4. **State Management**: Redux Toolkit (cart, user) + React Query (server data) - CONFIGURED ✅
5. **Expo Setup**: Managed workflow with EAS Build - CONFIGURED ✅
6. **Stripe**: `@stripe/stripe-react-native` integrated - CONFIGURED ✅

### Critical Development Priorities (in order)

1. **Social Features** - Biggest gap for feature parity:

   - Social Feed screen with real-time Firestore listener
   - Post Composer with image/video upload
   - Follow/Unfollow system
   - Likes, comments, reposts

2. **@Username Ticket Transfers** - Key differentiator not implemented:

   - Username lookup integration
   - Profile preview before transfer
   - Cloud Function integration for transfers

3. **Public User Profiles** - Foundation for social:

   - `/profile/[userId]` route
   - Bio, social links, stats
   - User search/discovery

4. **FCM Push Notifications** - For real-time engagement:

   - Migrate from Expo tokens to FCM
   - Consider `@react-native-firebase/messaging`

5. **Google Sign-In** - Auth completion:
   - Requires `@react-native-google-signin/google-signin`
   - Native configuration for iOS/Android

---

**This document is your context bridge. Keep it updated as features are completed on either platform.**

---

## Recommended Implementation Order

Based on the current state analysis, here's the recommended order for achieving feature parity:

### Phase 1: Social Foundation (Highest Priority)

**1.1 User Profile Enhancement** (~1-2 days)

- Extend `UserData` interface with bio, social links
- Create `src/app/(app)/profile/[userId].tsx` route
- Build `UserProfileView` component (self/other modes)
- Add user search capability

**1.2 Social Feed Core** (~3-5 days)

- Create `src/app/(app)/social/` route group
- Build feed screen with Firestore real-time listener
- Implement post card component
- Add infinite scroll pagination

**1.3 Post Composer** (~2-3 days)

- Create post composition modal/screen
- Image picker with compression (reuse existing)
- Video support via expo-image-picker
- Upload to Firebase Storage

**1.4 Social Interactions** (~2-3 days)

- Follow/unfollow with Firestore
- Like/unlike posts
- Comments with nested replies
- Repost functionality

### Phase 2: Ticket Transfer Enhancement

**2.1 @Username Transfer** (~2 days)

- Username search/lookup UI
- Cloud Function integration for transfers
- Profile preview before confirming

**2.2 Email Transfer** (~1 day)

- Email input for non-user transfers
- Integration with existing transfer functions

**2.3 Transfer Claim Flow** (~1-2 days)

- Deep link handling for claim URLs
- Claim confirmation UI
- Status updates and notifications

### Phase 3: Notifications & Polish

**3.1 Notifications Feed** (~2 days)

- In-app notifications list
- Real-time Firestore listener
- Read/unread state management

**3.2 FCM Integration** (~2-3 days)

- Migrate to `@react-native-firebase/messaging`
- FCM token registration
- Background notification handling

**3.3 Google Sign-In** (~1-2 days)

- Setup `@react-native-google-signin/google-signin`
- iOS/Android native configuration
- Integration with auth flow

### Phase 4: Polish & Production

**4.1 Deep Linking** (~1 day)

- Handle all route deep links
- Universal links configuration

**4.2 App Check** (~0.5 days)

- Production security requirement

**4.3 Light/Dark Mode** (~1 day)

- System preference detection
- Theme provider implementation

---

**Estimated Total Time to Feature Parity**: 3-4 weeks of focused development
