# Phase 3: Notifications & Polish

> **Timeline**: 1-2 weeks | **Priority**: 🟡 Medium  
> **Dependencies**: Phase 1 & 2 (for notification types)  
> **Outcome**: Rich notification system, Google Sign-In, UI polish

---

## Overview

This phase focuses on enhancing the user experience through proper push notifications (FCM), Google Sign-In as an auth alternative, and in-app notification feeds.

---

## ⚠️ Apple Developer Account Status

**Enrollment Status**: ✅ Verified & Active

### Optimized Work Order

| Order | Section                          | Apple Account Needed? | Testable Now?       |
| ----- | -------------------------------- | --------------------- | ------------------- |
| 1️⃣    | **3.1 In-App Notification Feed** | ❌ No                 | ✅ Fully testable   |
| 2️⃣    | **3.2 Notification Preferences** | ❌ No                 | ✅ Fully testable   |
| 3️⃣    | **3.3 FCM Push Notifications**   | ✅ iOS only           | 🟡 Android testable |
| 4️⃣    | **3.4 Google Sign-In**           | ✅ iOS only           | 🟡 Android testable |

**Strategy**: Complete 3.1 and 3.2 first (no dependencies), then build 3.3/3.4 and test on Android while Apple enrollment completes.

---

## Current State

**What Works (Backend Already Built!):**

- ✅ FCM push notifications (iOS) verified working
- ✅ Cloud Functions create notifications for:
  - `post_liked` - When someone likes a post
  - `comment_added` - New comments on posts
  - `new_follower` - New follower notifications
  - `mention` - @mentions in posts/comments
  - `post_reposted` - When posts are reposted
  - `ticket_transfer_sent` - Transfer initiated
  - `ticket_transfer_received` - Transfer received
  - `ticket_transfer_claimed` - Transfer claimed
  - `ticket_transfer_cancelled` - Transfer cancelled
- ✅ `batchMarkNotificationsRead` callable function
- ✅ Quiet hours evaluation logic
- ✅ Activity aggregation (batches likes/comments)
- ✅ `unreadNotifications` counter on user doc
- ✅ Expo Push Tokens stored in Firestore
- ✅ Basic `notificationService.ts` exists

**What's Missing (Frontend):**

- ❌ In-app notification feed UI ← **Start here**
- ❌ Notification preferences screen
- ✅ FCM integration for background push (iOS Complete)
- ❌ Google Sign-In native integration
- ❌ Tab bar badge count

---

## 3.1 In-App Notification Feed (~2-3 days) 🟢 NO APPLE ACCOUNT NEEDED

> **Priority**: Start immediately - fully testable on simulator/Android

### Firestore Schema (Already Exists)

```typescript
// Collection: users/{userId}/notifications
interface InAppNotification {
  id: string;
  type:
    | "post_liked"
    | "comment_added"
    | "new_follower"
    | "mention"
    | "post_reposted"
    | "ticket_transfer_sent"
    | "ticket_transfer_received"
    | "ticket_transfer_claimed"
    | "ticket_transfer_cancelled";
  title: string;
  body: string;
  data: {
    actorId?: string; // Who triggered notification
    postId?: string; // Related post
    eventId?: string; // Related event
    transferId?: string; // Related transfer
    commentId?: string; // Related comment
  };
  link: string; // Web path like /post/123
  deepLink: string; // App path like ragestate://post/123
  read: boolean;
  seenAt: Timestamp | null;
  createdAt: Timestamp;
  sendPush: boolean;
  pushSentAt: Timestamp | null;
  pushStatus: "pending" | "sent" | "failed";
}
```

### Implementation Checklist 3.1

- [x] **3.1.1** Create `src/hooks/useNotificationBadge.ts`
- [x] **3.1.2** Create `src/services/inAppNotificationService.ts`
- [x] **3.1.3** Create `src/components/notifications/NotificationCard.tsx`
- [x] **3.1.4** Create `src/components/notifications/EmptyNotifications.tsx`
- [x] **3.1.5** Create `src/components/notifications/index.ts` (barrel export)
- [x] **3.1.6** Create `src/app/(app)/notifications/_layout.tsx`
- [x] **3.1.7** Create `src/app/(app)/notifications/index.tsx`
- [x] **3.1.8** Update `src/app/(app)/_layout.tsx` with notifications tab + badge
- [x] **3.1.9** Add "Mark all read" action in header

### File: `src/hooks/useNotificationBadge.ts`

```typescript
import { useEffect, useState } from "react";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import * as Notifications from "expo-notifications";
import { db } from "../firebase/firebase";
import { useAuth } from "./AuthContext";

/**
 * Real-time unread notification count
 * Updates tab bar badge and app icon badge
 */
export function useNotificationBadge() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user?.uid) {
      setUnreadCount(0);
      return;
    }

    const unsubscribe = onSnapshot(
      query(
        collection(db, "users", user.uid, "notifications"),
        where("read", "==", false),
      ),
      (snapshot) => {
        const count = snapshot.size;
        setUnreadCount(count);

        // Update app icon badge
        Notifications.setBadgeCountAsync(count).catch(console.error);
      },
      (error) => {
        console.error("Error listening to notifications:", error);
      },
    );

    return unsubscribe;
  }, [user?.uid]);

  return unreadCount;
}
```

### File: `src/services/inAppNotificationService.ts`

```typescript
import {
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  doc,
  updateDoc,
  where,
  Timestamp,
  onSnapshot,
} from "firebase/firestore";
import { httpsCallable, getFunctions } from "firebase/functions";
import { db } from "../firebase/firebase";

export interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  link: string;
  deepLink: string;
  read: boolean;
  seenAt: Timestamp | null;
  createdAt: Timestamp;
}

/**
 * Fetch notifications for a user
 */
export async function getNotifications(
  userId: string,
  limitCount = 50,
): Promise<Notification[]> {
  const q = query(
    collection(db, "users", userId, "notifications"),
    orderBy("createdAt", "desc"),
    limit(limitCount),
  );

  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Notification[];
}

/**
 * Mark a single notification as read
 */
export async function markNotificationRead(
  userId: string,
  notificationId: string,
): Promise<void> {
  const notifRef = doc(db, "users", userId, "notifications", notificationId);
  await updateDoc(notifRef, {
    read: true,
    seenAt: Timestamp.now(),
  });
}

/**
 * Mark all notifications as read (uses Cloud Function)
 */
export async function markAllNotificationsRead(): Promise<{
  updated: number;
  remainingUnread: number;
}> {
  const functions = getFunctions();
  const batchMarkRead = httpsCallable(functions, "batchMarkNotificationsRead");
  const result = await batchMarkRead({ markAll: true, max: 100 });
  return result.data as { updated: number; remainingUnread: number };
}

/**
 * Subscribe to real-time notification updates
 */
export function subscribeToNotifications(
  userId: string,
  callback: (notifications: Notification[]) => void,
  limitCount = 50,
): () => void {
  const q = query(
    collection(db, "users", userId, "notifications"),
    orderBy("createdAt", "desc"),
    limit(limitCount),
  );

  return onSnapshot(q, (snapshot) => {
    const notifications = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as Notification[];
    callback(notifications);
  });
}
```

### File: `src/components/notifications/NotificationCard.tsx`

```typescript
import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Timestamp } from "firebase/firestore";
import { GlobalStyles } from "../../constants/styles";

interface NotificationCardProps {
  notification: {
    id: string;
    type: string;
    title: string;
    body: string;
    data: Record<string, any>;
    deepLink: string;
    read: boolean;
    createdAt: Timestamp;
  };
  onPress: () => void;
}

// Map notification types to icons
const TYPE_ICONS: Record<string, { name: string; color: string }> = {
  post_liked: { name: "heart", color: "#FF4757" },
  comment_added: { name: "comment", color: "#3498db" },
  new_follower: { name: "account-plus", color: "#2ecc71" },
  mention: { name: "at", color: "#9b59b6" },
  post_reposted: { name: "repeat", color: "#1abc9c" },
  ticket_transfer_sent: { name: "send", color: GlobalStyles.colors.primary },
  ticket_transfer_received: {
    name: "ticket",
    color: GlobalStyles.colors.primary,
  },
  ticket_transfer_claimed: { name: "check-circle", color: "#2ecc71" },
  ticket_transfer_cancelled: { name: "close-circle", color: "#e74c3c" },
};

function formatRelativeTime(timestamp: Timestamp): string {
  const now = new Date();
  const date = timestamp.toDate();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationCard({
  notification,
  onPress,
}: NotificationCardProps) {
  const iconConfig = TYPE_ICONS[notification.type] || {
    name: "bell",
    color: "#888",
  };

  return (
    <TouchableOpacity
      style={[styles.card, !notification.read && styles.unread]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: iconConfig.color + "20" },
        ]}
      >
        <MaterialCommunityIcons
          name={iconConfig.name as any}
          size={22}
          color={iconConfig.color}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {notification.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {notification.body}
        </Text>
        <Text style={styles.time}>
          {formatRelativeTime(notification.createdAt)}
        </Text>
      </View>

      {!notification.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
    backgroundColor: GlobalStyles.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: GlobalStyles.colors.border,
  },
  unread: {
    backgroundColor: "rgba(255, 107, 53, 0.05)",
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  content: {
    flex: 1,
  },
  title: {
    fontSize: 15,
    fontWeight: "600",
    color: GlobalStyles.colors.text,
    marginBottom: 2,
  },
  body: {
    fontSize: 14,
    color: GlobalStyles.colors.textSecondary,
    lineHeight: 20,
    marginBottom: 4,
  },
  time: {
    fontSize: 12,
    color: GlobalStyles.colors.grey5,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: GlobalStyles.colors.primary,
    marginLeft: 8,
  },
});

export default NotificationCard;
```

### File: `src/components/notifications/EmptyNotifications.tsx`

```typescript
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { GlobalStyles } from "../../constants/styles";

export function EmptyNotifications() {
  return (
    <View style={styles.container}>
      <MaterialCommunityIcons
        name="bell-outline"
        size={64}
        color={GlobalStyles.colors.grey5}
      />
      <Text style={styles.title}>No notifications yet</Text>
      <Text style={styles.subtitle}>
        When you get likes, comments, followers, or transfers, they'll show up
        here
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 32,
    paddingVertical: 64,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: GlobalStyles.colors.text,
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: GlobalStyles.colors.textSecondary,
    textAlign: "center",
    marginTop: 8,
    lineHeight: 20,
  },
});

export default EmptyNotifications;
```

### File: `src/components/notifications/index.ts`

```typescript
export { NotificationCard } from "./NotificationCard";
export { EmptyNotifications } from "./EmptyNotifications";
```

### Tab Bar Update (in `src/app/(app)/_layout.tsx`)

Add notifications tab with badge:

```typescript
// Add to imports
import { useNotificationBadge } from "../../hooks/useNotificationBadge";

// In AppLayout component
const unreadCount = useNotificationBadge();

// Add new Tabs.Screen
<Tabs.Screen
  name="notifications"
  options={{
    title: "Notifications",
    tabBarIcon: ({ color }) => (
      <MaterialCommunityIcons name="bell" color={color} size={24} />
    ),
    tabBarBadge:
      unreadCount > 0 ? (unreadCount > 99 ? "99+" : unreadCount) : undefined,
    tabBarBadgeStyle: { backgroundColor: GlobalStyles.colors.primary },
  }}
/>;
```

---

## 3.2 Notification Preferences (~1-2 days) 🟢 NO APPLE ACCOUNT NEEDED

> **Priority**: After 3.1 - fully testable on simulator/Android

### Settings Schema

```typescript
// Collection: users/{userId}/settings/notifications
interface NotificationSettings {
  // Master toggle
  pushEnabled: boolean;

  // Activity notifications
  followNotifications: boolean;
  likeNotifications: boolean;
  commentNotifications: boolean;
  mentionNotifications: boolean;
  repostNotifications: boolean;

  // Transfer notifications (always on - critical)
  transferNotifications: boolean; // readonly true

  // Event notifications
  eventReminders: boolean;

  // Marketing
  marketingNotifications: boolean;

  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "08:00"
  quietHoursTimezone: string; // "America/New_York"
}
```

### Implementation Checklist

- [x] **3.2.1** Create `src/services/notificationSettingsService.ts`
- [x] **3.2.2** Create `src/hooks/useNotificationSettings.ts`
- [x] **3.2.3** Create `src/components/ui/SettingsToggle.tsx`
- [x] **3.2.4** Create `src/components/ui/SettingsSection.tsx`
- [x] **3.2.5** Create `src/app/(app)/account/notifications.tsx`
- [x] **3.2.6** Add link from account screen to notification settings
- [x] **3.2.7** Cloud Functions already respect quiet hours ✅

### File: `src/services/notificationSettingsService.ts`

```typescript
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase/firebase";

export interface NotificationSettings {
  pushEnabled: boolean;
  followNotifications: boolean;
  likeNotifications: boolean;
  commentNotifications: boolean;
  mentionNotifications: boolean;
  repostNotifications: boolean;
  transferNotifications: boolean;
  eventReminders: boolean;
  marketingNotifications: boolean;
  quietHoursEnabled: boolean;
  quietHoursStart: string;
  quietHoursEnd: string;
  quietHoursTimezone: string;
}

const DEFAULT_SETTINGS: NotificationSettings = {
  pushEnabled: true,
  followNotifications: true,
  likeNotifications: true,
  commentNotifications: true,
  mentionNotifications: true,
  repostNotifications: true,
  transferNotifications: true, // Cannot be disabled
  eventReminders: true,
  marketingNotifications: false,
  quietHoursEnabled: false,
  quietHoursStart: "22:00",
  quietHoursEnd: "08:00",
  quietHoursTimezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
};

/**
 * Get notification settings for a user
 */
export async function getNotificationSettings(
  userId: string,
): Promise<NotificationSettings> {
  const docRef = doc(db, "users", userId, "settings", "notifications");
  const snapshot = await getDoc(docRef);

  if (!snapshot.exists()) {
    // Initialize with defaults
    await setDoc(docRef, {
      ...DEFAULT_SETTINGS,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return DEFAULT_SETTINGS;
  }

  return { ...DEFAULT_SETTINGS, ...snapshot.data() } as NotificationSettings;
}

/**
 * Update notification settings
 */
export async function updateNotificationSettings(
  userId: string,
  updates: Partial<NotificationSettings>,
): Promise<void> {
  // Ensure transferNotifications can't be disabled
  if (updates.transferNotifications === false) {
    delete updates.transferNotifications;
  }

  const docRef = doc(db, "users", userId, "settings", "notifications");
  await setDoc(
    docRef,
    {
      ...updates,
      updatedAt: serverTimestamp(),
    },
    { merge: true },
  );
}
```

### File: `src/components/ui/SettingsToggle.tsx`

```typescript
import React from "react";
import { View, Text, Switch, StyleSheet } from "react-native";
import { GlobalStyles } from "../../constants/styles";

interface SettingsToggleProps {
  label: string;
  description?: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  disabled?: boolean;
}

export function SettingsToggle({
  label,
  description,
  value,
  onValueChange,
  disabled = false,
}: SettingsToggleProps) {
  return (
    <View style={[styles.container, disabled && styles.disabled]}>
      <View style={styles.textContainer}>
        <Text style={styles.label}>{label}</Text>
        {description && <Text style={styles.description}>{description}</Text>}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled}
        trackColor={{
          false: GlobalStyles.colors.grey6,
          true: GlobalStyles.colors.primary,
        }}
        thumbColor="#FFFFFF"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: GlobalStyles.colors.background,
    borderBottomWidth: 1,
    borderBottomColor: GlobalStyles.colors.border,
  },
  disabled: {
    opacity: 0.5,
  },
  textContainer: {
    flex: 1,
    marginRight: 12,
  },
  label: {
    fontSize: 16,
    color: GlobalStyles.colors.text,
  },
  description: {
    fontSize: 13,
    color: GlobalStyles.colors.textSecondary,
    marginTop: 2,
  },
});

export default SettingsToggle;
```

### File: `src/components/ui/SettingsSection.tsx`

```typescript
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { GlobalStyles } from "../../constants/styles";

interface SettingsSectionProps {
  title: string;
  children: React.ReactNode;
}

export function SettingsSection({ title, children }: SettingsSectionProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 24,
  },
  title: {
    fontSize: 13,
    fontWeight: "600",
    color: GlobalStyles.colors.textSecondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  content: {
    borderTopWidth: 1,
    borderTopColor: GlobalStyles.colors.border,
  },
});

export default SettingsSection;
```

---

## 3.3 FCM Push Notifications (~2-3 days) 🟡 APPLE ACCOUNT NEEDED FOR iOS

> **Note**: Build this after 3.1/3.2. Test on Android while waiting for Apple enrollment.

### Why FCM Over Expo Push?

| Feature              | Expo Push        | FCM          |
| -------------------- | ---------------- | ------------ |
| Background delivery  | Limited          | Full support |
| Data-only messages   | No               | Yes          |
| Topic subscriptions  | Via wrapper      | Native       |
| Analytics            | Limited          | Full         |
| Consistency with web | Different tokens | Same system  |

### Prerequisites

- [x] Apple Developer enrollment complete ✅
- [ ] Download `GoogleService-Info.plist` from Firebase Console
- [x] Upload APNs Key to Firebase (Project Settings > Cloud Messaging) ✅

### 3.3.1 Android Verification Scope 🤖

To ensure robust Android Notification delivery, the following scope must be verified:

#### 1. Build Configuration 🏗️

- [x] **Manifest Conflict Resolution**: Ensure `AndroidManifest.xml` includes `tools:replace="android:resource"` in `<meta-data>` tags to resolve conflicts between Expo and Firebase.
- [x] **Google Services Plugin**: Verify `com.google.gms:google-services` is applied in `android/app/build.gradle`.
- [x] **Firebase Config**: Ensure `google-services.json` is present in `android/app/`.

#### 2. Runtime Configuration ⚙️

- [x] **Notification Channels**: Android 8.0+ (Oreo) **requires** notification channels.
  - _Action_: Ensure `Notifications.setNotificationChannelAsync` is called on app launch.
  - _Config_: Set Importance to `MAX` to ensure heads-up display.
- [x] **Service Initialization**: Ensure `pushNotificationService.ts` lazily loads Firebase Messaging to avoid crash on non-native environments (Expo Go), though primarily relevant for dev builds.

#### 3. Simulator/Device Environment 📱

- [x] **Google Play Services**: Using an Android Emulator with "Google Play" icon is mandatory. A standard AOSP emulator will **fail** to register FCM tokens.
- [x] **Play Store Login**: Must login to Google Play Store on the emulator to activate background services.
- [x] **Verification**: Run `npx expo run:android` and check terminal logs for `FCM token registered successfully`.

#### 4. Test Scenarios (Manual) 🧪

| State          | Method        | Expected Outcome                                                        |
| -------------- | ------------- | ----------------------------------------------------------------------- |
| **Foreground** | App Open      | In-app alert/banner shows immediately.                                  |
| **Background** | App Minimized | System tray notification appears. Tapping opens app.                    |
| **Quit**       | App Killed    | System tray notification appears. Tapping cold-starts app to deep link. |

### Installation

```bash
npx expo install expo-notifications @react-native-firebase/app @react-native-firebase/messaging
```

### Expo Config Updates

```json
// app.json additions
{
  "expo": {
    "plugins": [
      "@react-native-firebase/app",
      [
        "expo-notifications",
        {
          "icon": "./assets/notification-icon.png",
          "color": "#000000"
        }
      ]
    ],
    "ios": {
      "googleServicesFile": "./GoogleService-Info.plist"
    }
  }
}
```

### Implementation Checklist

- [x] **3.3.1** Install `@react-native-firebase/app` and `@react-native-firebase/messaging`
- [x] **3.3.2** Add `GoogleService-Info.plist` for iOS (after Apple enrollment)
- [x] **3.3.3** Update app.json with plugins
- [x] **3.3.4** Create `src/services/pushNotificationService.ts`
- [x] **3.3.5** Setup foreground handler in `_layout.tsx`
- [x] **3.3.6** Setup background handler (top-level)
- [x] **3.3.7** Store FCM tokens in Firestore (devices collection)
- [x] **3.3.8** Cloud Functions already send via FCM (admin.messaging)
- [ ] **3.3.9** Test on Android physical device
- [x] **3.3.10** Test on iOS physical device (requires Apple account) ✅

### File: `src/services/pushNotificationService.ts`

```typescript
import messaging from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { Platform } from "react-native";
import { db } from "../firebase/firebase";

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Request notification permissions and get FCM token
 */
export async function registerForPushNotifications(
  userId: string,
): Promise<string | null> {
  // Request permission
  const authStatus = await messaging().requestPermission();
  const enabled =
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL;

  if (!enabled) {
    console.log("Notification permission denied");
    return null;
  }

  // Get FCM token
  const fcmToken = await messaging().getToken();

  // Store in Firestore
  await setDoc(
    doc(db, "users", userId, "tokens", "fcm"),
    {
      token: fcmToken,
      platform: Platform.OS,
      lastUpdated: serverTimestamp(),
    },
    { merge: true },
  );

  // Listen for token refresh
  messaging().onTokenRefresh(async (newToken) => {
    await setDoc(
      doc(db, "users", userId, "tokens", "fcm"),
      {
        token: newToken,
        lastUpdated: serverTimestamp(),
      },
      { merge: true },
    );
  });

  return fcmToken;
}

/**
 * Subscribe to topic-based notifications
 */
export async function subscribeToTopic(topic: string): Promise<void> {
  await messaging().subscribeToTopic(topic);
}

export async function unsubscribeFromTopic(topic: string): Promise<void> {
  await messaging().unsubscribeFromTopic(topic);
}

/**
 * Handle foreground messages
 */
export function setupForegroundHandler(): () => void {
  const unsubscribe = messaging().onMessage(async (remoteMessage) => {
    // Show local notification
    await Notifications.scheduleNotificationAsync({
      content: {
        title: remoteMessage.notification?.title || "RageState",
        body: remoteMessage.notification?.body || "",
        data: remoteMessage.data,
      },
      trigger: null, // Show immediately
    });
  });

  return unsubscribe;
}

/**
 * Handle background/quit messages
 */
export function setupBackgroundHandler(): void {
  messaging().setBackgroundMessageHandler(async (remoteMessage) => {
    console.log("Background message:", remoteMessage);
    // Handle data-only messages, update badges, etc.
  });
}
```

### Notification Types

| Type                       | Trigger            | Deep Link                          |
| -------------------------- | ------------------ | ---------------------------------- |
| `ticket_transfer_received` | Transfer received  | `ragestate://transfer/claim?t=...` |
| `ticket_transfer_claimed`  | Recipient claimed  | `ragestate://events/my-events`     |
| `new_follower`             | Someone followed   | `ragestate://profile/{userId}`     |
| `post_liked`               | Someone liked post | `ragestate://post/{postId}`        |
| `comment_added`            | New comment        | `ragestate://post/{postId}`        |
| `mention`                  | @mentioned         | `ragestate://post/{postId}`        |

---

## 3.4 Google Sign-In (~1-2 days) 🟡 APPLE ACCOUNT NEEDED FOR iOS

> **Note**: Build this last. Test on Android while waiting for Apple enrollment.

### Installation

```bash
npx expo install @react-native-google-signin/google-signin
```

### Configuration

```json
// app.json additions
{
  "expo": {
    "plugins": [
      [
        "@react-native-google-signin/google-signin",
        {
          "iosUrlScheme": "com.googleusercontent.apps.YOUR_IOS_CLIENT_ID"
        }
      ]
    ]
  }
}
```

### Prerequisites

- [ ] Apple Developer enrollment complete ⏳ (for iOS testing)
- [ ] Get Web Client ID from Firebase Console (Authentication > Sign-in method > Google)
- [ ] Get iOS Client ID from Google Cloud Console

### Implementation Checklist

- [x] **3.4.1** Install `@react-native-google-signin/google-signin`
- [x] **3.4.2** Get web client ID from Firebase Console
- [x] **3.4.3** Get iOS client ID from Google Cloud Console
- [x] **3.4.4** Update app.json with plugin config
- [x] **3.4.5** Create `src/services/googleAuthService.ts`
- [x] **3.4.6** Add Google button to login screen
- [x] **3.4.7** Add Google button to signup screen
- [x] **3.4.8** Handle new user profile setup flow
- [ ] **3.4.9** Test on Android device
- [x] **3.4.10** Test on iOS device (verified) ✅

### File: `src/services/googleAuthService.ts`

```typescript
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import {
  GoogleAuthProvider,
  signInWithCredential,
  UserCredential,
} from "firebase/auth";
import { auth } from "../firebase/firebase";

// Configure (call once at app startup)
GoogleSignin.configure({
  webClientId: "YOUR_WEB_CLIENT_ID", // From Firebase Console
  offlineAccess: true,
  iosClientId: "YOUR_IOS_CLIENT_ID", // From Google Cloud Console
});

export async function signInWithGoogle(): Promise<UserCredential> {
  try {
    // Check Play Services (Android)
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });

    // Get Google credentials
    const { idToken } = await GoogleSignin.signIn();

    if (!idToken) {
      throw new Error("No ID token returned");
    }

    // Create Firebase credential
    const credential = GoogleAuthProvider.credential(idToken);

    // Sign in to Firebase
    return signInWithCredential(auth, credential);
  } catch (error: any) {
    if (error.code === statusCodes.SIGN_IN_CANCELLED) {
      throw new Error("Sign in cancelled");
    } else if (error.code === statusCodes.IN_PROGRESS) {
      throw new Error("Sign in already in progress");
    } else if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
      throw new Error("Play Services not available");
    }
    throw error;
  }
}

export async function signOutGoogle(): Promise<void> {
  await GoogleSignin.signOut();
}

export function initializeGoogleSignIn(
  webClientId: string,
  iosClientId?: string,
): void {
  GoogleSignin.configure({
    webClientId,
    iosClientId,
    offlineAccess: true,
  });
}
```

---

## Analytics Events

| Event                               | Properties              |
| ----------------------------------- | ----------------------- |
| `notification_feed_viewed`          | unread_count            |
| `notification_tapped`               | type, action_url        |
| `notification_marked_read`          | notification_type       |
| `notifications_mark_all_read`       | count                   |
| `notification_settings_changed`     | setting_name, new_value |
| `notification_permission_requested` | -                       |
| `notification_permission_granted`   | -                       |
| `notification_permission_denied`    | -                       |
| `fcm_token_registered`              | platform                |
| `google_signin_started`             | -                       |
| `google_signin_completed`           | is_new_user             |
| `google_signin_failed`              | error_code              |

---

## Success Criteria

### 3.1 In-App Feed (No Apple Account) ✅ COMPLETE

- [x] Notification feed shows all types
- [x] Unread badge displays on tab bar
- [x] Tap navigates to correct screen
- [x] Mark as read works
- [x] Mark all read works
- [x] Real-time updates work

### 3.2 Preferences (No Apple Account) ✅ COMPLETE

- [x] Settings screen accessible from account
- [x] Toggle states persist
- [x] Quiet hours configurable

### 3.3 FCM Push ✅ COMPLETE - BOTH PLATFORMS VERIFIED

- [x] FCM tokens registered and stored
- [x] Push notifications received in foreground (Android) ✅
- [x] Push notifications received in background (Android) ✅
- [x] Push notifications work on iOS ✅

### 3.4 Google Sign-In ✅ COMPLETE - BOTH PLATFORMS VERIFIED

- [x] Google Sign-In works on Android ✅
- [x] Google Sign-In works on iOS ✅
- [x] New users redirected to profile setup

---

## Files to Create

```
src/
├── app/(app)/
│   ├── notifications/
│   │   ├── _layout.tsx
│   │   └── index.tsx
│   └── account/
│       └── notifications.tsx    # Settings
├── components/
│   ├── notifications/
│   │   ├── NotificationCard.tsx
│   │   ├── EmptyNotifications.tsx
│   │   └── index.ts
│   └── ui/
│       ├── SettingsToggle.tsx
│       └── SettingsSection.tsx
├── services/
│   ├── inAppNotificationService.ts
│   ├── notificationSettingsService.ts
│   ├── pushNotificationService.ts      # 3.3
│   └── googleAuthService.ts            # 3.4
└── hooks/
    ├── useNotificationBadge.ts
    └── useNotificationSettings.ts
```

---

## Quick Reference

### 3.1 In-App Notification Feed (START HERE)

- [ ] 3.1.1 Create `useNotificationBadge.ts`
- [ ] 3.1.2 Create `inAppNotificationService.ts`
- [ ] 3.1.3 Create `NotificationCard.tsx`
- [ ] 3.1.4 Create `EmptyNotifications.tsx`
- [ ] 3.1.5 Create notifications barrel export
- [ ] 3.1.6 Create notifications `_layout.tsx`
- [ ] 3.1.7 Create notifications `index.tsx`
- [ ] 3.1.8 Update app `_layout.tsx` with tab + badge
- [ ] 3.1.9 Add "Mark all read" action

### 3.2 Notification Preferences

- [ ] 3.2.1 Create `notificationSettingsService.ts`
- [ ] 3.2.2 Create `useNotificationSettings.ts`
- [ ] 3.2.3 Create `SettingsToggle.tsx`
- [ ] 3.2.4 Create `SettingsSection.tsx`
- [ ] 3.2.5 Create account notifications screen
- [ ] 3.2.6 Add link from account screen

### 3.3 FCM Push Notifications

- [x] 3.3.1 Install Firebase packages
- [x] 3.3.2 Add `GoogleService-Info.plist` (Apple account)
- [x] 3.3.3 Update app.json
- [x] 3.3.4 Create `pushNotificationService.ts`
- [x] 3.3.5-3.3.6 Setup handlers
- [x] 3.3.7-3.3.8 Token storage & Cloud Functions
- [ ] 3.3.9 Test Android (Pending)
- [x] 3.3.10 Test iOS (Apple account) ✅

### 3.4 Google Sign-In

- [x] 3.4.1-3.4.4 Install & configure
- [x] 3.4.5 Create `googleAuthService.ts`
- [x] 3.4.6-3.4.8 UI integration
- [x] 3.4.9 Test Android ✅
- [x] 3.4.10 Test iOS ✅

---

## Migration Notes

### From Expo Push to FCM

1. Both systems can coexist temporarily
2. Store FCM token alongside Expo token
3. Update Cloud Functions to prefer FCM
4. Deprecate Expo token storage after migration
5. Remove Expo Push token code after full rollout
