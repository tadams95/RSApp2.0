/**
 * Firebase App Check Service
 * Ensures only genuine apps can access Firebase services
 *
 * This protects against:
 * - API abuse
 * - Fake clients
 * - Replay attacks
 *
 * Setup Requirements:
 * 1. Install the package: npx expo install @react-native-firebase/app-check
 * 2. Configure iOS DeviceCheck in Firebase Console
 * 3. Configure Android Play Integrity in Firebase Console
 * 4. Enable enforcement on Firestore, Realtime Database, Storage, Functions
 *
 * Debug Mode:
 * For development, debug tokens are used. Add these to Firebase Console > App Check > Apps > Manage debug tokens
 */

// Debug token for development - set in .env file
// Generate a debug token in Firebase Console > App Check > Apps > Manage debug tokens
const DEBUG_TOKEN = process.env.EXPO_PUBLIC_APP_CHECK_DEBUG_TOKEN;

interface AppCheckConfig {
  /** Whether App Check has been initialized */
  initialized: boolean;
  /** Last initialization error, if any */
  error: Error | null;
  /** Whether native module is available */
  isAvailable: boolean;
}

const appCheckState: AppCheckConfig = {
  initialized: false,
  error: null,
  isAvailable: false,
};

/**
 * Get the App Check module if available
 * Returns null if the native module is not installed
 */
function getAppCheckModule() {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const appCheck = require("@react-native-firebase/app-check").default;
    return appCheck;
  } catch (error) {
    return null;
  }
}

/**
 * Initialize Firebase App Check
 *
 * Uses:
 * - DeviceCheck on iOS (production)
 * - Play Integrity on Android (production)
 * - Debug provider in development
 *
 * @returns Promise<void>
 */
export async function initializeAppCheck(): Promise<void> {
  // Skip if already initialized
  if (appCheckState.initialized) {
    console.log("App Check already initialized");
    return;
  }

  const appCheck = getAppCheckModule();

  if (!appCheck) {
    console.warn(
      "⚠️ Firebase App Check native module not available. " +
        "This is expected in Expo Go or if the native build doesn't include it. " +
        "App Check will be skipped."
    );
    appCheckState.isAvailable = false;
    return;
  }

  try {
    appCheckState.isAvailable = true;

    // Create the App Check provider
    const rnfbProvider = appCheck().newReactNativeFirebaseAppCheckProvider();

    // Configure the provider
    rnfbProvider.configure({
      android: {
        // Use Play Integrity in production, debug provider in development
        provider: __DEV__ ? "debug" : "playIntegrity",
        debugToken: __DEV__ ? DEBUG_TOKEN : undefined,
      },
      apple: {
        // Use DeviceCheck in production, debug provider in development
        provider: __DEV__ ? "debug" : "deviceCheck",
        debugToken: __DEV__ ? DEBUG_TOKEN : undefined,
      },
    });

    // Initialize App Check with the configured provider
    await appCheck().initializeAppCheck({
      provider: rnfbProvider,
      isTokenAutoRefreshEnabled: true,
    });

    appCheckState.initialized = true;
    appCheckState.error = null;

    if (__DEV__) {
      console.log("✅ Firebase App Check initialized (debug mode)");

      // Try to get and log the debug token for registration in Firebase Console
      try {
        const tokenResult = await appCheck().getToken(true);
        if (tokenResult?.token) {
          console.log("📋 App Check token retrieved successfully");
          // The debug token is logged by the native SDK - check Xcode/Android Studio logs
          console.log(
            "💡 If using debug provider, find the debug token in native logs (Xcode/Android Studio)"
          );
          console.log(
            "💡 Add the debug token to Firebase Console > App Check > Apps > Manage debug tokens"
          );
        }
      } catch (tokenError) {
        console.warn("Could not get App Check token:", tokenError);
      }
    }
  } catch (error) {
    appCheckState.error = error as Error;
    console.error("❌ Failed to initialize Firebase App Check:", error);

    // In production, we might want to handle this differently
    // For now, log the error but don't crash the app
    if (!__DEV__) {
      // Consider sending this to your error reporting service
      // captureException(error);
    }
  }
}

/**
 * Get the current App Check token
 * Useful for debugging or manual token validation
 *
 * @returns Promise with the token result or null if unavailable
 */
export async function getAppCheckToken(): Promise<string | null> {
  try {
    if (!appCheckState.initialized || !appCheckState.isAvailable) {
      console.warn("App Check not initialized or unavailable.");
      return null;
    }

    const appCheck = getAppCheckModule();
    if (!appCheck) return null;

    const result = await appCheck().getToken(true);
    return result.token;
  } catch (error) {
    console.error("Failed to get App Check token:", error);
    return null;
  }
}

/**
 * Check if App Check is initialized and working
 *
 * @returns Object with initialization status and any errors
 */
export function getAppCheckStatus(): AppCheckConfig {
  return { ...appCheckState };
}

/**
 * Force refresh the App Check token
 * Useful when you need to ensure you have a fresh token
 *
 * @returns Promise with the new token or null if refresh failed
 */
export async function refreshAppCheckToken(): Promise<string | null> {
  try {
    if (!appCheckState.initialized || !appCheckState.isAvailable) {
      console.warn("App Check not initialized or unavailable.");
      return null;
    }

    const appCheck = getAppCheckModule();
    if (!appCheck) return null;

    // Force refresh by passing true
    const result = await appCheck().getToken(true);
    return result.token;
  } catch (error) {
    console.error("Failed to refresh App Check token:", error);
    return null;
  }
}

/**
 * Listen for App Check token changes
 * Useful for debugging or monitoring token refreshes
 *
 * @param callback - Function to call when token changes
 * @returns Unsubscribe function
 */
export function onAppCheckTokenChanged(
  callback: (token: string | null) => void
): () => void {
  const appCheck = getAppCheckModule();

  if (!appCheck || !appCheckState.isAvailable) {
    return () => {}; // No-op unsubscribe
  }

  const unsubscribe = appCheck().onTokenChanged(
    (tokenResult: { token: string } | null) => {
      callback(tokenResult?.token || null);
    }
  );

  return unsubscribe;
}

export default {
  initializeAppCheck,
  getAppCheckToken,
  getAppCheckStatus,
  refreshAppCheckToken,
  onAppCheckTokenChanged,
};
