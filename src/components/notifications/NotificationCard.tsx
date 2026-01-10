import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Timestamp } from "firebase/firestore";
import React from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import type { Notification } from "../../services/inAppNotificationService";

interface NotificationCardProps {
  notification: Notification;
  onPress: (notification: Notification) => void;
}

// Map notification types to icons and colors
// IMPORTANT: These semantic colors are intentionally preserved for notification type identification
const TYPE_ICONS: Record<string, { name: string; color: string }> = {
  post_liked: { name: "heart", color: "#FF4757" },
  comment_added: { name: "comment", color: "#3498db" },
  new_follower: { name: "account-plus", color: "#2ecc71" },
  mention: { name: "at", color: "#9b59b6" },
  post_reposted: { name: "repeat", color: "#1abc9c" },
  ticket_transfer_sent: { name: "send", color: "#FF3C00" }, // accent
  ticket_transfer_received: { name: "ticket", color: "#FF3C00" }, // accent
  ticket_transfer_claimed: { name: "check-circle", color: "#2ecc71" },
  ticket_transfer_cancelled: { name: "close-circle", color: "#e74c3c" },
};

const DEFAULT_ICON = { name: "bell", color: "#666666" }; // textTertiary equivalent

/**
 * Format timestamp to relative time string
 */
function formatRelativeTime(timestamp: Timestamp | null | undefined): string {
  if (!timestamp) return "";

  const now = new Date();
  const date = timestamp.toDate();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;

  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function NotificationCard({
  notification,
  onPress,
}: NotificationCardProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const iconConfig = TYPE_ICONS[notification.type] || DEFAULT_ICON;

  return (
    <TouchableOpacity
      style={[styles.card, !notification.read && styles.unread]}
      onPress={() => onPress(notification)}
      activeOpacity={0.7}
    >
      <View
        style={[
          styles.iconContainer,
          { backgroundColor: iconConfig.color + "20" },
        ]}
      >
        <MaterialCommunityIcons
          name={iconConfig.name as any}
          size={22}
          color={iconConfig.color}
        />
      </View>

      <View style={styles.content}>
        <Text style={styles.title} numberOfLines={1}>
          {notification.title}
        </Text>
        <Text style={styles.body} numberOfLines={2}>
          {notification.body}
        </Text>
        <Text style={styles.time}>
          {formatRelativeTime(notification.createdAt)}
        </Text>
      </View>

      {!notification.read && <View style={styles.unreadDot} />}
    </TouchableOpacity>
  );
}

const createStyles = (theme: import("../../constants/themes").Theme) =>
  ({
    card: {
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 14,
      paddingHorizontal: 16,
      backgroundColor: theme.colors.bgElev1,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.borderSubtle,
    },
    unread: {
      backgroundColor: `${theme.colors.accent}0D`, // 5% opacity
    },
    iconContainer: {
      width: 44,
      height: 44,
      borderRadius: 22,
      justifyContent: "center",
      alignItems: "center",
      marginRight: 12,
    },
    content: {
      flex: 1,
    },
    title: {
      fontSize: 15,
      fontWeight: "600",
      color: theme.colors.textPrimary,
      marginBottom: 2,
    },
    body: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      lineHeight: 20,
      marginBottom: 4,
    },
    time: {
      fontSize: 12,
      color: theme.colors.textTertiary,
    },
    unreadDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
      backgroundColor: theme.colors.accent,
      marginLeft: 8,
    },
  } as const);

export default NotificationCard;
