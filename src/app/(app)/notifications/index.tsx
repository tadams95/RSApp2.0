import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  usePostHog,
  useScreenTracking,
} from "../../../analytics/PostHogProvider";
import {
  EmptyNotifications,
  NotificationCard,
} from "../../../components/notifications";
import { useTheme } from "../../../contexts/ThemeContext";
import { auth } from "../../../firebase/firebase";
import { useAuth } from "../../../hooks/AuthContext";
import { useThemedStyles } from "../../../hooks/useThemedStyles";
import {
  markAllNotificationsRead,
  markNotificationRead,
  Notification,
  subscribeToNotifications,
} from "../../../services/inAppNotificationService";

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const posthog = usePostHog();
  const { authenticated } = useAuth();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [markingAllRead, setMarkingAllRead] = useState(false);

  // Track screen view
  useScreenTracking("Notifications", {
    notification_count: notifications.length,
    unread_count: notifications.filter((n) => !n.read).length,
  });

  // Subscribe to real-time notifications
  useEffect(() => {
    const currentUser = auth.currentUser;

    if (!authenticated || !currentUser?.uid) {
      setNotifications([]);
      setIsLoading(false);
      return;
    }

    const unsubscribe = subscribeToNotifications(
      currentUser.uid,
      (notifs) => {
        setNotifications(notifs);
        setIsLoading(false);
        setRefreshing(false);
      },
      (error) => {
        console.error("Error loading notifications:", error);
        setIsLoading(false);
        setRefreshing(false);
      }
    );

    // Track feed viewed
    posthog.capture("notification_feed_viewed", {
      user_id: currentUser.uid,
    });

    return unsubscribe;
  }, [authenticated, posthog]);

  // Handle pull-to-refresh
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    // The subscription will automatically update when data changes
    // This timeout ensures the refresh indicator shows
    setTimeout(() => setRefreshing(false), 500);
  }, []);

  // Handle notification tap
  const handleNotificationPress = useCallback(
    async (notification: Notification) => {
      const currentUser = auth.currentUser;
      if (!currentUser?.uid) return;

      // Track tap event
      posthog.capture("notification_tapped", {
        notification_id: notification.id,
        notification_type: notification.type,
        was_unread: !notification.read,
      });

      // Mark as read if unread
      if (!notification.read) {
        try {
          await markNotificationRead(currentUser.uid, notification.id);
        } catch (error) {
          console.error("Error marking notification as read:", error);
        }
      }

      // Navigate based on notification type
      const { data, type } = notification;

      if (data.postId) {
        router.push(`/social/post/${data.postId}`);
      } else if (data.transferId) {
        router.push(`/transfer/claim/${data.transferId}`);
      } else if (data.eventId) {
        router.push(`/events/${data.eventId}`);
      } else if (data.actorId) {
        router.push(`/notifications/profile/${data.actorId}`);
      }
    },
    [posthog, router]
  );

  // Handle mark all as read
  const handleMarkAllRead = useCallback(async () => {
    const unreadCount = notifications.filter((n) => !n.read).length;

    if (unreadCount === 0) {
      return;
    }

    setMarkingAllRead(true);

    try {
      const result = await markAllNotificationsRead();

      posthog.capture("notifications_mark_all_read", {
        updated_count: result.updated,
        remaining_unread: result.remainingUnread,
      });
    } catch (error) {
      console.error("Error marking all as read:", error);
      Alert.alert(
        "Error",
        "Failed to mark notifications as read. Please try again."
      );
    } finally {
      setMarkingAllRead(false);
    }
  }, [notifications, posthog]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderHeader = () => (
    <View style={styles.header}>
      <Text style={styles.headerTitle}>Notifications</Text>
      {unreadCount > 0 && (
        <TouchableOpacity
          onPress={handleMarkAllRead}
          disabled={markingAllRead}
          style={styles.markAllButton}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          {markingAllRead ? (
            <ActivityIndicator size="small" color={theme.colors.textPrimary} />
          ) : (
            <Text style={styles.markAllText}>Mark all read</Text>
          )}
        </TouchableOpacity>
      )}
    </View>
  );

  const renderNotification = ({ item }: { item: Notification }) => (
    <NotificationCard notification={item} onPress={handleNotificationPress} />
  );

  const keyExtractor = (item: Notification) => item.id;

  if (isLoading) {
    return (
      <View style={[styles.container, { paddingTop: insets.top }]}>
        {renderHeader()}
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={theme.colors.accent} />
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {renderHeader()}

      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={keyExtractor}
        contentContainerStyle={
          notifications.length === 0 ? styles.emptyListContent : undefined
        }
        ListEmptyComponent={<EmptyNotifications />}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={theme.colors.textPrimary}
            colors={[theme.colors.accent]}
          />
        }
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const createStyles = (theme: import("../../../constants/themes").Theme) =>
  ({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bgRoot,
    },
    header: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: theme.colors.borderSubtle,
    },
    headerTitle: {
      fontSize: 24,
      fontWeight: "700",
      color: theme.colors.textPrimary,
    },
    markAllButton: {
      paddingVertical: 6,
      paddingHorizontal: 12,
    },
    markAllText: {
      fontSize: 14,
      fontWeight: "500",
      color: theme.colors.accent,
    },
    loadingContainer: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    emptyListContent: {
      flex: 1,
    },
  } as const);
