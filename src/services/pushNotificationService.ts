import * as Notifications from "expo-notifications";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { Platform, NativeModules } from "react-native";
import { db } from "../firebase/firebase";

// Lazy-loaded Firebase messaging to avoid crashes in Expo Go
let messagingModule:
  | typeof import("@react-native-firebase/messaging").default
  | null = null;
let FirebaseMessagingTypes:
  | typeof import("@react-native-firebase/messaging").FirebaseMessagingTypes
  | null = null;

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
 * Check if Firebase messaging is available and load it lazily
 * Returns the messaging function if available, null otherwise
 */
function getFirebaseMessaging():
  | typeof import("@react-native-firebase/messaging").default
  | null {
  if (messagingModule !== null) {
    return messagingModule;
  }

  try {
    // EXTRA SAFETY: Check if native module exists before requiring
    // This prevents "Invariant Violation: new NativeEventEmitter()" crashes
    const nativeModuleExists = 
      NativeModules.RNFBMessagingModule || 
      NativeModules.RNFirebaseMessaging;

    if (!nativeModuleExists) {
      console.log("RNFirebaseMessaging native module not found - skipping (are you in Expo Go?)");
      return null;
    }

    // Dynamically require Firebase messaging
    const firebaseMessaging =
      require("@react-native-firebase/messaging").default;
    
    // Test if native module is available by calling it
    // (This double-check handles cases where NativeModule exists but init fails)
    if (firebaseMessaging) {
        firebaseMessaging();
        messagingModule = firebaseMessaging;
        return messagingModule;
    }
    return null;
  } catch (error) {
    console.log(
      "Firebase messaging not available (running in Expo Go?):",
      error
    );
    return null;
  }
}

/**
 * Check if Firebase messaging is available (not available in Expo Go)
 */
function isFirebaseMessagingAvailable(): boolean {
  return getFirebaseMessaging() !== null;
}

/**
 * Request notification permissions and get FCM token
 * Stores token in Firestore for Cloud Functions to send push notifications
 */
export async function registerForPushNotifications(
  userId: string
): Promise<string | null> {
  const messaging = getFirebaseMessaging();

  // Skip if Firebase messaging is not available (e.g., running in Expo Go)
  if (!messaging) {
    console.log("Firebase messaging not available - skipping FCM registration");
    return null;
  }

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
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return () => {};
  }

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
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    console.log(
      "Firebase messaging not available - skipping topic subscription"
    );
    return;
  }

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
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    console.log(
      "Firebase messaging not available - skipping topic unsubscription"
    );
    return;
  }

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
  const messaging = getFirebaseMessaging();

  // Skip if Firebase messaging is not available (e.g., running in Expo Go)
  if (!messaging) {
    console.log(
      "Firebase messaging not available - skipping foreground handler"
    );
    return () => {}; // Return no-op unsubscribe
  }

  try {
    const unsubscribe = messaging().onMessage(async (remoteMessage: any) => {
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
    });

    return unsubscribe;
  } catch (error) {
    console.warn("Failed to setup foreground handler:", error);
    return () => {};
  }
}

/**
 * Handle notification opened while app was in background/quit
 * Returns the initial notification if app was opened from one
 */
export async function getInitialNotification(): Promise<any | null> {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return null;
  }
  try {
    const initialNotification = await messaging().getInitialNotification();
    return initialNotification;
  } catch {
    return null;
  }
}

/**
 * Handle notification tap when app is in background
 */
export function setupNotificationOpenedHandler(
  onNotificationOpened: (remoteMessage: any) => void
): () => void {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return () => {};
  }
  try {
    const unsubscribe =
      messaging().onNotificationOpenedApp(onNotificationOpened);
    return unsubscribe;
  } catch {
    return () => {};
  }
}

/**
 * Setup background message handler
 * MUST be called outside of React component (at module level)
 * This handles messages when app is in background or terminated
 */
export function setupBackgroundHandler(): void {
  const messaging = getFirebaseMessaging();

  // Skip if Firebase messaging is not available (e.g., running in Expo Go)
  if (!messaging) {
    console.log(
      "Firebase messaging not available - skipping background handler setup"
    );
    return;
  }

  try {
    messaging().setBackgroundMessageHandler(async (remoteMessage: any) => {
      console.log("Background FCM message received:", remoteMessage);

      // Handle data-only messages here
      // Note: notification messages are automatically displayed by the system

      // You can update badges, sync data, etc.
      if (remoteMessage.data?.badgeCount) {
        await Notifications.setBadgeCountAsync(
          parseInt(remoteMessage.data.badgeCount as string, 10) || 0
        );
      }
    });
  } catch (error) {
    console.warn("Failed to setup background handler:", error);
  }
}

/**
 * Check if app has notification permission
 */
export async function hasNotificationPermission(): Promise<boolean> {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return false;
  }
  try {
    const authStatus = await messaging().hasPermission();
    return (
      authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
      authStatus === messaging.AuthorizationStatus.PROVISIONAL
    );
  } catch {
    return false;
  }
}

/**
 * Delete FCM token (for logout/account deletion)
 */
export async function unregisterPushNotifications(
  userId: string
): Promise<void> {
  const messaging = getFirebaseMessaging();
  if (!messaging) {
    return;
  }
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
