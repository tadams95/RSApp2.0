import messaging, {
  FirebaseMessagingTypes,
} from "@react-native-firebase/messaging";
import * as Notifications from "expo-notifications";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Platform } from "react-native";
import { db } from "../firebase/firebase";

// Configure expo-notifications handler for foreground display
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Request notification permissions and get FCM token
 * Stores token in Firestore for Cloud Functions to send push notifications
 */
export async function registerForPushNotifications(
  userId: string
): Promise<string | null> {
  try {
    // Request permission (iOS prompts user, Android auto-grants)
    const authStatus = await messaging().requestPermission();
    const enabled =
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL;

    if (!enabled) {
      console.log("Push notification permission denied");
      return null;
    }

    // Get FCM token
    const fcmToken = await messaging().getToken();

    if (!fcmToken) {
      console.warn("Failed to get FCM token");
      return null;
    }

    // Store token in Firestore devices collection (matches Cloud Functions expectation)
    // Using token hash as document ID to prevent duplicates
    const tokenHash = fcmToken.substring(0, 20);
    await setDoc(
      doc(db, "users", userId, "devices", tokenHash),
      {
        token: fcmToken,
        provider: "fcm",
        platform: Platform.OS,
        enabled: true,
        lastUpdated: serverTimestamp(),
        deviceInfo: {
          os: Platform.OS,
          version: Platform.Version,
        },
      },
      { merge: true }
    );

    console.log("FCM token registered successfully");
    return fcmToken;
  } catch (error) {
    console.error("Error registering for push notifications:", error);
    return null;
  }
}

/**
 * Listen for FCM token refresh events
 * Tokens can change when app data is cleared, reinstalled, etc.
 */
export function setupTokenRefreshListener(userId: string): () => void {
  const unsubscribe = messaging().onTokenRefresh(async (newToken) => {
    try {
      const tokenHash = newToken.substring(0, 20);
      await setDoc(
        doc(db, "users", userId, "devices", tokenHash),
        {
          token: newToken,
          provider: "fcm",
          platform: Platform.OS,
          enabled: true,
          lastUpdated: serverTimestamp(),
        },
        { merge: true }
      );
      console.log("FCM token refreshed and stored");
    } catch (error) {
      console.error("Error storing refreshed FCM token:", error);
    }
  });

  return unsubscribe;
}

/**
 * Subscribe to topic-based notifications (e.g., new events)
 */
export async function subscribeToTopic(topic: string): Promise<void> {
  try {
    await messaging().subscribeToTopic(topic);
    console.log(`Subscribed to topic: ${topic}`);
  } catch (error) {
    console.error(`Error subscribing to topic ${topic}:`, error);
    throw error;
  }
}

/**
 * Unsubscribe from topic-based notifications
 */
export async function unsubscribeFromTopic(topic: string): Promise<void> {
  try {
    await messaging().unsubscribeFromTopic(topic);
    console.log(`Unsubscribed from topic: ${topic}`);
  } catch (error) {
    console.error(`Error unsubscribing from topic ${topic}:`, error);
    throw error;
  }
}

/**
 * Handle foreground messages - displays local notification
 * Call this in your app's root layout useEffect
 */
export function setupForegroundHandler(): () => void {
  const unsubscribe = messaging().onMessage(
    async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log("Foreground FCM message received:", remoteMessage);

      // Show local notification using expo-notifications
      await Notifications.scheduleNotificationAsync({
        content: {
          title: remoteMessage.notification?.title || "RageState",
          body: remoteMessage.notification?.body || "",
          data: remoteMessage.data || {},
          sound: "default",
        },
        trigger: null, // Show immediately
      });
    }
  );

  return unsubscribe;
}

/**
 * Handle notification opened while app was in background/quit
 * Returns the initial notification if app was opened from one
 */
export async function getInitialNotification(): Promise<FirebaseMessagingTypes.RemoteMessage | null> {
  const initialNotification = await messaging().getInitialNotification();
  return initialNotification;
}

/**
 * Handle notification tap when app is in background
 */
export function setupNotificationOpenedHandler(
  onNotificationOpened: (
    remoteMessage: FirebaseMessagingTypes.RemoteMessage
  ) => void
): () => void {
  const unsubscribe = messaging().onNotificationOpenedApp(onNotificationOpened);
  return unsubscribe;
}

/**
 * Setup background message handler
 * MUST be called outside of React component (at module level)
 * This handles messages when app is in background or terminated
 */
export function setupBackgroundHandler(): void {
  messaging().setBackgroundMessageHandler(
    async (remoteMessage: FirebaseMessagingTypes.RemoteMessage) => {
      console.log("Background FCM message received:", remoteMessage);

      // Handle data-only messages here
      // Note: notification messages are automatically displayed by the system

      // You can update badges, sync data, etc.
      if (remoteMessage.data?.badgeCount) {
        await Notifications.setBadgeCountAsync(
          parseInt(remoteMessage.data.badgeCount as string, 10) || 0
        );
      }
    }
  );
}

/**
 * Check if app has notification permission
 */
export async function hasNotificationPermission(): Promise<boolean> {
  const authStatus = await messaging().hasPermission();
  return (
    authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
    authStatus === messaging.AuthorizationStatus.PROVISIONAL
  );
}

/**
 * Delete FCM token (for logout/account deletion)
 */
export async function unregisterPushNotifications(
  userId: string
): Promise<void> {
  try {
    await messaging().deleteToken();
    // Optionally delete token from Firestore
    await setDoc(
      doc(db, "users", userId, "tokens", "fcm"),
      {
        token: null,
        lastUpdated: serverTimestamp(),
        deleted: true,
      },
      { merge: true }
    );
    console.log("FCM token deleted");
  } catch (error) {
    console.error("Error deleting FCM token:", error);
  }
}
