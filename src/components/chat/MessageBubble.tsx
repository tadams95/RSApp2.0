import React from "react";
import { Image, Text, View } from "react-native";
import { useThemedStyles } from "../../hooks/useThemedStyles";
import type { Message } from "../../types/chat";
import type { Theme } from "../../constants/themes";

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showSender?: boolean;
}

/**
 * Format time for message display (e.g., "2:30 PM")
 */
function formatMessageTime(date: Date): string {
  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({
  message,
  isOwn,
  showSender = false,
}) => {
  const styles = useThemedStyles(createStyles);

  return (
    <View style={[styles.container, isOwn ? styles.containerOwn : styles.containerOther]}>
      {showSender && !isOwn && (
        <View style={styles.senderRow}>
          {message.senderPhoto && (
            <Image source={{ uri: message.senderPhoto }} style={styles.senderPhoto} />
          )}
          <Text style={styles.senderName}>{message.senderName}</Text>
        </View>
      )}
      <View style={[styles.bubble, isOwn ? styles.bubbleOwn : styles.bubbleOther]}>
        <Text style={[styles.text, isOwn ? styles.textOwn : styles.textOther]}>
          {message.text}
        </Text>
      </View>
      <Text style={[styles.time, isOwn ? styles.timeOwn : styles.timeOther]}>
        {formatMessageTime(message.createdAt)}
        {message.status === "sending" && " ..."}
      </Text>
    </View>
  );
};

const createStyles = (theme: Theme) => ({
  container: {
    marginVertical: 4,
    maxWidth: "80%" as const,
  },
  containerOwn: {
    alignSelf: "flex-end" as const,
  },
  containerOther: {
    alignSelf: "flex-start" as const,
  },
  senderRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    marginBottom: 4,
  },
  senderPhoto: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginRight: 4,
  },
  senderName: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    fontWeight: "500" as const,
  },
  bubble: {
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  bubbleOwn: {
    backgroundColor: theme.colors.accent,
    borderBottomRightRadius: 4,
  },
  bubbleOther: {
    backgroundColor: theme.colors.bgElev1,
    borderBottomLeftRadius: 4,
  },
  text: {
    fontSize: 15,
    lineHeight: 20,
  },
  textOwn: {
    color: "#FFFFFF",
  },
  textOther: {
    color: theme.colors.textPrimary,
  },
  time: {
    fontSize: 11,
    marginTop: 4,
  },
  timeOwn: {
    color: theme.colors.textTertiary,
    textAlign: "right" as const,
  },
  timeOther: {
    color: theme.colors.textTertiary,
  },
});
