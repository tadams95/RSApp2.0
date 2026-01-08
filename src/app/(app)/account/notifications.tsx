import { Ionicons } from "@expo/vector-icons";
import { Stack, useRouter } from "expo-router";
import React, { useEffect } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { usePostHog } from "../../../analytics/PostHogProvider";
import { SettingsSection, SettingsToggle } from "../../../components/ui";
import { GlobalStyles } from "../../../constants/styles";
import { useNotificationSettings } from "../../../hooks/useNotificationSettings";
import { NotificationSettings } from "../../../services/notificationSettingsService";

/**
 * NotificationSettingsScreen - Manage notification preferences
 * Allows users to control which notifications they receive and when
 */
export default function NotificationSettingsScreen() {
  const router = useRouter();
  const posthog = usePostHog();
  const { settings, isLoading, error, updateSetting, refetch } =
    useNotificationSettings();

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
            headerStyle: { backgroundColor: "#000" },
            headerTintColor: "#fff",
            headerLeft: () => (
              <Pressable
                onPress={() => router.back()}
                style={styles.backButton}
              >
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </Pressable>
            ),
          }}
        />
        <ActivityIndicator size="large" color={GlobalStyles.colors.primary} />
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
            headerStyle: { backgroundColor: "#000" },
            headerTintColor: "#fff",
            headerLeft: () => (
              <Pressable
                onPress={() => router.back()}
                style={styles.backButton}
              >
                <Ionicons name="chevron-back" size={24} color="#fff" />
              </Pressable>
            ),
          }}
        />
        <Ionicons name="alert-circle-outline" size={48} color="#ff6b6b" />
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
          headerStyle: { backgroundColor: "#000" },
          headerTintColor: "#fff",
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
              <Ionicons name="chevron-back" size={24} color="#fff" />
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
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
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  loadingText: {
    color: "#999",
    fontSize: 14,
    fontFamily,
    marginTop: 12,
  },
  errorContainer: {
    flex: 1,
    backgroundColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  errorText: {
    color: "#ff6b6b",
    fontSize: 16,
    fontFamily,
    textAlign: "center",
    marginTop: 12,
    marginBottom: 20,
  },
  retryButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    backgroundColor: "#222",
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#444",
  },
  retryButtonText: {
    color: "#fff",
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
    backgroundColor: "#111",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#333",
  },
  footerText: {
    color: "#666",
    fontSize: 13,
    fontFamily,
    lineHeight: 18,
    textAlign: "center",
  },
});
