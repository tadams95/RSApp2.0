import { Slot, SplashScreen } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import React, { useEffect, useState } from "react";
import { Alert, AppState, Image, StyleSheet, View } from "react-native";
import { PaperProvider } from "react-native-paper";
import { Provider } from "react-redux";
import ErrorBoundary from "../components/ErrorBoundary";
import { AuthProvider } from "../hooks/AuthContext";
import { store } from "../store/redux/store";
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
          resizeMode="contain"
        />
      </View>
    );
  }

  return (
    <Provider store={store}>
      <PaperProvider>
        <ErrorBoundary
          onError={(error, errorInfo) => {
            // Log any errors to your monitoring service here
            console.error("Root error boundary caught error:", error);
          }}
        >
          <AuthProvider>
            <View style={{ flex: 1, backgroundColor: "#000" }}>
              <StatusBar style="light" />
              <Slot />
            </View>
          </AuthProvider>
        </ErrorBoundary>
      </PaperProvider>
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
