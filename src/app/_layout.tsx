import { QueryClientProvider } from "@tanstack/react-query";
import { Image } from "expo-image";
import * as Linking from "expo-linking";
import { router, Slot, SplashScreen } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import React, { useEffect, useState } from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
  LogBox,
  StyleSheet,
  View,
} from "react-native";
import { PaperProvider } from "react-native-paper";
import { Provider } from "react-redux";
import { PostHogProvider } from "../analytics/PostHogProvider";
import ErrorBoundary from "../components/ErrorBoundary";
import { queryClient } from "../config/reactQuery";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";
import { AuthProvider } from "../hooks/AuthContext";
import { MusicPlayerProvider } from "../hooks/MusicPlayerContext";
import { SoundCloudPlayerProvider } from "../hooks/SoundCloudPlayerContext";
import { initializeAppCheck } from "../services/appCheckService";
import {
  setupBackgroundHandler,
  setupForegroundHandler,
} from "../services/pushNotificationService";
import { store } from "../store/redux/store";
import {
  handleMemoryPressure,
  initializeImageCache,
} from "../utils/imageCacheConfig";
import { imagePreloader } from "../utils/imagePreloader";
import { initializeOfflineCartSync } from "../utils/offlineCartSync";

// Setup FCM background handler - MUST be called at module level (outside components)
setupBackgroundHandler();

// Suppress PostHog's getCurrentRoute error logs (harmless navigation tracking incompatibility with Expo Router)
LogBox.ignoreLogs([
  "getCurrentRoute is not a function",
  "Warning: getCurrentRoute is not a function",
  "getCurrentRoute error",
  "navigation.getCurrentRoute is not a function",
  "TypeError: navigation.getCurrentRoute is not a function",
]);

// Override console.error to suppress PostHog getCurrentRoute errors
const originalConsoleError = console.error;
console.error = (...args) => {
  const message = args.join(" ");
  if (
    message.includes("getCurrentRoute") ||
    message.includes("navigation.getCurrentRoute is not a function")
  ) {
    // Suppress PostHog getCurrentRoute errors - these are harmless
    return;
  }
  originalConsoleError(...args);
};

// Prevent auto-hide of splash screen
SplashScreen.preventAutoHideAsync().catch(() => {
  // If we can't prevent the splash screen from hiding, it's not fatal
  console.warn("Unable to prevent splash screen from auto-hiding");
});

// Named export for root component registration with Expo Router
export function Root() {
  return null;
}

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  // Initialize image cache and preload critical images
  useEffect(() => {
    const initializeImageSystem = async () => {
      try {
        // Initialize image cache configuration
        initializeImageCache();

        // Initialize Firebase App Check for security
        await initializeAppCheck();

        // Preload critical images for better UX
        await imagePreloader.preloadCriticalImages();

        if (__DEV__) {
          const status = imagePreloader.getPreloadStatus();
          console.log(
            `Image preloading complete: ${status.loaded}/${status.total} images cached`
          );
        }
      } catch (error) {
        console.error("Failed to initialize image system:", error);
      }
    };

    initializeImageSystem();
  }, []);

  // Handle memory pressure events and session tracking
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "background") {
        // Clear memory cache when app goes to background to free up memory
        handleMemoryPressure();
      }
    };

    const subscription = AppState.addEventListener(
      "change",
      handleAppStateChange
    );
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    // Hide custom splash screen after a timeout
    const timer = setTimeout(() => {
      setShowSplash(false);
      SplashScreen.hideAsync().catch(() => {
        console.warn("Failed to hide splash screen");
      });
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") {
      checkForUpdates();

      // Check for updates when app returns to foreground
      const subscription = AppState.addEventListener(
        "change",
        (nextAppState) => {
          if (nextAppState === "active") {
            checkForUpdates();
          }
        }
      );

      return () => subscription.remove();
    }
  }, []);

  async function checkForUpdates() {
    try {
      const update = await Updates.checkForUpdateAsync();

      if (update.isAvailable) {
        Alert.alert(
          "Update Available",
          "A new version is available. Would you like to update now?",
          [
            { text: "Later", style: "cancel" },
            {
              text: "Update",
              onPress: async () => {
                try {
                  await Updates.fetchUpdateAsync();
                  await Updates.reloadAsync();
                } catch (error) {
                  console.log("Error fetching or reloading update:", error);
                }
              },
            },
          ]
        );
      }
    } catch (error) {
      console.log("Error checking for updates:", error);
    }
  }

  useEffect(() => {
    // Initialize offline cart sync when app starts
    initializeOfflineCartSync();
  }, []);

  // Setup FCM foreground message handler
  useEffect(() => {
    const unsubscribe = setupForegroundHandler();
    return () => unsubscribe();
  }, []);

  // Deep link handler for transfer claim URLs
  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      try {
        const parsed = Linking.parse(event.url);
        console.log("Deep link received:", parsed);

        // Handle transfer claim URLs
        // ragestate://transfer/{transferId}?token={claimToken}
        // OR web: https://ragestate.com/claim-ticket?t={claimToken}
        if (
          parsed.path?.includes("transfer") ||
          parsed.path?.includes("claim-ticket") ||
          parsed.path?.includes("claim")
        ) {
          const transferId = parsed.queryParams?.id as string | undefined;
          const token = (parsed.queryParams?.token || parsed.queryParams?.t) as
            | string
            | undefined;

          if (token) {
            // Navigate to claim screen with token
            router.push({
              pathname: "/(app)/transfer/claim",
              params: { token, transferId: transferId || "" },
            });
          }
        }
      } catch (error) {
        console.error("Error handling deep link:", error);
      }
    };

    // Listen for deep links while app is open
    const subscription = Linking.addEventListener("url", handleDeepLink);

    // Check if app was opened from a deep link
    Linking.getInitialURL().then((url) => {
      if (url) {
        handleDeepLink({ url });
      }
    });

    return () => subscription.remove();
  }, []);

  if (showSplash) {
    return (
      <View style={styles.splashContainer}>
        <Image
          source={require("../assets/RSLogo2025.png")}
          style={styles.logo}
          contentFit="contain"
        />
      </View>
    );
  }

  return (
    <PostHogProvider>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <PaperProvider>
            <ErrorBoundary
              onError={(error, errorInfo) => {
                // Log any errors to your monitoring service here
                console.error("Root error boundary caught error:", error);
              }}
            >
              <ThemeProvider>
                <AuthProvider>
                  <MusicPlayerProvider>
                    <SoundCloudPlayerProvider>
                      <ThemedAppContainer />
                    </SoundCloudPlayerProvider>
                  </MusicPlayerProvider>
                </AuthProvider>
              </ThemeProvider>
            </ErrorBoundary>
          </PaperProvider>
        </QueryClientProvider>
      </Provider>
    </PostHogProvider>
  );
}

/**
 * ThemedAppContainer
 * Inner component that can access the ThemeContext
 */
function ThemedAppContainer() {
  const { theme, isDark } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.bgRoot }}>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Slot />
    </View>
  );
}

const styles = StyleSheet.create({
  splashContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#000",
  },
  logo: {
    width: 200,
    height: 200,
  },
});
