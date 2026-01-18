import React from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import type { ChatSummary } from "../../types/chat";
import type { Theme } from "../../constants/themes";

interface ChatListItemProps {
  chat: ChatSummary;
  onPress: () => void;
}

/**
 * Format relative time for chat list display
 */
function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "now";
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  return date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export const ChatListItem: React.FC<ChatListItemProps> = ({ chat, onPress }) => {
  const styles = useThemedStyles(createStyles);

  const displayName = chat.type === "event" ? chat.eventName : chat.peerName;
  const photoURL = chat.type === "event" ? null : chat.peerPhoto;
  const hasUnread = chat.unreadCount > 0;

  return (
    <TouchableOpacity style={styles.container} onPress={onPress}>
      {/* Avatar */}
      <View style={styles.avatarContainer}>
        {photoURL ? (
          <Image source={{ uri: photoURL }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatar, styles.avatarPlaceholder]}>
            <Text style={styles.avatarText}>
              {chat.type === "event" ? "E" : displayName?.[0]?.toUpperCase() || "?"}
            </Text>
          </View>
        )}
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text
          style={[styles.name, hasUnread && styles.nameUnread]}
          numberOfLines={1}
        >
          {displayName || "Chat"}
        </Text>
        {chat.lastMessage && (
          <Text
            style={[styles.preview, hasUnread && styles.previewUnread]}
            numberOfLines={1}
          >
            {chat.lastMessage.text}
          </Text>
        )}
      </View>

      {/* Meta */}
      <View style={styles.meta}>
        {chat.lastMessage && (
          <Text style={styles.time}>
            {formatRelativeTime(chat.lastMessage.createdAt)}
          </Text>
        )}
        {hasUnread && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>
              {chat.unreadCount > 99 ? "99+" : chat.unreadCount}
            </Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: theme.colors.bgRoot,
  },
  avatarContainer: {
    marginRight: 12,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  avatarPlaceholder: {
    backgroundColor: theme.colors.bgElev2,
    justifyContent: "center" as const,
    alignItems: "center" as const,
  },
  avatarText: {
    fontSize: 18,
    fontWeight: "600" as const,
    color: theme.colors.textPrimary,
  },
  content: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    color: theme.colors.textPrimary,
    marginBottom: 2,
  },
  nameUnread: {
    fontWeight: "600" as const,
  },
  preview: {
    fontSize: 14,
    color: theme.colors.textSecondary,
  },
  previewUnread: {
    color: theme.colors.textPrimary,
  },
  meta: {
    alignItems: "flex-end" as const,
  },
  time: {
    fontSize: 12,
    color: theme.colors.textTertiary,
    marginBottom: 4,
  },
  badge: {
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: "center" as const,
    alignItems: "center" as const,
    paddingHorizontal: 6,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "600" as const,
    color: "#FFFFFF",
  },
});
