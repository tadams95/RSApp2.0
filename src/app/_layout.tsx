import { QueryClientProvider } from "@tanstack/react-query";
import { Image } from "expo-image";
import { Slot, SplashScreen } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import React, { useEffect, useState } from "react";
import {
  Alert,
  AppState,
  AppStateStatus,
  StyleSheet,
  View,
} from "react-native";
import { PaperProvider } from "react-native-paper";
import { Provider } from "react-redux";
import { AnalyticsProvider } from "../analytics/AnalyticsProvider";
import ErrorBoundary from "../components/ErrorBoundary";
import { queryClient } from "../config/reactQuery";
import { AuthProvider } from "../hooks/AuthContext";
import { store } from "../store/redux/store";
import {
  handleMemoryPressure,
  initializeImageCache,
} from "../utils/imageCacheConfig";
import { imagePreloader } from "../utils/imagePreloader";
import { initializeOfflineCartSync } from "../utils/offlineCartSync";

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

  // Handle memory pressure events
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
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <PaperProvider>
          <ErrorBoundary
            onError={(error, errorInfo) => {
              // Log any errors to your monitoring service here
              console.error("Root error boundary caught error:", error);
            }}
          >
            <AuthProvider>
              <AnalyticsProvider>
                <View style={{ flex: 1, backgroundColor: "#000" }}>
                  <StatusBar style="light" />
                  <Slot />
                </View>
              </AnalyticsProvider>
            </AuthProvider>
          </ErrorBoundary>
        </PaperProvider>
      </QueryClientProvider>
    </Provider>
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
