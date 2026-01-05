# Phase 3: Notifications & Polish

> **Timeline**: 1-2 weeks | **Priority**: 🟡 Medium  
> **Dependencies**: Phase 1 & 2 (for notification types)  
> **Outcome**: Rich notification system, Google Sign-In, UI polish

---

## Overview

This phase focuses on enhancing the user experience through proper push notifications (FCM), Google Sign-In as an auth alternative, and in-app notification feeds.

---

## Current State

**What Works:**

- Expo Push Tokens stored in Firestore
- Basic notification permission handling
- `src/services/notificationService.ts` exists

**What's Missing:**

- FCM integration (required for background notifications)
- In-app notification feed
- Google Sign-In native integration
- Notification preferences/settings
- Badge count management

---

## 3.1 FCM Push Notifications (~3-4 days)

### Why FCM Over Expo Push?

| Feature              | Expo Push        | FCM          |
| -------------------- | ---------------- | ------------ |
| Background delivery  | Limited          | Full support |
| Data-only messages   | No               | Yes          |
| Topic subscriptions  | Via wrapper      | Native       |
| Analytics            | Limited          | Full         |
| Consistency with web | Different tokens | Same system  |

### Installation

```bash
npx expo install expo-notifications @react-native-firebase/app @react-native-firebase/messaging
```

### Firebase Config Updates

**iOS:** Download `GoogleService-Info.plist` from Firebase Console

**Android:** `google-services.json` already exists at project root

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

### Enhanced Notification Service

```typescript
// src/services/pushNotificationService.ts
import messaging from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
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
  userId: string
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
    { merge: true }
  );

  // Listen for token refresh
  messaging().onTokenRefresh(async (newToken) => {
    await setDoc(
      doc(db, "users", userId, "tokens", "fcm"),
      {
        token: newToken,
        lastUpdated: serverTimestamp(),
      },
      { merge: true }
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

### App Integration

```typescript
// src/app/_layout.tsx
import {
  setupForegroundHandler,
  setupBackgroundHandler,
  registerForPushNotifications,
} from "../services/pushNotificationService";

export default function RootLayout() {
  const { user } = useAuth();

  useEffect(() => {
    // Setup background handler (must be top-level)
    setupBackgroundHandler();
  }, []);

  useEffect(() => {
    if (user) {
      // Register and setup foreground
      registerForPushNotifications(user.uid);
      const unsubscribe = setupForegroundHandler();
      return unsubscribe;
    }
  }, [user]);

  // ...
}
```

### Notification Types

| Type               | Trigger                     | Action                |
| ------------------ | --------------------------- | --------------------- |
| `ticket_transfer`  | Transfer received           | Open claim screen     |
| `transfer_claimed` | Recipient claimed           | Show confirmation     |
| `event_reminder`   | 24h before event            | Open event detail     |
| `new_follower`     | Someone followed            | Open follower profile |
| `post_like`        | Someone liked post          | Open post             |
| `post_comment`     | New comment                 | Open post comments    |
| `new_event`        | Followed artist posts event | Open event            |

### Implementation Checklist

- [ ] Install `@react-native-firebase/app` and `@react-native-firebase/messaging`
- [ ] Add `GoogleService-Info.plist` for iOS
- [ ] Update app.json with plugins
- [ ] Create `pushNotificationService.ts`
- [ ] Setup foreground handler in `_layout.tsx`
- [ ] Setup background handler (top-level)
- [ ] Store FCM tokens in Firestore
- [ ] Test on physical device (emulators don't support FCM)
- [ ] Migrate from Expo Push tokens to FCM

---

## 3.2 In-App Notification Feed (~3-4 days)

### Firestore Schema

```typescript
// Collection: users/{userId}/notifications
interface InAppNotification {
  id: string;
  type: "follow" | "like" | "comment" | "transfer" | "event" | "system";
  title: string;
  body: string;
  imageUrl?: string; // Actor's profile photo
  actionUrl?: string; // Deep link path
  read: boolean;
  createdAt: Timestamp;
  // Type-specific data
  data: {
    actorId?: string; // Who triggered notification
    actorName?: string;
    postId?: string;
    eventId?: string;
    transferId?: string;
  };
}
```

### Notification Feed Route

```typescript
// src/app/(app)/notifications/index.tsx
export default function NotificationsScreen() {
  const { user } = useAuth();

  // Real-time notifications listener
  const { data: notifications, isLoading } = useQuery({
    queryKey: ["notifications", user?.uid],
    queryFn: () => getNotifications(user!.uid),
    enabled: !!user,
  });

  // Real-time updates via Firestore listener
  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(
      query(
        collection(db, "users", user.uid, "notifications"),
        orderBy("createdAt", "desc"),
        limit(50)
      ),
      (snapshot) => {
        // Update React Query cache
        queryClient.setQueryData(
          ["notifications", user.uid],
          snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }))
        );
      }
    );

    return unsubscribe;
  }, [user]);

  return (
    <FlatList
      data={notifications}
      renderItem={({ item }) => <NotificationCard notification={item} />}
      ListEmptyComponent={<EmptyNotifications />}
    />
  );
}
```

### Notification Card Component

```typescript
// src/components/notifications/NotificationCard.tsx
export function NotificationCard({ notification }: Props) {
  const router = useRouter();

  const handlePress = async () => {
    // Mark as read
    await markNotificationRead(notification.id);

    // Navigate to relevant screen
    if (notification.actionUrl) {
      router.push(notification.actionUrl);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.card, !notification.read && styles.unread]}
      onPress={handlePress}
    >
      {notification.imageUrl && (
        <Image source={{ uri: notification.imageUrl }} style={styles.avatar} />
      )}
      <View style={styles.content}>
        <Text style={styles.title}>{notification.title}</Text>
        <Text style={styles.body}>{notification.body}</Text>
        <Text style={styles.time}>
          {formatRelativeTime(notification.createdAt)}
        </Text>
      </View>
      {!notification.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}
```

### Badge Count

```typescript
// src/hooks/useNotificationBadge.ts
export function useNotificationBadge() {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!user) return;

    const unsubscribe = onSnapshot(
      query(
        collection(db, "users", user.uid, "notifications"),
        where("read", "==", false)
      ),
      (snapshot) => {
        setUnreadCount(snapshot.size);
        // Update app badge
        Notifications.setBadgeCountAsync(snapshot.size);
      }
    );

    return unsubscribe;
  }, [user]);

  return unreadCount;
}
```

### Tab Bar Badge

```typescript
// In src/app/(app)/_layout.tsx
export default function AppLayout() {
  const unreadCount = useNotificationBadge();

  return (
    <Tabs>
      <Tabs.Screen
        name="notifications"
        options={{
          tabBarBadge: unreadCount > 0 ? unreadCount : undefined,
          tabBarBadgeStyle: { backgroundColor: "#FF3B30" },
        }}
      />
    </Tabs>
  );
}
```

### Implementation Checklist

- [ ] Create Firestore notification schema
- [ ] Build `notifications/index.tsx` screen
- [ ] Create `NotificationCard` component
- [ ] Add real-time listener for notifications
- [ ] Implement `markNotificationRead` function
- [ ] Create `useNotificationBadge` hook
- [ ] Add badge to tab bar
- [ ] Sync badge count with app icon badge
- [ ] Add "Mark all read" action

---

## 3.3 Google Sign-In (~2-3 days)

### Installation

```bash
npx expo install @react-native-google-signin/google-signin expo-auth-session
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

### Google Sign-In Service

```typescript
// src/services/googleAuthService.ts
import {
  GoogleSignin,
  statusCodes,
} from "@react-native-google-signin/google-signin";
import { GoogleAuthProvider, signInWithCredential } from "firebase/auth";
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
```

### Login Screen Integration

```typescript
// src/app/(auth)/login.tsx additions
import { signInWithGoogle } from "../../services/googleAuthService";

export default function LoginScreen() {
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      setGoogleLoading(true);
      const result = await signInWithGoogle();

      // Check if new user needs profile setup
      const isNewUser = result.additionalUserInfo?.isNewUser;
      if (isNewUser) {
        router.replace("/profile/setup");
      } else {
        router.replace("/(app)");
      }
    } catch (error: any) {
      Alert.alert("Sign In Error", error.message);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <View>
      {/* Existing email/password form */}

      <View style={styles.divider}>
        <Text>or</Text>
      </View>

      <TouchableOpacity
        style={styles.googleButton}
        onPress={handleGoogleSignIn}
        disabled={googleLoading}
      >
        <GoogleLogo />
        <Text>Continue with Google</Text>
      </TouchableOpacity>
    </View>
  );
}
```

### Implementation Checklist

- [ ] Install `@react-native-google-signin/google-signin`
- [ ] Get iOS client ID from Google Cloud Console
- [ ] Get web client ID from Firebase Console
- [ ] Configure GoogleSignin at app startup
- [ ] Create `googleAuthService.ts`
- [ ] Add Google button to login screen
- [ ] Add Google button to signup screen
- [ ] Handle new user profile setup flow
- [ ] Test on iOS device
- [ ] Test on Android device

---

## 3.4 Notification Preferences (~1-2 days)

### Settings Schema

```typescript
// Collection: users/{userId}/settings/notifications
interface NotificationSettings {
  pushEnabled: boolean;

  // Notification types
  followNotifications: boolean;
  likeNotifications: boolean;
  commentNotifications: boolean;
  transferNotifications: boolean;
  eventReminders: boolean;
  marketingNotifications: boolean;

  // Quiet hours
  quietHoursEnabled: boolean;
  quietHoursStart: string; // "22:00"
  quietHoursEnd: string; // "08:00"
}
```

### Settings Screen

```typescript
// src/app/(app)/account/notifications.tsx
export default function NotificationSettingsScreen() {
  const { data: settings, isLoading } = useQuery({
    queryKey: ["notificationSettings"],
    queryFn: getNotificationSettings,
  });

  const updateMutation = useMutation({
    mutationFn: updateNotificationSettings,
    onSuccess: () => {
      queryClient.invalidateQueries(["notificationSettings"]);
    },
  });

  return (
    <ScrollView>
      <SettingsSection title="Push Notifications">
        <SettingsToggle
          label="Enable Push Notifications"
          value={settings?.pushEnabled}
          onValueChange={(v) => updateMutation.mutate({ pushEnabled: v })}
        />
      </SettingsSection>

      <SettingsSection title="Activity">
        <SettingsToggle
          label="New Followers"
          value={settings?.followNotifications}
          onValueChange={(v) =>
            updateMutation.mutate({ followNotifications: v })
          }
        />
        <SettingsToggle
          label="Likes"
          value={settings?.likeNotifications}
          onValueChange={(v) => updateMutation.mutate({ likeNotifications: v })}
        />
        {/* More toggles */}
      </SettingsSection>

      <SettingsSection title="Quiet Hours">
        <SettingsToggle
          label="Enable Quiet Hours"
          value={settings?.quietHoursEnabled}
          onValueChange={(v) => updateMutation.mutate({ quietHoursEnabled: v })}
        />
        {settings?.quietHoursEnabled && (
          <>
            <TimePicker label="Start" value={settings.quietHoursStart} />
            <TimePicker label="End" value={settings.quietHoursEnd} />
          </>
        )}
      </SettingsSection>
    </ScrollView>
  );
}
```

### Implementation Checklist

- [ ] Create notification settings schema
- [ ] Build settings UI screen
- [ ] Create toggle components
- [ ] Implement settings persistence
- [ ] Add link from account screen
- [ ] Sync settings to Cloud Functions for server-side filtering

---

## Analytics Events

| Event                               | Properties              |
| ----------------------------------- | ----------------------- |
| `notification_permission_requested` | -                       |
| `notification_permission_granted`   | -                       |
| `notification_permission_denied`    | -                       |
| `fcm_token_registered`              | platform                |
| `notification_received`             | type, source            |
| `notification_tapped`               | type, action_url        |
| `notification_feed_viewed`          | unread_count            |
| `notification_marked_read`          | notification_type       |
| `google_signin_started`             | -                       |
| `google_signin_completed`           | is_new_user             |
| `google_signin_failed`              | error_code              |
| `notification_settings_changed`     | setting_name, new_value |

---

## Success Criteria

- [ ] FCM tokens registered and stored
- [ ] Push notifications received in foreground
- [ ] Push notifications received in background
- [ ] Notification tap opens correct screen
- [ ] In-app notification feed shows all types
- [ ] Unread badge displays on tab bar
- [ ] App icon badge synced
- [ ] Google Sign-In works on iOS
- [ ] Google Sign-In works on Android
- [ ] Notification preferences saved
- [ ] Quiet hours respected

---

## Files to Create

```
src/
├── app/(app)/
│   ├── notifications/
│   │   └── index.tsx
│   └── account/
│       └── notifications.tsx    # Settings
├── components/notifications/
│   ├── NotificationCard.tsx
│   ├── EmptyNotifications.tsx
│   └── index.ts
├── services/
│   ├── pushNotificationService.ts
│   └── googleAuthService.ts
└── hooks/
    └── useNotificationBadge.ts
```

---

## Migration Notes

### From Expo Push to FCM

1. Both systems can coexist temporarily
2. Store FCM token alongside Expo token
3. Update Cloud Functions to prefer FCM
4. Deprecate Expo token storage after migration
5. Remove Expo Push token code after full rollout
