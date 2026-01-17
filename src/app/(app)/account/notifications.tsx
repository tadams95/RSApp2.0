import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import { getFunctions, httpsCallable } from "firebase/functions";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Text,
  View,
} from "react-native";
import { usePostHog } from "../../../analytics/PostHogProvider";
import { SettingsSection, SettingsToggle } from "../../../components/ui";
import { useTheme } from "../../../contexts/ThemeContext";
import { useNotificationSettings } from "../../../hooks/useNotificationSettings";
import { useThemedStyles } from "../../../hooks/useThemedStyles";
import { NotificationSettings } from "../../../services/notificationSettingsService";

/**
 * NotificationSettingsScreen - Manage notification preferences
 * Allows users to control which notifications they receive and when
 */
export default function NotificationSettingsScreen() {
  const router = useRouter();
  const posthog = usePostHog();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { settings, isLoading, error, updateSetting, refetch } =
    useNotificationSettings();
  const [isSendingTest, setIsSendingTest] = useState(false);

  // Handle test push notification
  const handleTestPush = async () => {
    setIsSendingTest(true);
    try {
      const functions = getFunctions();
      const testSendPush = httpsCallable<
        { title?: string; body?: string },
        { success: boolean; devicesFound: number; fcmTokens?: number; error?: string; fcmResult?: { successCount: number; failureCount: number }; errors?: string[] }
      >(functions, "testSendPush");

      const result = await testSendPush({
        title: "🎉 Test Notification",
        body: "Push notifications are working! You're all set.",
      });

      const data = result.data;
      console.log("Test push result:", JSON.stringify(data, null, 2));

      if (data.success) {
        let message = `Push notification sent!\n\nDevices: ${data.devicesFound}\nFCM Tokens: ${data.fcmTokens}\nDelivered: ${data.fcmResult?.successCount || 0}`;
        if (data.fcmResult?.failureCount && data.fcmResult.failureCount > 0) {
          message += `\nFailed: ${data.fcmResult.failureCount}`;
          if (data.errors && data.errors.length > 0) {
            message += `\nErrors: ${data.errors.join(", ")}`;
          }
        }
        Alert.alert("Success!", message);
        posthog.capture("test_push_notification_success", {
          devices_found: data.devicesFound,
          fcm_tokens: data.fcmTokens,
        });
      } else {
        Alert.alert(
          "Test Failed",
          data.error 
            ? `${data.error}\n\nUser ID: ${data.queriedUid || "unknown"}`
            : `Server returned failure with no error message.\nResponse: ${JSON.stringify(data)}`
        );
        posthog.capture("test_push_notification_failed", {
          error: data.error,
          devices_found: data.devicesFound,
        });
      }
    } catch (err: any) {
      console.error("Test push failed:", err);
      Alert.alert(
        "Error",
        err.message || "Failed to send test notification. Please try again."
      );
      posthog.capture("test_push_notification_error", {
        error: err.message,
      });
    } finally {
      setIsSendingTest(false);
    }
  };

  // Clear all device registrations and re-register
  const handleClearDevices = async () => {
    setIsSendingTest(true);
    try {
      const { auth } = await import("../../../firebase/firebase");
      const { collection, getDocs, deleteDoc, doc, setDoc, serverTimestamp } = await import("firebase/firestore");
      const { db } = await import("../../../firebase/firebase");
      const { Platform } = await import("react-native");

      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert("Error", "Not logged in");
        setIsSendingTest(false);
        return;
      }

      // Delete all existing devices
      const devicesRef = collection(db, "users", userId, "devices");
      const snapshot = await getDocs(devicesRef);
      
      let deleted = 0;
      for (const docSnap of snapshot.docs) {
        await deleteDoc(docSnap.ref);
        deleted++;
      }

      Alert.alert("Cleared", `Removed ${deleted} old device registrations.\n\nNow tap "Register This Device" to set up push notifications.`);

    } catch (err: any) {
      console.error("Clear devices failed:", err);
      Alert.alert("Error", err.message || "Failed to clear devices");
    } finally {
      setIsSendingTest(false);
    }
  };

  // Register this device for push notifications
  const handleRegisterDevice = async () => {
    setIsSendingTest(true);
    try {
      const { auth } = await import("../../../firebase/firebase");
      const { doc, setDoc, serverTimestamp } = await import("firebase/firestore");
      const { db } = await import("../../../firebase/firebase");
      const { Platform, Linking } = await import("react-native");

      const userId = auth.currentUser?.uid;
      if (!userId) {
        Alert.alert("Error", "Not logged in");
        setIsSendingTest(false);
        return;
      }

      // Step 1: Check if Firebase messaging is available
      let messaging: any;
      try {
        const messagingModule = require("@react-native-firebase/messaging");
        messaging = messagingModule.default;
        
        // Check if native module exists before calling
        if (!messaging || typeof messaging !== "function") {
          throw new Error("Messaging module not available");
        }
        
        // Check if the app instance can be created (this is where it fails in Expo Go)
        const app = messaging();
        if (!app || !app.requestPermission) {
          throw new Error("Native module not linked");
        }
      } catch (e: any) {
        console.log("Firebase messaging check failed:", e.message);
        Alert.alert(
          "Development Build Required",
          "Push notifications require a development build.\n\nYou appear to be running in Expo Go, which doesn't support native Firebase modules.\n\nRun: npx expo run:ios\nor: npx expo run:android"
        );
        setIsSendingTest(false);
        return;
      }

      // Step 2: Request permission - THIS will trigger iOS permission dialog
      console.log("Requesting notification permission...");
      const authStatus = await messaging().requestPermission();
      console.log("Permission result:", authStatus);
      
      const AuthorizationStatus = messaging.AuthorizationStatus;
      
      if (authStatus === AuthorizationStatus.DENIED) {
        Alert.alert(
          "Permission Denied",
          "Notification permission was denied.\n\nTo enable notifications:\n1. Open Settings app\n2. Find RAGESTATE\n3. Tap Notifications\n4. Enable Allow Notifications",
          [
            { text: "Cancel", style: "cancel" },
            { text: "Open Settings", onPress: () => Linking.openSettings() }
          ]
        );
        setIsSendingTest(false);
        return;
      }

      const enabled = 
        authStatus === AuthorizationStatus.AUTHORIZED ||
        authStatus === AuthorizationStatus.PROVISIONAL;

      if (!enabled) {
        Alert.alert(
          "Permission Issue",
          `Unexpected permission status: ${authStatus}\n\nPlease try again or check your device settings.`
        );
        setIsSendingTest(false);
        return;
      }

      // Step 3: Get FCM token
      console.log("Getting FCM token...");
      const fcmToken = await messaging().getToken();
      console.log("FCM Token:", fcmToken ? `${fcmToken.substring(0, 20)}...` : "null");

      if (!fcmToken) {
        Alert.alert(
          "Token Error",
          "Failed to get FCM token.\n\nThis could be:\n• Network issue\n• APNs not configured\n\nPlease check your internet connection and try again."
        );
        setIsSendingTest(false);
        return;
      }

      // Step 4: Store token in Firestore
      console.log("Storing token in Firestore...");
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

      Alert.alert(
        "✅ Device Registered!",
        "Push notifications are now enabled.\n\nTap 'Send Test Notification' to verify it works!"
      );

      posthog.capture("device_registered_for_push", {
        platform: Platform.OS,
      });

    } catch (err: any) {
      console.error("Registration error:", err);
      Alert.alert(
        "Registration Failed",
        `Error: ${err.message}\n\nCode: ${err.code || "unknown"}`
      );
    } finally {
      setIsSendingTest(false);
    }
  };

  // Track screen view
  useEffect(() => {
    posthog.capture("notification_settings_viewed");
  }, [posthog]);

  // Handle setting toggle with analytics
  const handleToggle = async (
    key: keyof NotificationSettings,
    value: boolean
  ) => {
    await updateSetting(key, value);

    posthog.capture("notification_setting_changed", {
      setting_key: key,
      new_value: value,
    });
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: "Notifications",
            headerStyle: { backgroundColor: theme.colors.bgRoot },
            headerTintColor: theme.colors.textPrimary,
            headerLeft: () => (
              <Pressable
                onPress={() => router.back()}
                style={styles.backButton}
              >
                <Ionicons
                  name="chevron-back"
                  size={24}
                  color={theme.colors.textPrimary}
                />
              </Pressable>
            ),
          }}
        />
        <ActivityIndicator size="large" color={theme.colors.accent} />
        <Text style={styles.loadingText}>Loading settings...</Text>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Stack.Screen
          options={{
            headerShown: true,
            headerTitle: "Notifications",
            headerStyle: { backgroundColor: theme.colors.bgRoot },
            headerTintColor: theme.colors.textPrimary,
            headerLeft: () => (
              <Pressable
                onPress={() => router.back()}
                style={styles.backButton}
              >
                <Ionicons
                  name="chevron-back"
                  size={24}
                  color={theme.colors.textPrimary}
                />
              </Pressable>
            ),
          }}
        />
        <Ionicons
          name="alert-circle-outline"
          size={48}
          color={theme.colors.danger}
        />
        <Text style={styles.errorText}>{error.message}</Text>
        <Pressable style={styles.retryButton} onPress={refetch}>
          <Text style={styles.retryButtonText}>Try Again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTitle: "Notifications",
          headerStyle: { backgroundColor: theme.colors.bgRoot },
          headerTintColor: theme.colors.textPrimary,
          headerTitleStyle: {
            fontWeight: "700",
            fontFamily: Platform.select({
              ios: "Helvetica Neue",
              android: "Roboto",
              default: "system",
            }),
          },
          headerLeft: () => (
            <Pressable onPress={() => router.back()} style={styles.backButton}>
              <Ionicons
                name="chevron-back"
                size={24}
                color={theme.colors.textPrimary}
              />
            </Pressable>
          ),
        }}
      />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Push Notifications Master Toggle */}
        <SettingsSection
          title="Push Notifications"
          description="Control all push notifications for this device"
        >
          <SettingsToggle
            label="Enable Push Notifications"
            description="Receive alerts on your device"
            value={settings.pushEnabled}
            onValueChange={(value) => handleToggle("pushEnabled", value)}
          />
        </SettingsSection>

        {/* Activity Notifications */}
        <SettingsSection
          title="Activity"
          description="Notifications about social activity"
        >
          <SettingsToggle
            label="Likes"
            description="When someone likes your post"
            value={settings.likeNotifications}
            onValueChange={(value) => handleToggle("likeNotifications", value)}
            disabled={!settings.pushEnabled}
          />
          <SettingsToggle
            label="Comments"
            description="When someone comments on your post"
            value={settings.commentNotifications}
            onValueChange={(value) =>
              handleToggle("commentNotifications", value)
            }
            disabled={!settings.pushEnabled}
          />
          <SettingsToggle
            label="Follows"
            description="When someone follows you"
            value={settings.followNotifications}
            onValueChange={(value) =>
              handleToggle("followNotifications", value)
            }
            disabled={!settings.pushEnabled}
          />
          <SettingsToggle
            label="Mentions"
            description="When someone mentions you"
            value={settings.mentionNotifications}
            onValueChange={(value) =>
              handleToggle("mentionNotifications", value)
            }
            disabled={!settings.pushEnabled}
          />
          <SettingsToggle
            label="Reposts"
            description="When someone reposts your content"
            value={settings.repostNotifications}
            onValueChange={(value) =>
              handleToggle("repostNotifications", value)
            }
            disabled={!settings.pushEnabled}
          />
        </SettingsSection>

        {/* Transfer Notifications */}
        <SettingsSection
          title="Ticket Transfers"
          description="Important notifications about your tickets"
        >
          <SettingsToggle
            label="Transfer Notifications"
            description="Incoming and outgoing ticket transfers (always on for security)"
            value={true}
            onValueChange={() => {}}
            disabled={true}
          />
        </SettingsSection>

        {/* Event Notifications */}
        <SettingsSection title="Events" description="Stay updated about events">
          <SettingsToggle
            label="Event Reminders"
            description="Reminders before events you're attending"
            value={settings.eventReminders}
            onValueChange={(value) => handleToggle("eventReminders", value)}
            disabled={!settings.pushEnabled}
          />
        </SettingsSection>

        {/* Quiet Hours */}
        <SettingsSection
          title="Quiet Hours"
          description="Pause notifications during certain hours"
        >
          <SettingsToggle
            label="Enable Quiet Hours"
            description="Pause notifications from 10 PM to 8 AM"
            value={settings.quietHoursEnabled}
            onValueChange={(value) => handleToggle("quietHoursEnabled", value)}
            disabled={!settings.pushEnabled}
          />
        </SettingsSection>

        {/* Test Push Notification */}
        <SettingsSection
          title="Test Notifications"
          description="Verify push notifications are working"
        >
          <Pressable
            style={[
              styles.testButton,
              isSendingTest && styles.testButtonDisabled,
            ]}
            onPress={handleTestPush}
            disabled={isSendingTest}
          >
            {isSendingTest ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <>
                <Ionicons name="notifications" size={20} color="#fff" style={{ marginRight: 8 }} />
                <Text style={styles.testButtonText}>Send Test Notification</Text>
              </>
            )}
          </Pressable>

          {/* Register Device Button */}
          <Pressable
            style={[
              styles.registerButton,
              isSendingTest && styles.testButtonDisabled,
            ]}
            onPress={handleRegisterDevice}
            disabled={isSendingTest}
          >
            <Ionicons name="phone-portrait-outline" size={20} color="#fff" style={{ marginRight: 8 }} />
            <Text style={styles.testButtonText}>Register This Device</Text>
          </Pressable>

          {/* Clear Devices Button */}
          <Pressable
            style={[
              styles.clearButton,
              isSendingTest && styles.testButtonDisabled,
            ]}
            onPress={handleClearDevices}
            disabled={isSendingTest}
          >
            <Ionicons name="trash-outline" size={20} color={theme.colors.danger} style={{ marginRight: 8 }} />
            <Text style={[styles.clearButtonText, { color: theme.colors.danger }]}>Clear Old Devices</Text>
          </Pressable>
        </SettingsSection>

        {/* Info Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Ticket transfer notifications cannot be disabled for security
            reasons. You will always be notified of incoming and outgoing
            transfers.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const fontFamily = Platform.select({
  ios: "Helvetica Neue",
  android: "Roboto",
  default: "system",
});

const createStyles = (theme: import("../../../constants/themes").Theme) =>
  ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bgRoot,
    },
    scrollView: {
      flex: 1,
    },
    scrollContent: {
      padding: 20,
      paddingBottom: 40,
    },
    loadingContainer: {
      flex: 1,
      backgroundColor: theme.colors.bgRoot,
      alignItems: "center",
      justifyContent: "center",
    },
    loadingText: {
      color: theme.colors.textSecondary,
      fontSize: 14,
      fontFamily,
      marginTop: 12,
    },
    errorContainer: {
      flex: 1,
      backgroundColor: theme.colors.bgRoot,
      alignItems: "center",
      justifyContent: "center",
      padding: 20,
    },
    errorText: {
      color: theme.colors.danger,
      fontSize: 16,
      fontFamily,
      textAlign: "center",
      marginTop: 12,
      marginBottom: 20,
    },
    retryButton: {
      paddingHorizontal: 24,
      paddingVertical: 12,
      backgroundColor: theme.colors.bgElev2,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: theme.colors.borderStrong,
    },
    retryButtonText: {
      color: theme.colors.textPrimary,
      fontSize: 14,
      fontWeight: "600",
      fontFamily,
    },
    backButton: {
      padding: 8,
      marginLeft: -8,
    },
    footer: {
      marginTop: 16,
      padding: 16,
      backgroundColor: theme.colors.bgElev1,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.borderSubtle,
    },
    footerText: {
      color: theme.colors.textTertiary,
      fontSize: 13,
      fontFamily,
      lineHeight: 18,
      textAlign: "center",
    },
    testButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.accent,
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 10,
      marginTop: 8,
    },
    testButtonDisabled: {
      opacity: 0.6,
    },
    testButtonText: {
      color: "#fff",
      fontSize: 16,
      fontWeight: "600",
      fontFamily,
    },
    registerButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: theme.colors.success || "#22c55e",
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 10,
      marginTop: 12,
    },
    clearButton: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: "transparent",
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderRadius: 10,
      marginTop: 12,
      borderWidth: 1,
      borderColor: theme.colors.danger,
    },
    clearButtonText: {
      fontSize: 14,
      fontWeight: "600",
      fontFamily,
    },
  } as const);
