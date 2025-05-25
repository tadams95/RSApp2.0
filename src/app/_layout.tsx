import { Slot, SplashScreen } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as Updates from "expo-updates";
import React, { useEffect } from "react";
import { Alert, AppState, View } from "react-native";
import { Provider } from "react-redux";
import { AuthProvider } from "../hooks/AuthContext";
import { store } from "../store/redux/store";

// Import named exports for component registration
import { auth } from "./(auth)/_layout";
import { app } from "./(app)/_layout";
import { guest } from "./(guest)/_layout";

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
  useEffect(() => {
    // Hide splash screen after a timeout for a smoother launch experience
    const timer = setTimeout(() => {
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

  return (
    <Provider store={store}>
      <AuthProvider>
        <View style={{ flex: 1, backgroundColor: "#000" }}>
          <StatusBar style="light" />
          <Slot />
        </View>
      </AuthProvider>
    </Provider>
  );
}
