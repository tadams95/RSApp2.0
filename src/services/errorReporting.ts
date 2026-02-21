/**
 * Firebase Crashlytics Error Reporting Service
 * Free, unlimited crash reporting integrated with Firebase
 *
 * Note: Crashlytics requires a native build (not Expo Go).
 * If running in Expo Go or an old dev build, functions gracefully no-op.
 */

// Lazy-load crashlytics to avoid crash on import
let crashlyticsInstance: ReturnType<
  typeof import("@react-native-firebase/crashlytics").default
> | null = null;

function getCrashlytics() {
  if (crashlyticsInstance === null) {
    try {
      // Dynamic import to avoid crash if native module isn't available
      const crashlytics = require("@react-native-firebase/crashlytics").default;
      crashlyticsInstance = crashlytics();
    } catch (error) {
      if (__DEV__) {
        console.warn(
          "[Crashlytics] Native module not available. Run a development build to enable crash reporting.",
        );
      }
      return null;
    }
  }
  return crashlyticsInstance;
}

/**
 * Initialize Crashlytics error reporting
 * Call this once at app startup in _layout.tsx
 */
export function initializeErrorReporting(): void {
  const crashlytics = getCrashlytics();
  if (!crashlytics) return;

  // Enable/disable collection based on environment
  // In production, we always want to collect errors
  // In dev, we usually disable it to avoid noise, but can enable it for testing
  const enableCollection = !__DEV__;
  crashlytics.setCrashlyticsCollectionEnabled(enableCollection);

  if (__DEV__) {
    console.log(
      `[Crashlytics] Initialized (collection ${enableCollection ? "ENABLED" : "DISABLED"})`,
    );
  }
}

type ErrorContext = Record<string, string | number | boolean | null | undefined>;

/**
 * Capture an exception and send to Crashlytics
 */
export function captureException(
  error: Error,
  context?: ErrorContext,
): void {
  // Always log to console in dev
  if (__DEV__) {
    console.error("[Crashlytics]", error, context);
  }

  const crashlytics = getCrashlytics();
  if (!crashlytics) return;

  // Add context as custom attributes
  if (context) {
    Object.entries(context).forEach(([key, value]) => {
      if (typeof value === "string") {
        crashlytics.setAttribute(key, value);
      } else if (typeof value === "number" || typeof value === "boolean") {
        crashlytics.setAttribute(key, String(value));
      } else if (value !== null && value !== undefined) {
        crashlytics.setAttribute(key, JSON.stringify(value));
      }
    });
  }

  crashlytics.recordError(error);
}

/**
 * Log a message to Crashlytics (appears in crash reports)
 */
export function captureMessage(message: string): void {
  const crashlytics = getCrashlytics();
  if (!crashlytics) return;

  crashlytics.log(message);
}

/**
 * Set user context for error tracking
 * Call on login/logout to associate errors with users
 */
export function setUser(userId: string | null, email?: string): void {
  const crashlytics = getCrashlytics();
  if (!crashlytics) return;

  if (userId) {
    crashlytics.setUserId(userId);
    if (email) {
      crashlytics.setAttribute("email", email);
    }
  } else {
    // Clear user on logout
    crashlytics.setUserId("");
    crashlytics.setAttribute("email", "");
  }
}

/**
 * Add breadcrumb/log for debugging context
 * These appear in the Crashlytics logs section of crash reports
 */
export function addBreadcrumb(
  message: string,
  category?: string,
  data?: ErrorContext,
): void {
  const crashlytics = getCrashlytics();
  if (!crashlytics) return;

  const logMessage = category ? `[${category}] ${message}` : message;

  if (data) {
    crashlytics.log(`${logMessage} | ${JSON.stringify(data)}`);
  } else {
    crashlytics.log(logMessage);
  }
}

/**
 * Set a custom attribute for crash reports
 */
export function setAttribute(key: string, value: string): void {
  const crashlytics = getCrashlytics();
  if (!crashlytics) return;

  crashlytics.setAttribute(key, value);
}

/**
 * Wrapper for async operations with automatic error capture
 */
export async function withErrorCapture<T>(
  operation: () => Promise<T>,
  context: string,
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    captureException(error as Error, { context });
    throw error;
  }
}
